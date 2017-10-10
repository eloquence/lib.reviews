/* global $, libreviews */
'use strict';

// Front-end code for the /some-thing/manage/urls interface

// Initialize validation messages
$('[id^=url-validation-]').each(function() {
  // data-url-input is used to mark inputs with URL validation
  let input = $(this).parent().find('input[data-url-input]')[0];
  // data-add-protocol-for is used to look up input element
  $(this).append(`<div class="validation-error">${libreviews.msg('not a url')}</div>` +
    `<div class="helper-links"><a href="#" data-add-protocol="https://" data-add-protocol-for="${input.name}">` +
    `${libreviews.msg('add https')}</a> &ndash; <a href="#" data-add-protocol="http://"` +
    `data-add-protocol-for="${input.name}">${libreviews.msg('add http')}</div>`);
});

// Protocol helpers
$('[data-add-protocol]').click(addProtocol);

// Combined validation handler
$('input[name^=url-]').change(handleURLValidation);

function handleURLValidation() {
  let $parent = $(this).parent();
  let hasText = typeof this.value == 'string' && this.value.length > 0;
  let showValidationError = hasText && !window.libreviews.validateURL(this.value);
  let showProtocolHelperLinks = hasText && !window.libreviews.urlHasSupportedProtocol(this.value);
  $parent.find('.validation-error').toggle(showValidationError);
  $parent.find('.helper-links').toggle(showProtocolHelperLinks);
}

function addProtocol(e) {
  let protocol = $(this).attr('data-add-protocol');
  let inputName = $(this).attr('data-add-protocol-for');
  let $input = $(`input[name=${inputName}]`);
  $input.val(protocol + $input.val());
  $input.trigger('change');
  e.preventDefault();
}
