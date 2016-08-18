'use strict';
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');
const thinky = require('../db');
const r = thinky.r;
const hbs = require('hbs');

const Thing = require('../models/thing');
const Review = require('../models/review');
const mlString = require('../models/helpers/ml-string');
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');
const getResourceErrorHandler = require('./handlers/resource-error-handler');

/* GET users listing. */
router.get('/thing/:id', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.getNotStaleOrDeleted(id)
    .then(thing => {

      let p1, p2;

      thing.populateUserInfo(req.user);

      // We don't use a join so we can use the orderBy index on this query.
      p1 = Review.getFeed({
        thingID: thing.id,
        withThing: false
      });

      // Separate query for any reviews by the user. Populates with user info.
      p2 = thing.getReviewsByUser(req.user);

      Promise
      .all([p1, p2])
      .then(result => {

        result[0].feedItems.forEach((review, index) => {
          review.populateUserInfo(req.user);

          // We obtain the user's own review(s) separately.
          // They may not even appear in this feed since it has a limit.
          if (review.userIsAuthor)
            result[0].feedItems.splice(index, 1);

        });
        sendThing(req, res, thing, false, result[0], result[1]);
      })
      .catch(error => next(error));
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.get('/thing/:id/edit/label', function(req, res, next) {
  if (!req.user)
    return render.signinRequired(req, res, {
      titleKey: 'edit label'
    });

  let id = req.params.id.trim();
  Thing.getNotStaleOrDeleted(id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, {
          titleKey: 'edit label'
        });

      let edit = {
        label: true,
        titleKey: 'edit label'
      };
      sendThing(req, res, thing, edit);
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.post('/thing/:id/edit/label', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.getNotStaleOrDeleted(id)
    .then(thing => {

      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, {
          titleKey: 'edit label'
        });

      thing.newRevision(req.user).then(newRev => {
          if (!newRev.label)
            newRev.label = {};
          newRev.label[req.body['thing-label-language']] = escapeHTML(req.body['thing-label']);
          newRev.save().then(thing => {
              res.redirect(`/thing/${id}`);
            })
            .catch(error => {
              let errorMessage = Thing.resolveError(error);
              flashError(req, errorMessage, 'editing label - saving');
              sendThing(req, res, thing);
            });
        })
        .catch(error => {
          flashError(req, error, 'editing label - creating new revision');
          sendThing(req, res, thing);
        });
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});


function sendThing(req, res, thing, edit, feed, userReviews) {
  let pageErrors = req.flash('pageErrors');
  let showLanguageNotice = false;
  let user = req.user;

  if (edit && req.method == 'GET' && (!user.suppressedNotices ||
    user.suppressedNotices.indexOf('language-notice-thing') == -1))
    showLanguageNotice = true;

  render.template(req, res, 'thing', {
    deferHeader: edit ? true : false,
    titleKey: edit ? edit.titleKey : undefined,
    titleString: hbs.handlebars.helpers.getThingLabel(thing),
    thing,
    edit,
    pageErrors,
    deferPageHeader: true,
    showLanguageNotice,
    userReviews,
    feedItems: feed ? feed.feedItems : undefined
  });
}

module.exports = router;
