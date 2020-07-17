'use strict';

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/v3.x/concepts/configurations.html#cron-tasks
 */

module.exports = {
  /**
   * Simple example.
   * Every monday at 1am.
   */
  // '0 1 * * 1': () => {
  //
  // }
  // '* * * * * ': async () => {
  //   console.log('Cron every second')

  //   try {
  //     await strapi.plugins['email'].services.email.send({
  //       to: 'papershack@gmail.com',
  //       subject: 'strapi test',
  //       text: 'Hello world!',
  //       html: 'Hello world!',
  //     });
  //   } catch(err) {
  //     console.log('Exception in sending err', err)
  //   }
  // }
};
