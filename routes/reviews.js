'use strict';

// External dependencies
// const express = require('express');
// const router = express.Router();
const escapeHTML = require('escape-html');

// Internal dependencies
const db = require('../db');
const r = db.r;
const render = require('./helpers/render');
const forms = require('./helpers/forms');
const flashError = require('./helpers/flash-error');
const ErrorMessage = require('../util/error.js');
const Review = require('../models/review.js');
const ReviewProvider = require('./handlers/review-provider');
const reviewHandlers = require('./handlers/review-handlers');
const mlString = require('../models/helpers/ml-string.js');
const prettifyURL = require('../util/url-utils').prettify;

// Standard routes

let router = ReviewProvider.bakeRoutes('review');

// Additional routes

router.get('/', reviewHandlers.getFeedHandler({
  template: 'index',
  titleKey: 'welcome',
  deferPageHeader: true,
  onlyTrusted: true
}));

router.get('/feed', reviewHandlers.getFeedHandler());

router.get('/new', (req, res) => {
  res.redirect('/new/review');
});


module.exports = router;
