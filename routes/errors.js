'use strict';

// External dependencies
const express = require('express');
const router = express.Router();

// Internal dependencies
const render = require('./helpers/render');
const debug = require('../util/debug');

let errors =  {

  maintenanceMode: function(req, res, next) {
    if (req.path !== '/')
      return res.redirect('/');

    render.template(req, res, 'maintenance', {
      titleKey: 'maintenance mode'
    });
  },

  notFound: function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    render.template(req, res, '404', {
      titleKey: 'page not found title'
    });
  },

  generic: function(error, req, res, next) {

    let showDetails;
    // Not defined yet when this file is included, so required here instead.
    let app = require('../app');

    if (app.get('env') === 'development')
      showDetails = true;
    else
      showDetails = (req.user && req.user.showErrorDetails);

    res.status(error.status || 500);

    if (req.isAPI) {
      let response;
      switch (error.message) {
        case 'invalid json':
          response = {
            message: 'Could not process your request.',
            errors: ['Received invalid JSON data. Make sure your payload is in JSON format.']
          };
          break;
        default:
          response = {
            message: 'An error occurred processing your request.',
            errors: showDetails ? [error.message, `Stack: ${error.stack}`] : ['Unknown error. This has been logged.']
          };
          debug.error({
            context: 'API',
            req,
            error
          });
      }
      res.type('json');
      res.send(JSON.stringify(response, null, 2));
    } else {

      debug.error({
        context: 'web app',
        req,
        error
      });

      render.template(req, res, 'error', {
        titleKey: 'something went wrong',
        showDetails,
        error
      });
    }
  }
};
module.exports = errors;
