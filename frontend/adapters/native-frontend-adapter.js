/* global $, config, libreviews */
'use strict';

// Perform native (lib.reviews) lookups

const AbstractFrontendAdapter = require('./abstract-frontend-adapter');

class NativeFrontendAdapter extends AbstractFrontendAdapter {

  ask(url) {
    // Any valid URL can be looked up natively
    return libreviews.validateURL(url);
  }

  lookup(url) {
    return new Promise((resolve, reject) => {
      $.get('/api/thing', { url })
        .then(data => {
          let thing = data.thing;
          let thingURL = thing.urls[0];
          let label = window.libreviews.resolveString(config.language, thing.label) || thingURL;
          resolve({
            data: {
              label,
              thing
            }
          });
        })
        .catch(reject);
    });
  }

}

module.exports = NativeFrontendAdapter;
