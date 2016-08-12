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

  getFeedHandler: function(options) {

    options = Object.assign({ // Defaults
      titleKey: 'feed',
      template: 'feed',
      onlyTrusted: false,
      deferPageHeader: false,
      limit: 10,
      getOffsetDate: false // set true if :utcisodate param is to be used
    }, options);

    return function(req, res, next) {

      let offsetDate;
      if (options.getOffsetDate) {
        offsetDate = new Date(req.params.utcisodate.trim());
        if (!offsetDate || offsetDate == 'Invalid Date')
          offsetDate = null;
      }

      Review
        .getFeed({
          onlyTrusted: options.onlyTrusted,
          limit: options.limit,
          offsetDate
        })
        .then(result => {

          let offsetDate = result.offsetDate;
          let feedItems = result.feedItems;

          feedItems.forEach((item, index) => {
            item.populateUserInfo(req.user);
            if (item.thing) {
              item.thing.populateUserInfo(req.user);
            }
          });
          render.template(req, res, options.template, {
            titleKey: options.titleKey,
            deferPageHeader: options.deferPageHeader,
            feedItems,
            utcISODate:
              offsetDate ? offsetDate.toISOString() : undefined,
            pageLimit: options.limit
          });
        })
        .catch(error => {
          next(error);
        });
    };
  }
};

module.exports = reviewHandlers;
