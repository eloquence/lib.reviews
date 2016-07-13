'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const debug = require('../util/debug');
const i18n = require('i18n');
const passport = require('passport');

// Internal dependencies
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');
const User = require('../models/user');


router.get('/signin', function(req, res) {
  let errors = req.flash('errors');
  render.template(req, res, 'signin', {
    titleKey: 'sign in',
    errors
  });
});


router.post('/signin', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    if (!req.body.username)
      req.flash('errors', 'need username');
    if (!req.body.password)
      req.flash('errors', 'need password');
    return res.redirect('/signin');
  }

  passport.authenticate('local', function(error, user, info) {
    if (error) {
      debug.error({
        context: 'signin',
        req,
        error
      });
      return res.redirect('/signin');
    }
    if (!user) {
      if (info && info.message) {
        req.flash('errors', res.__(info.message));
      }
      return res.redirect('/signin');
    }
    req.login(user, function(error) {
      if (error) {
        debug.error({
          context: 'signin',
          req,
          error
        });
        return res.redirect('/signin');
      } else {
        return res.redirect('/'); // Success
      }
    });
  })(req, res, next);
});


router.get('/register', function(req, res) {
  let errors = req.flash('errors');
  render.template(req, res, 'register', {
    titleKey: 'register',
    errors
  });
});

router.post('/signout', function(req, res) {
  req.logout();
  res.redirect('/');
});

router.post('/register', function(req, res) {

  if (!req.body.username || !req.body.password) {
    if (!req.body.username)
      req.flash('errors', res.__('need username'));
    if (!req.body.password)
      req.flash('errors', res.__('need password'));
    return res.redirect('/register');
  }

  User.create({
      name: req.body.username,
      password: req.body.password,
      email: req.body.email
    })
    .then(user => {
      req.flash('messages', res.__('welcome new user', user.displayName));
      req.login(user, error => {
        if (error) {
          debug.error({
            context: 'registration->signin',
            req,
            error
          });
        }
        res.redirect('/');
      });
    })
    .catch(errorMessage => {
      flashError(req, res, errorMessage, 'registration');
      res.redirect('/register');
    });

});

module.exports = router;
