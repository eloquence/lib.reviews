'use strict';
const langKeys = Object.keys(require('../locales/languages'));
const thinky = require('../db');
const type = thinky.type;

let mlString = {
  // Simple thinky type hack for multilingual strings, permitting only strings in
  // the supported languages defined in locales/ . Language keys like 'en'
  // function as object keys, so you can use syntax like "label.en" or "aliases.fr[0]"
  getSchema: function(userOptions) {

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

    return type.object().schema(schema).allowExtra(false);

  },

  resolve: function(lang, strObj) {
    if (strObj === undefined)
      return undefined;

    if (strObj[lang] !== undefined)
      return strObj[lang];

    // Fallback
    if (strObj.en !== undefined)
      return strObj.en;

    return undefined;

  }

};

module.exports = mlString;
