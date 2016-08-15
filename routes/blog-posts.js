'use strict';
const BlogPostProvider = require('./handlers/blog-post-provider');

let router = BlogPostProvider.bakeRoutes(null, {
  browse: '/team/:id/blog',
  browseBefore: '/team/:id/blog/before/:utcISODate',
  browseAtom: '/team/:id/blog/atom/:language',
  browseAtomDetectLanguage: '/team/:id/blog/atom',
  read: '/team/:id/post/:postID',
  add: '/team/:id/new/post',
  edit: '/team/:id/post/:postID/edit',
  delete: '/team/:id/post/:postID/delete',
});

module.exports = router;
