'use strict';
const debug = require('../util/debug');
const WikidataBackendAdapter = require('./wikidata-backend-adapter');
const OpenLibraryBackendAdapter = require('./openlibrary-backend-adapter');

const wikidata = new WikidataBackendAdapter();
const openLibrary = new OpenLibraryBackendAdapter();
const adapters = [wikidata, openLibrary];
const sourceURLs = {};

adapters.forEach(adapter => (sourceURLs[adapter.getSourceID()] = adapter.getSourceURL()));

// General helper functions for adapters that obtain metadata about specific
// URLs

module.exports = {

    getAll() {
      return adapters;
    },

    // Returns the canonical URL that represents a specific source, typically
    // a project's main website. Used for "About this source" links and such.
    getSourceURL(sourceID) {
      return sourceURLs[sourceID];
    },

    // Returns the adapter that handles a specific source (undefined if not found)
    getAdapterForSource(sourceID) {
      for (let adapter of adapters)
        if (adapter.sourceID === sourceID)
          return adapter;
    },

    // Return a lookup promise from every adapter that can support metadata
    // about this URL.
    getSupportedLookupsAsSafePromises(url) {
      let p = [];
      adapters.forEach(adapter => {
        if (adapter.ask(url))
          p.push(adapter.lookup(url).catch(error => {
            debug.error({ error });
            return { error };
          }));
      });
      return p;
    },

    // Helper function to use in combination with Promise.all lookups
    getFirstResultWithData(results) {
      let firstResultWithData;
      for (let adapterResult of results) {
        if (typeof adapterResult === 'object' &&
          adapterResult.data && adapterResult.data.label) {
            firstResultWithData = adapterResult;
            break;
          }
      }
      return firstResultWithData;
    }
};
