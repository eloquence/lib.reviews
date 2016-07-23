'use strict';
const langKeys = Object.keys(require('../locales/languages')());
const jsonfile = require('jsonfile');

let enMessageKeys = Object.keys(jsonfile.readFileSync('../locales/en.json'));

for (let langKey of langKeys) {
  if (langKey == 'en')
    continue;

  let messageKeys = Object.keys(jsonfile.readFileSync(`../locales/${langKey}.json`));
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
