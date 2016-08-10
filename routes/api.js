'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const config = require('config');

// Internal dependencies
const debug = require('../util/debug');
const User = require('../models/user');
const actionHandler = require('./handlers/action-handler');

router.post('/actions/suppress-notice', actionHandler.suppressNotice);

router.get('/user/:name', function(req, res, next) {
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
