// Set up indices and update all reviews and review subjects (things)
'use strict';
const Review = require('../models/review');
const Thing = require('../models/thing');
const search = require('../search');

let indexSetup = search.createIndices();

let thingQuery = Thing
  .filter({
    _revOf: false
  }, {
    default: true
  })
  .filter({
    _revDeleted: false
  }, {
    default: true
  });

let reviewQuery = Review
  .filter({
    _revOf: false
  }, {
    default: true
  })
  .filter({
    _revDeleted: false
  }, {
    default: true
  });


Promise
  .all([thingQuery, reviewQuery, indexSetup])
  .then(results => {
    let things = results[0];
    let reviews = results[1];
    let p = [];
    for (let thing of things)
      p.push(search.indexThing(thing));
    for (let review of reviews)
      p.push(search.indexReview(review));
    Promise
      .all(p)
      .then(() => {
        console.log('All search indices updated!');
        process.exit();
      });
  })
  .catch(error => {
    console.log('Operation could not be completed:');
    console.log(error);
    process.exit();
  });
