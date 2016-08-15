'use strict';
// External dependencies
const escapeHTML = require('escape-html');
const url = require('url');
const config = require('config');

// Internal dependencies
const db = require('../../db');
const r = db.r;
const Review = require('../../models/review.js');
const render = require('../helpers/render');
const forms = require('../helpers/forms');
const feeds = require('../helpers/feeds');
const mlString = require('../../models/helpers/ml-string.js');
const prettifyURL = require('../../util/url-utils').prettify;
const languages = require('../../locales/languages');

let reviewHandlers = {

  getFeedHandler: function(options) {

    options = Object.assign({ // Defaults
      titleKey: 'feed',
      titleParam: undefined,
      template: 'feed',
      // Show only reviews by users with isTrusted = true, useful as pre-screen
      onlyTrusted: false,
      deferPageHeader: false,
      // Reviews per page, also applies to machine-readable feeds
      limit: 10,
      // Set to ID if we need to filter by user
      createdBy: undefined,
      // Anything else we need to pass into the template
      extraVars: {},
      // For <link> tags in generated output. The feed itself uses titleKey
      // as the title.
      atomURLPrefix: '/feed/atom',
      atomURLTitleKey: 'atom feed of all reviews',
      htmlURL: '/feed'
    }, options);

    return function(req, res, next) {

      let offsetDate, language;
      if (req.params.utcisodate) {
        offsetDate = new Date(req.params.utcisodate.trim());
        if (!offsetDate || offsetDate == 'Invalid Date')
          offsetDate = null;
      }

      // Feeds for external consumption require a language, we fall back to
      // English if we can't find one
      if (options.format) {
        language = req.params.language;
        if (!languages.isValid(language))
          language = 'en';
      }

      Review
        .getFeed({
          onlyTrusted: options.onlyTrusted,
          limit: options.limit,
          offsetDate,
          createdBy: options.createdBy
        })
        .then(result => {

          let offsetDate = result.offsetDate;
          let feedItems = result.feedItems;

          let updatedDate;

          feedItems.forEach((item, index) => {
            item.populateUserInfo(req.user);
            if (item.thing)
              item.thing.populateUserInfo(req.user);

            // For Atom feed - most recently modified item in the result set
            if (!updatedDate || item._revDate > updatedDate)
              updatedDate = item._revDate;

          });

          let vars = {
            titleKey: options.titleKey,
            titleParam: options.titleParam,
            deferPageHeader: options.deferPageHeader,
            feedItems,
            utcISODate: offsetDate ? offsetDate.toISOString() : undefined,
            pageLimit: options.limit,
            embeddedFeeds: feeds.getEmbeddedFeeds(req, options)
          };

          Object.assign(vars, options.extraVars);

          if (!options.format) {
            render.template(req, res, options.template, vars);
          } else {
            if (options.format == 'atom') {
              Object.assign(vars, {
                layout: 'layout-atom',
                language,
                updatedDate,
                selfURL: url.resolve(config.qualifiedURL, options.atomURLPrefix) + `/${language}`,
                htmlURL: url.resolve(config.qualifiedURL, options.htmlURL)
              });
              req.locale = language;
              res.type('application/atom+xml');
              render.template(req, res, 'review-feed-atom', vars);
            } else {
              throw new Error(`Format '${options.format}' not supported.`);
            }
          }
        })
        .catch(error => {
          next(error);
        });
    };
  }
};

module.exports = reviewHandlers;
