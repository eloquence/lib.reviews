'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const r = thinky.r;
const mlString = require('./helpers/ml-string');

const ErrorMessage = require('../util/error.js');
const User = require('./user.js');
const Thing = require('./thing.js');
const revision = require('./helpers/revision');
const isValidLanguage = require('../locales/languages').isValid;

const options = {
  maxTitleLength: 255
};

let reviewSchema = {
  id: type.string().uuid(4),
  thingID: type.string().uuid(4),
  title: mlString.getSchema({
    maxLength: options.maxTitleLength
  }),
  text: mlString.getSchema(),
  html: mlString.getSchema(),
  starRating: type.number().min(1).max(5).integer(),

  // Track original authorship across revisions
  createdOn: type.date().required(true),
  createdBy: type.string().uuid(4).required(true),
  // We track this for all objects where we want to be able to handle
  // translation permissions separately from edit permissions
  originalLanguage: type.string().max(4).validator(isValidLanguage),

  // These can only be populated from the outside using a user object
  userCanDelete: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userIsAuthor: type.virtual().default(false)
};

// Add versioning related fields
Object.assign(reviewSchema, revision.getSchema());

// Table generation is handled by thinky. URLs for reviews are stored as "things".
let Review = thinky.createModel("reviews", reviewSchema);

Review.belongsTo(User, "creator", "createdBy", "id");
Review.belongsTo(Thing, "thing", "thingID", "id");
Review.ensureIndex("createdOn");

Review.define("newRevision", revision.getNewRevisionHandler(Review));

Review.define("populateUserInfo", function(user) {
  if (!user)
    return; // fields will be at their default value (false)

  if (user.isModerator || user.id === this.createdBy)
    this.userCanDelete = true;

  if (user.id === this.createdBy)
    this.userCanEdit = true;

  if (user.id === this.createdBy)
    this.userIsAuthor = true;
});

Review.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(Review));
Review.define("deleteAllRevisionsWithThing", function(user) {

  let p1 = this
    .deleteAllRevisions(user, {
      tags: 'delete-with-thing'
    });

  // We rely on the thing property having been populated. This will fail on
  // a shallow Review object!
  let p2 = this.thing
    .deleteAllRevisions(user, {
      tags: 'delete-via-review'
    });

  return Promise.all([p1, p2]);

});


Review.create = function(reviewObj, options) {
  if (!options)
    options = {};

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
          createdOn: reviewObj.createdOn,
          createdBy: reviewObj.createdBy,
          originalLanguage: reviewObj.originalLanguage,
          _revID: r.uuid(),
          _revUser: reviewObj.createdBy,
          _revDate: reviewObj.createdOn,
          _revTags: options.tags ? options.tags : undefined
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
            case 'Validator for the field [originalLanguage] returned `false`.':
              reject(new ErrorMessage('invalid language', [String(reviewObj.originalLanguage)]));
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
      })
      .filter(r.row('_revDeleted').eq(false), { // Exclude deleted rows
        default: true
      })
      .then(things => {
        if (things.length) {
          resolve(things[0]); // we have an entry with this URL already
        } else {
          // Let's make one!
          let thing = new Thing({});
          let date = new Date();
          thing.urls = [reviewObj.url];
          thing.createdOn = date;
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

Review.getFeed = function(options) {

  options = Object.assign({
    // ID of original author
    createdBy: undefined,
    // exclude reviews by users that haven't been marked trusted yet. Will be
    // applied after limit, so you might get < limit items.
    onlyTrusted: false,
    limit: 10
  }, options);

  let rv = Review.orderBy({
    index: r.desc('createdOn')
  });
  if (options.createdBy)
    rv = rv.filter({
      createdBy: options.createdBy
    });

  rv = rv
    .filter(r.row('_revDeleted').eq(false), { // Exclude deleted rows
      default: true
    })
    .filter(r.row('_revOf').eq(false), { // Exclude old versions
      default: true
    })
    .limit(options.limit)
    .getJoin({
      thing: true
    })
    .getJoin({
      creator: {
        _apply: seq => seq.without('password')
      }
    });

  if (options.onlyTrusted)
    rv = rv.filter({
      creator: {
        isTrusted: true
      }
    });

  return rv;
};

module.exports = Review;
