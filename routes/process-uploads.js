'use strict';
// External dependencies
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const checkCSRF = require('csurf')();
const fileType = require('file-type');
const readChunk = require('read-chunk');
const fs = require('fs');
const isSVG = require('is-svg');
const config = require('config');

// Internal dependencies
const Thing = require('../models/thing');
const File = require('../models/file');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const render = require('./helpers/render');
const debug = require('../util/debug');
const ErrorMessage = require('../util/error');
const flashError = require('./helpers/flash-error');

const allowedTypes = ['image/png', 'image/gif', 'image/svg+xml', 'image/jpeg', 'video/webm', 'audio/ogg', 'video/ogg', 'audio/mpeg', 'image/webp'];

// Uploading is a two step process. In the first step, the user simply posts the
// file or files. In the second step, they provide information such as the
// license and description. This first step has to be handled separately
// because of the requirement of managing upload streams and multipart forms.
//
// Whether or not an upload is finished, as long as we have a valid file, we
// keep it on disk, initially in a temporary directory. We also create a
// record in the "files" table for it that can be completed later.
router.post('/thing/:id/upload', function(req, res, next) {

  // req.body won't be populated if this is a multipart request, and we pass
  // it along to the middleware for step 2, which can be found in things.js
  if (typeof req.body == "object" && Object.keys(req.body).length)
    return next();

  let id = req.params.id.trim();
  Thing.getNotStaleOrDeleted(id)
    .then(thing => {

      thing.populateUserInfo(req.user);
      if (!thing.userCanUpload)
        return render.permissionError(req, res, {
          titleKey: 'add media'
        });

      let storage = multer.diskStorage({
        destination: config.uploadTempDir,
        filename(req, file, done) {
          let p = path.parse(file.originalname);
          let name = `${p.name}-${Date.now()}${p.ext}`;
          name.replace(/<>&/g, '');
          done(null, name);
        }
      });

      let upload = multer({
        limits: {
          fileSize: 1024 * 1024 * 100 // 100 MB
        },
        fileFilter,
        storage
      }).array('media');

      // Execute the actual upload middleware
      upload(req, res, error => {

        // An error at this stage most likely means an unsupported file type was among the batch.
        // We reject the whole batch and report the bad apple.
        if (error) {
          cleanupFiles(req);
          flashError(req, error);
          return res.redirect(`/thing/${thing.id}/upload`);
        }

        if (req.files.length) {
          let validators = [];
          req.files.forEach(file => {
            // SVG files need full examination
            if (file.mimetype != 'image/svg+xml')
              validators.push(validateFile(file.path, file.mimetype));
            else
              validators.push(validateSVG(file.path));
          });


          // Validate all files
          Promise
            .all(validators)
            .then(() => {
              let fileRevPromises = [];
              req.files.forEach(() => fileRevPromises.push(File.createFirstRevision(req.user)));
              Promise
                .all(fileRevPromises)
                .then(fileRevs => {
                  req.files.forEach((file, index) => {
                    fileRevs[index].name = file.filename;
                    fileRevs[index].uploadedBy = req.user.id;
                    fileRevs[index].uploadedOn = new Date();
                    thing.addFile(fileRevs[index]);
                  });
                  thing
                    .saveAll() // saves joined files
                    .then(thing => render.template(req, res, 'thing-upload-step-2', {
                        titleKey: 'add media',
                        thing
                      }))
                    .catch(error => next(error)); // Problem saving file metadata
                })
                .catch(error => next(error)); // Problem starting file revisions
            })
            .catch(error => { // One of the files couldn't be validated
              cleanupFiles(req);
              flashError(req, error);
              res.redirect(`/thing/${thing.id}/upload`);
            });

        } else {
          req.flash('pageErrors', req.__('no file received'));
          res.redirect(`/thing/${thing.id}/upload`);
        }
      });

      // Note that at the time the filter runs, we won't have the complete file yet,
      // so we may temporarily store files and delete them later if, after
      // investigation, they turn out to contain unacceptable content.

      function fileFilter(req, file, done) {
        checkCSRF(req, res, error => {
          if (error)
            return done(error); // Bad CSRF token, reject upload

          if (allowedTypes.indexOf(file.mimetype) == -1) {
            done(new ErrorMessage('unsupported file type', [file.originalname, file.mimetype]), false);
          } else
            done(null, true); // Accept file for furhter investigation
        });
      }
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

});

function cleanupFiles(req) {
  if (!Array.isArray(req.files))
    return;

  req.files.forEach(file => {
    fs.unlink(file.path, error => {
      if (error)
        debug.error({
          context: 'upload',
          error,
          req
        });
    });
  });
}


// Verify that a file's contents match its claimed MIME type. This is shallow,
// fast validation. If files are manipulated, we need to pay further attention
// to any possible exploits.
function validateFile(filePath, claimedType) {

  return new Promise((resolve, reject) => {

    readChunk(filePath, 0, 262)
      .then(buffer => {
        let type = fileType(buffer);
        if (!type)
          return reject(new ErrorMessage('unrecognized file type', [path.basename(filePath)]));
        if (type.mime === claimedType)
          return resolve();
        if (type.mime !== claimedType)
          return reject(new ErrorMessage('mime mismatch', [path.basename(filePath), claimedType, type.mime]));
      })
      .catch(error => reject(error));
  });

}

// SVGs can't be validated by magic number check. This, too, is a relatively
// shallow validation, not a full XML parse.
function validateSVG(filePath) {

  return new Promise((resolve, reject) => {

    fs.readFile(filePath, (error, data) => {
      if (error)
        return reject(error);

      if (isSVG(data))
        return resolve();
      else
        return reject(new ErrorMessage('not valid svg', [path.basename(filePath)]));
    });
  });

}

module.exports = router;
