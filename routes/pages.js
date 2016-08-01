'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./helpers/render');

router.get('/terms', function(req, res) {
  render.template(req, res, `multilingual/terms-${req.locale}`, {
    deferPageHeader: true,
    titleKey: 'terms'
  });
});

module.exports = router;
