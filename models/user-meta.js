'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');

let userMetaSchema = {
  id: type.string(),
  bio: {
    text: mlString.getSchema({
      maxLength: 1000
    }),
    html: mlString.getSchema({
      maxLength: 1000
    })
  },
  originalLanguage: type.string().required() // We track this to enable collaborative bio translations
};


// Add versioning related fields
Object.assign(userMetaSchema, revision.getSchema());
let UserMeta = thinky.createModel("user_meta", userMetaSchema);
UserMeta.define("newRevision", revision.getNewRevisionHandler(UserMeta));
UserMeta.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(UserMeta));

module.exports = UserMeta;
