'use strict';
const debug = require('../util/debug');
module.exports = function flashErrorMessage(req, res, errorMessage, context) {
    if (errorMessage.constructor.name == 'ErrorMessage') {
      req.flash('errors', res.__.apply(this, errorMessage.toEscapedArray()));
    } else {
      // May be standard JS Error. We'll log the details for inspection.
      req.flash('errors', res.__('unknown error'));
      debug.error({
        context,
        req,
        error: errorMessage
      });
    }
};
