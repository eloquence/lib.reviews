'use strict';
const languages = require('../../locales/languages');
const langKeys = languages.getValidLanguages();
const thinky = require('../../db');
const type = thinky.type;
const decodeHTML = require('entities').decodeHTML;
const stripTags = require('striptags');

let mlString = {
  // Simple thinky type hack for multilingual strings, permitting only strings in
  // the supported languages defined in locales/ . Language keys like 'en'
  // function as object keys, so you can use syntax like "label.en" or "aliases.fr[0]"
  getSchema(userOptions) {

    let options = {
      maxLength: undefined,
      array: false
    };

    Object.assign(options, userOptions);

    let schema = {};
    for (let key of langKeys) {
      let typeDef = type.string();
      if (options.maxLength)
        typeDef.max(options.maxLength);

      if (options.array)
        typeDef = type.array(typeDef);

      schema[key] = typeDef;

    }

    return type
      .object()
      .schema(schema)
      .allowExtra(false);

  },

  resolve(lang, strObj) {
    if (strObj === undefined)
      return undefined;

    // We have a string in the specified language
    // Note that emptying a string reverts back to other available languages
    if (strObj[lang] !== undefined && strObj[lang] !== '')
      return {
        str: strObj[lang],
        lang
      };

    // Try specific fallbacks for this language first, e.g. European Portuguese
    // for Brazilian Portuguese. English is a declared fallback for all languages.
    let fallbackLanguages = languages.getFallbacks(lang);
    for (let fallbackLanguage of fallbackLanguages) {
      if (strObj[fallbackLanguage] !== undefined && strObj[fallbackLanguage] !== '')
        return {
          str: strObj[fallbackLanguage],
          lang: fallbackLanguage
        };
    }

    // Pick first available language
    let availableLanguages = Object.keys(strObj);
    for (let availableLanguage of availableLanguages) {
      if (languages.isValid(availableLanguage) &&
        strObj[availableLanguage] !== undefined &&
        strObj[availableLanguage] !== '')
        return {
          str: strObj[availableLanguage],
          lang: availableLanguage
        };
    }

    // This may not be a valid multilingual string object at all, or all strings
    // are empty.
    return undefined;

  },

  // Returns a copy of a given string object with HTML entities decoded and
  // HTML elements stripped
  stripHTML(strObj) {
    if (typeof strObj !== 'object')
      return strObj;

    let rv = {};
    for (let lang in strObj) {
      if (typeof strObj[lang] == 'string')
        rv[lang] = stripTags(decodeHTML(strObj[lang]));
      else
        rv[lang] = strObj[lang];
    }
    return rv;
  },

  // Returns a copy of a given string object array with HTML entities decoded
  // and HTML elements stripped
  stripHTMLFromArray(strObjArr) {
    if (!Array.isArray(strObjArr))
      return strObjArr;
    else
      return strObjArr.map(mlString.stripHTML);
  }

};

module.exports = mlString;
