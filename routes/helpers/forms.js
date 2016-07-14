'use strict';
let forms = {
  parseSubmission: function(req, formDef) {
    let hasRequiredFields = true;
    let hasUnknownFields = false;
    let formValues = {};
    let processedKeys = Object.keys(req.body);

    for (let field of formDef) {
      if (!req.body[field.name] && field.required) {
        req.flash('errors', req.__(`need ${field.name}`));
        hasRequiredFields = false;
      }
      if (req.body[field.name] && !field.radioMap)
        formValues[field.name] = req.body[field.name];
      if (req.body[field.name] && field.radioMap) {
        formValues[field.name] = {};
        formValues[field.name].value = req.body[field.name];
        formValues[field.name][req.body[field.name]] = true;
      }
      let k = processedKeys.indexOf(field.name);
      if (k !== -1)
        processedKeys.splice(k, 1);
    }
    if (processedKeys.length) {
      hasUnknownFields = true;
      req.flash('errors', req.__('unexpected form data'));
    }
    return {
      hasRequiredFields,
      hasUnknownFields,
      formValues
    };
  },
};

module.exports = forms;
