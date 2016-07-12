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

router.get('/new', function(req, res) {
  let titleKey = 'write a review';
  if (req.user)
    render.template(req, res, 'new', {
      titleKey,
      scripts: ['sisyphus.min.js', 'review.js']
    });
  else
    render.signinRequired(req, res, {
      titleKey
    });
});

module.exports = router;
