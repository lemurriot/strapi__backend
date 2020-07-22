"use strict";
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
            throw new Error('Cart contains an invalid item');
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
};
