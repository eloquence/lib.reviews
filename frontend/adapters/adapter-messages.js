'use strict';
const msgArr = [
  'no relevant results',
  'load next page',
  'load previous page',
  'more results',
  'no search results',
  'one edition',
  'multiple editions',
  'unknown year',
  'single year',
  'year range',
  'review via openlibrary help label',
  'review via wikidata help label',
  'review via openlibrary help text',
  'review via wikidata help text',
  'start typing to search openlibrary',
  'start typing to search wikidata'
];
const getMessages = require('../../util/get-messages');

module.exports.getAdapterMessageKeys = function() {
  return msgArr.slice();
};

module.exports.getAdapterMessages = function(locale) {
  return getMessages(locale, msgArr.slice());
};
