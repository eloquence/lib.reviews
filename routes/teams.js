'use strict';
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');
const md = require('markdown-it')({
  linkify: true,
  breaks: true,
  typographer: true
});
const forms = require('./helpers/forms');
const render = require('./helpers/render');
const User = require('../models/user');
const Team = require('../models/team');
const TeamFormHandler = require('./handlers/team-form-handler');
const mlString = require('../models/helpers/ml-string.js');

router.get('/new/team', function(req, res, next) {
  let teamForm = new TeamFormHandler(req, res, next);
  teamForm.execute();
});

router.post('/new/team', function(req, res, next) {
  let teamForm = new TeamFormHandler(req, res, next, {
    method: 'POST'
  });
  teamForm.execute();
});

router.get('/team/:id/edit', function(req, res, next) {
  let teamForm = new TeamFormHandler(req, res, next, {
    action: 'edit',
    method: 'GET',
    id: req.params.id.trim()
  });
  teamForm.execute();
});

router.post('/team/:id/edit', function(req, res, next) {
  let teamForm = new TeamFormHandler(req, res, next, {
    action: 'edit',
    method: 'POST',
    id: req.params.id.trim()
  });
  teamForm.execute();
});

router.get('/team/:id/delete', function(req, res, next) {
  let teamForm = new TeamFormHandler(req, res, next, {
    action: 'delete',
    method: 'GET',
    id: req.params.id.trim()
  });
  teamForm.execute();
});

router.post('/team/:id/delete', function(req, res, next) {
  let teamForm = new TeamFormHandler(req, res, next, {
    action: 'delete',
    method: 'POST',
    id: req.params.id.trim()
  });
  teamForm.execute();
});


router.get('/team/:id', function(req, res, next) {
  let id = req.params.id.trim();
  Team
    .get(id)
    .then(team => {

      if (team._revDeleted)
        throw new Error('deleted');

      if (req.user)
        team.populateUserInfo(req.user);

      let titleParam = mlString.resolve(req.locale, team.name).str;

      render.template(req, res, 'team', {
        team,
        titleKey: 'team title',
        titleParam,
        deferPageHeader: true // Two-column-layout
      });
    })
    .catch(error => {
      if (error.name == 'DocumentNotFoundError' || error.message == 'deleted')
        render.template(req, res, 'no-team', {
          id
        });
      else
        next(error);
    });
});

router.get('/:id/blog', function(req, res, next) {

});

module.exports = router;
