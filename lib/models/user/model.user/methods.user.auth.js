/*
 # model.user.js
 # User Mongoose Model
 */

/**
 # Module Dependencies
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');

const config = require('../../../configs');
const constants = require('../../../constants');

const { mail } = require('../../../modules');
const mailTemplates = require('../../../mail');

const {
  generateEmailValidationEmail,
  generatePasswordResetEmail,
} = mailTemplates.user;

/*
 # Critical Variables
 */

const constUser = constants.user;

/*
 # Utility Methods
 */

const generateJWT = (id) => {
  const auth = config.get('authentication');
  const secret = auth.jwt.secretOrKey;
  const options = {
    expiresIn: auth.jwt.expiration,
    issuer: auth.jwt.issuer,
    audience: auth.jwt.audience,
    subject: id.toString(),
  };

  const token = jwt.sign({}, secret, options);
  return token;
};


/*
 # Schema
 */

const schema = { methods: {}, statics: {} };

/*
 # Middleware
 */

/**
 # Schema Methods
 */

schema.methods.authenticatePassword = async function (password) {
  let result;
  try {
    return bcrypt.compareSync(password, this.hash);
  } catch (err) {
    // console.error(err);
    return result;
  }
};


// TODO: BETTER SUPPORT FOR BROADER USE CASES - CREATE NEW PASSWORD, NOT JUST
// CHANGE EXISTING.

/* schema.methods.setPassword = async function(newPassword, oldPassword) {
  let result;
  try {
    // If we have a password already, we need to confirm that the old one matches.
    if (this.hash) {
      const authenticated = await this.authenticatePassword(oldPassword);
      if (!authenticated) throw new Error('Old password does not match.');
    }
    this.hash = await this.hashPassword(newPassword);
    await this.save();
    result = true;

    return result;
  } catch (err) {
    console.error(err);
    return result;
  }
}; */

schema.methods.generateJWT = function () {
  return generateJWT(this._id);
};

// Consider whether to treat customer like any other identity.
/* schema.methods.getCustomer = async function (email, source) {
  let result;
  try {
    const storefront = config.get('storefront');
    const { client } = storefront.stripe;
    let customer;

    if (this.customerIds.stripe) {
      customer = await client.customers.retrieve(this.customerIds.stripe);
      if (!customer) throw new Error('Could not retrieve customer.');
    } else {
      customer = await client.customers.create({ email, source });
      if (!customer) throw new Error('Could not create customer.');
      this.customerIds.stripe = customer.id;

      // >>>>> TODO: ADD NEW IDENTITY FOR CUSTOMER / EMAIL

      await this.save();
    }
    result = customer;
    return result;
  } catch (err) {
    // console.error(err);
    return result;
  }
}; */

/**
 # Static Schema Methods
 */

schema.statics.hashPassword = async function (password) {
  try {
    return bcrypt.hashSync(password);
  } catch (err) {
    // console.error(err);
    return err;
  }
};

schema.statics.requestPasswordReset = async function (email) {
  const result = {};
  try {
    // const User = this;
    const Identity = this.db.model('Identity');

    if (!email) throw new Error('Cannot request password reset: No email defined.');

    const identity = await Identity.findIdentity('email', email);
    if (!identity) throw new Error('Cannot request password reset: Identity not found.');

    /*

        >>>>> TODO: INVALIDATE EXISTING PASSWORD RESET TOKENS

     */

    const token = await identity.generateToken(constUser.token.resetPassword);
    if (!token) throw new Error('Cannot request password reset: Could not generate Token.');

    const emailTemplate = await generatePasswordResetEmail({ to: [identity.key], token: token.token });
    await mail.send(emailTemplate);

    result.success = true;
    result.status = 'success';

    return result;
  } catch (err) {
    // console.error(err);
    result.err = err;
    return result;
  }
};

schema.statics.setPasswordWithToken = async function (tokenHash, password) {
  let result = {};
  try {
    const User = this;
    const Token = this.db.model('Token');
    const Identity = this.db.model('Identity');

    if (!password) throw new Error('No password set for password reset.');

    const token = await Token.findOne({ token: tokenHash });
    if (!token) throw new Error(`Could not find token ${tokenHash}.`);
    if (!token.type === constUser.token.resetPassword) throw new Error(`Token ${token} (${token.type}) cannot be used to reset password.`);

    const identity = await Identity.findOne({ _id: token.ownerId });
    if (!identity) throw new Error(`Could not find identity for token ${token}.`);

    const user = await identity.getUser();
    if (!user) throw new Error(`Could not find User for token ${token}.`);

    const redeemed = await token.redeem();
    if (redeemed.err) throw redeemed.err;
    if (!redeemed.success) throw new Error(`Could not redeem token ${token}`);

    const hash = await User.hashPassword(password);
    user.hash = hash;

    await user.save();

    result = redeemed;
    return result;
  } catch (err) {
    // console.error(err);
    result.err = err;
    return result;
  }
};

