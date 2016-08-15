'use strict';
const languages = require('../../locales/languages');

let feeds = {

  // Get the <link> feed metadata for the HTML output of a page, to enable
  // feed discoverability
  getEmbeddedFeeds(req, options) {

    options = Object.assign({
      // must be provided, used for <link> tag metadata.
      atomURLPrefix: undefined,
      atomURLTitleKey: undefined
    }, options);

    // Configure embedded feeds (for the HTML output's <link> tag)
    let embeddedFeeds = [];
    if (options.atomURLPrefix && options.atomURLTitleKey) {
      // Add current language (which is English by default) first, since
      // many feed readers will only discover one feed per URL
      embeddedFeeds.push({
        url: `${options.atomURLPrefix}/${req.locale}`,
        type: 'application/atom+xml',
        title: `[${req.locale}] ` + req.__(options.atomURLTitleKey),
        language: req.locale
      });
      // Now add all remaining languages to make them discoverable
      let otherLanguages = languages.getAll();
      delete otherLanguages[req.locale];
      for (let otherLanguage in otherLanguages) {
        embeddedFeeds.push({
          url: `${options.atomURLPrefix}/${otherLanguage}`,
          type: 'application/atom+xml',
          title: `[${otherLanguage}] ` + req.__({
            phrase: options.atomURLTitleKey,
            locale: otherLanguage
          }),
          language: otherLanguage
        });
      }
    }

    return embeddedFeeds;

  }

};

module.exports = feeds;
