/*
 # models/index.js
 # Model Index
 */

/*
 # Module Dependencies
 */

const User = require('./user/model.user/model.user.schema');
const Identity = require('./user/model.identity');

const Token = require('./authentication/model.token');

const Product = require('./storefront/model.product');
const Sku = require('./storefront/model.sku');
const Order = require('./storefront/model.order');

// const Plan = require('./storefront/model.plan');

/*
 # Critical Variables
 */


/*
 # Module Exports
 */

module.exports = {
  User,
  Identity,
  Token,

  Product,
  Sku,
  Order,
};
