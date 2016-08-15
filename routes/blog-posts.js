'use strict';
const BlogPostProvider = require('./handlers/blog-post-provider');

let router = BlogPostProvider.bakeRoutes(null, {
  browse: '/team/:id/blog',
  browseBefore: '/team/:id/blog/before/:utcISODate',
  read: '/team/:id/post/:postID',
  add: '/team/:id/new/post',
  edit: '/team/:id/post/:postID/edit',
  delete: '/team/:id/post/:postID/delete',
});

module.exports = router;
