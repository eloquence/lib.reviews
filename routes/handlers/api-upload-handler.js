'use strict';

// External deps
const escapeHTML = require('escape-html');

// Internal deps
const languages = require('../../locales/languages');
const { validateFiles, cleanupFiles, getFileRevs } = require('../uploads');
const ReportedError = require('../../util/reported-error');
const File = require('../../models/file');
const api = require('../helpers/api');


/**
 * The main handler for processing upload attempts via the API. Kicks in after
 * the basic MIME check within the Multer middleware. Handles metadata
 * validation & creation of "File" revisions.
 *
 * @param {IncomingMessage} req
 *  Express request
 * @param {ServerResponse} res
 *  Express response
 * @returns {Function}
 *  callback invoked by the Multer middleware
 */
module.exports = function apiUploadHandler(req, res) {
  return fileFilterError => {

    // Status code will be used for known errors from the app, not for errors
    // from multer or unknown errors
    const abortUpload = (errors = []) => {
      cleanupFiles(req);
      const errorMessages = errors.map(error => error instanceof ReportedError ?
        req.__(...error.getEscapedUserMessageArray()) :
        error.message
      );
      api.error(req, res, errorMessages);
    };

    if (fileFilterError)
      return abortUpload([fileFilterError]);

    if (!req.files.length)
      return abortUpload([new Error('No files received.')]);

    const validationErrors = validateAllMetadata(req.files, req.body);
    if (validationErrors.length)
      return abortUpload(validationErrors);

    validateFiles(req.files)
      .then(fileTypes => getFileRevs(req.files, fileTypes, req.user, ['upload', 'upload-via-api']))
      .then(fileRevs => addMetadata(req.files, fileRevs, req.body))
      .then(fileRevs => Promise.all(fileRevs.map(fileRev => fileRev.save())))
      .then(() => reportUploadSuccess(req, res))
      .catch(error => abortUpload([error]));
  };
};

/**
 * Ensure that required fields have been submitted for each upload.
 *
 * @param {Object[]} files
 *  Files to validate
 * @param {Object} data
 *  Request data
 * @returns {Error[]}
 *  Validation errors, if any.
 */
function validateAllMetadata(files, data) {
  const errors = [],
    processedFields = ['multiple'],
    multiple = Boolean(data.multiple);

  if (files.length > 1 && !multiple)
    errors.push(new Error(`Received more than one file, but 'multiple' flag is not set.`));

  for (let file of files) {
    const validationResult = validateMetadata(file, data, { addSuffix: multiple });
    errors.push(...validationResult.errors);
    processedFields.push(...validationResult.processedFields);
  }
  const remainingFields = Object.keys(data).filter(key => !processedFields.includes(key));
  if (remainingFields.length > 0)
    errors.push(new Error(`Unknown or conflicting parameter(s): ${remainingFields.join(', ')}`));

  return errors;
}


/**
 * Check that required metadata fields are present for a given upload. Also
 * ensures that language is valid, and that license is one of the accepted
 * licenses.
 *
 * @param {Object} file
 *  File received from the upload middleware
 * @param {Object} data
 *  Request data that should contain the metadata we need
 * @param {Object} [options]
 *  Validation options
 * @param {Boolean} options.addSuffix=false
 *  Add a filename suffix to each field (used for requests with multiple files)
 * @returns {Error[]}
 *  Validation errors for this field, if any
 */
function validateMetadata(file, data, { addSuffix = false } = {}) {
  const validLicenses = File.getValidLicenses();
  const errors = [],
    processedFields = [];
  // For multiple uploads, we use the filename as a suffix for each file
  const field = key => addSuffix ? `${key}-${file.originalname}` : key;

  const requiredFields = data[field('ownwork')] ?
    ['description', 'license', 'ownwork', 'language'].map(field) :
    ['description', 'author', 'source', 'license', 'language'].map(field);

  errors.push(...checkRequired(data, requiredFields));
  processedFields.push(...requiredFields);

  const language = data[field('language')];

  if (language && !languages.isValid(language))
    errors.push(new Error(`Language ${language} is not valid or recognized.`));

  const license = data[field('license')];
  if (license && !validLicenses.includes(license))
    errors.push(new Error(`License ${license} is not one of: ` +
      validLicenses.join(', ')));

  return { errors, processedFields };
}

/**
 * Check if we have "truthy" values for all required fields in a given object
 * (typically an API request body)
 *
 * @param {Object} obj
 *  any object whose keys we want to validate
 * @param {String[]} [required=[]]
 *  keys which must access a truthy value
 * @returns {Error[]}
 *  errors for each validation issue or an empty array
 */
function checkRequired(obj, required = []) {
  // Make a copy since we modify it below
  required = required.slice();

  const errors = [];
  for (let key in obj) {
    if (required.includes(key)) {
      if (!obj[key])
        errors.push(new Error(`Parameter must not be empty: ${key}`));
      required.splice(required.indexOf(key), 1);
    }
  }
  if (required.length)
    errors.push(new Error(`Missing the following parameter(s): ${required.join(', ')}`));

  return errors;
}


/**
 * Add all metadata to each file revision (does not save)
 *
 * @param {Object[]} files
 *  file objects received from the middleware
 * @param {File[]} fileRevs
 *  initial revisions of the File model, containing only the data that comes
 *  with the file itself (MIME type, filename, etc.)
 * @param {Ojbect} data
 *  request data
 * @returns {File[]}
 *  the revisions for further processing
 */
function addMetadata(files, fileRevs, data) {
  const multiple = Boolean(data.multiple);
  fileRevs.forEach((fileRev, index) =>
    addMetadataToFileRev(files[index], fileRevs[index], data, { addSuffix: multiple })
  );
  return fileRevs;
}


/**
 * Add all relevant metadata to an individual file revision
 *
 * @param {Object} file
 *  file object from the middleware
 * @param {File} fileRev
 *  initial revision of the File model
 * @param {Object} data
 *  request data
 * @param {Object} [options]
 *  Validation options
 * @param {Boolean} options.addSuffix=false
 *  Add a filename suffix to each field (used for requests with multiple files)
 */
function addMetadataToFileRev(file, fileRev, data, { addSuffix = false } = {}) {
  const field = key => addSuffix ? `${key}-${file.originalname}` : key;
  const addMlStr = (keys, rev) => {
    for (let key of keys)
      if (data[field(key)])
        rev[key] = {
          [data[field('language')]]: escapeHTML(data[field(key)])
        };
  };
  addMlStr(['description', 'creator', 'source'], fileRev);
  fileRev.license = data[field('license')];
}


/**
 * Send a success response to the API request that contains the newly assigned
 * filenames, so they can be used, e.g. in the editor.
 *
 * @param {IncomingMessage} req
 *  Express request
 * @param {ServerResponse} res
 *  Express response
 */
function reportUploadSuccess(req, res) {
  const uploads = req.files.map(file => ({
    originalName: file.originalname,
    uploadedFileName: file.filename
  }));
  res.status(200);
  res.send(JSON.stringify({
    message: 'Upload successful.',
    uploads,
    errors: []
  }, null, 2));
}
