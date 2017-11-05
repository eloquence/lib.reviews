/* global $, config, libreviews */
'use strict';

// This module performs shallow lookups on Wikidata. They are shallow in that
// they only load the information that needs to be displayed to the user in
// their current language. The backend version of this adapter performs the
// actual deep lookup for all languages.

// Internal deps

const AbstractAutocompleteAdapter = require('./abstract-autocomplete-adapter');

// See abstract-adapter.js for method documentation.
class WikidataAutocompleteAdapter extends AbstractAutocompleteAdapter {

  constructor(updateCallback, searchBoxSelector) {
    super(updateCallback, searchBoxSelector);
    // Adapter settings
    this.sourceID = 'wikidata';
    this.supportedPattern = new RegExp('^http(s)*://(www.)*wikidata.org/(entity|wiki)/(Q\\d+)(?:#.*)?$', 'i');
    this.apiBaseURL = 'https://www.wikidata.org/w/api.php';
    this.queryServiceBaseURL = 'https://query.wikidata.org/bigdata/namespace/wdq/sparql';

    // Because we exclude certain item classes (e.g., disambiguation pages), we
    // fetch a larger number of results than we may need, since we may
    // eliminate some of them. The ratio below has proven to strike a
    // good balance where few queries result in zero "good" results.
    this.fetchResults = 25;
    this.displayResults = 7;

    // Timeout for query service validation requests in milliseconds
    this.queryServiceTimeout = 5000;

    // Items with these classes are typically not going to be the target of reviews.
    this.excludedItemClasses = [
      'Q4167410', // disambiguation page
      'Q17633526', // Wikinews article
      'Q11266439', // Template
      'Q4167836', // Category
      'Q14204246' // Wikimedia project page
    ];

    // How do lib.reviews language code translate to Wikidata language codes?
    // Since Wikidata supports a superset of languages and most language codes
    // are identical, we only enumerate exceptions.
    this.nativeToWikidata = {
      pt: 'pt-br',
      'pt-PT': 'pt'
    };

  }

  lookup(url) {
    return new Promise((resolve, reject) => {
      let qNumber = (url.match(this.supportedPattern) || [])[4];
      if (!qNumber)
        return reject(new Error('URL does not appear to contain a Q number (e.g., Q42) or is not a Wikidata URL.'));

      // in case the URL had a lower case "q"
      qNumber = qNumber.toUpperCase();

      let language = this.nativeToWikidata[config.language] || config.language;
      language = language.toLowerCase();

      let queryObj = {
        action: 'wbgetentities',
        format: 'json',
        languages: language,
        uselang: language,
        languagefallback: 1,
        props: 'labels|descriptions',
        ids: qNumber
      };

      $.get({
          url: this.apiBaseURL,
          jsonp: 'callback',
          dataType: 'jsonp',
          data: queryObj
        })
        .done(data => {
          if (typeof data !== 'object' || !data.success || !data.entities || !data.entities[qNumber])
            return reject(new Error('Did not get a valid Wikidata entity for query: ' + qNumber));

          // Descriptions result will be an empty object if no description is available, so
          const entity = data.entities[qNumber];
          // will always pass this test
          if (!entity.labels || !entity.descriptions)
            return reject(new Error('Did not get label and description information for query: ' + qNumber));

          if (!entity.labels[language])
            return reject(new Error('Did not get a label for ' + qNumber + 'for the specified language: ' + language));

          let label = entity.labels[language].value,
            description;

          if (entity.descriptions[language])
            description = entity.descriptions[language].value;

          resolve({
            data: {
              label,
              description
            },
            sourceID: this.sourceID
          });
        })
        .fail(reject);
    });
  }

  setupAutocomplete() {
    super.setupAutocomplete();

    // For matches against aliases, we shove some additional text into the title
    // which we don't pass along to the main application, so we don't want to
    // use the default, row.label, here.
    this.ac.primaryTextKey = 'title';

    // Wikidata can handle it :-)
    this.ac.delay = 0;

    this.ac.renderNav = this._renderNavHandler.bind(this.ac);
    this.ac.extractRow = this._extractRowHandler.bind(this.ac);
  }

