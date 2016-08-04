'use strict';
const TeamProvider = require('./handlers/team-provider');

let router = TeamProvider.bakeRoutes('team');

module.exports = router;
