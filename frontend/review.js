/* global $ */
/* eslint prefer-reflect: "off" */

(function() {
  'use strict';

  // Our form's behavior depends significantly on whether we're creating
  // a new review, or editing an old one.
  let editing = window.config.editing;
  let textFields = editing ? '#review-title,#review-text' :
    '#review-url,#review-title,#review-text';

  // A library we rely on to persist form data, but only for new reviews for now
  let sisyphus;

  // Add inputs used only with JS here so they don't appear/conflict when JS is disabled
  $('#star-rating-control').append(`<input id="review-rating" name="review-rating" type="hidden" data-required>`);

  // Get rating value from previous POST request, if any
  let postRating = $('#star-rating-control').attr('data-post') || '';

  // Register event handlers

  $('[id^=star-button-]')
    .mouseout(clearStars)
    .mouseover(indicateStar)
    .click(selectStar)
    .keyup(maybeSelectStar);

  // Highlight rating from POST request
  if (postRating)
    selectStar.apply($(`#star-button-${postRating}`)[0]);

  if (!editing) {
    $(textFields).change(hideAbandonDraft);
    $('#review-url').keyup(handleURLLookup);
    $('#review-url').change(handleURLLookup);
    $('#review-url').change(handleURLValidation);
    $('#dismiss-draft-notice').click(hideDraftNotice);
    $('#abandon-draft').click(emptyAllFormFields);
    $('#add-http').click(addHTTP);
    $('#add-https').click(addHTTPS);

    // When writing a review of an existing thing, the URL field is not
    // available, so do not attempt to store data to it.
    let maybeExcludeURL = '';
    if (!$('#review-url').length)
      maybeExcludeURL = ',#review-url';

    sisyphus = $('#review-form').sisyphus({
      onRestore: processLoadedData,
      excludeFields: $('#review-token,#review-language' + maybeExcludeURL)
    });
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
    $('#review-label').focus();
    event.preventDefault();
  }

  function addHTTPS(event) {
    addProtocol('https');
    $('#review-label').focus();
    event.preventDefault();
  }

  function handleURLLookup() {
    let inputURL = this.value;
    if (validateURL(inputURL))
      lookupThing(inputURL);
    else {
      // Clean out any old URL metadata and show the label field again
      $('#resolved-url').empty();
      $('.review-label-group').slideDown(200, window.libreviews.repaintFocusedHelp);
    }
  }

  // Show warning and helper links as appropriate
  function handleURLValidation() {
    let inputURL = this.value;
    let protocolRegex = /^(https?|ftp):\/\//;
    if (inputURL && !validateURL(inputURL)) {
      $('#review-url-error').show();
      if (!protocolRegex.test(inputURL)) {
        $('#helper-links').show();
        $('#add-https').focus();
      } else {
        $('#helper-links').hide();
      }
    } else {
      $('#review-url-error').hide();
      $('#helper-links').hide();
    }
  }

  // Check if entered URL is valid; if not, show error. Offer adding HTTP/HTTPS
  // prefix if missing.
  function validateURL(inputURL) {
    let urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!$&'()*+,;=]|:|@)|\/|\?)*)?$/i;
    return urlRegex.test(inputURL);
  }

  // Check if we already have a record for this URL; if so, show relevant data.
  function lookupThing(inputURL) {
    $.get('/api/thing', { url: inputURL })
      .then(result => {

        let wasFocused = $('#resolved-url a').is(':focus');

        let label = window.libreviews.resolveString(window.config.language, result.thing.label) || result.thing.urls[0];
        $('#resolved-url')
          .empty()
          .append(`<a href="${result.thing.urls[0]}" target="_blank">${label}</a>`)
          .show();
        if (wasFocused)
          $('#resolved-url a').focus();

        $('.review-label-group').slideUp(200, () => {
          window.libreviews.repaintFocusedHelp();
          // If now hidden field is focused, focus on title field instead (next in form)
          if ($('#review-label').is(':focus')) {
            $('#review-title').focus();
          }
        });
      })
      .catch(_error => {
        // Clear out previously loaded site metadata
        $('#resolved-url').empty().hide();
        $('.review-label-group').slideDown(200, window.libreviews.repaintFocusedHelp);
      });

  }

  // For clearing out old drafts
  function emptyAllFormFields(event) {
    clearStars();
    $('#review-url,#review-title,#review-text,#review-rating').val('');
    $('#review-url').trigger('change');
    for (let rte in window.libreviews.activeRTEs)
      window.libreviews.activeRTEs[rte].reRender();
    sisyphus.manuallyReleaseData();
    hideDraftNotice();
    event.preventDefault();
  }

  // For processing draft data
  function processLoadedData() {
    let rating = Number($('#review-rating').val());

    // Trim just in case whitespace got persisted
    $('input[data-auto-trim],textarea[data-auto-trim]').each(window.libreviews.trimInput);

    // Only show notice if we've actually recovered some data
    if (rating || $('#review-url').val() || $('#review-title').val() || $('#review-text').val()) {
      if (rating)
        selectStar.apply($(`#star-button-${rating}`)[0]);

      $('#draft-notice').show();
      // Repaint help in case it got pushed down
      window.libreviews.repaintFocusedHelp();
    }

    // Show URL issues if appropriate
    if ($('#review-url').length) {
      handleURLLookup.apply($('#review-url')[0]);
      handleURLValidation.apply($('#review-url')[0]);
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
}());
