'use strict';
const debug = require('../../util/debug');

let api = {

  // Set the API flag for API requests, and ensure all API requests come either
  // from a browser or an application.
  prepareRequest: function(req, res, next) {
    req.isAPI = true;
    if (req.get('x-requested-with') != 'XMLHttpRequest' &&
      req.get('x-requested-with') != 'app') {
      let response = {};
      response.message = 'Access denied.';
      response.errors = ['Missing X-Requested-With header. Must be set to "XMLHttpRequest" or "app" to avoid request forgery.'];
      res.status(400);
      res.type('json');
      res.send(JSON.stringify(response, null, 2));
    } else
      next();
  },
  signinRequired: function(req, res) {
    let response = {};
    response.message = 'Could not perform action.';
    response.errors = ['Authentication required.'];
    res.type('json');
    res.status(401);
    res.send(JSON.stringify(response, null, 2));
  }
};

module.exports = api;
