'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const passport = require('passport');
const config = require('config');
const i18n = require('i18n');

// Internal dependencies
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');
const forms = require('./helpers/forms');
const User = require('../models/user');
const InviteLink = require('../models/invite-link');
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

router.get('/actions/invite', function(req, res, next) {
  if (!req.user)
    return render.signinRequired(req, res, {
      titleKey: 'invite users'
    });

  renderInviteLinkPage(req, res, next);
});

router.post('/actions/invite', function(req, res, next) {
  if (!req.user)
    return render.signinRequired(req, res, {
      titleKey: 'invite users'
    });

  if (!req.user.inviteLinkCount) {
    req.flash('pageErrors', res.__('out of links'));
    return renderInviteLinkPage(req, res, next);
  } else {
    let inviteLink = new InviteLink({});
    inviteLink.createdOn = new Date();
    inviteLink.createdBy = req.user.id;
    let p1 = inviteLink.save();

    req.user.inviteLinkCount--;
    let p2 = req.user.save();

    Promise.all([p1, p2])
      .then(() => {
        req.flash('pageMessages', res.__('link generated'));
        return renderInviteLinkPage(req, res, next);
      })
      .catch(error => next(error));
  }

});


function renderInviteLinkPage(req, res, next) {

  // Links that have been generated but not used
  let p1 = InviteLink.filter({
    createdBy: req.user.id,
    usedBy: false
  }, {
    default: true
  });

  // Links that have been generated and used
  let p2 = InviteLink.filter({
      createdBy: req.user.id
    })
    .filter(inviteLink => inviteLink('usedBy').ne(false))
    .getJoin({
      usedByUser: true
    });

  Promise
    .all([p1, p2])
    .then(results => {

      let pendingInviteLinks = results[0];
      let usedInviteLinks = results[1];

      render.template(req, res, 'invite', {
        titleKey: 'invite users',
        invitePage: true, // to tell template not to show call-to-action again
        pendingInviteLinks,
        usedInviteLinks,
        pageErrors: req.flash('pageErrors'),
        pageMessages: req.flash('pageMessages')
      });

    })
    .catch(error => next(error));

}

router.post('/actions/suppress-notice', actionHandler.suppressNotice);

router.post('/actions/change-language', function(req, res) {
  let maxAge = 1000 * 60 * config.sessionCookieDuration; // cookie age: 30 days
  let lang = req.body.lang;
  let hasLanguageNotice = req.body['has-language-notice'] ? true : false;

  if (!languages.isValid(lang)) {
    req.flash('siteErrors', req.__('invalid language'));
    return res.redirect('back');
  }

  res.cookie('locale', lang, {
    maxAge,
    httpOnly: true
  });
  i18n.setLocale(req, lang);

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
    pageErrors
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
  if (config.requireInviteLinks)
    return render.template(req, res, 'invite-needed', {
      titleKey: 'register'
    });
  else
    return sendRegistrationForm(req, res);
});

router.get('/register/:code', function(req, res, next) {
  let code = req.params.code;
  InviteLink
    .get(code)
    .then(inviteLink => {
      if (inviteLink.usedBy)
        return render.permissionError(req, res, {
          titleKey: 'invite link already used title',
          detailsKey: 'invite link already used'
        });
      else
        return sendRegistrationForm(req, res);
    })
    .catch(error => {
      if (error.name === 'DocumentNotFoundError')
        return render.permissionError(req, res, {
          titleKey: 'invite link invalid title',
          detailsKey: 'invite link invalid'
        });
      else
        return next(error);
    });
});

router.post('/signout', function(req, res) {
  req.logout();
  res.redirect('/');
});

if (!config.requireInviteLinks) {
  router.post('/register', function(req, res) {

    let formInfo = forms.parseSubmission(req, {
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
      .catch(errorMessage => { // Problem creating user
        flashError(req, errorMessage, 'registration');
        return sendRegistrationForm(req, res, formInfo);
      });

  });
}


router.post('/register/:code', function(req, res, next) {

  let code = req.params.code;

  InviteLink
    .get(code)
    .then(inviteLink => {

      if (inviteLink.usedBy)
        return render.permissionError(req, res, {
          titleKey: 'invite link already used title',
          detailsKey: 'invite link already used'
        });

      let formInfo = forms.parseSubmission(req, {
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
          inviteLink.usedBy = user.id;
          inviteLink.save().then(() => {
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
            .catch(error => next(error)); // Problem updating invite code
        })
        .catch(errorMessage => { // Problem creating user
          flashError(req, errorMessage, 'registration');
          return sendRegistrationForm(req, res, formInfo);
        });

    })
    .catch(error => { // Invite link lookup problem
      if (error.name === 'DocumentNotFoundError')
        return render.permissionError(req, res, {
          titleKey: 'invite link invalid title',
          detailsKey: 'invite link invalid'
        });
      else
        return next(error);
    });


});

function sendRegistrationForm(req, res, formInfo) {
  let pageErrors = req.flash('pageErrors');

  let inviteCode = req.params.code;

  render.template(req, res, 'register', {
    titleKey: 'register',
    pageErrors,
    formValues: formInfo ? formInfo.formValues : undefined,
    questionCaptcha: forms.getQuestionCaptcha('register'),
    illegalUsernameCharactersReadable: User.options.illegalCharsReadable,
    scripts: ['register.js'],
    inviteCode
  }, {
    illegalUsernameCharacters: User.options.illegalChars.source
  });
}

module.exports = router;
