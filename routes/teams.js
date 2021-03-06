'use strict';
const escapeHTML = require('escape-html');

const TeamProvider = require('./handlers/team-provider');
const TeamJoinRequest = require('../models/team-join-request');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const render = require('./helpers/render');
const mlString = require('../models/helpers/ml-string');
const languages = require('../locales/languages');
const slugs = require('./helpers/slugs');


// Default routes for read, edit, add, delete
let router = TeamProvider.bakeRoutes('team');

router.get('/team', (req, res) => res.redirect('/teams'));

// Feed of all reviews
router.get('/team/:id/feed', (req, res, next) => {
  const teamProvider = new TeamProvider(req, res, next, {
    action: 'feed',
    method: 'GET',
    id: req.params.id
  });
  teamProvider.execute();
});

// Feed of all reviews before a given date
router.get('/team/:id/feed/before/:utcisodate', (req, res, next) => {
  let offsetDate = new Date(req.params.utcisodate);
  if (!offsetDate || offsetDate == 'Invalid Date')
    offsetDate = null;

  let teamProvider = new TeamProvider(req, res, next, {
    action: 'feed',
    method: 'GET',
    id: req.params.id,
    offsetDate
  });
  teamProvider.execute();
});

router.get('/team/:id/feed/atom', (req, res) =>
  res.redirect(`/team/${req.params.id}/feed/atom/${req.locale}`)
);

// Feed of all reviews in Atom format
router.get('/team/:id/feed/atom/:language', (req, res, next) => {
  let { language } = req.params;
  if (!languages.isValid(language))
    language = 'en';

  let teamProvider = new TeamProvider(req, res, next, {
    action: 'feed',
    method: 'GET',
    id: req.params.id,
    format: 'atom',
    language
  });
  teamProvider.execute();
});


// Show list of all teams
router.get('/teams', function(req, res, next) {
  let teamProvider = new TeamProvider(req, res, next, {
    action: 'browse',
    method: 'GET'
  });
  teamProvider.execute();
});

// Show membership roster for a specific team
router.get('/team/:id/members', function(req, res, next) {
  let teamProvider = new TeamProvider(req, res, next, {
    action: 'members',
    method: 'GET',
    id: req.params.id
  });
  teamProvider.execute();
});

// Moderator tool for managing requests which require moderator approval
router.get('/team/:id/manage-requests', function(req, res, next) {
  let teamProvider = new TeamProvider(req, res, next, {
    action: 'manageRequests',
    method: 'GET',
    id: req.params.id
  });
  teamProvider.execute();
});

// Moderator tool for managing requests which require moderator approval
router.post('/team/:id/manage-requests', function(req, res, next) {
  let teamProvider = new TeamProvider(req, res, next, {
    action: 'manageRequests',
    method: 'POST',
    id: req.params.id
  });
  teamProvider.execute();
});

// Process join requests, form is on team page itself
router.post('/team/:id/join', function(req, res, next) {
  const { id } = req.params;
  slugs
    .resolveAndLoadTeam(req, res, id)
    .then(team => {
      team.populateUserInfo(req.user);
      if (!team.userCanJoin)
        return render.permissionError(req, res);

      if (team.rules && mlString.resolve(req.locale, team.rules.html) &&
        !req.body['agree-to-rules']) {
        req.flash('joinErrors', req.__('must agree to team rules'));
        return res.redirect(`/team/${id}`);
      }

      if (team.modApprovalToJoin) {
        let teamJoinRequest = new TeamJoinRequest({
          teamID: team.id,
          userID: req.user.id,
          requestMessage: escapeHTML(req.body['join-request-message'].trim()),
          requestDate: new Date()
        });
        teamJoinRequest.save().then(() => {
          res.redirect(`/team/${id}`);
        })
        .catch(next); // Problem saving join request

      } else { // No approval required, just add the new member

        team.members.push(req.user);
        team
          .saveAll()
          .then(() => {
            req.flash('pageMessages', req.__('welcome to the team'));
            res.redirect(`/team/${id}`);
          })
          .catch(next); // Problem saving user changes
      }
    })
    .catch(getResourceErrorHandler(req, res, next, 'team', id));
});

// Process leave requests, form is on team page itself
router.post('/team/:id/leave', function(req, res, next) {
  const { id } = req.params;
  slugs
    .resolveAndLoadTeam(req, res, id)
    .then(team => {
      team.populateUserInfo(req.user);
      if (!team.userCanLeave)
        return render.permissionError(req, res);

      team.members = team.members.filter(member => member.id !== req.user.id);
      team.moderators = team.moderators.filter(moderator => moderator.id !== req.user.id);
      team
        .saveAll()
        .then(() => {
          req.flash('pageMessages', req.__('goodbye team'));
          res.redirect(`/team/${id}`);
        })
        .catch(next); // Problem saving user changes
    })
    .catch(getResourceErrorHandler(req, res, next, 'team', id));
});

module.exports = router;
