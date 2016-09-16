/* global $, config */
(function() {
  'use strict';
  let originalLabel = $('#upload-label').text();
  // We shouldn't be able to start an upload until we've selected some files.
  $('#start-upload').prop('disabled', true);
  $('#upload-input').change(() => {
    let count = $('#upload-input')[0].files.length;
    if (!count) {
      $('#start-upload').prop('disabled', true);
      $('#upload-label').text(originalLabel);
    } else {
      let countLabel = count == 1 ? config.messages['one file selected'] : config.messages['files selected'];
      countLabel = countLabel.replace('%s', String(count));
      $('#upload-label-text').text(countLabel);
      $('#start-upload').prop('disabled', false);
    }
  });
}());
