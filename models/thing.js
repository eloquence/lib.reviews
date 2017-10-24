'use strict';
const thinky = require('../db');
const r = thinky.r;
const type = thinky.type;

const urlUtils = require('../util/url-utils');
const debug = require('../util/debug');
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');
const slugName = require('./helpers/slug-name');
const getSetIDHandler = require('./helpers/set-id');
const File = require('./file');
const ThingSlug = require('./thing-slug');
const isValidLanguage = require('../locales/languages').isValid;
const ReportedError = require('../util/reported-error');
const adapters = require('../adapters/adapters');
const search = require('../search');

let thingSchema = {

  id: type.string(),

  // First element is primary URL associated with this thing
  urls: [type.string().validator(_isValidURL)],

  label: mlString.getSchema({
    maxLength: 256
  }),

  aliases: mlString.getSchema({
    maxLength: 256,
    array: true
  }),

  description: mlString.getSchema({
    maxLength: 512
  }),

  // Many creative works have a subtitle that we don't typically include as part
  // of the label.
  subtitle: mlString.getSchema({
    maxlength: 256
  }),

  // For creative works like books, magazine articles. Author names can be
  // transliterated, hence also a multilingual field. However, it is advisable
  // to treat it as monolingual in presentation (i.e. avoid indicating language),
  // since cross-language differences are the exception and not the norm.
  authors: [mlString.getSchema({
    maxLength: 256
  })],


  // Data for fields can be pulled from external sources. For fields that
  // support this, we record whether a sync is currently active (in which
  // case the field is not editable), when the last sync took place,
  // and from where.
  //
  // Note we don't initialize the "active" property -- if (and only if) it is
  // undefined, it may be switched on by the /adapters/sync scripts.
  sync: {
    description: {
      active: type.boolean(),
      updated: type.date(),
      source: type.string().enum(['wikidata'])
    }
  },

  originalLanguage: type
    .string()
    .max(4)
    .validator(isValidLanguage),

  canonicalSlugName: type.string(),

  urlID: type.virtual().default(function() {
    return this.canonicalSlugName ? encodeURIComponent(this.canonicalSlugName) : this.id;
  }),

  // Track original authorship across revisions
  createdOn: type.date().required(true),
  createdBy: type.string().uuid(4).required(true),

  // These can only be populated from the outside using a user object
  userCanDelete: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userCanUpload: type.virtual().default(false),
  userIsCreator: type.virtual().default(false),

  // Populated asynchronously using the populateReviewMetrics method
  numberOfReviews: type.virtual().default(0),
  averageStarRating: type.virtual().default(0)
};

// Add versioning related fields
Object.assign(thingSchema, revision.getSchema());

let Thing = thinky.createModel("things", thingSchema);

// Define membership and moderator relations; these are managed by the ODM
// as separate tables, e.g. teams_users_membership
Thing.hasAndBelongsToMany(File, "files", "id", "id", {
  type: 'media_usage'
});

File.hasAndBelongsToMany(Thing, "things", "id", "id", {
  type: 'media_usage'
});

Thing.hasOne(ThingSlug, "slug", "id", "thingID");

ThingSlug.belongsTo(Thing, "thing", "thingID", "thing");

Thing.getNotStaleOrDeleted = revision.getNotStaleOrDeletedHandler(Thing);

Thing.lookupByURL = function(url) {
  return Thing
    .filter(thing => thing('urls').contains(url))
    .filter({ _revOf: false }, { default: true })
    .filter({ _revDeleted: false }, { default: true });
};

// Update URL array without saving. Will also update synchronization settings.
Thing.define("setURLs", function(urls) {

  // Turn off all synchronization
  if (typeof this.sync == 'object') {
    for (let field in this.sync) {
      this.sync[field].active = false;
    }
  }

  // Turn on synchronization for supported fields. The first adapter
  // from the getAll() array to claim a supported field will be responsible
  // for it. The order of the URLs also matters -- adapters handling earlier
  // URLs can claim fields before adapters handling later URLs get to them.
  // We could change the order to enforce precedence, but for now, we leave
  // it up to the editor.
  urls.forEach(url => {
    adapters.getAll().forEach(adapter => {
      if (adapter.ask(url)) {
        adapter.supportedFields.forEach(field => {
          // Another adapter is already handling this field
          if (this.sync && this.sync[field] && this.sync[field].active)
            return;
          if (!this.sync)
            this.sync = {};

          this.sync[field] = {
            active: true,
            source: adapter.sourceID
          };
        });
      }
    });
  });
  this.urls = urls;
});

