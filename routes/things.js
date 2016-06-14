'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./render');

// locale names and message keys

/* GET home page. */
router.get('/', function(req, res) {
  render(req, res, 'index');
});


module.exports = router;
