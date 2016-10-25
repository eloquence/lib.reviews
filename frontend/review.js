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

  $('#live-preview').change(toggleLivePreview);
  $('#preview').click(showPreviewOnce);

  if (!editing) {
    $(textFields).change(hideAbandonDraft);
    $('#review-url').change(validateURL);
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
      excludeFields: $('#live-preview,#review-token,#review-language' + maybeExcludeURL)
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
    $('#review-title').focus();
    event.preventDefault();
  }

  function addHTTPS(event) {
    addProtocol('https');
    $('#review-title').focus();
    event.preventDefault();
  }

  function validateURL() {
    let maybeURL = this.value;
    let urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
    let protocolRegex = /^(https?|ftp):\/\//;
    if (maybeURL && !urlRegex.test(maybeURL)) {
      $('#review-url-error').show();
      if (!protocolRegex.test(maybeURL)) {
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

  // For clearing out old drafts
  function emptyAllFormFields(event) {
    clearStars();
    $('#review-url,#review-title,#review-text,#review-rating').val('');
    $('#review-url').trigger('change');
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
    if ($('#review-url').length)
      validateURL.apply($('#review-url')[0]);
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
    let parsed = window.markdown.render(text);
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

    // For handling events inside content, e.g., spoiler warnings
    window.libreviews.updateContentClickHandlers();
    // Re-render help in case it got pushed down by preview
    window.libreviews.repaintFocusedHelp();
  }

  function renderPreviewStars(rating) {
    if (!rating || Number($('#preview-review-rating').attr('data-preview-stars')) == rating)
      return; // Nothing to do

    let img = `<img src="/static/img/star-${rating}-full.svg" width="20" class="preview-star">`;

    $('#preview-review-rating').html('');
    for (let i = 1; i <= rating; i++) {
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

  // For link labels when we only have a URL
  function prettifyURL(url) {
    return url
      .replace(/^.*?:\/\//, '') // strip protocol
      .replace(/\/$/, ''); // remove trailing slashes for display only
  }
}());
