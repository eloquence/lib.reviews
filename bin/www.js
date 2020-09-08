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
const {
  createServer
} = require('http');
const {
  pathToFileURL
} = require('url');
const path = require('path')
const greenlock = require('greenlock-express')

async function runWebsite() {
  const db = await getDB();
  const app = await getApp(db);
  const port = normalizePort(process.env.PORT || config.get('devPort'));

  if (app.get('env') == 'production') {
    greenlock.init({
      packageRoot: path.join(__dirname, '..'),

      // contact for security and critical bug notices
      maintainerEmail: config.get('adminEmail'),

      // where to look for configuration
      configDir: path.join(__dirname, '../config/greenlock'),

      // whether or not to run at cloudscale
      cluster: false
    }).serve(app)
  } else {
    app.set('port', port);
    app.listen(port, '127.0.0.1').on('error', onError);
  }
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