'use strict';
// External dependencies
const unescapeHTML = require('unescape-html');

// Converts a source string (e.g., a team name, or a thing label) into a slug
// or throws an error if this is not possible. String must be monolingual.
module.exports = function generateSlugName(str) {
  if (typeof str !== 'string')
    throw new InvalidSlugStringError('Source string is undefined or not a string.');

  str = str.trim();

  if (str === '')
    throw new InvalidSlugStringError('Source string cannot be empty.');

  let slugName = unescapeHTML(str)
    .trim()
    .toLowerCase()
    .replace(/[?&"'`<>]/g, '')
    .replace(/[ _]/g, '-');

  if (!slugName)
    throw new InvalidSlugStringError(`Source string '${str}' cannot be converted to a valid slug.`); // Expected depending on user input

  return slugName;
};

class InvalidSlugStringError extends Error {
  constructor(...args) {
    super(args);
    this.name = 'InvalidSlugStringError';
  }
}
