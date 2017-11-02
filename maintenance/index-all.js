// Set up indices and update all reviews and review subjects (things)
'use strict';
const Review = require('../models/review');
const Thing = require('../models/thing');
const search = require('../search');

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
console.log(new Date().toISOString() + ' - Initiating search index update.');
updateIndices()
  .then(() => {
    console.log(new Date().toISOString() + ' - All search indices updated!');
    process.exit();
  })
  .catch(error => {
    console.error(new Date().toISOString() + ' - Problem updating search indices. The error was:');
    console.error(error.stack);
    process.exit(1);
  });
