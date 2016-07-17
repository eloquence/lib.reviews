'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const ErrorMessage = require('../util/error.js');
const User = require('./user.js');
const Thing = require('./thing.js');

const options = {
  maxTitleLength: 255
};

// Table generation is handled by thinky. URLs for reviews are stored as "things".
let Review = thinky.createModel("reviews", {
  id: type.string(),
  reviewerID: type.string(),
  thingID: type.string(),
  title: type.string().max(options.maxTitleLength),
  text: type.string(),
  html: type.string(),
  datePosted: type.date(),
  starRating: type.number().min(1).max(5).integer(),
  language: type.string().max(4)
});

Review.belongsTo(User, "reviewer", "reviewerID", "id");
Review.belongsTo(Thing, "thing", "thingID", "id");
Review.ensureIndex("datePosted");

Review.create = function(reviewObj) {
  return new Promise((resolve, reject) => {
    Review
      .findOrCreateThing(reviewObj)
      .then((thing) => {
        let review = new Review({
          reviewerID: reviewObj.reviewerID,
          thingID: thing.id,
          title: reviewObj.title,
          text: reviewObj.text,
          html: reviewObj.html,
          datePosted: reviewObj.datePosted,
          starRating: reviewObj.starRating,
          language: reviewObj.language
        });
        review.save().then(review => {
          resolve(review);
        }).catch(error => { // Save failed
          switch (error.message) {
            case 'Value for [starRating] must be greater than or equal to 1.':
            case 'Value for [starRating] must be less than or equal to 5.':
            case 'Value for [starRating] must be an integer.':
            case 'Value for [starRating] must be a finite number or null.':
              reject(new ErrorMessage('invalid star rating', [String(reviewObj.starRating)]));
              break;
            case `Value for [title] must be shorter than ${options.maxTitleLength}.`:
              reject(new ErrorMessage('review title too long'));
              break;
              // Update when https://github.com/neumino/thinky/issues/530 is fixed
             case 'Value for [language] must be shorter than 4.':
              reject(new ErrorMessage('invalid language code', [reviewObj.language]));
              break;
            default:
              reject(error);
          }
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
