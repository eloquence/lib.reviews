'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Internal dependencies
const render = require('./helpers/render');
const languages = require('../locales/languages');

router.get('/terms', function(req, res, next) {
  resolveMultilingualTemplate('terms', req.locale)
    .then(templateName => {
      render.template(req, res, templateName, {
        deferPageHeader: true,
        titleKey: 'terms'
      });
    })
    .catch(error => next(error));
});


// Detects the best available template in the multilingual templates directory
// for a given locale.
function resolveMultilingualTemplate(templateName, locale) {
  return new Promise((resolveTemplate, rejectTemplate) => {
    let templateLanguages = languages.getFallbacks(locale);

    // Add the request language itself if not already a default fallback
    if (templateLanguages.indexOf(locale) == -1)
      templateLanguages.unshift(locale);

    let findFilePromises = [];
    for (let language of templateLanguages) {
      let p = new Promise(resolve => {
        fs.stat(path.join(__dirname, `../views/multilingual/${templateName}-${language}.hbs`),
          (error, _result) => {
            if (error)
              resolve(false);
            else
              resolve(`multilingual/${templateName}-${language}`);
          });
      });
      findFilePromises.push(p);
    }
    Promise
      .all(findFilePromises)
      .then(fileNames => {
        for (let fileName of fileNames) {
          if (fileName)
            return resolveTemplate(fileName);
        }
        let langStr = templateLanguages.join(', ');
        return rejectTemplate(new Error(`Template ${templateName} does not appear to exist in any of these languages: ${langStr}`));
      });
  });
}
module.exports = router;
