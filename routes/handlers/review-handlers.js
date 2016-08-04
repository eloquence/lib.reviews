'use strict';
const escapeHTML = require('escape-html');

const db = require('../../db');
const r = db.r;
const Review = require('../../models/review.js');
const render = require('../helpers/render');
const forms = require('../helpers/forms');
const mlString = require('../../models/helpers/ml-string.js');
const prettifyURL = require('../../util/url-utils').prettify;

let reviewHandlers = {

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
