#!/usr/bin/env node

'use strict';

const r = require('rethinkdb');

/**
 * Module dependencies.
 */

const app = require('../app');
const debug = require('../util/debug');
const createServer = require('auto-sni'); // Server with Let's Encrypt support
const config = require('config');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || config.get('defaultPort'));
app.set('port', port);

/**
 * Create HTTP server.
 */
var server = createServer({
  email: config.adminEmail,
  agreeTos: true,
  domains: config.httpsDomains,
  debug: app.get('env') == 'production' ? false : true,
  forceSSL: app.get('env') == 'production' ? true : false,
  ports: {
    http: port,
    https: config.httpsPort
  }
}, app);

/**
 * Listen on provided port, on all network interfaces.
 */
//server.listen(port);
server.on('error', onError);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}
