'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./helpers/render');
const forms = require('./helpers/forms');

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

router.get('/new', function(req, res) {
  maybeRenderReviewForm(req, res);
});

router.post('/new', function(req, res) {
  let formInfo = forms.parseSubmission(req, formDefs['new']);
  maybeRenderReviewForm(req, res, formInfo);
});

function maybeRenderReviewForm(req, res, formInfo) {
  let errors = req.flash('errors');
  let titleKey = 'write a review';
  if (!formInfo)
    formInfo = {};

  if (req.user)
    if (!formInfo.hasRequiredFields || formInfo.hasExtraFields)
      render.template(req, res, 'new', {
        formValues: formInfo.formValues,
        titleKey,
        errors,
        scripts: ['sisyphus.min.js', 'review.js']
      });
    else
      res.redirect('/');
  else
    render.signinRequired(req, res, {
      titleKey
    });
}

module.exports = router;
