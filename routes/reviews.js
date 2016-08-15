'use strict';

// External dependencies
const escapeHTML = require('escape-html');
const config = require('config');

// Internal dependencies
const db = require('../db');
const r = db.r;
const render = require('./helpers/render');
const forms = require('./helpers/forms');
const feeds = require('./helpers/feeds');
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

// We show two query results on the front-page, the team developers blog
// and a feed of recent reviews, filtered to include only trusted ones.
router.get('/', function(req, res, next) {

  let queries = [Review.getFeed({
    onlyTrusted: true
  })];

  if (config.frontPageTeamBlog)
    queries.push(BlogPost.getMostRecentBlogPosts(config.frontPageTeamBlog));

  Promise.all(queries)

  .then(queryResults => {

    // Promise.all helpfully keeps order in which promises were passed
    let feedItems = queryResults[0].feedItems;
    let offsetDate = queryResults[0].offsetDate;
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

    let embeddedFeeds = feeds.getEmbeddedFeeds(req, {
      atomURLPrefix: `/feed/atom`,
      atomURLTitleKey: `atom feed of all reviews`,
    });

    render.template(req, res, 'index', {
      titleKey: 'welcome',
      deferPageHeader: true,
      feedItems,
      blogPosts,
      blogKey: config.frontPageTeamBlogKey,
      showBlog: config.frontPageTeamBlog ? true : false,
      utcISODate: offsetDate ? offsetDate.toISOString() : null,
      embeddedFeeds
    });
  });

});


router.get('/feed', reviewHandlers.getFeedHandler());

router.get('/feed/atom', function(req, res) {
  res.redirect(`/feed/atom/${req.locale}`);
});

router.get('/feed/atom/:language', reviewHandlers.getFeedHandler({format: 'atom'}));

router.get('/feed/before/:utcisodate', reviewHandlers.getFeedHandler());

router.get('/new', (req, res) => {
  res.redirect('/new/review');
});


module.exports = router;
