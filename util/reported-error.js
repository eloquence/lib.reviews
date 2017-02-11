'use strict';
const AbstractReportedError = require('./abstract-reported-error');
const i18n = require('i18n');
const sprintf = require('sprintf-js').sprintf;

// For lib.reviews use, we use our standard i18n framework to log user errors
// in English
class ReportedError extends AbstractReportedError {
  constructor(options) {
    if (typeof options == 'object')
      options.translateFn = _translate;

    super(options);
  }
}

function _translate(...args) {
  try {
    return Reflect.apply(i18n.__, this, args);
  } catch (_e) {
    // In case i18n framework is not available or configured
    return Reflect.apply(sprintf, this, args);
  }
}

module.exports = ReportedError;
