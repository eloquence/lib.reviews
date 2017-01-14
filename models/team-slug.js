'use strict';
const thinky = require('../db');
const type = thinky.type;
const unescapeHTML = require('unescape-html');

let teamSlugSchema = {
  name: type.string().max(100),
  teamID: type.string().uuid(4),
  createdOn: type.date(),
  createdBy: type.string().uuid(4)
};

let TeamSlug = thinky.createModel("team_slugs", teamSlugSchema, {
  pk: "name"
});

TeamSlug.generateSlug = function(teamName) {
  if (typeof teamName !== 'string')
    throw new Error('Team name is undefined or not a string.');

  let slugName = unescapeHTML(teamName)
    .trim()
    .toLowerCase()
    .replace(/[?&"'`<>]/g, '')
    .replace(/[ _]/g, '-');

  if (!slugName)
    throw new Error('Team name could not be converted to a valid slug.');

  return slugName;

};


module.exports = TeamSlug;
