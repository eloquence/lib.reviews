'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const User = require('../models/user');
const actionHandler = require('./handlers/action-handler');
const search = require('../search');

// For true/false user preferences.
router.post('/actions/:modify-preference', actionHandler.modifyPreference);

router.post('/actions/suppress-notice', actionHandler.suppressNotice);

// Search suggestions
router.get('/suggest/thing/:prefix', function(req, res, next) {
  let prefix = req.params.prefix.trim();
  search
    .suggestThing(prefix, req.locale)
    .then(results => {
      let rv = {};

      // Simplify ElasticSearch result structure for API use (flatten, strip
      // metadata; strip unneeded source data)
      rv.results = results.suggest;
      for (let k in rv.results) {
        rv.results[k] = rv.results[k][0].options;
        for (let option of rv.results[k]) {
          option.urlID = option._source.urlID;
          option.urls = option._source.urls;
          Reflect.deleteProperty(option, '_source');
          Reflect.deleteProperty(option, '_index');
        }
      }

      res.type('json');
      res.status(200);
      res.send(JSON.stringify(rv, null, 2));
    })
    .catch(next);
});

router.get('/user/:name', function(req, res) {
  let name = req.params.name.trim();
  let rv = {};
  User.filter({
    canonicalName: User.canonicalize(name)
  }).then(result => {
    if (result.length) {
      let user = result[0];
      rv.id = user.id;
      rv.displayName = user.displayName;
      rv.canonicalName = user.canonicalName;
      rv.registrationDate = user.registrationDate;
      rv.isSiteModerator = user.isSiteModerator;
      res.status(200);
    } else {
      rv.message = 'Could not retrieve user data.';
      rv.errors = ['User does not exist.'];
      res.status(404);
    }
    res.type('json');
    res.send(JSON.stringify(rv, null, 2));
  });
});

module.exports = router;
