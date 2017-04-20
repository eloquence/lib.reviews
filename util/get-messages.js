'use strict';
const i18n = require('i18n');

// Accepts multiple arrays as input and returns an object with resolved
// messages per the given locale. Used to export messages to the
// client in the window.config.messages object.
module.exports = function getMessages(locale, ...args) {
  let messagesObj = {};
  for (let arg of args) {
    if (Array.isArray(arg)) {
      arg.forEach(key => {
        messagesObj[key] = i18n.__({
          phrase: key,
          locale
        });
      });
    }
  }
  return messagesObj;
};
