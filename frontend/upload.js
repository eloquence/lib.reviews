/* global $, libreviews */
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
      let countLabel = count == 1 ? libreviews.msg('one file selected') : libreviews.msg('files selected');
      // We use a different icon to represent multiple files
      if (count == 1)
        $('#upload-icon').removeClass('fa-files-o').addClass('fa-file-image-o');
      else
        $('#upload-icon').removeClass('fa-file-image-o').addClass('fa-files-o');
      countLabel = countLabel.replace('%s', String(count));
      $('#upload-label-text').text(countLabel);
      $('#start-upload').prop('disabled', false);
    }
  });
}());
