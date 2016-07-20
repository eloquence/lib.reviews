'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;

const ErrorMessage = require('../util/error.js');
const mlString = require('./ml-string');

let Thing = thinky.createModel("things", {
  id: type.string(),

  // First element is primary URL associated with this thing
  urls: [type.string().validator(isValidURL)],

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

  // Versioning information
  _revUser: type.string().required(true),
  _revDate: type.date().required(true),
  _revID: type.string().uuid(4).required(true), // Set this for all revisions, including current
  _revOf: type.string(), // Only set if it's an old revision of an existing thing
  _revDeleted: type.boolean(), // Set to true for all deleted revisions (not all revisions have to be deleted)
});


Thing.define("archiveCurrentRevision", function() {
  let thing = new Thing(this);
  thing._revOf = this.id;
  thing.id = undefined;
  return thing.save();
});



function isValidURL(url) {
  let urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/;
  if (urlRegex.test(url))
    return true;
  else
    throw new ErrorMessage('invalid url');
}

module.exports = Thing;
