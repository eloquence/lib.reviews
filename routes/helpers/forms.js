'use strict';
let forms = {
  getFormValues: function(req, formDef) {
    let formValues = {};
    for (let field of formDef) {
      if (!req.body[field.name] && field.required)
        req.flash('errors', req.__(`need ${field.name}`));
      if (req.body[field.name] && !field.radioMap)
        formValues[field.name] = req.body[field.name];
      if (req.body[field.name] && field.radioMap) {
        formValues[field.name] = {};
        formValues[field.name].value = req.body[field.name];
        formValues[field.name][req.body[field.name]] = true;
      }
    }
    return formValues;
  }
};

module.exports = forms;
