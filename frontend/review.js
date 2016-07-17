'use strict';

// Add inputs used only with JS here so they don't appear/conflict when JS is disabled
$('#star-rating-control').append(`<input id="review-rating" name="review-rating" type="hidden">`);
$('#show-extra-fields').append(`<input id="review-expand-extra-fields" name="review-expand-extra-fields" type="hidden">`);

// Get rating value from previous POST request, if any
let postRating = $('#star-rating-control').attr('data-post') || '';

// Highlight rating from POST request
if (postRating)
  selectStar.apply($(`#star-button-${postRating}`)[0]);

// Expand extra fields control if it was expanded in the POST request
if ($('#show-extra-fields')[0].hasAttribute('data-post-expanded')) {
  showExtraFields.apply($('#show-extra-fields')[0]);
}

// Markdown parser & options for live preview
let md = window.markdownit({
  linkify: true,
  breaks: true,
  typographer: true
});

// Register event handlers
$('#review-url,#review-title,#review-text').focus(showInputHelp);
$('#review-url,#review-title,#review-text').blur(hideInputHelp);
$('#review-url,#review-title,#review-text').change(trimInput);
$('#review-url,#review-title,#review-text,#review-language').change(hideAbandonDraft);
$('#review-url').change(fixURL);
$('#star-rating-control').mouseover(showStarControlHelp);
$('#star-rating-control').mouseout(hideStarControlHelp);
$('[id^=star-button-]')
  .mouseout(clearStars)
  .mouseover(indicateStar)
  .click(selectStar)
  .keyup(maybeSelectStar)
  .focus(showStarControlHelp)
  .blur(hideStarControlHelp);

$('#show-extra-fields').click(showExtraFields);
$('#show-extra-fields').keyup(maybeShowExtraFields);
$('#live-preview').change(toggleLivePreview);
$('#dismiss-draft-notice').click(hideDraftNotice);

$('#review-url').focus();

// The sisyphus library persists form data to local storage on change events
let sisyphus = $('#new-review-form').sisyphus({
  onRestore: processLoadedData,
  excludeFields: $('#live-preview')
});

$('#abandon-draft').click(emptyAllFormFields);
$('#add-http').click(addHTTP);
$('#add-https').click(addHTTPS);
$('#publish').click(checkRequiredFields);
$('#preview').click(showPreviewOnce);


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
  if ($('#draft-notice').is(':visible'))
    $('#draft-notice').fadeOut(200);
}

function hideAbandonDraft() {
  if ($('#abandon-draft').is(':visible'))
    $('#abandon-draft').fadeOut(200);
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
  hideDraftNotice();
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
  if (!$('#review-expand-extra-fields').val())
    $('#review-expand-extra-fields').val(true);
  else
    $('#review-expand-extra-fields').val(undefined);
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


function clearStars(start) {
  if (!start || typeof start !== "number")
    start = 1;
  for (let i = start; i < 6; i++)
    replaceStar(i, `/static/img/star-placeholder.svg`, 'star-holder');
}

function replaceStar(id, src, className) {
  $(`#star-button-${id}`)
    .attr('src', src)
    .removeClass()
    .addClass(className);
}

function restoreSelected() {
  let selectedStar = $('#star-rating-control').attr('data-selected');
  if (selectedStar) {
    selectStar.apply($(`#star-button-${selectedStar}`)[0]);
  }
}


function indicateStar() {
  let selectedStar = Number(this.id.match(/\d/)[0]); // We want to set all stars to the color of the selected star
  for (let i = 1; i <= selectedStar; i++)
    replaceStar(i, `/static/img/star-${selectedStar}-full.svg`, 'star-full');
  if (selectedStar < 5)
    clearStars(selectedStar + 1);
  return selectedStar;
}

function selectStar() {
  let selectedStar = indicateStar.apply(this);
  $('#star-rating-control').attr('data-selected', selectedStar);
  $('#star-rating-control img[id^=star-button-]')
    .off('mouseout')
    .mouseout(restoreSelected);
  $('#review-rating').val(selectedStar);
  $('#review-rating').trigger('change');
}

function maybeSelectStar(event) {
  if (event.keyCode == 13 || event.keyCode == 32) {
    selectStar.apply(this);
  }
}

function showPreviewOnce(event) {
  $('#preview-contents').removeClass('hidden');
  renderPreview();
  event.preventDefault();
}

function renderPreview() {
  let text = $('#review-text').val();
  let parsed = md.render(text);
  let reviewURL = $('#review-url').val();
  let rating = $('#review-rating').val();
  if (reviewURL) {
    $('#preview-review-url').removeClass('hidden');
    $('#preview-review-url-link').attr('href', encodeURI(reviewURL));
    $('#preview-review-url-link').html(escapeHTML(prettifyURL(reviewURL)));
  } else {
    $('#preview-review-url').addClass('hidden');
  }
  if (rating)
    renderPreviewStars(rating);

  $('#preview-review-text').html(parsed);
  $('#preview-review-title').html(escapeHTML($('#review-title').val()));
  $('#preview-review-byline-date').html(new Date().toLocaleString(window.config.language));
}

function renderPreviewStars(rating) {
  if (!rating || Number($('#preview-review-rating').attr('data-preview-stars')) == rating)
    return; // Nothing to do

  let img = `<img src="/static/img/star-${rating}-full.svg" width="20" class="preview-star">`;

  $('#preview-review-rating').html('');
  for (let i=1; i<=rating; i++) {
    $('#preview-review-rating').append(img);
  }
  $('#preview-review-rating').attr('data-preview-stars', rating);

}

function toggleLivePreview() {
  if ($(this).prop('checked')) {
    renderPreview();
    $('#preview-contents').removeClass('hidden');
    $('#review-title').keyup(renderPreview);
    $('#review-text').keyup(renderPreview);
    $('#review-url').change(renderPreview);
    $('#review-rating').change(renderPreview);
  } else {
    $('#preview-contents').addClass('hidden');
    $('#review-text').off('keyup', renderPreview);
    $('#review-title').off('keyup', renderPreview);
    $('#review-url').off('change', renderPreview);
    $('#review-rating').off('change', renderPreview);
  }
}

function escapeHTML(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function prettifyURL(url) {
  return url
    .replace(/^.*?:\/\//, '') // strip protocol
    .replace(/\/$/, ''); // remove trailing slashes for display only
}
