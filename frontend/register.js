(function() {
  'use strict';
  $('#register-button').click(window.libreviews.getRequiredFieldHandler({
    fieldSelector: '#username,#password,#captcha-answer'
  }));
  $('#username').focus();

})();
