// Set up indices and update all reviews and review subjects (things)
'use strict';
const Review = require('../models/review');
const Thing = require('../models/thing');
const search = require('../search');
const debug = require('../util/debug');

// Commonly run from command-line, force output
debug.util.enabled = true;
debug.errorLog.enabled = true;

async function updateIndices() {
  // Get revisions we need to index & create indices
  const setupResults = await Promise.all([
    Thing.filterNotStaleOrDeleted(),
    Review.filterNotStaleOrDeleted(),
    search.createIndices()
  ]);
  const [things, reviews] = setupResults;
  let indexUpdates = [
    ...things.map(search.indexThing),
    ...reviews.map(search.indexReview)
  ];
  await Promise.all(indexUpdates);
}

debug.util('Initiating search index update.');
updateIndices()
  .then(() => {
    debug.util('All search indices updated!');
    process.exit();
  })
  .catch(error => {
    debug.error('Problem updating search indices. The error was:');
    debug.error({ error });
    process.exit(1);
  });
