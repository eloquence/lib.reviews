'use strict';
const escapeHTML = require('escape-html');

const db = require('../../db');
const r = db.r;
const Review = require('../../models/review.js');
const render = require('../helpers/render');
const forms = require('../helpers/forms');
const mlString = require('../../models/helpers/ml-string.js');
const prettifyURL = require('../../util/url-normalizer').prettify;

let reviewHandlers = {

  view: function(req, res, next) {
    let id = req.params.id.trim();
    Review.getWithData(id).then(review => {
        if (review._revDeleted)
          return reviewHandlers.sendReviewNotFound(req, res, id);
        review.thing.populateUserInfo(req.user);
        review.populateUserInfo(req.user);
        reviewHandlers.sendReview(req, res, review);
      })
      .catch(reviewHandlers.getReviewNotFoundHandler(req, res, next, id));
  },


  sendReview: function(req, res, review, edit) {
    let pageErrors = req.flash('pageErrors');
    let pageMessages = req.flash('pageMessages');

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
      pageErrors,
      pageMessages
    });
  },

  sendReviewNotFound: function(req, res, id) {
    res.status(404);
    render.template(req, res, 'no-review', {
      titleKey: 'review not found',
      id: escapeHTML(id)
    });
  },

  getReviewNotFoundHandler: function(req, res, next, id) {
    return function(error) {
      if (error.name == 'DocumentNotFoundError')
        reviewHandlers.sendReviewNotFound(req, res, id);
      else {
        next(error);
      }
    };
  },

  sendPermissionError: function(req, res) {
    render.permissionError(req, res, {
      titleKey: 'delete review'
    });
  },

  getFeedHandler: function(optionsParam) {

    let options = {
      titleKey: 'feed',
      template: 'feed',
      onlyTrusted: false,
      deferPageHeader: false
    };

    if (typeof optionsParam == "object")
      Object.assign(options, optionsParam);

    return function(req, res, next) {
      Review
        .getFeed({
          onlyTrusted: options.onlyTrusted
        })
        .then(feedItems => {
          for (let item of feedItems) {
            item.populateUserInfo(req.user);
            if (item.thing) {
              item.thing.populateUserInfo(req.user);
            }
          }
          render.template(req, res, options.template, {
            titleKey: options.titleKey,
            deferPageHeader: options.deferPageHeader,
            feedItems
          });
        })
        .catch(error => {
          next(error);
        });
    };
  }
};

module.exports = reviewHandlers;
