(function() {
  'use strict';
  $('#register-button').click(window.libreviews.getRequiredFieldHandler({
    fieldSelector: '#username,#password,#captcha-answer'
  }));
  $('#username').change(checkIllegalCharacters);
  $('#username').change(checkExistence);
  $('#username').focus();

  function checkExistence() {
    let name = this.value.trim();
    $.ajax({type: 'HEAD', url: `/api/user/${name}`})
      .done(() => {
        $('#username-exists-error').show();
      })
      .error(() => {
        $('#username-exists-error').hide();
      });
  }

  function checkIllegalCharacters() {
    let regex = new RegExp(config.illegalUsernameCharacters);
    if (regex.test(this.value))
      $('#username-characters-error').show();
    else
      $('#username-characters-error').hide();
  }

})();
