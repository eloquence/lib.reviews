'use strict';
const Thinky = require('thinky');
const config = require('config');
const debug = require('./util/debug');
const thinky = Thinky({
    servers: config.dbServers,
    db: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    silent: true
  });
thinky.r.getPoolMaster().on('log', debug.db);

module.exports = thinky;
