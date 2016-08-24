'use strict';

// External dependencies
const hbs = require('hbs');
const escapeHTML = require('escape-html');
const i18n = require('i18n');
const Reflect = require('harmony-reflect');

// Internal dependencies
const mlString = require('../models/helpers/ml-string');
const langDefs = require('../locales/languages').getAll();
const urlUtils = require('./url-utils');

// Current iteration value will be passed as {{this}} into the block,
// starts at 1 for more human-readable counts. First and last set @first, @last
hbs.registerHelper('times', function(n, block) {
  let data = {},
    rv = '';

  if (block.data)
    data = hbs.handlebars.createFrame(block.data);

  for (let i = 1; i <= n; i++) {
    data.first = i == 1 ? true : false;
    data.last = i == n ? true : false;
    rv += block.fn(i, {
      data
    }).trim();
  }
  return rv;
});

hbs.registerHelper('escapeHTML', function(block) {
  return escapeHTML(block.fn(this));
});

hbs.registerHelper('link', function(url, title) {
  return `<a href="${url}">${title}</a>`;
});

hbs.registerHelper('userLink', function(user) {
  return user ? `<a href="/user/${user.urlName}">${user.displayName}</a>` : '';
});

hbs.registerHelper('prettify', function(url) {
  if (url)
    return urlUtils.prettify(url);
  else
    return '';
});

// These helpers must be registered in a middleware context, so we export
// them for use as such
module.exports = function(req, res, next) {
  hbs.registerHelper('__', function() {
    return Reflect.apply(i18n.__, req, arguments);
  });
  hbs.registerHelper('__n', function() {
    return Reflect.apply(i18n.__n, req, arguments);
  });

  // Get the language code that will result from resolving a string to the
  // current request language (may be a fallback if no translation available).
  hbs.registerHelper('getLang', function(str) {
    let mlRv = mlString.resolve(req.locale, str);
    return mlRv ? mlRv.lang : undefined;
  });

  hbs.registerHelper('getThingLabel', function(thing) {

    if (!thing || !thing.id)
      return undefined;

    let str;
    if (thing.label)
      str = mlString.resolve(req.locale, thing.label).str;

    if (str)
      return str;

    // If we have no proper label, we can at least show the URL
    if (thing.urls && thing.urls.length)
      return urlUtils.prettify(thing.urls[0]);

    return undefined;

  });

  hbs.registerHelper('isoDate', date => date && date.toISOString ? date.toISOString() : undefined);

  // Resolve a multilingual string to the current request language.
  //
  // addLanguageSpan -- Do we want a little label next to the string (default true!)
  hbs.registerHelper('mlString', function(str, addLanguageSpan) {
    if (addLanguageSpan === undefined)
      addLanguageSpan = true;

    let mlRv = mlString.resolve(req.locale, str);

    if (mlRv === undefined || mlRv.str === undefined || mlRv.str === '')
      return undefined;

    if (!addLanguageSpan || mlRv.lang === req.locale)
      return mlRv.str;
    else {
      let langLabelKey = langDefs[mlRv.lang].messageKey;
      let langLabel = Reflect.apply(i18n.__, req, [langLabelKey]);
      return `${mlRv.str} <span class="language-identifier" title="${langLabel}">` +
        `<span class="fa fa-globe spaced-icon" style="color:#777;"></span>${mlRv.lang}</span>`;
    }
  });

  next();
};
