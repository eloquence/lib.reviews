'use strict';
const debug = require('../util/debug');
const WikidataBackendAdapter = require('./wikidata-backend-adapter');
const wikidata = new WikidataBackendAdapter();
const adapters = [wikidata];
const sourceURLs = {};

adapters.forEach(adapter => (sourceURLs[adapter.getSourceID()] = adapter.getSourceURL()));

// General helper functions for adapters that obtain metadata about specific
// URLs

module.exports = {

    getAll() {
      return adapters;
    },

    getSourceURL(sourceID) {
      return sourceURLs[sourceID];
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
