'use strict';
const debugModule = require('debug');
const debug = {
  // For lower-level debug messages available if needed
  db: debugModule('libreviews:db'),
  app: debugModule('libreviews:app'),
  util: debugModule('libreviews:util'),

  // For all serious errors that should be examined by a human and fixed or categorized
  // { context: String - where in the application the error occurred
  //   req: Request object, if available
  //   error: standard error object
  // }
  error: function(errorObj) {
    let log = debugModule('libreviews:error');
    if (!errorObj.context && errorObj.req)
      errorObj.context = `Route ${errorObj.req.route.path}`;

    log(`Error occurred in context <${errorObj.context || 'unknown'}>.`);
    if (errorObj && errorObj.req) {
      log(`Request method: ${errorObj.req.method} - URL: ${errorObj.req.originalUrl}`);
      if (errorObj.req.method !== 'GET') {
        log('Request body:');
        if (typeof errorObj.req.body == "object")
          log(JSON.stringify(errorObj.req.body, null, 2));
        else
          log (errorObj.req.body.toString());
      }
    }
    if (errorObj && errorObj.error) {
      log('Stacktrace:');
      log(errorObj.error.stack);
    }
  }
};
module.exports = debug;
