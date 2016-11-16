'use strict';

// NOTE: This module loads language metadata into memory synchronously and
// should be required on startup.

// External dependencies
const jsonfile = require('jsonfile');
const path = require('path');

// To add support for a new language, first add the locale file (JSON format)
// with the translations to the locales/ directory. Then add the new language
// code to this array. Language names will be automatically imported from CLDR
// on the next restart.
const validLanguages = ['en', 'bn', 'de', 'eo', 'es', 'fr', 'mk', 'pt', 'pt-PT', 'sv', 'zh', 'zh-Hant'];

const languageNameMap = {
  // CLDR uses the unqualified key (e.g., "pt" for Portuguese) for the version
  // used by the most speakers, and to avoid duplication, there isn't even a
  // directory for the version with the qualifier. We use the same minimal codes,
  // but the qualification matters for purposes of looking up the language names,
  // so we use this map to remember which specific locale name to look up.
  'pt': 'pt-BR',
  'zh': 'zh-Hans'
};

let langData = {};


// Import language names from CLDR module
let cldrPath = path.join(__dirname, '../node_modules/cldr-localenames-full/main');

/* eslint no-sync: "off" */
validLanguages.forEach(language => {
  let contents = jsonfile.readFileSync(path.join(cldrPath, language, 'languages.json'));
  langData[language] = contents.main[language].localeDisplayNames.languages;
});

let languages = {

  // Returns a list of all valid language keys. We make a copy to prevent accidental manipulation.
  getValidLanguages() {
    return validLanguages.slice();
  },

  // Returns the native name of a language, e.g. "Deutsch" for German
  getNativeName(langKey) {
    let lookupKey = languageNameMap[langKey] || langKey;
    return langData[langKey][lookupKey];
  },

  // Returns a translated name of a language, e.g. "German" instead of "Deutsch"
  getTranslatedName(langKey, translationLanguage) {
    let lookupKey = languageNameMap[langKey] || langKey;
    return langData[translationLanguage][lookupKey];
  },

  // Returns both the native name and a translation (if appropriate).
  getCompositeName(langKey, translationLanguage) {
    let nativeName = languages.getNativeName(langKey);
    let translatedName = languages.getTranslatedName(langKey, translationLanguage);
    if (nativeName != translatedName)
      return `${translatedName} (${nativeName})`;
    else
      return nativeName;
  },

  isValid(langKey) {
    return validLanguages.indexOf(langKey) !== -1;
  },

  // Returns an array of fallback languages to try first when selecting
  // which language version to show. We return English as a fallback
  // if we don't have a better answer, since it's the most widely spoken
  // secondary language.
  getFallbacks(langKey) {
    let fallbacks = ['en'];
    switch (langKey) {
      case 'pt':
        fallbacks.unshift('pt-PT');
        break;
      case 'pt-PT':
        fallbacks.unshift('pt');
        break;
      // no default
    }
    return fallbacks;
  }

};

module.exports = languages;
