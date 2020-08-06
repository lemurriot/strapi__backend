"use strict";
const { sanitizeEntity } = require("strapi-utils");
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const fetch = require("node-fetch");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  setUpStripe: async (ctx) => {
    try {
      // stripe total is in cents
      const validatedCart = [];
      /*
        Through ctx.request.body we will receive the products & qty
      */
      const { cart } = ctx.request.body;

      await Promise.all(
        cart.map(async (product) => {
          const validatedProduct = await strapi.services[
            "package-item"
          ].findOne({
            id: product.id,
          });
          if (validatedProduct) {
            validatedProduct.qty = product.qty;
            const { id, price, title, qty } = validatedProduct;
            validatedCart.push({ id, title, price, qty });
          } else {
            throw new Error("Cart contains an invalid item");
          }
          return validatedProduct;
        })
      );
      // remember Stripe payments take cents, so multiply by 100
      const total =
        validatedCart.reduce(
          (accumulator, item) => item.qty * item.price + accumulator,
          0
        ) * 100;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: total,
          currency: "usd",
          // Verify your integration in this guide by including this parameter
          metadata: { cart: JSON.stringify(validatedCart) },
        });
        return paymentIntent;
      } catch (err) {
        return { error: err.raw.message };
      }
    } catch (err) {
      return { error: err.message };
    }
  },
  create: async (ctx) => {
    const { paymentIntent, name, email, cart } = ctx.request.body;
    let paymentInfo;
    // payment intent for validation
    try {
      paymentInfo = await stripe.paymentIntents.retrieve(paymentIntent.id);
      if (paymentInfo.status !== "succeeded") {
        throw { message: "Payment was not successfully collected" };
      }
    } catch (err) {
      // return status to client
      ctx.response.status = 402;
      return { error: err.message };
    }

    // check paymentIntent was not already used to generate an order
    const alreadyExistingOrder = await strapi.services.order.find({
      orderId: paymentIntent.id,
    });
    if (alreadyExistingOrder && alreadyExistingOrder.length) {
      ctx.response.status = 402;
      return { error: "This payment intent was already used" };
    }

    const product_qty = [];
    const products = [];
    let sanitizedCart = [];

    await Promise.all(
      cart.map(async (product) => {
        const foundProduct = await strapi.services["package-item"].findOne({
          id: product.id,
        });
        if (foundProduct) {
          product_qty.push({ id: product.id, qty: product.qty });
          products.push(foundProduct);
          sanitizedCart.push({ ...foundProduct, ...{ qty: product.qty } });
        }
        return foundProduct;
      })
    );
    let total_in_dollars = sanitizedCart.reduce(
      (accumulator, item) => item.qty * item.price + accumulator,
      0
    );
    // check payment amt is consistent (stripe payments are in cents)
    if (paymentInfo.amount !== total_in_dollars * 100) {
      ctx.response.status = 402;
      return { error: "The total to be paid is different from Payment Intent" };
    }

    const entry = {
      orderId: paymentIntent && paymentIntent.id,
      user_name: name,
      user_email: email,
      product_qty,
      products,
      total_in_dollars,
      date_created: Date.now(),
    };
    const entity = await strapi.services.order.create(entry);
    const order_id = `${entity.id}-${entity.orderId.substring(
      entity.orderId.length - 5
    )}`;
    const orderItems = sanitizedCart.map(({ title, price, qty }) => ({
      title,
      price,
      qty,
    }));

    try {
      fetch(
        "https://api.sendgrid.com/v3/mail/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          // prettier-ignore
          body: JSON.stringify({
            "from":{
              "email":"admin@dharmicastrology.com"
           },
           "personalizations":[
              {
                 "to":[
                    {
                       "email":email
                    }
                 ],
                 "dynamic_template_data":{
                    "total_in_dollars":total_in_dollars,
                    "items":orderItems,
                    "name":name,
                    "orderId":order_id
                  }
              }
           ],
           "template_id":"d-cc775f0c80034863bec255b8f6d779cf"
          })
        }
      );
    } catch (err) {
      console.log("Exception in sending err", err);
    }

    // finally return data to client
    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};

stripe.paymentIntents.retrieve();
