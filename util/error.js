'use strict';
const escapeHTML = require('escape-html');

// This class is exclusively for localized error messages that are passed
// through to the user.  When there is no need to pass an error message
// through to the user, use native Error objects, or specialized Error
// objects provided by a library.
class ErrorMessage {
  constructor(msgKey, msgParams, originalError) {
    if (!msgKey)
      throw new Error('Must provide at least a message key for the error.');

    if (msgParams && !Array.isArray(msgParams))
      throw new Error('Message parameters must be provided as an array.');

    if (!msgParams)
      msgParams = [];

    msgParams.forEach(ele => {
      if (typeof ele !== 'string') {
        throw new Error('Message parameters must be strings.');
      }
    });

    this.msgKey = msgKey;
    this.msgParams = msgParams;
    this.originalError = originalError;
  }

  toArray() {
    return [this.msgKey].concat(this.msgParams);
  }

  toEscapedArray() {
    return [this.msgKey].concat(this.msgParams.map(escapeHTML));
  }


}

module.exports = ErrorMessage;
