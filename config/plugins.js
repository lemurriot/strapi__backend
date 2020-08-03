module.exports = ({ env }) => ({
  upload: {
    provider: "cloudinary",
    providerOptions: {
      cloud_name: env('CLOUDINARY_NAME'),
      api_key: env('CLOUDINARY_KEY'),
      api_secret: env('CLOUDINARY_SECRET')
    }
  },
  email: {
    provider: 'sendgrid',
    providerOptions: {
      apiKey: env('SENDGRID_API_KEY'),
    },
    settings: {
      defaultFrom: env('SENDGRID_DEFAULT_FROM', 'developer@strapi.io'),
      defaultReplyTo: env('SENDGRID_DEFAULT_REPLY_TO', 'developer@strapi.io'),
    },
  },
});
