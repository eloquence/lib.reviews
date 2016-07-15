'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const md = require('markdown-it')({
  linkify: true,
  breaks: true
});
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
  let isPreview = req.body['review-action'] == 'preview' ? true : false;
  if (isPreview) {
    formInfo.preview = getPreview(req);
  }
  maybeRenderReviewForm(req, res, formInfo, isPreview);
});


function maybeRenderReviewForm(req, res, formInfo, isPreview) {
  let errors = req.flash('errors');
  let titleKey = 'write a review';
  if (!formInfo)
    formInfo = {};

  if (req.user)
    if (isPreview || !formInfo.hasRequiredFields || formInfo.hasExtraFields)
      render.template(req, res, 'new', {
        formValues: formInfo.formValues,
        titleKey,
        errors: !isPreview ? errors : undefined,
        isPreview,
        preview: formInfo.preview,
        scripts: ['sisyphus.min.js', 'markdown-it.min.js', 'review.js']
      });
    else
      // Save logic TK
      res.redirect('/');
  else
    render.signinRequired(req, res, {
      titleKey
    });
}

function getPreview(req) {
  let preview = {};
  // Values are escaped in the template, with the exception of review text,
  // which is escaped by markdown parser
  preview['review-title'] = req.body['review-title'];
  preview['review-url'] = req.body['review-url'];
  preview['review-url-text'] = prettifyURL(req.body['review-url']);
  preview['review-text'] = md.render(req.body['review-text']);
  let rating = Number(req.body['review-rating']);
  // FIXME - move into Handlebars partial?
  preview['review-rating'] =
    `<img src="/static/img/star-${rating}-full.svg" width="20" class="preview-star-full">`
    .repeat(rating);
  preview['review-date'] = new Date().toLocaleString(req.locale);
  return preview;

  function prettifyURL(url) {
    return url
      .replace(/^.*?:\/\//, '') // strip protocol
      .replace(/\/$/, ''); // remove trailing slashes for display only
  }

}

module.exports = router;
