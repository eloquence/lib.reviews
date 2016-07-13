// Because many sites generate multiple URLs or URL variants pointing to the same resource,
// we standardize user-submitted URLs before storing or querying them. This reduces the need
// for manual merging.
'use strict';

// Node's built-in module helps a little
let url = require('url');


// Custom converters based on hostname matches
let converterRules = [{
  host: /^(www\.)?amazon\.com$/,
  converter: stripAmazonQueryStrings
}];

function normalize(inputURL) {
  let outputURL;

  let parsedURL = url.parse(inputURL);

  // Normalizes trailing slashes
  outputURL = parsedURL.href;

  for (let rule of converterRules) {
    if (rule.host.test(parsedURL.hostname)) {
      outputURL = rule.converter(outputURL);
    }
  }

  return outputURL;

}

function stripAmazonQueryStrings(inputURL) {
  let regex = /(.*\/)ref=.*$/;
  let match = inputURL.match(regex);
  if (Array.isArray(match) && match[1])
    return match[1];
  else
    return inputURL;
}

module.exports = normalize;
