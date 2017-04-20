'use strict';
// Get either the minified or full version of a script, depending on environment
module.exports = function getJS(name) {
  let env;
  if (process.env.NODE_ENV)
    env = process.env.NODE_ENV.toUpperCase();
  return env === 'PRODUCTION' ? `${name}.min.js` : `${name}.js`;
};
