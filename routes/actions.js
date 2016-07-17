'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const debug = require('../util/debug');
const i18n = require('i18n');
const passport = require('passport');
const config = require('config');

// Internal dependencies
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');
const forms = require('./helpers/forms');
const User = require('../models/user');

const formDefs = {
  'register': [{
    name: 'username',
    required: true
  }, {
    name: 'password',
    required: true,
  }, {
    name: 'email',
    required: false
  }, {
    name: 'captcha-answer',
    required: config.questionCaptcha.enabled,
  }, {
    name: 'captcha-id',
    required: config.questionCaptcha.enabled,
  }]
};


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
      req.flash('errors', req.__('need username'));
    if (!req.body.password)
      req.flash('errors', req.__('need password'));
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
  let hasQuestionCaptcha = config.questionCaptcha.enabled,
    captcha, captchaIndex;

  if (hasQuestionCaptcha) {
    // Pick a random captcha
    captchaIndex = Math.floor(Math.random() * config.questionCaptcha.captchas.length);
    captcha = config.questionCaptcha.captchas[captchaIndex];
  }

  render.template(req, res, 'register', {
    titleKey: 'register',
    errors,
    hasQuestionCaptcha,
    questionKey: hasQuestionCaptcha ? captcha.questionKey : undefined,
    captchaIndex
  });
});

router.post('/signout', function(req, res) {
  req.logout();
  res.redirect('/');
});

router.post('/register', function(req, res) {

  let formInfo = forms.parseSubmission(req, formDefs.register);
  if (!formInfo.hasRequiredFields || formInfo.hasExtraFields)
    return res.redirect('/register');

  let hasQuestionCaptcha = config.questionCaptcha.enabled;
  if (hasQuestionCaptcha) {
    let captchaIndex = Number(req.body['captcha-id']);
    let answerCaptcha = config.questionCaptcha.captchas[captchaIndex], answerKey;
    if (answerCaptcha === undefined) {
      req.flash('errors', req.__('unknown captcha'));
      return res.redirect('/register');
    }
    answerKey = answerCaptcha.answerKey;
    if (req.body['captcha-answer'].trim().toUpperCase() != req.__(answerKey).toUpperCase()) {
      req.flash('errors', req.__('incorrect captcha answer'));
      return res.redirect('/register');
    }
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
      flashError(req, errorMessage, 'registration');
      res.redirect('/register');
    });

});

module.exports = router;
