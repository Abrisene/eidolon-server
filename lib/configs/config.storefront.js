/*
 # config.storefront.js
 # Storefront Config
 */

/**
 # Module Dependencies
 */

const Stripe = require('stripe');
const { jsonTryParse } = require('../common');

/**
 # Configuration Methods
 */

const getStripe = () => {
  const s = jsonTryParse(process.env.STRIPE);
  const client = (s && s.secretKey && s.publicKey) ? new Stripe(s.secretKey) : undefined;
  return client ? { ...s, client } : undefined;
};

const getConfig = async () => ({
  stripe: getStripe(),
});

/**
 # Module Exports
 */

module.exports = getConfig;
