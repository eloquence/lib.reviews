'use strict';
// Internal dependencies
const thinky = require('../db');
const type = thinky.type;
const r = thinky.r;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');
const slugName = require('./helpers/slug-name');
const getSetIDHandler = require('./helpers/set-id');
const isValidLanguage = require('../locales/languages').isValid;
const User = require('./user');
const Review = require('./review');
const TeamSlug = require('./team-slug');

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

  canonicalSlugName: type.string(),

  // For collaborative translation of team metadata
  originalLanguage: type.string().max(4).validator(isValidLanguage),

  // For feeds
  reviewOffsetDate: type.virtual().default(null),

  // These can only be populated from the outside using a user object
  userIsFounder: type.virtual().default(false),
  userIsMember: type.virtual().default(false),
  userIsModerator: type.virtual().default(false),
  userCanBlog: type.virtual().default(false),
  userCanJoin: type.virtual().default(false),
  userCanLeave: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userCanDelete: type.virtual().default(false),

  urlID: type.virtual().default(function() {
    return this.canonicalSlugName ? encodeURIComponent(this.canonicalSlugName) : this.id;
  }),

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

Team.hasOne(TeamSlug, "slug", "id", "teamID");

TeamSlug.belongsTo(Team, "team", "teamID", "team");

User.hasAndBelongsToMany(Team, "teams", "id", "id", {
  type: 'membership'
});

User.hasAndBelongsToMany(Team, "moderatorOf", "id", "id", {
  type: 'moderatorship'
});

// Any review can have any number of teams associated with it and vice versa.
Team.hasAndBelongsToMany(Review, "reviews", "id", "id", {
  type: 'team_content'
});

Review.hasAndBelongsToMany(Team, "teams", "id", "id", {
  type: 'team_content'
});


Team.createFirstRevision = revision.getFirstRevisionHandler(Team);
Team.getNotStaleOrDeleted = revision.getNotStaleOrDeletedHandler(Team);
Team.getWithData = function(id, options) {

  options = Object.assign({ // Default: all first-level joins except reviews
    withMembers: true,
    withModerators: true,
    withJoinRequests: true,
    withJoinRequestDetails: false,
    withReviews: false,
    reviewLimit: 1,
    reviewOffsetDate: null
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

    if (options.withReviews) {
      join.reviews = {
        creator: true,
        teams: true,
        thing: true
      };
      if (options.reviewOffsetDate)
        join.reviews._apply = seq => seq
        .orderBy(r.desc('createdOn'))
        .filter(review => review('createdOn').lt(options.reviewOffsetDate))
        .limit(options.reviewLimit + 1);
      else
        join.reviews._apply = seq => seq
        .orderBy(r.desc('createdOn'))
        .limit(options.reviewLimit + 1);
    }

    Team
      .get(id)
      .getJoin(join)
      .then(team => {
        if (team._revDeleted)
          return reject(revision.deletedError);

        if (team._revOf)
          return reject(revision.staleError);

        // At least one additional document available, return offset for pagination
        if (options.withReviews && Array.isArray(team.reviews) &&
          team.reviews.length == options.reviewLimit + 1) {
          team.reviews.pop();
          team.reviewOffsetDate = team.reviews[team.reviews.length - 1].createdOn;
        }
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

  if (team.userIsModerator || user.isSuperUser)
    team.userCanEdit = true;

  // For now, only site-wide mods can delete teams
  if (user.isSuperUser || user.isSiteModerator)
    team.userCanDelete = true;

  // For now, founders can't leave their team - must be deleted
  if (!team.userIsFounder && team.userIsMember)
    team.userCanLeave = true;

});

// Update the slug if an update is needed. Modifies the team object but does
// not save it.
Team.define("updateSlug", slugName.getUpdateSlugHandler({
  SlugModel: TeamSlug,
  slugForeignKey: 'teamID',
  slugSourceField: 'name'
}));

Team.define("setID", getSetIDHandler());

module.exports = Team;
