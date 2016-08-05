'use strict';
const thinky = require('../db');
const r = thinky.r;
const type = thinky.type;
const Errors = thinky.Errors;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');
const isValidLanguage = require('../locales/languages').isValid;
const User = require('./user');

let blogPostSchema = {
  id: type.string(),
  teamID: type.string().uuid(4),
  title: mlString.getSchema({
    maxLength: 100
  }),
  post: {
    text: mlString.getSchema(),
    html: mlString.getSchema()
  },
  // Track original authorship
  createdOn: type.date(),
  createdBy: type.string(),
  originalLanguage: type.string().max(4).required().validator(isValidLanguage),
  userCanEdit: type.virtual().default(false),
  userCanDelete: type.virtual().default(false)
};

// Add versioning related fields
Object.assign(blogPostSchema, revision.getSchema());
let BlogPost = thinky.createModel("blog_posts", blogPostSchema);

BlogPost.ensureIndex("createdOn");
BlogPost.belongsTo(User, "creator", "createdBy", "id");

BlogPost.createFirstRevision = revision.getFirstRevisionHandler(BlogPost);
BlogPost.define("newRevision", revision.getNewRevisionHandler(BlogPost));
BlogPost.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(BlogPost));

BlogPost.define("populateUserInfo", function(user) {

  if (!user) // Keep at permissions at default (false)
    return;

  if (user.id === this.createdBy)
    this.userCanEdit = true;

  if (user.id === this.createdBy || user.isModerator)
    this.userCanDelete = true;

});

BlogPost.getWithCreator = function(id) {
  return BlogPost
  .get(id)
  .getJoin({
    creator: {
      _apply: seq => seq.without('password')
    }
  });
};

BlogPost.getMostRecentBlogPosts = function(teamID, options) {
  if (!teamID)
    throw new Error('We require a team ID to fetch blog posts.');

  options = Object.assign({ // Defaults
    limit: 10
  }, options);

  let rv = BlogPost
    .orderBy({
      index: r.desc('createdOn')
    })
    .filter(r.row('_revDeleted').eq(false), { // Exclude deleted rows
      default: true
    })
    .filter(r.row('_revOf').eq(false), { // Exclude old versions
      default: true
    })
    .limit(options.limit)
    .getJoin({
      creator: {
        _apply: seq => seq.without('password')
      }
    });


  return rv;

};


module.exports = BlogPost;
