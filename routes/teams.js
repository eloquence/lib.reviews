'use strict';
const TeamProvider = require('./handlers/team-provider');

// Default routes for read, edit, add, delete
let router = TeamProvider.bakeRoutes('team');

// Browse route, non-standard for now
router.get('/teams', function(req, res, next) {
  let teamProvider = new TeamProvider(req, res, next, {
    action: 'browse',
    method: 'GET'
  });
  teamProvider.execute();
});

module.exports = router;
