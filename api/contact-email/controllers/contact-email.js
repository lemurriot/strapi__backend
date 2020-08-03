"use strict";
const fetch = require("node-fetch");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  create: async (ctx) => {
    const { user_email } = ctx.request.body;
    const putEmailSendgrid = await fetch(
      "https://api.sendgrid.com/v3/marketing/contacts",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        // prettier-ignore
        body: JSON.stringify({"contacts": [ { "email": user_email } ]})
      }
    );
    ctx.response.status = putEmailSendgrid.status;
    ctx.response.message = putEmailSendgrid.statusText;
    return ctx.response;
  },
};
