/*
 # server.js
 # Server Index
 */

/**
 # Module Dependencies
 */

const chalk = require('chalk');
const ip = require('ip');

const socketIO = require('socket.io');

const routes = require('./routes');
const sockets = require('./sockets');

const config = require('./configs');
const models = require('./models');

/*
 # Server
 */

const server = async () => {
  const environment = config.get('environment');
  const {
    app, port, appName, env,
  } = environment;
  const instance = app.listen(port, async () => {
    // Server Info
    const address = `http://${ip.address()}:${port}`;

    // Add Server and Sockets to Config
    config.add('environment', { server: instance, io: socketIO(instance) });

    // Routes & Sockets
    await routes();
    await sockets();

    // Render Status Logs
    console.log(chalk.bold.underline.green(`\n${appName} Listening on ${port}:\n`));

    console.log(chalk.bold.underline.green('  Addresses:\n'));
    if (env === 'development') console.log(chalk.cyan.bold(`  • http://localhost:${port}`));
    console.log(chalk.cyan.bold(`  • ${address}`));

    console.log(chalk.bold.underline.green('\n  Configs:\n'));
    Object.keys(config).forEach((configKey) => {
      console.log(chalk`  {cyan ${configKey}}`);
      Object.keys(config[configKey]).forEach((k) => {
        const color = config[configKey][k] !== undefined ? 'cyan.bold' : 'dim';
        if (k !== 'apiPublicKeys') console.log(chalk`    • {${color} ${k}}`);
      });
      console.log('\n');
    });

    console.log(chalk.bold.underline.green('\n  Models:\n'));
    Object.keys(models).forEach((key) => {
      console.log(chalk`    • {cyan.bold ${key}}`);
    });

    console.log('\n');
  });

  return instance;
};

/*
 # Module Exports
 */

module.exports = server;
