(function() {
  'use strict';
  $('#signin-button').click(window.libreviews.getRequiredFieldHandler({
    fieldSelector: '#username,#password'
  }));
  $('#username').focus();
})();
