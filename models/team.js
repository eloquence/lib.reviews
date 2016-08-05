'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');
const isValidLanguage = require('../locales/languages').isValid;

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
  originalLanguage: type.string().max(4).validator(isValidLanguage),

  // These can only be populated from the outside using a user object
  userIsMember: type.virtual().default(false),
  userIsModerator: type.virtual().default(false),
  userCanBlog: type.virtual().default(false),
  userCanJoin: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userCanDelete: type.virtual().default(false),

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
let Team = thinky.createModel("teams", teamSchema);
Team.createFirstRevision = revision.getFirstRevisionHandler(Team);
Team.define("newRevision", revision.getNewRevisionHandler(Team));
Team.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(Team));
Team.define("populateUserInfo", function(user) {
  if (!user)
    return false; // Permissions remain at defaults (false)

  let team = this;
  if (user.teams && user.teams.indexOf(team.id) !== -1)
    team.userIsMember = true;

  if (team.moderators && team.moderators.indexOf(user.id) !== -1)
    team.userIsModerator = true;

  if (team.userIsMember &&  (!team.onlyModsCanBlog || team.userIsModerator))
    team.userCanBlog = true;

  if (!team.userIsMember)
    team.userCanJoin = true;

  if (team.userIsModerator)
    team.userCanEdit = true;

  // For now, only site-wide mods can delete teams
  if (user.isModerator)
    team.userCanDelete = true;

});

module.exports = Team;
