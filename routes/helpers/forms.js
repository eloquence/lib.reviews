'use strict';
let forms = {
  parseSubmission: function(req, formDef) {
    let hasRequiredFields = true;
    let formValues = {};

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
    }
    return {
      hasRequiredFields,
      formValues
    };
  },
};


const formDefs = {
  'new': [{
    name: 'review-url',
    required: true
  }, {
    name: 'review-title',
    required: true,
  }, {
    name: 'review-text',
    required: true
  }, {
    name: 'review-rating',
    required: true,
    radioMap: true
  }, {
    name: 'review-language',
    required: false,
    radioMap: true
  }, {
    name: 'review-expand-extra-fields',
    required: false
  }]
};
module.exports = forms;
