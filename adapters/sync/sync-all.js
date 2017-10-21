'use strict';
// Syncs are performed in a shallow manner, that is, they do not create new
// revisions. This is so we can adjust the sync frequency as appropriate
// without accumulating an unwieldy number of revisions.

// Run with DEBUG=libreviews:app to get information about which URLs are being
// contacted, and which slug changes are being performed.

// External deps
const limit = require('promise-limit')(2); // Max 2 URL batch updates at a time
const Thing = require('../../models/thing');
Thing
  .filter({ _revOf: false }, { default: true })
  .filter({ _revDeleted: false }, { default: true })
  .then(things => {
    console.log('Resetting sync settings.');
    things.forEach(thing => thing.setURLs(thing.urls));

    console.log('Fetching new data and updating search index.');
    let updates = things.map(thing => limit(() => thing.updateActiveSyncs()));
    Promise
      .all(updates)
      .then(_updatedThings => {
        console.log('All updates complete.');
        process.exit(0);
      });
  });
