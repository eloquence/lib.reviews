#!/usr/bin/env node

'use strict';

// pm2 sets the NODE_APP_INSTANCE variable in cluster mode, which config
// also uses for instance-specific configuration, and throws warnings when
// it doesn't find them. For this reason we temporarily change the value
// before loading the config, _unless_ it is set to 'testing', which is
// used for test-specific configurations. If we ever actually want
// instance-specific configs in cluster mode, we can remove this.
let instance = process.env.NODE_APP_INSTANCE;

if (instance && !/^testing/.test(instance))
  Reflect.deleteProperty(process.env, 'NODE_APP_INSTANCE');

const config = require('config');

if (instance)
  process.env.NODE_APP_INSTANCE = instance;

const getApp = require('../app');
const getDB = require('../db').getDB;
const createServer = require('auto-sni'); // Server with Let's Encrypt support

async function runWebsite() {
  const db = await getDB();
  const app = await getApp(db);

  /**
   * Get port from environment and store in Express.
   */
  const port = normalizePort(process.env.PORT || config.get('defaultPort'));
  app.set('port', port);

  /**
   * Create HTTP(S) server.
   */
  const server = createServer({
    email: config.adminEmail,
    agreeTos: true,
    domains: config.httpsDomains,
    // Debug setting for Let's Encrypt certificates.
    debug: config.stageHTTPS,
    forceSSL: config.forceHTTPS,
    ports: {
      http: port,
      https: config.httpsPort
    }
  }, app);

  server.on('error', onError);
}

runWebsite().catch(error => {
  console.error('Could not start lib.reviews web service. An error occurred:');
  console.error(error.stack);
  process.exit(1);
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port))
    return val; // named pipe

  if (port >= 0)
    return port; // port number

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`Port ${error.port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`Port ${error.port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}
