'use strict';

// External dependencies
const hbs = require('hbs');
const escapeHTML = require('escape-html');
const i18n = require('i18n');
const Reflect = require('harmony-reflect');

// Internal dependencies
const mlString = require('../models/helpers/ml-string');
const langDefs = require('../locales/languages').getAll();
const Thing = require('../models/thing');
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

hbs.registerHelper('shortDate', function(date) {
  if (date && date instanceof Date)
    return date.toLocaleDateString();
});

hbs.registerHelper('longDate', function(date) {
  if (date && date instanceof Date)
    return date.toLocaleString();
});

hbs.registerHelper('__', function() {
  let args = Reflect.apply(Array.prototype.slice, arguments);
  let options = args.pop();
  return Reflect.apply(i18n.__, options.data.root, args);
});

hbs.registerHelper('__n', function() {
  let args = Reflect.apply(Array.prototype.slice, arguments);
  let options = args.pop();
  return Reflect.apply(i18n.__n, options.data.root, args);
});

// Get the language code that will result from resolving a string to the
// current request language (may be a fallback if no translation available).
hbs.registerHelper('getLang', function(str, options) {
  let mlRv = mlString.resolve(options.data.root.locale, str);
  return mlRv ? mlRv.lang : undefined;
});

hbs.registerHelper('getThingLabel', (thing, options) =>
  Thing.getLabel(thing, options.data.root.locale));

hbs.registerHelper('getThingLink', (thing, options) => {
  let label = Thing.getLabel(thing, options.data.root.locale);
  return `<a href="/thing/${thing.id}">${label}</a>`;
});

// Filenames cannot contain HTML metacharacters, so URL encoding is sufficient here
hbs.registerHelper('getFileLink', filename => `<a href="/static/uploads/${encodeURIComponent(filename)}">${filename}</a>`);

hbs.registerHelper('isoDate', date => date && date.toISOString ? date.toISOString() : undefined);

// Resolve a multilingual string to the current request language.
//
// addLanguageSpan -- Do we want a little label next to the string (default true!)
hbs.registerHelper('mlString', function(str, addLanguageSpan, options) {
  // hbs passes options object in as last parameter
  if (arguments.length == 2) {
    options = addLanguageSpan;
    addLanguageSpan = true;
  } else if (addLanguageSpan === undefined)
    addLanguageSpan = true;

  let mlRv = mlString.resolve(options.data.root.locale, str);

  if (mlRv === undefined || mlRv.str === undefined || mlRv.str === '')
    return undefined;

  if (!addLanguageSpan || mlRv.lang === options.data.root.locale)
    return mlRv.str;
  else {
    let langLabelKey = langDefs[mlRv.lang].messageKey;
    let langLabel = Reflect.apply(i18n.__, options.data.root, [langLabelKey]);
    return `${mlRv.str} <span class="language-identifier" title="${langLabel}">` +
      `<span class="fa fa-globe spaced-icon" style="color:#777;"></span>${mlRv.lang}</span>`;
  }
});
