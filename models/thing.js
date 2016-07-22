'use strict';
const thinky = require('../db');
const r = thinky.r;
const type = thinky.type;
const Errors = thinky.Errors;

const ErrorMessage = require('../util/error.js');
const mlString = require('./ml-string');

let Thing = thinky.createModel("things", {
  id: type.string(),

  // First element is primary URL associated with this thing
  urls: [type.string().validator(_isValidURL)],

  label: mlString.getSchema({maxLength: 256}),
  aliases: mlString.getSchema({maxLength: 256, array: true}),
  description: mlString.getSchema({maxLength: 512}),

  // First element is used for main part of canonical URL given to this thing, others redirect
  slugs: [type.string()],

  // We can set one or many types which determine which metadata cen be added about this thing
  isA: [type.string()],

  // Information for specific types.
  bookAuthor: type.string().uuid(4), // => human

  // Track original authorship across revisions
  createdAt: type.date().required(true),
  createdBy: type.string().uuid(4).required(true),

  hasInfo: type.virtual().default(_hasInfo), // Helper for determining whether this is more than a single URL

  // These can only be populated from the outside using a user object
  userCanDelete: type.virtual().default(false),
  userCanEdit: type.virtual().default(false),
  userIsCreator: type.virtual().default(false),

  // Versioning information
  _revUser: type.string().required(true),
  _revDate: type.date().required(true),
  _revID: type.string().uuid(4).required(true), // Set this for all revisions, including current
  _revOf: type.string(), // Only set if it's an old revision of an existing thing
  _revDeleted: type.boolean(), // Set to true for all deleted revisions (not all revisions have to be deleted)
});



// Make a copy of the current object referencing the shared thing ID,
// then assign a new revision ID to the current object. Since UUID itself
// is an asynchronous op, we have to return a custom promise.
Thing.define("newRevision", function(user) {

  return new Promise((resolve, reject) => {
    let newRev = this;
    // Archive current revision
    let oldRev = new Thing(newRev);
    oldRev._revOf = newRev.id;
    oldRev.id = undefined;
    oldRev.save().then(() => {
      r.uuid().then(uuid => {
          newRev._revID = uuid;
          newRev._revUser = user.id;
          newRev._revDate = new Date();
          resolve(newRev);
      }).catch(err => { // Problem getting ID
        reject(err);
      });
    }).catch(err => { // Problem saving old rev
      reject(err);
    });
  });
});


// For more convenient access, we can reformat the document to resolve all
// multilingual strings to a single value.
Thing.define("resolveStrings", function(langKey) {

  // The ['key'] syntax is a shorthand for keys in the schema that are arrays
  // of multilingual strings.
  const mlStrings = ['label', 'description', ['aliases']];
  mlStrings.forEach(key => {
    // Resolve all strings contained in array to the value appropriate for locale
    if (Array.isArray(key) && Array.isArray(this[key[0]])) {
      this[key[0]].forEach(mlStr => {
        mlStr = mlString.resolve(langKey, mlStr);
      });
    // Resolve all strings in single fields to the value appropriate for locale
    } else {
      this[key] =  mlString.resolve(langKey, this[key]);
    }
  });
});

Thing.define("populateUserInfo", function(user) {
  if (!user)
    return; // Permissions will be at their default value (false)

  // For now, we don't let users delete things they've created,
  // since things are collaborative in nature
  this.userCanDelete = user.isModerator ? true : false;
  this.userCanEdit = user.isEditor || user.id && user.id === this.createdBy ? true : false;
  this.userIsCreator = user.id && user.id === this.createdBy ? true : false;

});

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
  let urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/;
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
