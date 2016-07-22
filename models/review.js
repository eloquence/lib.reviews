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

  // These can only be populated from the outside using a user object
  userCanDelete: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userIsAuthor: type.virtual().default(false),

  // Versioning information
  _revUser: type.string().required(true),
  _revDate: type.date().required(true),
  _revID: type.string().uuid(4).required(true), // Set this for all revisions, including current
  _revOf: type.string(), // Only set if it's an old revision of an existing thing
  _revDeleted: type.boolean(), // Set to true for all deleted revisions (not all revisions have to be deleted)
  _revTags: [type.string()] // Optional tags to describe action performed through this revision, e.g. edit, delete, etc.
});

Review.belongsTo(User, "creator", "createdBy", "id");
Review.belongsTo(Thing, "thing", "thingID", "id");
Review.ensureIndex("createdAt");

Review.define("populateUserInfo", function(user) {
  if (!user)
    return; // fields will be at their default value (false)

  this.userCanDelete = user.canDeleteReview(this);
  this.userCanEdit = user.canEditReview(this);
  this.userIsAuthor = user.id && user.id === this.createdBy;
});

Review.define("newRevision", function(user, options) {
  if (!options)
    options = {};

  // This promise is fulfilled when a new revision is _ready_ to be saved.
  // It's not saved yet, so we can actually change it!
  return new Promise((resolve, reject) => {
    let newRev = this;
    // Archive current revision
    let oldRev = new Review(newRev);
    oldRev._revOf = newRev.id;
    oldRev.id = undefined;
    oldRev.save().then(() => {
      r.uuid().then(uuid => {
        newRev._revID = uuid;
        newRev._revUser = user.id;
        newRev._revDate = new Date();
        newRev._revTags = options.tags ? options.tags : undefined;
        resolve(newRev);
      }).catch(err => { // Problem with new rev
        reject(err);
      });
    }).catch(err => { // Problem saving old rev
      reject(err);
    });
  });
});

Review.define("deleteAllRevisions", function(user, options) {

  if (!options)
    options = {};

  let id = this.id;
  let thingID = this.thingID;
  let tags = ['delete'];

  // We return at least p1, and p2 if the associated thing is deleted as well.
  // p1 is fulfilled when all revisions of the review have been deleted.
  // p2 and p3 are fulfilled when all revisions of the associated thing have been deleted.
  let p1, p2, p3;

  if (options.deleteAssociatedThing)
    tags.push('delete-with-thing');

  p1 = new Promise((resolve, reject) => {
    this.newRevision(user, {
        tags
      })
      .then(newRev => {
        newRev._revDeleted = true;
        newRev
          .save()
          .then(() => {
            resolve(Review
              .filter({
                _revOf: id
              })
              .update({
                _revDeleted: true
              }));
          });
      })
      .catch(error => {
        reject(error);
      });
  });
  if (options.deleteAssociatedThing) {
    p2 = Thing
      .filter({
        _revOf: thingID
      })
      .update({
        _revDeleted: true
      });
    p3 = Thing
      .get(thingID)
      .update({
        _revDeleted: true
      });
    return Promise.all([p1, p2, p3]);
  } else
    return p1;
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
