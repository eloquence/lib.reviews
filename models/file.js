'use strict';
const thinky = require('../db');
const type = thinky.type;
const mlString = require('./helpers/ml-string');
const revision = require('./helpers/revision');

/* eslint-disable newline-per-chained-call */ /* for schema readability */

let fileSchema = {
  id: type.string().uuid(4),
  name: type.string().max(512),
  description: mlString.getSchema(),
  uploadedBy: type.string().uuid(4),
  uploadedOn: type.date(),
  license: type.string().enum(['cc-0', 'cc-by', 'cc-by-sa', 'fair-use']),
  creator: mlString.getSchema(),
  source: mlString.getSchema(),
  // Uploaded files with incomplete metadata are stored in a separate directory
  completed: type.boolean().default(false)
};

/* eslint-enable newline-per-chained-call */ /* for schema readability */

Object.assign(fileSchema, revision.getSchema());

let File = thinky.createModel("files", fileSchema);
File.define("newRevision", revision.getNewRevisionHandler(File));
File.define("deleteAllRevisions", revision.getDeleteAllRevisionsHandler(File));
File.createFirstRevision = revision.getFirstRevisionHandler(File);
File.getNotStaleOrDeleted = revision.getNotStaleOrDeletedGetHandler(File);

module.exports = File;
