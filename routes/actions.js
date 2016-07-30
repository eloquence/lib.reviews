'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const i18n = require('i18n');
const passport = require('passport');
const config = require('config');

// Internal dependencies
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');
const forms = require('./helpers/forms');
const User = require('../models/user');
const debug = require('../util/debug');
const actionHandler = require('./handlers/action-handler.js');
const languages = require('../locales/languages');

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
  }]
};

router.post('/actions/suppress-notice', actionHandler.suppressNotice);

router.post('/actions/change-language', function(req, res) {
  let maxAge = 1000 * 60 * 60 * 24 * 30; // cookie age: 30 days
  let lang = req.body.lang;
  let referer = req.get('referer');
  let hasLanguageNotice = req.body['has-language-notice'] ? true : false;

  if (!languages.isValid(lang)) {
    req.flash('siteErrors', req.__('invalid language'));
    return res.redirect('back');
  }

  res.cookie('locale', lang, {
    maxAge, // FIXME: should be from config
    httpOnly: true
  });
  req.locale = lang;

  // Don't show on pages with language notices on them, to avoid message overkill.
  if (!hasLanguageNotice)
    req.flash('siteMessages', req.__('notification language-changed'));

  res.redirect('back');
});

// Below actions have shorter names for convenience

router.get('/signin', function(req, res) {
  let pageErrors = req.flash('pageErrors');
  render.template(req, res, 'signin', {
    titleKey: 'sign in',
    pageErrors,
    scripts: ['signin.js']
  });
});


router.post('/signin', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    if (!req.body.username)
      req.flash('pageErrors', req.__('need username'));
    if (!req.body.password)
      req.flash('pageErrors', req.__('need password'));
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
        req.flash('pageErrors', res.__(info.message));
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


router.get('/new/user', function(req, res) {
  res.redirect('/register');
});

router.get('/register', function(req, res) {
  sendRegistrationForm(req, res);
});

router.post('/signout', function(req, res) {
  req.logout();
  res.redirect('/');
});

router.post('/register', function(req, res) {

  let formInfo = forms.parseSubmission({
    req,
    formDef: formDefs.register,
    formKey: 'register'
  });

  if (req.flashHas('pageErrors'))
    return sendRegistrationForm(req, res, formInfo);

  User.create({
      name: req.body.username,
      password: req.body.password,
      email: req.body.email
    })
    .then(user => {
      req.flash('siteMessages', res.__('welcome new user', user.displayName));
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
      return sendRegistrationForm(req, res, formInfo);
    });

});

function sendRegistrationForm(req, res, formInfo) {
  let pageErrors = req.flash('pageErrors');

  render.template(req, res, 'register', {
    titleKey: 'register',
    pageErrors,
    formValues: formInfo ? formInfo.formValues : undefined,
    questionCaptcha: forms.getQuestionCaptcha('register'),
    illegalUsernameCharactersReadable: User.options.illegalCharsReadable,
    scripts: ['register.js']
  }, {
    illegalUsernameCharacters: User.options.illegalChars.source
  });
}

module.exports = router;
