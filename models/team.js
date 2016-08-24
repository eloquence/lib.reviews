'use strict';
const thinky = require('../db');
const type = thinky.type;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');
const isValidLanguage = require('../locales/languages').isValid;
const User = require('./user');

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

  createdBy: type.string().uuid(4),
  createdOn: type.date(),

  // For collaborative translation of team metadata
  originalLanguage: type.string().max(4).validator(isValidLanguage),

  // These can only be populated from the outside using a user object
  userIsFounder: type.virtual().default(false),
  userIsMember: type.virtual().default(false),
  userIsModerator: type.virtual().default(false),
  userCanBlog: type.virtual().default(false),
  userCanJoin: type.virtual().default(false),
  userCanLeave: type.virtual().default(false),
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

// Define membership and moderator relations; these are managed by the ODM
// as separate tables, e.g. teams_users_membership
Team.hasAndBelongsToMany(User, "members", "id", "id", {
  type: 'membership'
});

Team.hasAndBelongsToMany(User, "moderators", "id", "id", {
  type: 'moderatorship'
});

User.hasAndBelongsToMany(Team, "teams", "id", "id", {
  type: 'membership'
});

User.hasAndBelongsToMany(Team, "moderatorOf", "id", "id", {
  type: 'moderatorship'
});


Team.createFirstRevision = revision.getFirstRevisionHandler(Team);
Team.getNotStaleOrDeleted = revision.getNotStaleOrDeletedHandler(Team);
Team.getWithData = function(id, options) {

  options = Object.assign({ // Default: all first-level joins
    withMembers: true,
    withModerators: true,
    withJoinRequests: true,
    withJoinRequestDetails: false
  }, options);

  return new Promise((resolve, reject) => {

    let join = {};
    if (options.withMembers)
      join.members = true;

    if (options.withModerators)
      join.moderators = true;

    if (options.withJoinRequests)
      join.joinRequests = true;

    if (options.withJoinRequests && options.withJoinRequestDetails) {
      join.joinRequests = {
        user: true
      };
    }

    Team
      .get(id)
      .getJoin(join)
      .then(team => {
        if (team._revDeleted)
          return reject(revision.deletedError);

        if (team._revOf)
          return reject(revision.staleError);
        resolve(team);

      })
      .catch(error => reject(error));
  });

};

Team.define("newRevision", revision.getNewRevisionHandler(Team));
Team.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(Team));
Team.define("populateUserInfo", function(user) {
  if (!user)
    return false; // Permissions remain at defaults (false)

  let team = this;
  if (this.members && this.members.filter(member => member.id === user.id).length)
    team.userIsMember = true;

  if (team.moderators && team.moderators.filter(moderator => moderator.id === user.id).length)
    team.userIsModerator = true;

  if (user.id === team.createdBy)
    team.userIsFounder = true;

  if (team.userIsMember && (!team.onlyModsCanBlog || team.userIsModerator))
    team.userCanBlog = true;

  // Can't join if you have a pending or rejected join request
  if (!team.userIsMember && !team.joinRequests.filter(request => request.userID === user.id).length)
    team.userCanJoin = true;

  if (team.userIsModerator)
    team.userCanEdit = true;

  // For now, only site-wide mods can delete teams
  if (user.isSiteModerator)
    team.userCanDelete = true;

  // For now, founders can't leave their team - must be deleted
  if (!team.userIsFounder && team.userIsMember)
    team.userCanLeave = true;

});

module.exports = Team;
