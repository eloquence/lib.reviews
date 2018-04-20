'use strict';
// External dependencies
const config = require('config');
const url = require('url');
const getJS = require('../../util/get-js');
const i18n = require('i18n');

// Internal dependencies
const languages = require('../../locales/languages');

let render = {

  // extraVars - object containing any vars we want to pass along to template
  // extraJSConfig - object containing any vars we want to expose to client-side
  //  scripts (must not contain sensitive data!)
  template(req, res, view, extraVars, extraJSConfig) {
    let vars = {};

    // override locale cookie using signupLanguage if present
    if (req.query.signupLanguage) {
        i18n.setLocale(req, req.query.signupLanguage);
        vars.signupLanguage = req.query.signupLanguage;
    }

    let jsConfig = {
      userName: req.user ? req.user.displayName : undefined,
      userID: req.user ? req.user.id : undefined,
      language: req.locale,
      userPrefersRichTextEditor: req.user ? req.user.prefersRichTextEditor : undefined,
      messages: {}
    };

    if (extraJSConfig)
      Object.assign(jsConfig, extraJSConfig);

    Object.assign(jsConfig.messages, languages.getCompositeNamesAsMessageObject(req.locale));

    vars.configScript = `window.config = ${JSON.stringify(jsConfig)};`;

    if (extraVars)
      Object.assign(vars, extraVars);

    vars.user = req.user;

    vars.scripts = [getJS('lib')];
    if (extraVars && Array.isArray(extraVars.scripts))
      vars.scripts = vars.scripts.concat(extraVars.scripts);

    vars.languageNames = [];
    languages.getValidLanguagesSorted().forEach(langKey => {
      let nameObj = {
        langKey,
        name: languages.getCompositeName(langKey, req.locale)
      };
      if (langKey == req.locale)
        nameObj.isCurrentLanguage = true;
      vars.languageNames.push(nameObj);
    });

    vars.currentLanguage = {
      langKey: req.locale,
      name: languages.getNativeName(req.locale)
    };

    if (req.csrfToken)
      vars.csrfToken = req.csrfToken();

    vars.qualifiedURL = config.qualifiedURL;

    vars.urlPath = url.parse(req.originalUrl).pathname;


    // Pass along returnTo path for post-submit redirection if not already
    // present in query. If on /signin or /register page without a returnTo, we
    // don't want to redirect back to the form, so setting to '/' in those
    // cases.
    const registerRegex = new RegExp('^/register(/|$)'); // for invite links
    if (req.query.returnTo)
      vars.returnTo = req.query.returnTo;
    else if (req.path == '/signin' || registerRegex.test(req.path))
      vars.returnTo = '/';
    else
      vars.returnTo = vars.urlPath;

    // Non-page specific, will show up if language is changed for this page
    // only because of ?uselang parameter
    if (typeof req.localeChange == 'object' && req.localeChange.old && req.localeChange.new)
      vars.localeChange = req.localeChange;

    // Non page-specific, will show up on any page if we have some to show
    vars.siteMessages = req.flash('siteMessages');
    vars.siteErrors = req.flash('siteErrors');
    res.render(view, vars);

  },

  signinRequired(req, res, extraVars) {
    render.template(req, res, 'signin-required', extraVars);
  },

  // Pass detailsKey in extraVars for message providing further details
  // about why permission is denied.
  permissionError(req, res, extraVars) {
    res.status(403);
    render.template(req, res, 'permission-error', extraVars);
  },

  // Pass titleKey and bodyKey in extraVars to explain the nature of the error
  // (e.g., page not found, stale revision). Don't forget to call
  // res.status as appropriate.
  resourceError(req, res, extraVars) {
    render.template(req, res, 'resource-error', extraVars);
  }

};

module.exports = render;
