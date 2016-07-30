'use strict';
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');

const render = require('./helpers/render');
const User = require('../models/user');
const Team = require('../models/team');

router.get('/new/team', function(req, res, next) {
  if (!req.user || !req.user.isTrusted)
    return render.permissionError(req, res, next);
  else
    render.template(req, res, 'team-form', {
      titleKey: 'new team',
      scripts: [ 'team.js' ]
    });
});

router.get('/team/:id', function(req, res, next) {
  let id = req.params.id.trim();
  Team
    .get(id)
    .then(team => {
      render.template(req, res, 'team');
    })
    .catch(error => {
      if (error.name == 'DocumentNotFoundError')
        render.template(req, res, 'no-team', { id });
      else
        next(error);
    });
});

router.get('/:id/blog', function(req, res, next) {

});

module.exports = router;
