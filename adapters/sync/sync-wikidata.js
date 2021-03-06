'use strict';

// Syncs are performed in a shallow manner, that is, they do not create new
// revisions. This is so we can adjust the sync frequency as appropriate
// without accumulating an unwieldy number of revisions.

// External deps
const limit = require('promise-limit')(4); // Max 4 concurrent requests

// Internal deps
const WikidataBackendAdapter = require('../wikidata-backend-adapter');
const wikidata = new WikidataBackendAdapter();
const Thing = require('../../models/thing');
const search = require('../../search');

// URL pattern a thing needs to have among its .urls to enable and perform
// sync for descriptions. This is identical to the one used by the
// adapter, but keep in mind that RethinkDB uses RE2 expressions, not JS ones.
const regexStr = '^http(s)*://(www.)*wikidata.org/(entity|wiki)/(Q\\d+)$';

Thing
  .filter({ _oldRevOf: false }, { default: true })
  .filter({ _revDeleted: false }, { default: true })
  .filter(thing => thing('urls').contains(url => url.match(regexStr)))
  .then(processThings);

// For an array of things, perform Wikidata lookups and update their
// descriptions as appropriate
function processThings(things) {
  let wikidataLookups = [];
  things.forEach(thing => {
    let wikidataURL = getWikidataURL(thing.urls);
    if (wikidataURL === undefined) {
      // We want a result array that maps against the original query, so
      // we pad it with 'null' values for any unexpectedly missing URLs
      wikidataLookups.push(Promise.resolve(null));
      return;
    }

    if (thing.sync === undefined)
      thing.sync = {};
    if (thing.sync.description === undefined) {
      thing.sync.description = {
        active: true,
        source: 'wikidata'
      };
    }
    wikidataLookups.push(limit(() => wikidata.lookup(wikidataURL)));
  });
  Promise
    .all(wikidataLookups)
    .then(wikidataResults => {
      let thingUpdates = [];

      things.forEach((thing, index) => {

        let syncActive = thing.sync && thing.sync.description && thing.sync.description.active,
          hasDescription = wikidataResults[index] &&
          wikidataResults[index].data && wikidataResults[index].data.description;

        if (syncActive && hasDescription) {
          thing.description = wikidataResults[index].data.description;
          thing.sync.description.updated = new Date();
          thing.sync.description.source = 'wikidata';
          thingUpdates.push(thing.save());
        }
      });
      Promise
        .all(thingUpdates)
        .then(updatedThings => {
          console.log(`Sync complete. ${updatedThings.length} items updated.`);
          console.log(`Updating search index now.`);
          Promise
            .all(updatedThings.map(search.indexThing))
            .then(() => {
              console.log('Search index updated.');
              process.exit();
            })
            .catch(error => {
              console.log('Problem updating search index. The error was:');
              console.log(error);
              process.exit(1);
            });
        })
        .catch(error => {
          console.log('Problem performing updates. The error was:');
          console.log(error);
          process.exit(1);
        });
    })
    .catch(error => {
      console.log('Problem performing lookups for sync. The error was:');
      console.log(error);
      process.exit(1);
    });

}

// From an array of URLs, return the first one (if any) that matches the
// Wikidata regular expression.
function getWikidataURL(arr) {
  let r = new RegExp(regexStr);
  for (let url of arr)
    if (r.test(url))
      return url;
}
