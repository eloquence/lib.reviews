'use strict';

// Handlers

$('#review-url,#review-title,#review-text').focus(showInputHelp);
$('#review-url,#review-title,#review-text').blur(hideInputHelp);
$('#review-url,#review-title,#review-text').change(hideDraftNotice);
$('#review-url,#review-title,#review-text').change(trimInput);
$('#review-url').change(fixURL);
$('#star-rating-group').mouseover(showStarControlHelp);
$('#star-rating-group').mouseout(hideStarControlHelp);
$('[id^=star-button-]')
  .mouseout(clearStars)
  .mouseover(previewStar)
  .click(selectStar)
  .keyup(maybeSelectStar)
  .focus(showStarControlHelp)
  .blur(hideStarControlHelp);

$('#show-extra-fields').click(showExtraFields);
$('#show-extra-fields').keyup(maybeShowExtraFields);
$('#star-rating-group').append(`<span id="star-control">`);
$('#review-url').focus();

// The sisyphus library persists form data to local storage on change events
let sisyphus = $('#new-review-form').sisyphus({
  onRestore: processLoadedData
});

$('#abandon-draft').click(emptyAllFormFields);
$('#add-http').click(addHTTP);
$('#add-https').click(addHTTPS);
$('#publish').click(checkRequiredFields);

// Function defs

function checkRequiredFields(event) {
  // Clear out old warnings
  $('label span.required').hide();
  $('#required-fields-message,#form-error-message').hide();
  let $emptyFields = $('#review-url,#review-title,#review-text,#review-language,#review-rating').filter(getEmptyStrings);
  if ($emptyFields.length > 0) {
    $emptyFields.each(function() {
      $(`label[for="${this.id}"] span.required`).show();
    });
    $('#required-fields-message').show();
    event.preventDefault();
    return;
  }
  // Highlight any other validation errors now (not doing it earlier to avoid
  // error message overkill)
  if ($('fieldset .validation-error:visible').length > 0) {
    $('#form-error-message').show();
    event.preventDefault();
    return;
  }
}

function getEmptyStrings() {
  let str = String(this.value);
  if (str === '' || str === undefined)
    return true;
  else
    return false;
}

function trimInput() {
  this.value = this.value.trim();
}

function hideDraftNotice() {
  $('#draft-notice').fadeOut(200);
}

function addProtocol(protocol) {
  $('#review-url').val(protocol + '://' + $('#review-url').val());
  $('#review-url').trigger('change');
}

function addHTTP(event) {
  addProtocol('http');
  $('#review-title').focus();
  event.preventDefault();
}

function addHTTPS(event) {
  addProtocol('https');
  $('#review-title').focus();
  event.preventDefault();
}


function fixURL() {
  let maybeURL = this.value;
  let urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/;
  let protocolRegex = /^(https?|ftp):\/\//;
  if (maybeURL && !urlRegex.test(maybeURL)) {
    $('#review-url-validation').show();
    if (!protocolRegex.test(maybeURL)) {
      $('#helper-links').show();
      $('#add-https').focus();
    } else {
      $('#helper-links').hide();
    }
  } else {
    $('#review-url-validation').hide();
    $('#helper-links').hide();
  }
}

function emptyAllFormFields(event) {
  $('#review-url,#review-title,#review-text').val('');
  $('#review-language').val(window.config.language);
  $('#review-url').trigger('change');
  clearStars();
  sisyphus.manuallyReleaseData();
  event.preventDefault();
}

function processLoadedData() {
  let rating = Number($('#review-rating').val());
  let languageChanged = $('#review-language').val() !== window.config.language;

  // Trim just in case whitespace got persisted
  $('#review-url,#review-text,#review-title').each(trimInput);

  // Only show notice if we've actually recovered some data
  if (rating || $('#review-url').val() || $('#review-title').val() || $('#review-text').val() ||
    languageChanged) {
    if (rating)
      selectStar.apply($(`#star-button-${rating}`)[0]);

    if (languageChanged)
      $('#show-extra-fields').trigger('click');

    $('#draft-notice').show();
  }

  // Show URL issues if appropriate
  fixURL.apply($('#review-url')[0]);
}

function showExtraFields() {
  $('#extra-fields').toggle(200);
  $('#extra-fields-collapsed').toggle();
  $('#extra-fields-expanded').toggle();
}

function maybeShowExtraFields(event) {
  if (event.keyCode == 13 || event.keyCode == 32) {
    showExtraFields.apply(this);
  }
}

function showInputHelp() {
  let id = this.id;
  $('[id^=help-text]').hide();
  $('#help').show();
  $(`#help-text-${id}`).show();
  $('#help').attr('data-last-shown', id);
}

function hideInputHelp() {
  let id = this.id;
  // Keep help visible if user is hoving over it, so
  // links remain accessible
  if (!$(`#help-text-${id}:hover`).length) {
    $('#help').hide();
    $('#help-text-url').hide();
  }
}

function showStarControlHelp() {
  $('[id^=help-text]').hide();
  let shown = $('#help').attr('data-last-shown');
  if (shown)
    $(`#help-text-${shown}`).hide();

  $('#help').show();
  $('#help-text-review-rating').show();
}

function hideStarControlHelp() {
  // Keep help visible as long as at least one star is in focus
  if ($('[id^=star-button-]:focus').length)
    return;

  $('#help').hide();
  $('#help-text-review-rating').hide();

  let shown = $('#help').attr('data-last-shown');
  if (shown && $(`#${shown}:focus`).length) {
    $('#help').show();
    $(`#help-text-${shown}`).show();
  }
}


function previewStar() {
  let selectedStar = Number(this.id.match(/\d/)[0]); // We want to set all stars to the color of the selected star
  for (let i = 1; i <= selectedStar; i++)
    replaceStar(i, `/static/img/star-${selectedStar}-full.svg`, 'star-full');
  if (selectedStar < 5)
    clearStars(selectedStar + 1);
  return selectedStar;
}

function clearStars(start) {
  if (!start || typeof start !== "number")
    start = 1;
  for (let i = start; i < 6; i++)
    replaceStar(i, `/static/img/star-placeholder.svg`, 'star-holder');
}

function maybeSelectStar(event) {
  if (event.keyCode == 13 || event.keyCode == 32) {
    selectStar.apply(this);
  }
}

function replaceStar(id, src, className) {
  $(`#star-button-${id}`)
    .attr('src', src)
    .removeClass()
    .addClass(className);
}

function restoreSelected() {
  let selectedStar = $('#star-control').attr('data-selected');
  if (selectedStar) {
    selectStar.apply($(`#star-button-${selectedStar}`)[0]);
  }
}

function selectStar() {
  let selectedStar = previewStar.apply(this);
  $('#star-control').attr('data-selected', selectedStar);
  $('#review-rating').val(selectedStar);
  $('#star-rating-group img[id^=star-button-]')
    .off('mouseout')
    .mouseout(restoreSelected);
  $('#review-rating').trigger('change');
}
