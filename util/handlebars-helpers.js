'use strict';
const hbs = require('hbs');
const mlstring = require('../models/helpers/ml-string');
const i18n = require('i18n');
const langDefs = require('../locales/languages').getAll();

// Current iteration value will be passed as {{this}} into the block,
// starts at 1 for more human-readable counts. First and last set @first, @last
hbs.registerHelper('times', function(n, block) {
  let rv = '', data = {};
  if (block.data)
    data = hbs.handlebars.createFrame(block.data);

  for (let i = 1; i <= n; i++) {
    data.first = i == 1 ? true : false;
    data.last = i == n ? true : false;
    rv += block.fn(i, { data } ).trim();
  }
  return rv;
});

hbs.registerHelper('link', function(url, title) {
  return `<a href="${url}">${title}</a>`;
});

hbs.registerHelper('userLink', function(user) {
  return `<a href="/user/${user.urlName}">${user.displayName}</a>`;
});

hbs.registerHelper('prettify', function(url) {
  return url
    .replace(/^.*?:\/\//, '') // strip protocol
    .replace(/\/$/, ''); // remove trailing slashes for display only
});

// These helpers must be registered in a middleware context, so we export
// them for use as such
module.exports = function(req, res, next) {
  hbs.registerHelper('__', function() {
    return i18n.__.apply(req, arguments);
  });
  hbs.registerHelper('__n', function() {
    return i18n.__n.apply(req, arguments);
  });
  hbs.registerHelper('mlString', function(str, addLanguageSpan) {
    if (addLanguageSpan === undefined)
      addLanguageSpan = true;

    let mlRv = mlstring.resolve(req.locale, str);

    if (mlRv === undefined || mlRv.str === undefined || mlRv.str === '')
      return undefined;

    if (!addLanguageSpan || mlRv.lang === req.locale)
      return mlRv.str;
    else {
      let langLabelKey = langDefs[mlRv.lang].messageKey;
      let langLabel = i18n.__.call(req, langLabelKey);
      return `${mlRv.str} <span class="language-identifier" title="${langLabel}">` +
      `<span class="fa fa-globe spaced-icon" style="color:#777;"></span>${mlRv.lang}</span>`;
    }
  });

  next();
};