schema.statics.authenticateEmail = async function (email, password, register = false) {
  const result = {};
  try {
    const User = this;
    const Identity = this.db.model('Identity');

    if (!email) throw new Error('Cannot authenticate email, no email defined.');
    if (!password) throw new Error('Cannot authenticate email, no password defined.');

    const ts = Date.now();
    let identity = await Identity.findIdentity('email', email);
    let user;

    if (identity) { // Login Flow >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
      user = await identity.getUser();
      if (!user) throw new Error(`User not found for Identity ${identity._id}.`);
      if (!user.hash) throw new Error(`User ${user._id} does not support Email Login.`);
      // ^ THIS SHOULD TRIGGER RESET PASSWORD PROCESS TO SET PASSWORD.

      const authenticated = await user.authenticatePassword(password);
      if (authenticated !== true) throw new Error(`Could not authenticate Email Login for ${email}`);

      user.tsLogin.push(ts);
      identity.tsAccessed = ts;

      await user.save();
      await identity.save();

      result.user = user;
      result.identity = identity;
      result.authenticated = authenticated;
    } else if (register) { // Registration Flow >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
      const hash = await User.hashPassword(password);

      user = new User({ email, hash, tsLogin: [ts] });
      identity = new Identity({
        ownerId: user._id,
        type: 'email',
        key: email,
        source: 'user',
        email,
        tsAccessed: ts,
      });

      await user.linkIdentity(identity);
      await user.save();
      await identity.save();

      const token = await identity.generateToken(constUser.token.validateIdentity, 86400 * 7);
      if (!token) throw new Error('Cannot request password reset: Could not generate Token.');

      const emailTemplate = await generateEmailValidationEmail({ to: [identity.key], token: token.token });
      await mail.send(emailTemplate);

      result.user = user;
      result.identity = identity;
      result.token = token;
      result.authenticated = true;
    } else {
      throw new Error(`Identity not found for ${email}`);
    }
    return result;
  } catch (err) {
    // console.error(err);
    result.err = err;
    return result;
  }
};

schema.statics.authenticateSocial = async function (type, profile) {
  const result = {};
  try {
    const User = this;
    const Identity = this.db.model('Identity');

    const { id } = profile;
    const ts = Date.now();
    let socialIdentity = await Identity.findIdentity(type, id);
    let emailIdentity;
    let user;

    // If the socialIdentity exists, login, otherwise register.
    if (socialIdentity) { // Login Flow >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
      console.log('TODO: CHECK FOR SOCIAL PROFILE UPDATES');
      /*


          >>>>> TODO: CHECK IF PROFILE DATA HAS CHANGED
          >>>>> WHAT IF THERE IS A COLLISION WITH EXISTING?


       */

      // Get the user attached to the socialIdentity and return credentials.
      user = await socialIdentity.getUser();
      if (!user) throw new Error(`User not found for Identity ${socialIdentity._id}.`);

      user.tsLogin.push(ts);
      socialIdentity.tsAccessed = ts;

      await user.save();
      await socialIdentity.save();

      result.user = user;
      result.identity = socialIdentity;
      result.authenticated = true;
    } else { // Registration Flow >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
      // Does an Identtiy exist with the email address?
      const identities = await Identity.findIdentitiesByEmail(profile.email);
      let currentIdentity;

      // See if we have an valid identity to link to.
      if (identities.length > 0) {
        identities.some((i) => {
          const linkable = i.tsValidated;
          if (linkable) currentIdentity = i;
          return linkable;
        });
      }

      // If we found a valid identity to link, use that instead.
      if (currentIdentity) {
        user = await currentIdentity.getUser();
        user.tsLogin.push(ts);
      } else {
        user = new User({ email: profile.email, tsLogin: [ts] });
      }

      // Create identity for social account.
      socialIdentity = new Identity({
        ownerId: user._id,
        type,
        key: id,
        source: 'user',
        email: profile.email,
        displayName: profile.displayName,
        gender: profile.gender,
        metadata: profile.metadata,
        tsValidated: ts,
        tsAccessed: ts,
      });

      // Create identity for social email.
      emailIdentity = new Identity({
        ownerId: user._id,
        type: 'email',
        key: profile.email,
        source: type,
        email: profile.email,
        tsValidated: ts,
      });

      await user.linkIdentity(socialIdentity);
      await user.linkIdentity(emailIdentity);
      await user.save();
      await socialIdentity.save();
      await emailIdentity.save();

      result.user = user;
      result.identity = socialIdentity;
      result.authenticated = true;
    }
    return result;
  } catch (err) {
    // console.error(err);
    result.err = err;
    return result;
  }
};

/**
 # Module Exports
 */

module.exports = schema;
