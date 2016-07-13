'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const ErrorMessage = require('../util/error.js');
const Thing = require('./thing.js');

// Table generation is handled by thinky. URLs for reviews are stored as "things".
let Review = thinky.createModel("reviews", {
  id: type.string(),
  reviewerID: type.string(),
  thingID: type.string(),
  title: type.string().max(255),
  text: type.string(),
  starRating: type.number().min(1).max(5),
  language: type.string().max(4)
});

Review.create = function(reviewObj) {
  return new Promise((resolve, reject) => {
    Review
      .findOrCreateThing(reviewObj)
      .then((thing) => {
        let review = new Review({
          thingID: thing.id,
          title: reviewObj.title,
          text: reviewObj.text,
          starRating: reviewObj.starRating,
          language: reviewObj.language
        });
        review.save().then(review => {
          resolve(review);
        }).catch(error => { // Save failed
          reject(error);
        });
      })
      .catch(errorMessage => { // Pre-save code failed
        reject(errorMessage);
      });
  });
};

Review.findOrCreateThing = function(reviewObj) {
  return new Promise((resolve, reject) => {
    Thing.filter(function(thing) {
      return thing('urls').contains(reviewObj.url);
    }).then(things => {
      if (things.length)
        resolve(things[0]); // we have an entry with this URL already
      else {
        // Let's make one!
        let thing = new Thing({});
        thing.urls = [reviewObj.url];
        thing.type = 'thing'; // default type
        thing.save().then(thing => {
          resolve(thing);
        }).catch(error => {
          reject(error);
        });
      }
    }).catch(error => {
      // Most likely, table does not exist. Will be auto-created on restart.
      reject(error);
    });
  });
};


module.exports = Review;
