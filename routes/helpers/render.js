'use strict';
const languages = require('../../locales/languages');

let render = {
  template: function(req, res, view, extraVars, extraConfig) {

    let vars = {};

    let config = {
      userName: req.user ? req.user.displayName : undefined,
      language: req.locale
    };

    if (extraConfig)
      Object.assign(config, extraConfig);

    vars.configScript = `window.config = ${JSON.stringify(config)};`;

    if (extraVars)
      Object.assign(vars, extraVars);

    vars.user = req.user;

    vars.scripts = ['jquery-2.1.4.min.js', 'libreviews.js'];
    if (extraVars && Array.isArray(extraVars.scripts))
      vars.scripts = vars.scripts.concat(extraVars.scripts);

    // Mapping of languages keys against message keys that provide labels
    // for those languages.
    vars.languages = languages.getAll();

    if (vars.languages[req.locale])
      vars.languages[req.locale].currentLanguage = true;

    vars.currentLanguage = req.locale;

    vars.csrfToken = req.csrfToken();

    // Non page-specific, will show up on any page if we have some to show
    vars.siteMessages = req.flash('siteMessages');
    vars.siteErrors = req.flash('siteErrors');

    res.render(view, vars);

  },

  signinRequired: function(req, res, extraVars) {
    this.template(req, res, 'signin-required', extraVars);
  },

  permissionError: function(req, res, extraVars) {
    this.template(req, res, 'permission-error', extraVars);
  }

};

module.exports = render;
