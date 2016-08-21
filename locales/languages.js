'use strict';

let langObj;

let languages = {

  // Produces new copy each time to avoid accidental manipulation
  getAll() {
    return {
      'de': {
        messageKey: 'german'
      },
      'en': {
        messageKey: 'english'
      }
    };
  },

  isValid(langKey) {
    if (!langObj)
      langObj = languages.getAll();

    if (langObj[langKey])
      return true;
    else
      return false;
  }

};

module.exports = languages;
