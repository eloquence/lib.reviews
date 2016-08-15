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
BlogPost.getNotStaleOrDeleted = revision.getNotStaleOrDeletedHandler(BlogPost);

BlogPost.define("newRevision", revision.getNewRevisionHandler(BlogPost));
BlogPost.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(BlogPost));

BlogPost.define("populateUserInfo", function(user) {

  if (!user) // Keep at permissions at default (false)
    return;

  if (user.id === this.createdBy)
    this.userCanEdit = true;

  if (user.id === this.createdBy || user.isSiteModerator)
    this.userCanDelete = true;

});

BlogPost.getWithCreator = function(id) {
  return new Promise((resolve, reject) => {
    BlogPost
      .get(id)
      .getJoin({
        creator: {
          _apply: seq => seq.without('password')
        }
      })
      .then(post => {
        if (post._revDeleted)
          return reject(revision.deletedError);

        if (post._revOf)
          return reject(revision.staleError);

        resolve(post);

      })
      .catch(error => reject(error));
  });
};

BlogPost.getMostRecentBlogPosts = function(teamID, options) {
  if (!teamID)
    throw new Error('We require a team ID to fetch blog posts.');

  options = Object.assign({ // Defaults
    limit: 10,
    // Only show posts older than this date. Must be JavaScript Date object.
    offsetDate: undefined
  }, options);



  let query = BlogPost;

  if (options.offsetDate && options.offsetDate.valueOf)
    query = query.between(r.minval, r.epochTime(options.offsetDate.valueOf() / 1000), {
      index: 'createdOn',
      rightBound: 'open' // Do not return previous record that exactly matches offset
    });


  query = query.orderBy({
      index: r.desc('createdOn')
    })
    .filter({
      teamID
    })
    .filter({
      _revDeleted: false
    }, {
      default: true
    })
    .filter({
      _revOf: false
    }, {
      default: true
    })
    .limit(options.limit + 1) // One over limit to check if we need potentially another set
    .getJoin({
      creator: {
        _apply: seq => seq.without('password')
      }
    });

  return new Promise((resolve, reject) => {

    query
      .then(blogPosts => {

        let result = {};

        // At least one additional document available, set offset for pagination
        if (blogPosts.length == options.limit + 1) {
          result.offsetDate = blogPosts[options.limit - 1].createdOn;
          blogPosts.pop();
        }

        result.blogPosts = blogPosts;

        resolve(result);
      })
      .catch(error => reject(error));

  });

};


module.exports = BlogPost;