  // Must be bound to an autocomplete widget:
  // Callback for requesting/validating rows from the API + query
  // service.
  _requestHandler(query, requestedOffset) {
    const time = Date.now();

    // Keep track of most recently fired query so we can ignore responses
    // coming in late
    if (this.latestQuery === undefined || this.latestQuery < time)
      this.latestQuery = time;

    this.results = [];
    query = query.trim();

    // Nothing to do - clear out the display & abort
    if (!query) {
      this.adapter.disableSpinner();
      this.render();
      return;
    }

    // Turn on spinner
    this.adapter.enableSpinner();

    const language = this.adapter.nativeToWikidata[config.language] || config.language;

    let queryObj = {
      action: 'wbsearchentities',
      search: query,
      language,
      uselang: language,
      format: 'json',
      limit: this.adapter.fetchResults
    };

    // Track if this is the first page we're rendering, in which case there's
    // no "previous" button
    let isFirstPage;

    if (requestedOffset) {
      // Pass along the offset
      queryObj.continue = requestedOffset;
    } else {
      isFirstPage = true;
      // Keep track of the exact offsets used on previous pages, since
      // they vary due to client-side filtering
      this.prevStack = [];
    }

    $.get({
        url: this.adapter.apiBaseURL,
        jsonp: 'callback',
        dataType: 'jsonp',
        data: queryObj
      })
      .done(data => {
        // Don't update if a more recent query has superseded this one
        if (time < this.latestQuery)
          return;

        this.adapter.disableSpinner();
        this.results = [];

        // Keep track of how many results we get that we can use
        let goodResults = 0;
        // Keep track of where in the result set we want to continue from
        let resultIndex = 0;

        if (typeof data !== 'object' || !data.search || !data.search.length) {
          // Render blank results and error, abort
          this.render();
          this.renderNoResults();
          return;
        }

        // Build SPARQL list of items to validate against excluded classes via
        // query service
        let prefixedItemsStr = data.search
          .map(item => `wd:${item.id}`)
          .join(' ');

        // Build SPARQL list of classes to exclude via query service
        let excludedClassesStr = this.adapter.excludedItemClasses.reduce((str, qNumber) => {
          str += `MINUS { ?item wdt:P31 wd:${qNumber} }\n`;
          return str;
        }, '');

        let sparqlQuery = 'SELECT DISTINCT ?item WHERE { \n' +
          '?item ?property ?value \n' +
          excludedClassesStr + ' \n' +
          'VALUES ?item { ' + prefixedItemsStr + '} \n' +
          '}';

        // Validate result against list of excluded classes
        $.get({
            url: this.adapter.queryServiceBaseURL,
            dataType: 'json',
            data: {
              query: sparqlQuery,
              format: 'json'
            },
            timeout: this.adapter.queryServiceTimeout
          })
          .done(filteredData => {

            // Ignore late results
            if (time < this.latestQuery)
              return;

            let isExcludedURI = uri => {
              if (typeof filteredData !== 'object' || !filteredData.results ||
                !filteredData.results.bindings)
                return false;

              for (let dataItem of filteredData.results.bindings) {
                if (dataItem.item.value === uri)
                  return false;
              }
              return true;
            };

            for (let item of data.search) {
              resultIndex++;
              if (isExcludedURI(item.concepturi))
                continue;

              let result = this.extractRow(item, query);

              this.results.push(result);
              goodResults++;

              if (goodResults >= this.adapter.displayResults)
                break;
            }
            this.render();
            let hasPagination = this.renderNav({
              isFirstPage,
              apiResult: data,
              goodResults,
              resultIndex,
              requestedOffset,
              queryString: query
            });
            if (!hasPagination && goodResults === 0)
              this.renderNoResults();

          })
          .fail(_error => {
            // In case of problems contacting the query service, we still
            // want to show unfiltered results
            if (time < this.latestQuery)
              return;

            this.results = data.search
              .slice(0, this.adapter.displayResults)
              .map(item => this.extractRow(item, query));
            let goodResults = this.results.length,
              resultIndex = goodResults;
            this.render();
            let hasPagination = this.renderNav({
              isFirstPage,
              apiResult: data,
              goodResults,
              resultIndex,
              requestedOffset,
              queryString: query
            });
            if (!hasPagination && goodResults === 0)
              this.renderNoResults();
          });
      })
      .fail(_error => {
        // Show generic error
        $('#generic-action-error').removeClass('hidden');
        window.libreviews.repaintFocusedHelp();
        // Turn off spinner
        this.adapter.disableSpinner();
      });
  }

