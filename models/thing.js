'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const ErrorMessage = require('../util/error.js');

let Thing = thinky.createModel("things", {
  id: type.string(),
  urls: [type.string()],
  type: type.string()
});

module.exports = Thing;
