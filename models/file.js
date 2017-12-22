'use strict';

/**
 * Model for file metadata.
 *
 * @namespace File
 */
const thinky = require('../db');
const type = thinky.type;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');

const User = require('./user');
const validLicenses = ['cc-0', 'cc-by', 'cc-by-sa', 'fair-use'];

/* eslint-disable newline-per-chained-call */ /* for schema readability */

const fileSchema = {
  id: type.string().uuid(4),
  name: type.string().max(512),
  description: mlString.getSchema(),
  uploadedBy: type.string().uuid(4),
  uploadedOn: type.date(),
  mimeType: type.string(),
  license: type.string().enum(validLicenses),
  // Provided by uploader: if not the author, who is?
  creator: mlString.getSchema(),
  // Provided by uploader: where does this file come from?
  source: mlString.getSchema(),
  // Uploaded files with incomplete metadata are stored in a separate directory
  completed: type.boolean().default(false),
  userCanDelete: type.virtual().default(false),
  userIsCreator: type.virtual().default(false)
};

/* eslint-enable newline-per-chained-call */ /* for schema readability */

Object.assign(fileSchema, revision.getSchema());
const File = thinky.createModel("files", fileSchema);

File.belongsTo(User, "uploader", "uploadedBy", "id");

// NOTE: STATIC METHODS --------------------------------------------------------

// Standard handlers

File.createFirstRevision = revision.getFirstRevisionHandler(File);
File.getNotStaleOrDeleted = revision.getNotStaleOrDeletedGetHandler(File);
File.filterNotStaleOrDeleted = revision.getNotStaleOrDeletedFilterHandler(File);

// Custom handlers

File.getStashedUpload = async function(userID, name) {
  const files = await File
    .filter({
      name,
      uploadedBy: userID,
      completed: false
    })
    .filter({ _revDeleted: false }, { default: true })
    .filter({ _oldRevOf: false }, { default: true });
  return files[0];
};

File.getValidLicenses = () => validLicenses.slice();

File.getFileList = async function() {
  return await File
    .filterNotStaleOrDeleted()
    .filter({ completed: true })
    .getJoin({ things: true, uploader: true })
    .orderBy(thinky.r.desc('uploadedOn'));
};

// NOTE: INSTANCE METHODS ------------------------------------------------------

// Standard handlers

File.define("newRevision", revision.getNewRevisionHandler(File));
File.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(File));
File.define("populateUserInfo", populateUserInfo);

/**
 * Populate virtual permission fields in a File object with the rights of a
 * given user.
 *
 * @param {User} user
 *  the user whose permissions to check
 * @memberof File
 * @instance
 */
function populateUserInfo(user) {
  if (!user)
    return; // Permissions will be at their default value (false)

  this.userIsCreator = user.id === this.createdBy;
  this.userCanDelete = this.userIsCreator || user.isSuperUser || user.isSiteModerator || false;
}

module.exports = File;
