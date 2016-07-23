'use strict';
const langKeys = Object.keys(require('../locales/languages')());
const jsonfile = require('jsonfile');

let enMessageKeys = Object.keys(jsonfile.readFileSync('../locales/en.json'));

for (let langKey of langKeys) {
  if (langKey == 'en')
    continue;

  let messageKeys = Object.keys(jsonfile.readFileSync(`../locales/${langKey}.json`));
  let missingKeys = enMessageKeys.filter(getMissingKeys(messageKeys));

  if (missingKeys.length) {
    console.log(`The following keys are missing from ${langKey}.json:`);
    console.log(missingKeys.join('\n'));
  }
}

function getMissingKeys(xxMessageKeys) {
  return function(ele) {
    if (xxMessageKeys.indexOf(ele) == -1)
      return true;
    else
      return false;
  };
}
