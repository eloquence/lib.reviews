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
      getOffsetEpoch: false // set true if :epoch param is to be used
    }, options);

    return function(req, res, next) {

      let offsetEpoch;
      if (options.getOffsetEpoch) {
        offsetEpoch = Number(req.params.epoch.trim());
        if (new Date(offsetEpoch) == 'Invalid Date')
          offsetEpoch = undefined;
      }


      Review
        .getFeed({
          onlyTrusted: options.onlyTrusted,
          limit: options.limit,
          offsetEpoch
        })
        .then(result => {

          let offsetEpoch = result.offsetEpoch;
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
            offsetEpoch,
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
