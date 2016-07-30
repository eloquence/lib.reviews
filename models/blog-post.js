'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');

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
  date: type.date(),
  originalLanguage: type.string()
};

// Add versioning related fields
Object.assign(blogPostSchema, revision.getSchema());
let BlogPost = thinky.createModel("blog_posts", blogPostSchema);
BlogPost.define("newRevision", revision.getNewRevisionHandler(BlogPost));
BlogPost.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(BlogPost));

module.exports = BlogPost;
