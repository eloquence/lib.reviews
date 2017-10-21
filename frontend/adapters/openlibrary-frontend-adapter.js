/* global $ */
'use strict';

// This module performs book metadata lookups on openlibrary.org. Like other
// frontend adapters, it is shallow & cares not for language, authorship, or
// other details. Those are handled by the backend adapter.

// Internal deps

const AbstractFrontendAdapter = require('./abstract-frontend-adapter');

// Adapter settings
const supportedPattern = new RegExp('^https*://openlibrary.org/(works|books)/(OL[^/]+)/*(.*)$', 'i');
const sourceID = 'openlibrary';

class OpenLibraryFrontendAdapter extends AbstractFrontendAdapter {

  ask(url) {
    return supportedPattern.test(url);
  }

  lookup(url) {
    return new Promise((resolve, reject) => {
      let m = url.match(supportedPattern);
      if (m === null)
        return reject(new Error('URL does not appear to reference an Open Library work or edition.'));

      // Open Library distinguishes works and editions. Editions contain
      // significantly more metadata and are generally preferred. We cannot
      // guess the edition, however -- even if only on 1 exists in Open Library,
      // others may exist in the world.
      let isEdition = m[1] == 'books';

      // The string at the end of the original URL must be strpiped off for
      // obtaining the JSON representation.
      let jsonURL = isEdition ? `https://openlibrary.org/books/${m[2]}.json` :
        `https://openlibrary.org/works/${m[2]}.json`;

      $.get(jsonURL)
        .done(data => {
          // We need at least a label to work with
          if (typeof data !== 'object' || !data.title)
            return reject(new Error('Result from Open Library did not include a work or edition title.'));

          let label = data.title,
            subtitle = data.subtitle;
          resolve({
            data: {
              label,
              subtitle
            },
            sourceID
          });
        })
        .fail(reject);
    });
  }

}

module.exports = OpenLibraryFrontendAdapter;