  // Bound to the autocomplete widget:
  // Transform a result from the Wikidata item into a row that can be rendered
  // by the autocomplete control
  _extractRowHandler(item, queryString) {
    let row = {};
    row.url = `https:${item.url}`; // Returned URL is protocol relative
    // Modified below
    row.title = item.label;
    // We preserve the original label
    row.label = item.label;
    row.description = item.description;
    // Result does not contain query string directly, but some part of
    // match does. Following example of Wikidata.org search box,
    // append match to result.
    if (item.label && item.label.toUpperCase().indexOf(queryString.toUpperCase()) === -1)
      row.title += ` (${item.match.text})`;
    else if (!item.label)
      row.title = item.match.text;

    return row;
  }

  // Must be bound to an autocomplete widget:
  // Render next/previous navigation within the autocomplete widget.
  // Returns true if any navigation elements were added, false if not.
  _renderNavHandler(spec) {

    const { isFirstPage, apiResult, goodResults, resultIndex, requestedOffset, queryString } = spec;

    // Navigation templates
    const $navPlaceholder = $('<div class="ac-adapter-get-prev">&nbsp;</div>'),
      $navWrapper = $('<div class="ac-adapter-get-more"></div>'),
      $navMoreResultsText = $('<div class="ac-adapter-more-results">' + libreviews.msg('more results') + '</div>'),
      $navNoResultsText = $('<div class="ac-adapter-no-relevant-results">' + libreviews.msg('no relevant results') + '</div>'),
      $navPreviousPage = $('<div accesskey="<" class="ac-adapter-get-prev ac-adapter-get-active" title="' + libreviews.msg('load previous page', { accessKey: '<' }) + '"><span class="fa fa-caret-left">&nbsp;</span></div>'),
      $navNextPage = $('<div class="ac-adapter-get-next ac-adapter-get-active" accesskey=">" title="' + libreviews.msg('load next page', { accessKey: '>' }) + '"><span class="fa fa-caret-right">&nbsp;</span></div>');

    // The API only returns the 'search-continue' offset up to the 50th
    // result. It is useful only in edge cases but we track it for those.
    let apiSaysMoreResults = apiResult['search-continue'] !== undefined;
    let weKnowAboutMoreResults = apiResult.search.length > resultIndex;
    let hasPagination = !isFirstPage || apiSaysMoreResults || weKnowAboutMoreResults;

    let $getMore,
      $wrapper = $(this.rowWrapperEl);


    // Add basic pagination template
    if (hasPagination) {
      $getMore = $navWrapper.appendTo($wrapper);
      // Show "no relevant results" text
      if (goodResults === 0)
        $wrapper
        .prepend($navNoResultsText)
        .show();
    }

    // Add "previous page" navigation
    if (!isFirstPage) {
      $navPreviousPage
        .appendTo($getMore)
        .click(() => this.requestFn(queryString, this.prevStack.pop()));
    }

    if (apiSaysMoreResults || weKnowAboutMoreResults) {
      let nextOffset = (requestedOffset || 0) + resultIndex;

      // Add whitespace placeholder
      if (isFirstPage)
        $navPlaceholder
        .appendTo($getMore);

      // Add "MORE RESULTS" centered text
      $navMoreResultsText
        .appendTo($getMore);

      // Add "next page" navigation
      $navNextPage
        .appendTo($getMore)
        .click(() => {
          this.prevStack.push(requestedOffset);
          this.requestFn(queryString, nextOffset);
        });
    } else if (!isFirstPage) {
      // Add "MORE RESULTS" centered text
      $navMoreResultsText
        .appendTo($getMore);
    }

    return hasPagination;

  }

}

module.exports = WikidataAutocompleteAdapter;
