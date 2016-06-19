'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./render');

// Homepage
router.get('/', function(req, res) {
  render(req, res, 'index', { titleKey: 'welcome', messages: req.flash('messages') } );
});


module.exports = router;
