'use strict';
const path = require('path');
const basePath = path.join(__dirname, '../locales');
const langKeys = require(`${basePath}/languages`).getValidLanguages();
// qqq is a pseudo language code (reserved for local use in the ISO standard)
// which, per translatewiki.net convention, is used for message documentation
langKeys.push('qqq');
const jsonfile = require('jsonfile');

/* eslint no-sync: "off" */
let enMessageKeys = Object.keys(jsonfile.readFileSync(`${basePath}/en.json`));

for (let langKey of langKeys) {
  if (langKey == 'en')
    continue;

  let messageKeys = Object.keys(jsonfile.readFileSync(`${basePath}/${langKey}.json`));
  let missingKeys = enMessageKeys.filter(getKeyFilter(messageKeys));

  if (missingKeys.length) {
    console.log(`The following keys are missing from ${langKey}.json:`);
    console.log(missingKeys.join('\n'));
  }

  let extraKeys = messageKeys.filter(getKeyFilter(enMessageKeys));
  if (extraKeys.length) {
    console.log(`\nThe following keys exist in ${langKey}.json which are not in the English version:`);
    console.log(extraKeys.join('\n'));
  }
}


function getKeyFilter(xxMessageKeys) {
  return function(ele) {
    if (xxMessageKeys.indexOf(ele) == -1)
      return true;
    else
      return false;
  };
}
