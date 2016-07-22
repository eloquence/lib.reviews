'use strict';
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');

const Thing = require('../models/thing');
const mlString = require('../models/ml-string');
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');

/* GET users listing. */
router.get('/thing/:id', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.get(id)
    .then(thing => {
      thing.populateRights(req.user);
      sendThing(req, res, thing);
    })
    .catch(error => {
      if (error.name == 'DocumentNotFoundError')
        sendThingNotFound(req, res, id);
      else
        next(error);
    });
});

router.get('/thing/:id/edit/label', function(req, res, next) {
  if (!req.user)
    return render.signinRequired(req, res, {
      titleKey: 'edit label'
    });

  let id = req.params.id.trim();
  Thing.get(id)
    .then(thing => {
      thing.populateRights(req.user);
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
    .catch(error => {
      if (error.name == 'DocumentNotFoundError')
        sendThingNotFound(req, res, id);
      else
        next(error);
    });
});

// FIXME: Permission checks!
router.post('/thing/:id/edit/label', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.get(id)
    .then(thing => {
      thing.populateRights(req.user);
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
    .catch(error => {
      if (error.name == 'DocumentNotFoundError')
        sendThingNotFound(req, res, id);
      else
        next(error);
    });
});



function sendThing(req, res, thing, edit) {
  let errors = req.flash('errors');
  // For convenient access to primary URL
  if (thing.urls && thing.urls.length) {
    thing.mainURL = thing.urls.shift();
    if (thing.urls.length)
      thing.otherURLs = thing.urls;
  }

  // For convenient access to labels in current language
  thing.label = mlString.resolve(req.locale, thing.label);

  render.template(req, res, 'thing', {
    deferHeader: edit ? true : false,
    titleKey: edit ? edit.titleKey : undefined,
    thing,
    edit,
    errors
  });
}

function sendThingNotFound(req, res, id) {
  res.status(404);
  render.template(req, res, 'no-thing', {
    titleKey: 'thing not found',
    id: escapeHTML(id)
  });
}

module.exports = router;
