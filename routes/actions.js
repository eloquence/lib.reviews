'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const passport = require('passport');
const config = require('config');
const i18n = require('i18n');

// Internal dependencies
const render = require('./helpers/render');
const forms = require('./helpers/forms');
const User = require('../models/user');
const InviteLink = require('../models/invite-link');
const debug = require('../util/debug');
const actionHandler = require('./handlers/action-handler.js');
const signinRequiredRoute = require('./handlers/signin-required-route');
const languages = require('../locales/languages');
const search = require('../search');

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


router.get('/actions/search', function(req, res, next) {
  let query = (req.query.query || '').trim();
  if (query) {
    Promise
      .all([search.searchThings(query, req.locale), search.searchReviews(query, req.locale)])
      .then(results => {
        let labelMatches = results[0].hits.hits;
        let textMatches = search.filterDuplicateInnerHighlights(results[1].hits.hits, 'reviews');
        let noMatches = !labelMatches.length && !textMatches.length;

        render.template(req, res, 'search', {
          titleKey: 'search results',
          noMatches,
          labelMatches,
          textMatches,
          query,
          showHelp: noMatches,
          deferPageHeader: true
        });
      })
      .catch(next);
  } else {
    render.template(req, res, 'search', {
      titleKey: 'search lib.reviews',
      showHelp: true,
      deferPageHeader: true
    });
  }
});

router.get('/actions/invite', signinRequiredRoute('invite users', renderInviteLinkPage));

router.post('/actions/invite', signinRequiredRoute('invite users', function(req, res, next) {
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
      .catch(next);
  }

}));


function renderInviteLinkPage(req, res, next) {

  // Links that have been generated but not used
  let p1 = InviteLink.getAvailable(req.user);

  // Links that have been generated and used
  let p2 = InviteLink.getUsed(req.user);

  Promise
    .all([p1, p2])
    .then(results => {

      let pendingInviteLinks = results[0];
      let usedInviteLinks = results[1];

      render.template(req, res, 'invite', {
        titleKey: res.locals.titleKey,
        invitePage: true, // to tell template not to show call-to-action again
        pendingInviteLinks,
        usedInviteLinks,
        pageErrors: req.flash('pageErrors'),
        pageMessages: req.flash('pageMessages')
      });

    })
    .catch(next);

}

router.post('/actions/suppress-notice', actionHandler.suppressNotice);

router.post('/actions/change-language', function(req, res) {
  let maxAge = 1000 * 60 * config.sessionCookieDuration; // cookie age: 30 days
  let lang = req.body.lang;
  let redirectTo = req.body['redirect-to'];

  let hasLanguageNotice = req.body['has-language-notice'] ? true : false;

  if (!languages.isValid(lang)) {
    req.flash('siteErrors', req.__('invalid language'));
    if (redirectTo)
      return res.redirect(redirectTo);
    else
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

  if (redirectTo)
    res.redirect(redirectTo);
  else
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
      debug.error({ req, error });
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
        debug.error({ req, error });
        return res.redirect('/signin');
      } else {
        return returnToPath(req, res); // Success
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
  const { code } = req.params;
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
            debug.error({ req, error });
          }
          returnToPath(req, res);
        });
      })
      .catch(error => { // Problem creating user
        req.flashError(error);
        return sendRegistrationForm(req, res, formInfo);
      });

  });
}


router.post('/register/:code', function(req, res, next) {

  const { code } = req.params;

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
                  debug.error({ req, error });
                }
                returnToPath(req, res);
              });
            })
            .catch(next); // Problem updating invite code
        })
        .catch(error => { // Problem creating user
          req.flashError(error);
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

  const { code } = req.params;

  render.template(req, res, 'register', {
    titleKey: 'register',
    pageErrors,
    formValues: formInfo ? formInfo.formValues : undefined,
    questionCaptcha: forms.getQuestionCaptcha('register'),
    illegalUsernameCharactersReadable: User.options.illegalCharsReadable,
    scripts: ['register.js'],
    inviteCode: code
  }, {
    illegalUsernameCharacters: User.options.illegalChars.source
  });
}

// checks for external redirect in returnTo, ignores if present and redirects
function returnToPath(req, res) {
    let returnTo = req.query.returnTo;
    if (returnTo.includes('http')) {
        returnTo = '/';
    }
    res.redirect(returnTo);
}
module.exports = router;
