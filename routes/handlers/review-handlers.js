'use strict';
const escapeHTML = require('escape-html');

const db = require('../../db');
const r = db.r;
const Review = require('../../models/review.js');
const render = require('../helpers/render');
const forms = require('../helpers/forms');
const mlString = require('../../models/helpers/ml-string.js');
const prettifyURL = require('../../util/url-utils').prettify;
const languages = require('../../locales/languages');

let reviewHandlers = {

  getFeedHandler: function(options) {

    options = Object.assign({ // Defaults
      titleKey: 'feed',
      template: 'feed',
      onlyTrusted: false,
      deferPageHeader: false,
      limit: 10
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
          offsetDate
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

          // Configure embedded feeds (for the HTML output's <link> tag)
          let embeddedFeeds = [];
          if (options.atomURLPrefix && options.atomURLTitleKey) {
            // Add current language (which is English by default) first, since
            // many feed readers will only discover one feed per URL
            embeddedFeeds.push({
              url: `${options.atomURLPrefix}/${req.locale}`,
              type: 'application/atom+xml',
              title: req.__(options.atomURLTitleKey),
              language: req.locale
            });
            // Now add all remaining languages to make them discoverable
            let otherLanguages = languages.getAll();
            delete otherLanguages[req.locale];
            for (let otherLanguage in otherLanguages) {
              embeddedFeeds.push({
                url: `${options.atomURLPrefix}/${otherLanguage}`,
                type: 'application/atom+xml',
                title: req.__({
                  phrase: options.atomURLTitleKey,
                  locale: otherLanguage
                }),
                language: otherLanguage
              });
            }
          }

          let vars = {
            titleKey: options.titleKey,
            deferPageHeader: options.deferPageHeader,
            feedItems,
            utcISODate: offsetDate ? offsetDate.toISOString() : undefined,
            pageLimit: options.limit,
            embeddedFeeds
          };

          if (!options.format) {
            render.template(req, res, options.template, vars);
          } else {
            if (options.format == 'atom') {
              Object.assign(vars, {
                layout: 'layout-atom',
                language,
                updatedDate
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
