'use strict';
const thinky = require('../db');
const type = thinky.type;

let teamSlugSchema = {
  name: type.string().max(100),
  teamID: type.string().uuid(4),
  createdOn: type.date(),
  createdBy: type.string().uuid(4)
};

let TeamSlug = thinky.createModel("team_slugs", teamSlugSchema, {
  pk: "name"
});

module.exports = TeamSlug;
