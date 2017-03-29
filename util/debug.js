'use strict';
const debugModule = require('debug');
const debug = {
  // For lower-level debug messages available if needed
  db: debugModule('libreviews:db'),
  app: debugModule('libreviews:app'),
  util: debugModule('libreviews:util'),
  tests: debugModule('libreviews:tests'),

  // For all serious errors that should be examined by a human and fixed or categorized
  // {
  //   req: Request object, if available
  //   error: standard error object
  // }
  error(errorObj) {
    let log = debugModule('libreviews:error');
    if (errorObj && errorObj.req) {

      if (errorObj.req.route)
        log(`Error occurred in route <${errorObj.req.route.path}>.`);

      log(`Request method: ${errorObj.req.method} - URL: ${errorObj.req.originalUrl}`);
      if (errorObj.req.method !== 'GET' && errorObj.req.body !== undefined) {
        log('Request body:');
        if (typeof errorObj.req.body == "object")
          log(JSON.stringify(errorObj.req.body, null, 2));
        else
          log(errorObj.req.body.toString());
      }
    }
    if (errorObj && errorObj.error) {
      log('Stacktrace:');
      log(errorObj.error.stack);
    }
  }
};
module.exports = debug;