// Initialize supported fields from a single adapter result. Does not save,
// resets all sync settings, so should only be invoked on new objects.
// Silently ignores empty results, will throw error on malformed objects.
Thing.define("initializeFieldsFromAdapter", function(adapterResult) {
  if (typeof adapterResult != 'object')
    return;

  let responsibleAdapter = adapters.getAdapterForSource(adapterResult.sourceID);
  let supportedFields = responsibleAdapter.getSupportedFields();
  for (let field in adapterResult.data) {
    if (supportedFields.includes(field)) {
      this[field] = adapterResult.data[field];
      if (typeof this.sync != 'object')
        this.sync = {};
      this.sync[field] = {
        active: true,
        source: adapterResult.sourceID,
        updated: new Date()
      };
    }
  }
});


// Fetch new external data for all fields set to be synchronized. Saves.
// - Does not create a new revision, so if you need one, create it first.
// - Performs search index update.
// - Resolves with updated thing object.
// - May result in a slug update, so if initiated by a user, should be passed the
//   user ID. Otherwise, any slug changes will be without attribution
Thing.define("updateActiveSyncs", function(userID) {
  const thing = this; // For readability
  return new Promise((resolve, reject) => {
    // No active syncs of any kind? Just give the thing back.
    if (!thing.urls || !thing.urls.length || typeof thing.sync !== 'object')
      resolve(thing);

    // Determine which external sources we need to contact. While one source
    // may give us updates for many fields, we obviously only want to contact
    // it once.
    let sources = [];
    for (let field in thing.sync) {
      if (thing.sync[field].active && thing.sync[field].source &&
        !sources.includes(thing.sync[field].source))
        sources.push(thing.sync[field].source);
    }

    //  Build array of lookup promises from currently used sources
    let p = [];

    // Keep track of all URLs we're contacting for convenience
    let allURLs = [];

    sources.forEach(source => {
      let adapter = adapters.getAdapterForSource(source);
      // Find all matching URLs in array (we might have, e.g., a URL for
      // a work and one for an edition, and need to contact both).
      let relevantURLs = thing.urls.filter(url => adapter.ask(url));
      allURLs = allURLs.concat(relevantURLs);
      // Add relevant lookups as individual elements to array
      p.push(...relevantURLs.map(url => adapter.lookup(url)));
    });

    if (allURLs.length)
      debug.app(`Retrieving item metadata for ${thing.id} from the following URL(s):\n` +
        allURLs.join(', '));

    // Perform all lookups, then update thing from the results, which will be
    // returned in the same order as the sources array.
    Promise
      .all(p)
      .then(results => {
        // If the label has changed, we need to update the short identifier
        // (slug). This means a possible URL change! Redirects are put in
        // place automatically.
        let needSlugUpdate;

        // Get obj w/ key = source ID, value = reverse order array of
        // result.data objects
        let dataBySource = _organizeDataBySource(results);
        sources.forEach((source) => {
          for (let field in thing.sync) {
            // Only update if everything looks good: sync is active, source
            // ID matches, we may have new data
            if (thing.sync[field].active && thing.sync[field].source === source &&
              Array.isArray(dataBySource[source])) {
              // Earlier results get priority, i.e. need to be assigned last
              for (let d of dataBySource[source]) {
                if (d[field] !== undefined) {
                  thing.sync[field].updated = new Date();
                  this[field] = d[field];
                  if (field == 'label')
                    needSlugUpdate = true;
                }
              }
            }
          }
        });

        const updateSlug = needSlugUpdate ?
          thing.updateSlug(userID, thing.originalLanguage || 'en') :
          Promise.resolve(thing);

        updateSlug
          .then(thing => {
            thing
              .save()
              .then(thing => {
                resolve(thing);
                search.indexThing(thing);
              })
              .catch(reject);
          });
      })
      .catch(reject);

    // Put valid data from results array into an object with sourceID as
    // the key and data as a reverse-order array. There may be multiple
    // URLs from one source, assigning value to the same field. URLs earlier
    // in the original thing.urls array take priority, so we have to ensure
    // they come last.
    function _organizeDataBySource(results) {
      let rv = {};
      results.forEach(result => {
        // Correctly formatted result object with all relevant information
        if (typeof result == 'object' && typeof result.sourceID == 'string' &&
          typeof result.data == 'object') {
          // Initialize array if needed
          if (!Array.isArray(rv[result.sourceID]))
            rv[result.sourceID] = [];

          // See above on why this array is in reverse order
          rv[result.sourceID].unshift(result.data);
        }
      });
      return rv;
    }

  });

});

