'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');

// Internal dependencies
const db = require('../db');
const r = db.r;
const render = require('./helpers/render');
const forms = require('./helpers/forms');
const flashError = require('./helpers/flash-error');
const ErrorMessage = require('../util/error.js');
const Review = require('../models/review.js');
const ReviewFormHandler = require('./handlers/review-form-handler');
const reviewHandlers = require('./handlers/review-handlers');
const mlString = require('../models/helpers/ml-string.js');
const prettifyURL = require('../util/url-normalizer').prettify;

router.get('/feed', reviewHandlers.feed);
router.get('/review/:id', reviewHandlers.view);
router.get('/review/:id/delete', function(req, res, next) {
  let reviewForm = new ReviewFormHandler({
    req,
    res,
    next,
    type: 'delete',
    reviewID: req.params.id.trim()
  });
  reviewForm.handleRequest();
});

router.post('/review/:id/delete', function(req, res, next) {
  let reviewForm = new ReviewFormHandler({
    req,
    res,
    next,
    type: 'delete',
    submitted: true,
    reviewID: req.params.id.trim()
  });
  reviewForm.handleRequest();
});

router.get('/review/:id/edit', function(req, res, next) {
  let reviewForm = new ReviewFormHandler({
    req,
    res,
    next,
    type: 'edit',
    reviewID: req.params.id.trim()
  });
  reviewForm.handleRequest();
});

router.post('/review/:id/edit', function(req, res, next) {
  let reviewID = req.params.id.trim();
  let reviewForm = new ReviewFormHandler({
    req,
    res,
    next,
    type: 'edit',
    reviewID: req.params.id.trim(),
    submitted: true,
    isPreview: req.body['review-action'] == 'preview'
  });
  reviewForm.handleRequest();
});

router.get('/new/review', function(req, res, next) {
  let reviewForm = new ReviewFormHandler({
    req,
    res,
    next
  });
  reviewForm.handleRequest();
});

router.post('/new/review', function(req, res, next) {
  let reviewForm = new ReviewFormHandler({
    req,
    res,
    next,
    submitted: true,
    isPreview: req.body['review-action'] == 'preview'
  });
  reviewForm.handleRequest();
});

router.get('/new', (req, res) => {
  res.redirect('/new/review');
});


module.exports = router;
