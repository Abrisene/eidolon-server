/*
 # config.messaging.js
 # Messaging Config
 */

/**
 # Module Dependencies
 */

const chalk = require('chalk');

const PubNub = require('pubnub');
const Ably = require('ably');
const mailgun = require('mailgun.js');
const Twilio = require('twilio');
const { jsonTryParse } = require('../common');

/**
 # Configuration Methods
 */

const getPubNub = () => {
  const p = jsonTryParse(process.env.PUBNUB);
  const client = (p && p.subscribeKey) ? new PubNub(p) : undefined;
  return client ? { ...p, client } : undefined;
};

const getAbly = () => {
  const a = jsonTryParse(process.env.ABLY);
  const client = (a && a.serverKey) ? new Ably.Realtime(a.serverKey) : undefined;
  if (client) client.connection.on('connected', () => console.log(chalk.magenta.bold('>> Ably Client Connected <<')));
  if (client) client.connection.on('failed', () => console.log(chalk.red.bold('>> Ably Client Connection Failed <<')));
  return client ? { ...a, client } : undefined;
};

const getMailgun = () => {
  const m = jsonTryParse(process.env.MAILGUN);
  const client = (m && m.key) ? mailgun.client({ ...m, username: 'api' }) : undefined;
  return client ? { ...m, client } : undefined;
};

const getTwilio = () => {
  const t = jsonTryParse(process.env.TWILIO);
  const client = (t && t.account && t.key) ? new Twilio(t.account, t.key) : undefined;
  return client ? { ...t, client } : undefined;
};

const getConfig = async () => ({
  pubnub: getPubNub(),
  ably: getAbly(),
  mailgun: getMailgun(),
  twilio: getTwilio(),
});

/**
 # Module Exports
 */

module.exports = getConfig;
