/* global $ */
(function() {
  'use strict';
  if ($('#bio-textarea').length) {
    $('#bio-textarea').keyup(updateCharacterCount);
    updateCharacterCount();
  }

  function updateCharacterCount() {
    let count = $('#bio-textarea').val().length;
    let remaining = 1000 - count;
    if (remaining > 0) {
      $('#character-counter').show();
      $('#over-maximum-warning').hide();
      $('#character-count').text(remaining);
    } else if (remaining === 0) {
      $('#character-counter').hide();
      $('#over-maximum-warning').hide();
    } else {
      $('#character-counter').hide();
      $('#over-maximum-warning').show();
      $('#over-maximum-count').text(-1 * remaining);
    }
  }
}());
