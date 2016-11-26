/* global $, jQuery */
/* eslint prefer-reflect: "off" */

/*
 * Standard helper functions across lib.reviews pages, divided into jQuery
 * plugins and more lib.reviews-specific functionality.
 * @license CC-0; see https://creativecommons.org/publicdomain/zero/1.0/
 */

(function($) {
  'use strict';

  // Return any empty input elements among a selector of inputs
  $.fn.getEmptyInputs = function() {
    return this.filter(function() {
      return this.value === undefined || String(this.value) === '';
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

  $.fn.attachRequiredFieldHandler = function(options) {

    if (!options)
      options = {};

    // How we find "* required" indicators that are child elements of labels
    let indicatorSelector = options.indicatorSelector || 'span.required';

    // Error message(s) selector informing user required fields are missing
    let requiredFieldsMessage = options.requiredFieldMessage || '#required-fields-message';

    // Error message(s) selector reminding user about other validation errors
    let formErrorMessage = options.formErrorMessage || '#form-error-message';

    // Selector used to find any remaining validation errors that need to be corrected
    let validationErrorSelector = options.validationErrorSelector || '.validation-error:visible';

    this.click(requiredFieldHandler);

    function requiredFieldHandler(event) {

      // Clear out old warnings
      $(`${requiredFieldsMessage},${formErrorMessage},label ${indicatorSelector}`).hide();

      let $emptyFields = $('input[data-required],textarea[data-required]')
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

    }

  };

}(jQuery));

(function() {
  'use strict';
  // Global namespace for lib.reviews-specific functions
  window.libreviews = {};

  window.libreviews.trimInput = function() {
    this.value = this.value.trim();
  };

  // For groups of form controls that are sometimes, but not always, required
  // inputs, we can enable the required check selectively. To do so, we need
  // to set the "data-required-indicator-group" and "data-required-input-group"
  // to a unique ID for each group, and set the data-enable-required-group
  // and data-disable-required-group to the same ID for the controls which
  // change the state (for now only radio controls are supported).
  // The indicator also needs to have the "hidden" class initially.
  window.libreviews.enableRequiredGroup = function(groupID) {
    $(`span[data-required-indicator-group="${groupID}"]`)
      .addClass('required')
      .removeClass('hidden');
    $(`[data-required-input-group="${groupID}"]`)
      .attr('data-required', '');
  };

  window.libreviews.disableRequiredGroup = function(groupID) {
    $(`span[data-required-indicator-group="${groupID}"]`)
      .addClass('hidden')
      .removeClass('required');
    $(`[data-required-input-group="${groupID}"]`)
      .removeAttr('data-required');
  };

  $('input[type="radio"][data-enable-required-group]').focus(function() {
    window.libreviews.enableRequiredGroup($(this).attr('data-enable-required-group'));
  });

  $('input[type="radio"][data-disable-required-group]').focus(function() {
    window.libreviews.disableRequiredGroup($(this).attr('data-disable-required-group'));
  });


  // Generic function for dismiss buttons. The attribute data-dismiss-element
  // must specify an element ID.
  $('button[data-dismiss-element]').click(function(event) {
    let id = $(this).attr('data-dismiss-element');
    $(`#${id}`).fadeOut(200);
    event.preventDefault();
  });

  // Generic function to permanently dismiss notices of a certain kind.
  // This is useful for introductory messages, or community-wide banners.
  $('button[data-suppress-notice]').click(function(event) {
    let id = $(this).attr('data-suppress-notice');
    $.ajax({
        type: 'POST',
        url: `/api/actions/suppress-notice`,
        data: JSON.stringify({
          noticeType: id
        }),
        contentType: 'application/json',
        dataType: 'json'
      })
      .done(() => {
        $(`#${id}`).fadeOut(200);
      })
      .fail(() => {
        $('#generic-action-error').removeClass('hidden');
      });
    event.preventDefault();
  });

  // Prevents submission of buttons that have data-check-required when required
  // fields are missing
  $('button[data-check-required]').attachRequiredFieldHandler();

  // Auto-trim all inputs with data-auto-trim
  $('input[data-auto-trim],textarea[data-auto-trim]').change(window.libreviews.trimInput);

  // Add link anchors to long texts
  $('.long-text h2,.long-text h3').each(function() {
    $(this).prepend(`<a href="#${this.id}" class="fragment-link no-print"><span class="fa fa-link"></span></a>`);
  });

  // Dynamic help sidebars

  // Exported repaint function, trigger this if you need to repaint the
  // help because of a change in scroll position. This is done automatically
  // for window resizes.
  window.libreviews.repaintFocusedHelp = () => {
    let focused = $(':focus')[0];

    // Check if the currently focused element requires a help re-render
    if (focused && focused.id && $(`[data-help-for=${focused.id}]`).length)
      showInputHelp.apply(focused);

  };

  if ($('[data-help-for]').length) {

    // Attach dynamic help display for data-help-for="id" elements (to the "id"
    // element, typically an input)
    $('[data-help-for]').each(function() {
      let inputID = $(this).attr('data-help-for');
      $(`#${inputID}`).focus(showInputHelp);
      $(`#${inputID}`).blur(hideInputHelp);
    });

    // Re-calculate positioning of help on window resize
    $(window).resize(window.libreviews.repaintFocusedHelp);
  }

  // Show/hide parts of a page dynamically
  $('[data-show]').focus(function() {
    $(`#${$(this).attr('data-show')}`).slideDown(200);
  });

  $('[data-hide]').focus(function() {
    $(`#${$(this).attr('data-hide')}`).slideUp(200);
  });

  // Focus input
  $('[data-focus]').focus();

  // Buttons that copy text into the clipboard
  $('[data-copy]').click(function() {
    let copySourceID = $(this).attr('data-copy');
    let copySource = $(`#${copySourceID}`)[0];

    let range = document.createRange();
    range.selectNode(copySource);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    try {
      document.execCommand('copy');
    } catch (error) {
      console.error('Copying not supported in your browser.');
    }
  });

  // Some click handlers exist inside content which may be dynamically generated.
  window.libreviews.updateContentClickHandlers = () => {
    $('summary.content-warning-notice').click(toggleDangerousContent);
  };

  window.libreviews.updateContentClickHandlers();

  // For content which is hidden by default and can be expanded, e.g., spoiler
  // warnings, NSFW warnings
  function toggleDangerousContent(event) {
    if ($(this).parent().is('[open]')) {
      $(this).next('.dangerous-content').slideUp(200, () => {
        $(this).parent().removeAttr('open');
      });
    } else {
      $(this).parent().attr('open', '');
      $(this).next('.dangerous-content').slideDown(200);
    }
    event.preventDefault();
  }

  function showInputHelp() {
    let id = this.id;
    // Hide all help texts
    $('.help-text').hide();

    // Show help text for active input
    $(`#${id}-help`).show();

    // We want to avoid pushing down the next form field, so we use
    // absolute positioning if available.
    if (this.getBoundingClientRect && $(`label[for=${id}]`)[0]) {
      let pos, posHelp;
      pos = $(`label[for=${id}]`)[0].getBoundingClientRect();
      posHelp = $(`#${id}-help`)[0].getBoundingClientRect();

      if (posHelp.left > pos.right) {
        let newPos = Math.floor(window.scrollY) + Math.floor(pos.top);
        // Position vertically aligned with the input we're showing help for
        let style = `position:absolute;top:${newPos}px;display:inline-block;`;
        $(`#${id}-help`).attr('style', style);
      } else {
        // Reset position
        $(`#${id}-help`).attr('style', 'display:inline-block;');
      }
    }
    // For additional help-related logic
    $('#help').attr('data-last-shown', id);
  }

  function hideInputHelp() {
    let id = this.id;
    // Keep help visible if user is hoving over it, so
    // links remain accessible
    if (!$('.help-text:hover').length)
      $(`#${id}-help`).hide();
  }

}());
