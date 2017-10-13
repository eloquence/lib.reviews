// Because many sites generate multiple URLs or URL variants pointing to the same resource,
// we standardize user-submitted URLs before storing or querying them. This reduces the need
// for manual merging.
'use strict';

// Node's built-in module helps a little
const url = require('url');

const urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)|\/|\?)*)?$/i;


// host: match against the hostname part of the URL
// converter: conversion to be applied to a URL of this type before it is added
//   to the database
// tags: internal descriptors that identify this URL, which can be used to group
//   related URLs. For applications that only use one tag, the first tag in the
//   array is chosen.
// id: identifier for all URLs of this type, which can be used to create
//  a default non-alphabetic presentation order all known URLs of a certain type
const rules = [{
    host: /^(www\.)?amazon\.com$/,
    converter: _stripAmazonQueryStrings,
    tags: ['shops', 'reviews'],
    id: 'amazon'
  },
  {
    host: /^(www\.)?wikidata\.org$/,
    tags: ['databases', 'opendata'],
    id: 'wikidata'
  },
  {
    host: /^(www\.)?goodreads\.com$/,
    tags: ['reviews', 'databases'],
    id: 'goodreads'
  },
  {
    host: /^(www\.)?openstreetmap\.org$/,
    tags: ['maps', 'opendata', 'databases'],
    id: 'openstreetmap'
  },
  {
    host: /^openlibrary\.org$/,
    tags: ['databases', 'opendata'],
    id: 'openlibrary'
  },
  {
    host: /^(www\.)?imdb\.com$/,
    tags: ['databases', 'reviews'],
    id: 'imdb'
  },
  {
    host: /^(www\.)?yelp\.com$/,
    tags: ['reviews', 'databases'],
    id: 'yelp'
  },
  {
    host: /^(www\.)?tripadvisor\.com$/,
    tags: ['reviews', 'databases'],
    id: 'yelp'
  },
  {
    host: /^(www\.)?indiebound\.org$/,
    tags: ['shops'],
    id: 'indiebound'
  },

  {
    host: /^([a-z]*)?wikipedia\.org$/,
    tags: ['summaries', 'databases', 'opendata'],
    id: 'yelp'
  }

];

// Preferred order. We generally rank open data before proprietary data, and
// nonprofit platforms before for-profit ones.
const placement = {
  databases: ['wikidata', 'imdb'],
  maps: ['openstreetmap'],
  reviews: ['yelp', 'tripadvisor', 'goodreads'],
  shops: ['indiebound', 'amazon'],
  summaries: ['wikipedia']
};

let urlUtils = {

  validate(inputURL) {
    return urlRegex.test(inputURL);
  },

  normalize(inputURL) {
    let outputURL;
    let parsedURL = url.parse(inputURL);

    // Normalizes trailing slashes
    outputURL = parsedURL.href;


    for (let rule of rules) {
      if (rule.converter && rule.host.test(parsedURL.hostname)) {
        outputURL = rule.converter(outputURL);
      }
    }

    return outputURL;

  },

  // Transforms an URL array into a key value object as follows:
  //
  // {
  //   databases:  [{ id: 'wikidata', url: 'https://www.wikidata.org/wiki/Q2611788' }],
  //   reviews: [{ id: 'yelp', url: 'https://www.yelp.com/biz/katzs-delicatessen-new-york'],
  //   opendata: [{ id: 'wikidata', url: 'https://www.wikidata.org/wiki/Q2611788' }],
  //   other: ['https://www.katzsdelicatessen.com/']
  //  }
  //
  // If onlyOneTag is set to true, the first tag from the rules is applied.
  // If sortResults is set to true, the placement rules are applied.
  getURLsByTag(inputURLs = [], options = { onlyOneTag: false, sortResults: false }) {
    const { onlyOneTag, sortResults } = options;
    const rv = {};
    for (let inputURL of inputURLs) {
      let recognized = false;
      let parsedURL = url.parse(inputURL);
      for (let rule of rules) {
        if (rule.host.test(parsedURL.hostname) && rule.tags && rule.id) {
          for (let tag of rule.tags) {
            if (rv[tag] === undefined)
              rv[tag] = [];
            rv[tag].push({ id: rule.id, url: inputURL });
            recognized = true;
            if (onlyOneTag)
              break;
          }
        }
      }

      // Sort surces in each tag using placement array, provided it's
      // configured for this tag
      if (sortResults) {
        for (let tag in rv) {
          if (Array.isArray(placement[tag]))
            rv[tag].sort((obj1, obj2) => {
              // Look up source IDs in the placement array
              let p1 = placement[tag].indexOf(obj1.id);
              let p2 = placement[tag].indexOf(obj2.id);

              // For legibility
              let p1Found = p1 != -1;
              let p2Found = p2 != -1;

              // A return value of -1 means p1 wins (is earlier in the result
              // array); a return value of 1 means p2 wins.
              //
              // If one of the two isn't found in the placement array at all,
              // the other wins. Otherwise, being later in the placement array
              // means being later in the result array.
              if (p1 > p2)
                return !p2Found ? -1 : 1;
              else if (p1 < p2)
                return !p1Found ? 1 : -1;
              else
                return 0; // We don't care
            });
        }
      }
      if (!recognized) {
        if (rv.other === undefined)
          rv.other = [];
        rv.other.push({ id: 'unknown', url: inputURL });
      }
    }
    return rv;
  },

  prettify(inputURL) {
    return inputURL
      .replace(/^.*?:\/\//, '') // strip protocol
      .replace(/\/$/, ''); // remove trailing slashes
  }

};

function _stripAmazonQueryStrings(inputURL) {
  let regex = /(.*\/)ref=.*$/;
  let match = inputURL.match(regex);
  if (Array.isArray(match) && match[1])
    return match[1];
  else
    return inputURL;
}

module.exports = urlUtils;
