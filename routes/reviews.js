'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');
const md = require('markdown-it')({
  linkify: true,
  breaks: true,
  typographer: true
});

// Internal dependencies
const db = require('../db');
const r = db.r;
const render = require('./helpers/render');
const forms = require('./helpers/forms');
const flashError = require('./helpers/flash-error');
const ErrorMessage = require('../util/error.js');
const Review = require('../models/review.js');

// Form definitions for these routes
const formDefs = {
  'new': [{
    name: 'review-url',
    required: true
  }, {
    name: 'review-title',
    required: true,
  }, {
    name: 'review-text',
    required: true
  }, {
    name: 'review-rating',
    required: true,
    radioMap: true
  }, {
    name: 'review-language',
    required: false,
    radioMap: true
  }, {
    name: 'review-expand-extra-fields', // Cosmetic, not saved
    required: false
  }, {
    name: 'review-action', // Logic, not saved
    required: true
  }]
};

router.get('/feed', function(req, res) {
  Review.orderBy({
    index: r.desc('datePosted')
  }).limit(10).getJoin({
    thing: true
  }).getJoin({
    reviewer: {
      _apply: seq => seq.without('password')
    }
  }).then(feedItems => {
    render.template(req, res, 'feed', {
      titleKey: 'feed',
      feedItems
    });
  });
});

router.get('/new', function(req, res) {
  // Encourage easy creation of reviews with default redirect
  res.redirect('/new/review');
});

router.get('/new/review', function(req, res) {
  sendReviewFormResponse(req, res);
});

router.post('/new/review', function(req, res) {
  let formInfo = forms.parseSubmission({
    req,
    formDef: formDefs['new'],
    formKey: 'new'
  });
  let isPreview = req.body['review-action'] == 'preview' ? true : false;
  if (isPreview) {
    formInfo.preview = getPreview(req);
  }
  sendReviewFormResponse(req, res, formInfo, isPreview);
});

function sendReviewFormResponse(req, res, formInfo, isPreview) {
  let errors = req.flash('errors');
  let titleKey = 'write a review';
  let context = 'review form';
  if (req.user)
  // GET requests or incomplete POST requests
    if (!formInfo || isPreview || errors.length)
      render.template(req, res, 'new-review', {
        formValues: formInfo ? formInfo.formValues : undefined,
        titleKey,
        errors: !isPreview ? errors : undefined,
        isPreview,
        preview: formInfo ? formInfo.preview : undefined,
        scripts: ['sisyphus.min.js', 'markdown-it.min.js', 'review.js']
      });
    else if (req.method == 'POST') {
    let reviewObj = getReviewObj(req);
    Review.create(reviewObj).then(review => {
      let id = review.id || '';
      res.redirect(`/feed#review-${id}`);
    }).catch(errorMessage => {
      flashError(req, errorMessage, context);
      sendReviewFormResponse(req, res, formInfo, isPreview);
    });
  } else if (req.method !== 'POST' && req.method !== 'GET') {
    flashError(req, new ErrorMessage('unsupported method'), context);
    res.redirect('/new');
  } else {
    flashError(req, null, context);
    res.redirect('/new');
  } else
    render.signinRequired(req, res, {
      titleKey
    });
}

function getReviewObj(req) {
  let reviewObj = {};
  reviewObj.reviewerID = req.user.id;
  reviewObj.title = escapeHTML(req.body['review-title']);
  reviewObj.text = escapeHTML(req.body['review-text']);
  reviewObj.url = encodeURI(req.body['review-url']);
  reviewObj.html = md.render(req.body['review-text']);
  reviewObj.datePosted = new Date();
  reviewObj.starRating = Number(req.body['review-rating']);
  reviewObj.language = escapeHTML(req.body['review-language']);
  return reviewObj;
}

function getPreview(req) {
  let preview = {};
  // Values are escaped in the template, with the exception of review text,
  // which is escaped by markdown parser
  preview['review-title'] = req.body['review-title'];
  preview['review-url'] = req.body['review-url'];
  preview['review-url-text'] = prettifyURL(req.body['review-url']);
  preview['review-text'] = md.render(req.body['review-text']);
  preview['review-rating'] = Number(req.body['review-rating']);
  preview['review-date'] = new Date().toLocaleString(req.locale);
  return preview;

  function prettifyURL(url) {
    return url
      .replace(/^.*?:\/\//, '') // strip protocol
      .replace(/\/$/, ''); // remove trailing slashes for display only
  }

}

module.exports = router;