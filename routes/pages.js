'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./render');

// Homepage
router.get('/terms', function(req, res) {
  render.template(req, res, `multilingual/terms-${req.locale}`, { titleKey: 'terms' } );
});

module.exports = router;
