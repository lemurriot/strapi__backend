"use strict";
const { sanitizeEntity } = require("strapi-utils");
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);

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
      date_created: paymentIntent ? paymentIntent.created : Date.now(),
    };

    const entity = await strapi.services.order.create(entry);
    const order_id = `${entity.id}-${entity.orderId.substring(
      entity.orderId.length - 5
    )}`;
    const table_style =
      "border-radius: 3px;";
    const order_table = sanitizedCart
      .map(
        (item) =>
          `<tr>
        <td style=${table_style}>${item.title}</td>
        <td style=${table_style}>${item.price}.00</td>
        <td style=${table_style}>${item.qty}</td>
        </tr>`
      )
      .join("");

    // Send confirmation email to purchaser
    try {
      await strapi.plugins["email"].services.email.send({
        to: email,
        bcc: "dharmic.astrologicalsystems@gmail.com",
        subject: "Thank you for your order",
        text: `Thank you for your order. Your order is number ${order_id}. Someone will be in touch within three business days to schedule an appointment. Please reply to this email with any questions.`,
        html: `<h4>Hello ${name},</h4>
          <p>We thank you for your recent order.</p>
          <table width="600" style="border-top: 1px solid grey; border-bottom: 1px solid grey">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom: .5px solid grey">Order</th>
                <th style="text-align:left; border-bottom: .5px solid grey">Cost (each)</th>
                <th style="text-align:left; border-bottom: .5px solid grey">Qty</th>
              </tr>
            </thead>
            <tbody>
                ${order_table}
            </tbody>
          </table>
          <span style="text-align:right; margin-top: 10px">Total: $${entity.total_in_dollars}.00</span>
          <p>Your order number is ${order_id}</p>
          <p>Someone will be in touch soon to schedule your appointment. Please reach out to us at dharmic.astrologicalsystems@gmail.com if you do not hear from us within three business days.</p>
          <div>Sincerely,</div>
          <div>Dharmic Astrology</div>
          <a href="https://www.dharmicastrology.com">www.dharmicastrology.com</a>
        `,
      });
    } catch (err) {
      console.log("Exception in sending err", err);
    }

    // finally return data to client
    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};

stripe.paymentIntents.retrieve();
