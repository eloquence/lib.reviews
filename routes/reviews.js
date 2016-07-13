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
    name: 'review-expand-extra-fields',
    required: false
  }]
};

router.get('/new', function(req, res) {
  maybeRenderReviewForm(req, res);
});

router.post('/new', function(req, res) {
  let formValues = forms.getFormValues(req, formDefs['new']); // For preserving form data on each submission
  maybeRenderReviewForm(req, res, formValues);
});

function maybeRenderReviewForm(req, res, formValues) {
  let errors = req.flash('errors');
  let titleKey = 'write a review';

  if (req.user)
    render.template(req, res, 'new', {
      formValues,
      titleKey,
      errors,
      scripts: ['sisyphus.min.js', 'review.js']
    });
  else
    render.signinRequired(req, res, {
      titleKey
    });
}

module.exports = router;
