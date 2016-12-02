'use strict';
const thinky = require('../db');
const r = thinky.r;
const type = thinky.type;

const ErrorMessage = require('../util/error.js');
const urlUtils = require('../util/url-utils');
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');
const File = require('./file');

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

  // First element is used for main part of canonical URL given to this thing, others redirect
  slugs: [type.string()],

  // We can set one or many types which determine which metadata cen be added about this thing
  isA: [type.string()],

  // Information for specific types.
  bookAuthor: type.string().uuid(4), // => human

  // Track original authorship across revisions
  createdOn: type.date().required(true),
  createdBy: type.string().uuid(4).required(true),

  hasInfo: type.virtual().default(_hasInfo), // Helper for determining whether this is more than a single URL

  // These can only be populated from the outside using a user object
  userCanDelete: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userCanUpload: type.virtual().default(false),
  userIsCreator: type.virtual().default(false)

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

Thing.getNotStaleOrDeleted = revision.getNotStaleOrDeletedHandler(Thing);

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

// Helper function to deal with array initialization
Thing.define("addFile", function(filename) {
  if (this.files === undefined)
    this.files = [];

  this.files.push(filename);

});
Thing.define("newRevision", revision.getNewRevisionHandler(Thing));
Thing.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(Thing));
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
    withFiles: true
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
        resolve(thing);

      })
      .catch(error => reject(error));
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


// Resolve common errors to standard error messages
Thing.resolveError = function(error) {
  let msg = error.message;
  let matches = msg.match(/Extra field `(.*?)` in \[label\] not allowed./);
  if (matches)
    return new ErrorMessage('invalid language code', [matches[1]], error);

  return error;

};


// Internal helper functions

function _isValidURL(url) {
  let urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
  if (urlRegex.test(url))
    return true;
  else
    throw new ErrorMessage('invalid url');
}

function _hasInfo() {
  if ((!this.urls || this.urls.length == 1) &&
    !this.aliases && !this.description && !this.slugs && !this.isA)
    return false;
  else
    return true;
}

module.exports = Thing;
