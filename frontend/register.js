(function() {
  'use strict';
  $('#register-button').click(window.libreviews.getRequiredFieldHandler({
    fieldSelector: '#username,#password,#captcha-answer'
  }));
  $('#username').change(checkIllegalCharacters);
  $('#username').focus();

  function checkIllegalCharacters() {
    let regex = new RegExp(config.illegalUsernameCharacters);
    if (regex.test(this.value))
      $('#username-characters-validation').show();
    else
      $('#username-characters-validation').hide();
  }

})();