// There _should_ only be one review per user+thing. But the user of the model
// should be prepared to deal with edge cases where there might be more.
Thing.define("getReviewsByUser", function(user) {
  return new Promise((resolve, reject) => {

    let Review = require('./review');

    if (!user)
      return resolve([]);

    Review
      .filter({
        thingID: this.id,
        createdBy: user.id
      })
      .filter(r.row('_revDeleted').eq(false), { // Exclude deleted rows
        default: true
      })
      .filter(r.row('_revOf').eq(false), { // Exclude old revisions
        default: true
      })
      .getJoin({
        creator: {
          _apply: seq => seq.without('password')
        },
        teams: true
      })
      .then(reviews => {
        reviews.forEach(review => review.populateUserInfo(user));
        resolve(reviews);
      })
      .catch(error => reject(error));

  });
});

Thing.define("getAverageStarRating", function() {
  return new Promise((resolve, reject) => {
    r.table('reviews')
      .filter({
        thingID: this.id,
      })
      .filter({ _revOf: false }, { default: true })
      .filter({ _revDeleted: false }, { default: true })
      .avg('starRating')
      .then(resolve)
      .catch(error => {
        // Throws if the stream is empty. We consider a subject with 0 reviews
        // to have an average rating of 0.
        if (error.name == 'ReqlRuntimeError')
          resolve(0);
        else
          reject(error);
      });
  });
});

Thing.define("getReviewCount", function() {
  return new Promise((resolve, reject) => {
    r.table('reviews')
      .filter({
        thingID: this.id,
      })
      .filter({ _revOf: false }, { default: true })
      .filter({ _revDeleted: false }, { default: true })
      .count()
      .then(resolve)
      .catch(reject);
  });

});


// Obtain metrics for this review subject.
Thing.define("populateReviewMetrics", function() {
  return new Promise((resolve, reject) => {
    Promise
      .all([this.getAverageStarRating(), this.getReviewCount()])
      .then(metrics => {
        this.averageStarRating = metrics[0];
        this.numberOfReviews = metrics[1];
        resolve(this);
      })
      .catch(reject);
  });
});

// Helper function to deal with array initialization
Thing.define("addFile", function(filename) {
  if (this.files === undefined)
    this.files = [];

  this.files.push(filename);

});
Thing.define("newRevision", revision.getNewRevisionHandler(Thing));
Thing.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(Thing));

// Update the slug if an update is needed. Modifies the team object but does
// not save it.
Thing.define("updateSlug", slugName.getUpdateSlugHandler({
  SlugModel: ThingSlug,
  slugForeignKey: 'thingID',
  slugSourceField: 'label'
}));

Thing.define("setID", getSetIDHandler());


Thing.define("populateUserInfo", function(user) {
  if (!user)
    return; // Permissions will be at their default value (false)

  // For now, we don't let users delete things they've created,
  // since things are collaborative in nature
  this.userCanDelete = user.isSuperUser || user.isSiteModerator || false;
  this.userCanEdit = user.isSuperUser || user.isTrusted || user.id === this.createdBy;
  this.userCanUpload = user.isSuperUser || user.isTrusted;
  this.userIsCreator = user.id === this.createdBy;

});

Thing.getWithData = function(id, options) {

  options = Object.assign({ // Default: all first-level joins
    withFiles: true,
    withReviewMetrics: true
  }, options);

  return new Promise((resolve, reject) => {

    let join = {};
    if (options.withFiles)
      join.files = {
        _apply: seq => seq.filter({ completed: true }) // We don't show unfinished uploads
      };

    Thing
      .get(id)
      .getJoin(join)
      .then(thing => {
        if (thing._revDeleted)
          return reject(revision.deletedError);

        if (thing._revOf)
          return reject(revision.staleError);

        if (options.withReviewMetrics)
          thing
          .populateReviewMetrics()
          .then(resolve)
          .catch(reject);
        else
          resolve(thing);

      })
      .catch(reject);
  });

};

// Get label for a given thing, fallback to prettified URL if none available
Thing.getLabel = function(thing, language) {

  if (!thing || !thing.id)
    return undefined;

  let str;
  if (thing.label)
    str = mlString.resolve(language, thing.label).str;

  if (str)
    return str;

  // If we have no proper label, we can at least show the URL
  if (thing.urls && thing.urls.length)
    return urlUtils.prettify(thing.urls[0]);

  return undefined;

};


// Internal helper functions

function _isValidURL(url) {
  if (urlUtils.validate(url))
    return true;
  else
    throw new ReportedError({
      message: 'Thing URL %s is not a valid URL.',
      messageParams: [url],
      userMessage: 'invalid url',
      userMessageParams: []
    });
}

module.exports = Thing;
