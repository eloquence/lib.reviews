'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const r = thinky.r;

const ErrorMessage = require('../util/error.js');
const User = require('./user.js');
const Thing = require('./thing.js');

const langKeys = Object.keys(require('../locales/languages')());

const options = {
  maxTitleLength: 255
};

// Table generation is handled by thinky. URLs for reviews are stored as "things".
let Review = thinky.createModel("reviews", {
  id: type.string(),
  thingID: type.string(),
  title: type.string().max(options.maxTitleLength),
  text: type.string(),
  html: type.string(),
  starRating: type.number().min(1).max(5).integer(),
  language: type.string().validator(isValidLanguage),

  // Track original authorship across revisions
  createdAt: type.date().required(true),
  createdBy: type.string().uuid(4).required(true),

  // Versioning information
  _revUser: type.string().required(true),
  _revDate: type.date().required(true),
  _revID: type.string().uuid(4).required(true), // Set this for all revisions, including current
  _revOf: type.string(), // Only set if it's an old revision of an existing thing
  _revDeleted: type.boolean(), // Set to true for all deleted revisions (not all revisions have to be deleted)

});

Review.belongsTo(User, "creator", "createdBy", "id");
Review.belongsTo(Thing, "thing", "thingID", "id");
Review.ensureIndex("createdAt");

Review.define("populateRights", function(user) {
  if (!user)
    return; // permissions will be "undefined", which evaluates to false

  this.userCanDelete = user.canDeleteReview(this);
  this.userCanEdit = user.canEditReview(this);
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
          html: reviewObj.html,
          starRating: reviewObj.starRating,
          createdAt: reviewObj.createdAt,
          createdBy: reviewObj.createdBy,
          language: reviewObj.language,
          _revID: r.uuid(),
          _revUser: reviewObj.createdBy,
          _revDate: reviewObj.createdAt
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
        let date = new Date();
        thing.urls = [reviewObj.url];
        thing.createdAt = date;
        thing.createdBy = reviewObj.createdBy;
        thing._revDate = date;
        thing._revUser = reviewObj.createdBy;
        thing._revID = r.uuid();
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

Review.getWithData = function(id) {
  return Review.get(id)
    .getJoin({
      thing: true
    })
    .getJoin({
      creator: {
        _apply: seq => seq.without('password')
      }
    });
};

function isValidLanguage(lang) {
  if (langKeys.indexOf(lang) !== -1)
    return true;
  else
    throw new ErrorMessage('invalid language code', [String(lang)]);
}


module.exports = Review;
