'use strict';
const Thinky = require('thinky');
const thinky = Thinky({
  host: 'localhost',
  port: 28015,
  db: 'libreviews'
});
module.exports = thinky;
