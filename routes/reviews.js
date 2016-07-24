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
const mlString = require('../models/ml-string.js');

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
    radioMap: false
  }, {
    name: 'review-expand-extra-fields', // Cosmetic, not saved
    required: false
  }, {
    name: 'review-action', // Logic, not saved
    required: true
  }],
  'delete': [{
    name: 'delete-action',
    required: true,
  }, {
    name: 'delete-thing',
    required: false
  }]
};

router.get('/feed', function(req, res, next) {
  Review
    .orderBy({
      index: r.desc('createdAt')
    })
    .filter(r.row('_revDeleted').eq(false), {  // Exclude deleted rows
      default: true
    })
    .filter(r.row('_revOf').eq(false), { // Exclude old versions
      default: true
    })
    .limit(10)
    .getJoin({
      thing: true
    })
    .getJoin({
      creator: {
        _apply: seq => seq.without('password')
      }
    })
    .then(feedItems => {
      for (let item of feedItems) {
        item.populateUserInfo(req.user);
        if (item.thing) {
          item.thing.populateUserInfo(req.user);
        }
      }
      render.template(req, res, 'feed', {
        titleKey: 'feed',
        feedItems
      });
    })
    .catch(error => {
      next(error);
    });
});

router.get('/review/:id', function(req, res, next) {
  let id = req.params.id.trim();

  Review.getWithData(id).then(review => {
      if (review._revDeleted)
        return sendReviewNotFound(req, res, id);
      review.thing.populateUserInfo(req.user);
      review.populateUserInfo(req.user);
      sendReview(req, res, review);
    })
    .catch(getReviewNotFoundHandler(req, res, next, id));
});

router.get('/review/:id/delete', function(req, res, next) {
  let id = req.params.id.trim();
  Review.getWithData(id).then(review => {
    if (review._revDeleted)
      return sendReviewNotFound(req, res, id);
    review.thing.populateUserInfo(req.user);
    review.populateUserInfo(req.user);
    if (!review.userCanDelete)
      return sendPermissionError(req, res);
    else
      sendDeleteReview(req, res, review);
  }).catch(getReviewNotFoundHandler(req, res, next, id));
});

router.post('/review/:id/delete', function(req, res, next) {
  let id = req.params.id.trim();
  Review.getWithData(id).then(review => {
    if (review._revDeleted)
      return sendReviewNotFound(req, res, id);
    review.thing.populateUserInfo(req.user);
    review.populateUserInfo(req.user);
    if (!review.userCanDelete)
      return sendPermissionError(req, res);
    else {

      let formInfo = forms.parseSubmission({
        req,
        formDef: formDefs['delete'],
        formKey: 'delete-review'
      });

      if (req.flashHasErrors())
        return sendDeleteReview(req, res, review);

      let options = {};
      if (req.body['delete-thing']) {
        options.deleteAssociatedThing = true;
      }
      // Delete logic
      review.deleteAllRevisions(req.user, options).then(() => {
        return render.template(req, res, 'review-deleted', {
          titleKey: 'review deleted'
        });
      }).catch(err => {
        next(err);
      });

    }

  }).catch(getReviewNotFoundHandler(req, res, next, id));
});

router.get('/review/:id/edit', function(req, res, next) {
  let id = req.params.id.trim();
  Review.getWithData(id).then(review => {
    if (review._revDeleted)
      return sendReviewNotFound(req, res, id);
    review.populateUserInfo(req.user);
    if (!review.userCanEdit) {
      return render.permissionError(req, res, {
        titleKey: 'edit review'
      });
    } else {
      res.send('tbd');
    }
  }).catch(getReviewNotFoundHandler(req, res, next, id));
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
  let showLanguageNotice = true;
  let user = req.user;

  if (!user)
    return render.signinRequired(req, res, {
      titleKey
    });

  if (req.method == 'POST' || user.suppressedNotices &&
    user.suppressedNotices.indexOf('language-notice-review') !== -1)
        showLanguageNotice = false;

  // GET requests or incomplete POST requests
  if (!formInfo || isPreview || errors.length)
    render.template(req, res, 'new-review', {
      formValues: formInfo ? formInfo.formValues : undefined,
      titleKey,
      errors: !isPreview ? errors : undefined,
      isPreview,
      preview: formInfo ? formInfo.preview : undefined,
      scripts: ['sisyphus.min.js', 'markdown-it.min.js', 'review.js'],
      showLanguageNotice
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
  } else {
    flashError(req, null, context);
    res.redirect('/new');
  }
}

function getReviewObj(req) {
  let date = new Date();
  let lang = req.body['review-language'] || req.locale;
  let reviewObj = {
    title: {},
    text: {},
    url: encodeURI(req.body['review-url']),
    html: {},
    createdAt: date,
    createdBy: req.user.id,
    starRating: Number(req.body['review-rating'])
  };


  reviewObj.title[lang] = escapeHTML(req.body['review-title']);
  reviewObj.text[lang] = escapeHTML(req.body['review-text']);
  reviewObj.html[lang] = md.render(req.body['review-text']);
  return reviewObj;
}

function getPreview(req) {
  let preview = {};
  // Values are escaped in the template, with the exception of review text,
  // which is escaped by markdown parser
  preview['review-title'] = req.body['review-title'];
  preview['review-url'] = req.body['review-url'];
  preview['review-url-text'] = prettifyURL(req.body['review-url'] || '');
  preview['review-text'] = md.render(req.body['review-text'] || '');
  preview['review-rating'] = Number(req.body['review-rating']);
  preview['review-date'] = new Date().toLocaleString(req.locale);
  return preview;

}

function sendReview(req, res, review, edit) {
  let errors = req.flash('errors');
  let titleParam;

  if (review.thing) {
    if (review.thing.label)
      titleParam = mlString.resolve(req.locale, review.thing.label).str;
    else
      titleParam = prettifyURL(review.thing.urls[0]);
  }

  render.template(req, res, 'review', {
    titleKey: titleParam ? 'review of' : 'review',
    titleParam,
    deferPageHeader: true,
    review,
    edit,
    errors
  });
}

function sendDeleteReview(req, res, review) {
  let errors = req.flash('errors');

  render.template(req, res, 'delete-review', {
    titleKey: 'delete review',
    review,
    errors
  });
}

function sendReviewNotFound(req, res, id) {
  res.status(404);
  render.template(req, res, 'no-review', {
    titleKey: 'review not found',
    id: escapeHTML(id)
  });
}

function prettifyURL(url) {
  return url
    .replace(/^.*?:\/\//, '') // strip protocol
    .replace(/\/$/, ''); // remove trailing slashes for display only
}

function getReviewNotFoundHandler(req, res, next, id) {
  return function(error) {
    if (error.name == 'DocumentNotFoundError')
      sendReviewNotFound(req, res, id);
    else {
      next(error);
    }
  };
}

function sendPermissionError(req, res) {
  render.permissionError(req, res, {
    titleKey: 'delete review'
  });
}

module.exports = router;
