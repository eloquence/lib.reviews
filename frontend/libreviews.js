// Standard helper functions across lib.reviews pages, divided into jQuery
// plugins and more lib.reviews-specific functionality

(function($) {
  'use strict';

  // Return any empty input elements among a selector of inputs
  $.fn.getEmptyInputs = function() {
    return this.filter(function() {
      return (this.value === undefined || String(this.value) === '');
    });
  };

  // Highlight labels associated with a set of elements using an indicator
  // class. Typically used to highlight required form fields, in combination
  // with emptyInputs(). This will not hide previously set labels.
  $.fn.highlightLabels = function(indicatorSelector) {

    if (!indicatorSelector)
      indicatorSelector = "span.required";

    // Show the ones from our current jQuery object
    this.each(function() {
      $(`label[for="${this.id}"] ${indicatorSelector}`).show();
    });

    // Return the (unmodified) object for further processing/chaining as needed
    return this;
  };

}(jQuery));

(function() {
  'use strict';
  // Global namespace for lib.reviews-specific functions
  window.libreviews = {};

  // Generic handler for highlighting missing fields on forms, showing an
  // associated error message, and preventing form submission.
  window.libreviews.getRequiredFieldHandler = function(options) {

    return function(event) {

      if (!options || typeof options !== "object" || !options.fieldSelector)
        throw new Error('We need an options.fieldSelector parameter to know which fields are required.');

      let fieldSelector = options.fieldSelector;

      // How we find "* required" indicators that are child elements of labels
      let indicatorSelector = options.indicatorSelector || 'span.required';

      // Error message(s) selector informing user required fields are missing
      let requiredFieldsMessage = options.requiredFieldMessage || '#required-fields-message';

      // Error message(s) selector reminding user about other validation errors
      let formErrorMessage = options.formErrorMessage || '#form-error-message';

      // Selector used to find any remaining validation errors that need to be corrected
      let validationErrorSelector = options.validationErrorSelector || '.validation-error:visible';

      // Clear out old warnings
      $(`${requiredFieldsMessage},${formErrorMessage},label ${indicatorSelector}`).hide();

      let $emptyFields = $(fieldSelector)
        .getEmptyInputs()
        .highlightLabels();

      if ($emptyFields.length) {
        $(requiredFieldsMessage).show();
        event.preventDefault();
        return;
      }

      // Highlight any other validation errors now (not doing it earlier to avoid
      // error message overkill)
      if ($(validationErrorSelector).length > 0) {
        $(formErrorMessage).show();
        event.preventDefault();
        return;
      }

    };

  };

  window.libreviews.trimInput = function() {
    this.value = this.value.trim();
  };

  $('input[data-auto-trim],textarea[data-auto-trim]').change(libreviews.trimInput);

})();
