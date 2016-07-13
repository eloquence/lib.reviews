'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./render');


router.get('/new', function(req, res) {
  maybeRenderReviewForm(req, res);
});

router.post('/new', function(req, res) {
  let formDef = [{
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
  }];

  let formValues = {}; // For preserving form data on each submission

  for (let field of formDef) {
    if (!req.body[field.name] && field.required)
      req.flash('errors', res.__(`need ${field.name}`));
    if (req.body[field.name] && !field.radioMap)
      formValues[field.name] = req.body[field.name];
    if (req.body[field.name] && field.radioMap) {
      formValues[field.name] = {};
      formValues[field.name].value = req.body[field.name];
      formValues[field.name][req.body[field.name]] = true;
    }
  }
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
