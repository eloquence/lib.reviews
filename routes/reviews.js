'use strict';

// External dependencies
const escapeHTML = require('escape-html');
const config = require('config');

// Internal dependencies
const db = require('../db');
const r = db.r;
const render = require('./helpers/render');
const forms = require('./helpers/forms');
const flashError = require('./helpers/flash-error');
const ErrorMessage = require('../util/error.js');
const Review = require('../models/review.js');
const ReviewProvider = require('./handlers/review-provider');
const reviewHandlers = require('./handlers/review-handlers');
const mlString = require('../models/helpers/ml-string.js');
const prettifyURL = require('../util/url-utils').prettify;
const BlogPost = require('../models/blog-post');

// Standard routes

let router = ReviewProvider.bakeRoutes('review');

// Additional routes

router.get('/', function(req, res, next) {

  let queries = [Review.getFeed({
    onlyTrusted: true
  })];

  if (config.frontPageTeamBlog)
    queries.push(BlogPost.getMostRecentBlogPosts(config.frontPageTeamBlog));

  Promise.all(queries)

    .then(queryResults => {

      // Promise.all helpfully keeps order in which promises were passed
      let feedItems = queryResults[0];
      let blogPosts = queryResults[1];

      // Set review permissions
      feedItems.forEach(item => {
        item.populateUserInfo(req.user);
        if (item.thing)
          item.thing.populateUserInfo(req.user);
      });

      // Set post permissions
      if (blogPosts)
        blogPosts.forEach(post => {
          post.populateUserInfo(req.user);
        });

      render.template(req, res, 'index', {
        titleKey: 'welcome',
        deferPageHeader: true,
        feedItems,
        blogPosts,
        blogKey: config.frontPageTeamBlogKey,
        showBlog: config.frontPageTeamBlog ? true : false
      });
    });

});


router.get('/feed', reviewHandlers.getFeedHandler());

router.get('/new', (req, res) => {
  res.redirect('/new/review');
});


module.exports = router;
