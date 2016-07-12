'use strict';

let render = {
  template: function(req, res, view, extraVars) {

    let vars = {};

    let config = {
      userName: req.user ? req.user.displayName : undefined,
      language: req.locale
    };

    vars.configScript = `window.config = ${JSON.stringify(config)};`;

    if (extraVars)
      Object.assign(vars, extraVars);

    vars.user = req.user;

    vars.scripts = ['jquery-2.1.4.min.js'];
    if (Array.isArray(extraVars.scripts))
      vars.scripts = vars.scripts.concat(extraVars.scripts);

    // Mapping of languages keys against message keys that provide labels
    // for those languages
    vars.languages = {
      'de': 'german',
      'en': 'english'
    };

    vars.currentLanguage = {
      key: req.locale,
      label: vars.languages[req.locale]
    };

    // This array only contains other languages than the current one, for easy rendering
    delete vars.languages[req.locale];

    res.render(view, vars);

  },

  signinRequired: function(req, res, extraVars) {
    this.template(req, res, 'signin-required', extraVars);
  }

};

module.exports = render;
