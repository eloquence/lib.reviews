'use strict';

function render(req, res, view, extraVars) {

  let vars = {};
  if (extraVars)
    Object.assign(vars, extraVars);

  vars.user = req.user;

  // Mapping of languages keys against message keys that provide labels
  // for those languages
  vars.languages = {
    'de': 'german',
    'en': 'english'
  };

  // We don't offer the active language
  delete vars.languages[req.locale];

  res.render(view, vars);

}

module.exports = render;
