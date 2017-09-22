'use strict';

// External dependencies
const hbs = require('hbs');
const escapeHTML = require('escape-html');
const i18n = require('i18n');
const stripTags = require('striptags');

// Internal dependencies
const mlString = require('../models/helpers/ml-string');
const languages = require('../locales/languages');
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

// Strips HTML and shortens to specified length
hbs.registerHelper('summarize', function(html, length) {
  return stripTags(html.substr(0, length)) + '...';
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

hbs.registerHelper('getSourceMsgKey', function(sourceID) {
  return `${sourceID} source label`;
});

hbs.registerHelper('__', function(...args) {
  let options = args.pop();
  return Reflect.apply(i18n.__, options.data.root, args);
});

hbs.registerHelper('__n', function(...args) {
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

// Just a simple %1, %2 substitution function for various purposes
hbs.registerHelper('substitute', function(...args) {

  let i = 1,
    string = args.shift();

  while (args.length) {
    let sub = args.shift();
    string = string.replace(`%${i}`, sub);
    i++;
  }
  return string;
});


hbs.registerHelper('getThingLink', (thing, options) => {
  let label = Thing.getLabel(thing, options.data.root.locale);
  return `<a href="/${thing.urlID}">${label}</a>`;
});

// Filenames cannot contain HTML metacharacters, so URL encoding is sufficient here
hbs.registerHelper('getFileLink', filename => `<a href="/static/uploads/${encodeURIComponent(filename)}">${filename}</a>`);

hbs.registerHelper('getLanguageName', (lang, options) => languages.getTranslatedName(lang, options.data.root.locale));
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
    let languageName = languages.getCompositeName(mlRv.lang, options.data.root.locale);
    return `${mlRv.str} <span class="language-identifier" title="${languageName}">` +
      `<span class="fa fa-fw fa-globe language-identifier-icon">&nbsp;</span>${mlRv.lang}</span>`;
  }
});

hbs.registerHelper('round', (num, dec) => +num.toFixed(dec));

hbs.registerHelper('ifCond', function(v1, operator, v2, options) {
  switch (operator) {
    case '==':
      return v1 == v2 ? options.fn(this) : options.inverse(this);
    case '===':
      return v1 === v2 ? options.fn(this) : options.inverse(this);
    case '<':
      return v1 < v2 ? options.fn(this) : options.inverse(this);
    case '<=':
      return v1 <= v2 ? options.fn(this) : options.inverse(this);
    case '>':
      return v1 > v2 ? options.fn(this) : options.inverse(this);
    case '>=':
      return v1 >= v2 ? options.fn(this) : options.inverse(this);
    case '&&':
      return v1 && v2 ? options.fn(this) : options.inverse(this);
    case '||':
      return v1 || v2 ? options.fn(this) : options.inverse(this);
    default:
      return options.inverse(this);
  }
});
