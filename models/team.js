'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');

let teamSchema = {
  id: type.string(),
  name: mlString.getSchema({
    maxLength: 100
  }),
  motto: mlString.getSchema({
    maxLength: 200
  }),
  description: {
    text: mlString.getSchema(),
    html: mlString.getSchema()
  },
  rules: {
    text: mlString.getSchema(),
    html: mlString.getSchema()
  },
  modApprovalToJoin: type.boolean(),
  onlyModsCanBlog: type.boolean(),
  moderators: [type.string().uuid(4)],

  // For collaborative translation of team metadata
  originalLanguage: type.string().max(4),

  // When a user joins this team, they get the permissions defined here.
  // When they leave, they lose them.
  confersPermissions: {
    // Confers permission to see detailed debug messages
    showErrorDetails: type.boolean().default(false),
    // Team membership confers permission to translate multilingual text
    translate: type.boolean().default(false)
  }
};

// Add versioning related fields
Object.assign(teamSchema, revision.getSchema());
let Team = thinky.createModel("team", teamSchema);
Team.define("newRevision", revision.getNewRevisionHandler(Team));
Team.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(Team));

module.exports = Team;
