'use strict';
const msgArr = [
  'no relevant results',
  'load next page',
  'load previous page',
  'more results',
  'wikidata title blacklist',
  'no search results'
];
const getMessages = require('../../util/get-messages');

module.exports.getAdapterMessageKeys = function() {
  return msgArr.slice();
};

module.exports.getAdapterMessages = function(locale) {
  return getMessages(locale, msgArr.slice());
};
