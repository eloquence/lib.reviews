'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./render');

// Homepage
router.get('/', function(req, res) {
  render.template(req, res, 'index', {
    titleKey: 'welcome',
    messages: req.flash('messages')
  });
});

router.get('/terms', function(req, res) {
  render.template(req, res, `multilingual/terms-${req.locale}`, {
    longText: true,
    titleKey: 'terms',
    scripts: ['long-text.js']

  });
});

module.exports = router;
