'use strict';
const thinky = require('../db');
const type = thinky.type;
const r = thinky.r;
const mlString = require('./helpers/ml-string');

const ReportedError = require('../util/reported-error');
const User = require('./user.js');
const Thing = require('./thing.js');
const revision = require('./helpers/revision');
const isValidLanguage = require('../locales/languages').isValid;
const adapters = require('../adapters/adapters');

const reviewOptions = {
  maxTitleLength: 255
};

/* eslint-disable newline-per-chained-call */
/* for schema readability */

let reviewSchema = {
  id: type.string().uuid(4),
  thingID: type.string().uuid(4),
  title: mlString.getSchema({
    maxLength: reviewOptions.maxTitleLength
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

/* eslint-enable newline-per-chained-call */
/* for schema readability */

// Add versioning related fields
Object.assign(reviewSchema, revision.getSchema());

// Table generation is handled by thinky. URLs for reviews are stored as "things".
let Review = thinky.createModel("reviews", reviewSchema);

Review.options = reviewOptions;
Object.freeze(Review.options);

Review.belongsTo(User, "creator", "createdBy", "id");
Review.belongsTo(Thing, "thing", "thingID", "id");
Thing.hasMany(Review, "reviews", "id", "thingID");

Review.ensureIndex("createdOn");

Review.define("newRevision", revision.getNewRevisionHandler(Review));

Review.define("populateUserInfo", function(user) {
  if (!user)
    return; // fields will be at their default value (false)

  if (user.isSuperUser || user.isSiteModerator || user.id === this.createdBy)
    this.userCanDelete = true;

  if (user.isSuperUser || user.id === this.createdBy)
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
      .then(thing => {
        let review = new Review({
          thing, // joined
          teams: reviewObj.teams, // joined
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
        review.saveAll({
          teams: true,
          thing: true
        }).then(review => {
          resolve(review);
        }).catch(error => { // Save failed
          if (error instanceof ReviewError)
            reject(error);
          else
            reject(new ReviewError({
              parentError: error,
              payload: {
                review
              }
            }));
        });
      })
      .catch(errorMessage => { // Pre-save code failed
        reject(errorMessage);
      });
  });
};

Review.findOrCreateThing = function(reviewObj) {

  return new Promise((resolve, reject) => {

    // We have an existing thing to add this review to
    if (reviewObj.thing)
      return resolve(reviewObj.thing);

    let queries = [Thing.lookupByURL(reviewObj.url)];

    // Look up this URL in adapters that support it. Promises will not reject,
    // so can be added to Promise.all below. Order is specified in adapters.js
    // and is important (see below)
    queries = queries.concat(adapters.getSupportedLookupsAsSafePromises(reviewObj.url));

    Promise
      .all(queries)
      .then(results => {
        let things = results.shift();


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
          thing.originalLanguage = reviewObj.originalLanguage;

          // The first result ("first" in the array of adapters) for the URL
          // specified by the user will be used to initalize values like label,
          // description, subtitle, authors, or other supported fields. These
          // fields will also be set to read-only, with synchronization metadata
          // stored in the thing.sync property.
          thing.initializeFieldsFromAdapter(adapters.getFirstResultWithData(results));

          // If the user provided a valid label, it always overrides any label
          // from an adapter.
          if (reviewObj.label && reviewObj.label[reviewObj.originalLanguage])
            thing.label = reviewObj.label;

          // If we have a label, we need to set the "slug" (short URL identifier)
          // for this thing. Otherwise the promise is just a pass-through.
          const updateSlug = thing.label ?
            thing.updateSlug(reviewObj.createdBy, reviewObj.originalLanguage) :
            Promise.resolve(thing);

          updateSlug
            .then(thing => {
              thing
                .save()
                .then(resolve)
                .catch(reject);
            })
            .catch(reject);
        }
      })
      .catch(reject);
  });
};

Review.getWithData = function(id) {
  return new Promise((resolve, reject) => {
    Review.get(id)
      .getJoin({
        thing: true
      })
      .getJoin({
        teams: true
      })
      .getJoin({
        creator: {
          _apply: seq => seq.without('password')
        }
      })
      .then(review => {

        if (review._revDeleted)
          return reject(revision.deletedError);

        if (review._revOf)
          return reject(revision.staleError);

        resolve(review);

      })
      .catch(error => reject(error));
  });
};

Review.getFeed = function(options) {

  options = Object.assign({
    // If defined, ID of original author to filter by
    createdBy: undefined,
    // If set to JS date, only show reviews older than this date
    offsetDate: undefined,
    // If true, exclude reviews by users that haven't been marked trusted yet.
    // Will be applied after limit, so you might get < limit items.
    onlyTrusted: false,
    // If defined, only show reviews of a certain thing.
    thingID: undefined,
    // If true, join on the associated thing
    withThing: true,
    // If true, join on the associated teams
    withTeams: true,
    // If set, exclude reviews by a certain user ID
    withoutCreator: undefined,
    limit: 10
  }, options);

  let query = Review;

  if (options.offsetDate && options.offsetDate.valueOf)
    query = query.between(r.minval, r.epochTime(options.offsetDate.valueOf() / 1000), {
      index: 'createdOn',
      rightBound: 'open' // Do not return previous record that exactly matches offset
    });

  query = query.orderBy({
    index: r.desc('createdOn')
  });

  if (options.thingID)
    query = query.filter({
      thingID: options.thingID
    });

  if (options.withoutCreator)
    query = query.filter(r.row("createdBy").ne(options.withoutCreator));

  if (options.createdBy)
    query = query.filter({
      createdBy: options.createdBy
    });

  query = query
    .filter(r.row('_revDeleted').eq(false), { // Exclude deleted rows
      default: true
    })
    .filter(r.row('_revOf').eq(false), { // Exclude old versions
      default: true
    })
    .limit(options.limit + 1); // One over limit to check if we need potentially another set

  if (options.withThing)
    query = query.getJoin({
      thing: true
    });

  if (options.withTeams)
    query = query.getJoin({
      teams: true
    });

  query = query.getJoin({
    creator: {
      _apply: seq => seq.without('password')
    }
  });

  return new Promise((resolve, reject) => {

    query.then(feedItems => {
        let result = {};

        // At least one additional document available, set offset for pagination
        if (feedItems.length == options.limit + 1) {
          result.offsetDate = feedItems[options.limit - 1].createdOn;
          feedItems.pop();
        }

        if (options.onlyTrusted)
          feedItems = feedItems.filter(item => item.creator.isTrusted ? true : false);

        result.feedItems = feedItems;

        resolve(result);
      })
      .catch(error => {
        reject(error);
      });

  });

};

class ReviewError extends ReportedError {
  constructor(options) {
    if (typeof options == 'object' && options.parentError instanceof Error &&
      typeof options.payload.review == 'object') {
      switch (options.parentError.message) {
        case 'Value for [starRating] must be greater than or equal to 1.':
        case 'Value for [starRating] must be less than or equal to 5.':
        case 'Value for [starRating] must be an integer.':
        case 'Value for [starRating] must be a finite number or null.':
          options.userMessage = 'invalid star rating';
          options.userMessageParams = [String(options.payload.review.starRating)];
          break;
        case `Value for [title] must be shorter than ${Review.options.maxTitleLength}.`:
          options.userMessage = 'review title too long';
          break;
        case 'Validator for the field [originalLanguage] returned `false`.':
          options.userMessage = 'invalid language';
          options.userMessageParams = [String(options.payload.review.originalLanguage)];
          break;
        default:
      }
    }
    super(options);
  }

}

module.exports = Review;
