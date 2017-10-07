/* global $, config, libreviews */
/* eslint prefer-reflect: "off" */
(function() {
  'use strict';

  require('es6-promise').polyfill();

  const NativeFrontendAdapter = require('./adapters/native-frontend-adapter');
  const WikidataFrontendAdapter = require('./adapters/wikidata-frontend-adapter');

  // All adapters will be tried against a provided review subject URL. If they
  // support it, they will perform a parallel, asynchronous lookup. The array order
  // matters in that the first element in the array (not the first to return
  // a result) will be used for the review subject metadata. The native (lib.reviews)
  // lookup therefore always takes precedence.
  const adapters = [
    new NativeFrontendAdapter(),
    new WikidataFrontendAdapter(updateURLAndReviewSubject, '#review-search-wikidata')
  ];

  // Our form's behavior depends significantly on whether we're creating
  // a new review, or editing an old one.
  let editing = config.editing;
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

  // Little "X" icon that makes previously looked up information from Wikidata
  // and other sources go away and clears out the URL field
  $('#remove-resolved-info')
    .click(removeResolvedInfo)
    .keyup(maybeRemoveResolvedInfo);

  // Highlight rating from POST request
  if (postRating)
    selectStar.apply($(`#star-button-${postRating}`)[0]);

  // We only have to worry about review subject lookup for new reviews,
  // not when editing existing reviews
  if (!editing) {
    initializeURLValidation();
    $(textFields).change(hideAbandonDraft);
    $('#review-url').keyup(handleURLLookup);
    $('#review-url').keyup(handleURLFixes);
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
      excludeFields: $('[data-ignore-autosave]' + maybeExcludeURL)
    });

    // Set up adapters for looking up review subjects
    adapters.forEach(adapter => {
      if (adapter.setup)
        adapter.setup();
    });
  }

  // In case we're in preview mode and have a URL, make sure we fire the URL
  // validation/lookup handlers
  if ($('#preview-contents').length && $('#review-url').val()) {
    handleURLLookup.apply($('#review-url')[0]);
    handleURLValidation.apply($('#review-url')[0]);
  }

  function hideDraftNotice() {
    if ($('#draft-notice').is(':visible'))
      $('#draft-notice').fadeOut(200);
  }

  // Handler for removing a previously added review subject from a review
  function removeResolvedInfo() {
    clearResolvedInfo();
    $('#review-url').val('');
    // Trigger change-related event handlers
    handleURLLookup.apply($('#review-url')[0]);
    handleURLValidation.apply($('#review-url')[0]);
    // Update saved data w/ empty URL
    sisyphus.saveAllData();

    // Focus back on URL field.
    // We don't clear out any search fields in case the user quickly wants
    // to get back to the text they previously entered.
    $('#review-via-url').click();
  }

  // "Enter" / "Space" keyboard handler for above
  function maybeRemoveResolvedInfo() {
    if (event.keyCode == 13 || event.keyCode == 32)
      removeResolvedInfo();
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
    let inputEle = this;
    let inputURL = inputEle.value;
    let promises = [];

    if (!inputURL)
      return clearResolvedInfo();

    // We look up this URL using all adapters that support it. The native
    // adapter performs its own URL schema validation, and other adapters
    // are more restrictive.
    adapters.forEach(adapter => {
      if (adapter.ask && adapter.lookup && adapter.ask(inputURL))
        promises.push(adapter.lookup(inputURL));
    });

    // We use a mapped array so we can catch failing promises and pass along
    // the error as payload, instead of aborting the whole process if even
    // one of the queries fails.
    Promise
      .all(promises.map(promise => promise.catch(error => ({ error }))))
      .then(results => {
        // If the URL field has been cleared since the user started the query,
        // don't bother with the result of the lookup
        if (!inputEle.value)
          return;
        // Use first valid result in order of the array. Since the native lookup
        // is the first array element, it will take precedence over any adapters.
        for (let result of results) {
          if (result.data && result.data.label)
            return updateReviewSubject({
              url: inputURL,
              label: result.data.label,
              description: result.data.description, // may be undefined
              thing: result.data.thing // may be undefined
            });
        }

        clearResolvedInfo();

      });
  }

  // Clean out any old URL metadata and show the label field again
  function clearResolvedInfo() {
    $('.resolved-info').empty();
    $('#review-subject').hide();
    $('.review-label-group').show();
    window.libreviews.repaintFocusedHelp();
  }

  // Show warning and helper links as appropriate
  function handleURLValidation() {
    let inputURL = this.value;
    let protocolRegex = /^(https?|ftp):\/\//;
    if (inputURL && !libreviews.validateURL(inputURL)) {
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

  // Handle only URL corrections. This is done on keyup so fixes are instantly
  // detected.
  function handleURLFixes() {
    let inputURL = this.value;
    if ($('#review-url-error').is(':visible')) {
      if (libreviews.validateURL(inputURL)) {
        $('#review-url-error').hide();
        $('#helper-links').hide();
      }
    }
  }

  // Update the URL and the review subject, typically called from an adapter.
  function updateURLAndReviewSubject(data) {
    if (!data.url)
      throw new Error('To update a URL, we must get one.');
    $('#review-url').val(data.url);

    // Re-validate URL. There shouldn't be any problems with the new URL, so
    // this will mainly clear out old validation errors.
    handleURLValidation.apply($('#review-url')[0]);
    updateReviewSubject(data);
    // Make sure we save draft in case user aborts here
    sisyphus.saveAllData();
  }

  // Update review subject info with data from a lookup. Hides the label group
  // (label is mandatory).
  function updateReviewSubject(data) {
    const { url, label, description, thing } = data;
    if (!label)
      throw new Error('Review subject must have a label.');
    let wasFocused = $('#resolved-url a').is(':focus');
    $('.resolved-info').empty();
    $('#resolved-url').append(`<a href="${url}" target="_blank">${label}</a>`);
    if (description)
      $('#resolved-description').html(description);
    if (thing) {
      $('#resolved-thing').append(`<a href="/${thing.urlID}" target="_blank">${libreviews.msg('more info')}</a>`);
    }
    $('#review-subject').show();
    if (wasFocused)
      $('#resolved-url a').focus();
    $('.review-label-group').hide();
    // If now hidden field is focused, focus on title field instead (next in form)
    if ($('#review-label').is(':focus') || document.activeElement === document.body)
      $('#review-title').focus();
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

  function initializeURLValidation() {
    $('#url-validation').append(
      `<div id="review-url-error" class="validation-error">${libreviews.msg('not a url')}</div>` +
      `<div id="helper-links"><a href="#" id="add-https">${libreviews.msg('add https')}</a> &ndash; <a href="#" id="add-http">${libreviews.msg('add http')}</a></div>`
    );
  }
}());
