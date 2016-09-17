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

// Internal dependencies
const Thing = require('../models/thing');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const render = require('./helpers/render');
const debug = require('../util/debug');

const allowedTypes = ['image/png', 'image/gif', 'image/svg+xml', 'image/jpeg', 'video/webm', 'audio/ogg', 'video/ogg', 'audio/mpeg'];

router.post('/thing/:id/upload', function(req, res, next) {

  let id = req.params.id.trim();
  Thing.getNotStaleOrDeleted(id)
    .then(thing => {

      thing.populateUserInfo(req.user);
      if (!thing.userCanUpload)
        return render.permissionError(req, res, {
          titleKey: 'add media'
        });

      // If any files in a given upload were rejected, we add them here for reporting.
      let rejectedFiles = [];

      let storage = multer.diskStorage({
        destination: path.join(__dirname, '../static/uploads'),
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
        if (error)
          return next(error);

        if (req.files.length) {
          req.files.forEach(f => thing.addFile(f.filename));

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
              thing
                .save()
                .then(() => {
                  req.flash('pageMessages', req.__('upload completed'));
                  res.redirect(`/thing/${thing.id}`);
                });
            })
            .catch(_error => { // One of the files couldn't be validated

              cleanupFiles(req);
              req.flash('pageErrors', req.__('upload failed'));
              res.redirect(`/thing/${thing.id}`);

            });

        } else {

          // TODO: We need to handle different error cases here, e.g.,
          // one of the uploaded files failed; why did it fail.

          req.flash('pageErrors', req.__('upload failed'));
          res.redirect(`/thing/${thing.id}`);
        }
      });

      // Note that at the time the filter runs, we won't have the complete file yet,
      // so we may temporarily store files and delete them later if, after
      // investigation, they turn out to contain unacceptable content.

      function fileFilter(req, file, done) {
        checkCSRF(req, res, error => {
          if (error)
            done(error); // Bad CSRF token, reject upload
          else
          if (allowedTypes.indexOf(file.mimetype) == -1) { // Bad MIME type, reject this file
            rejectedFiles.push(file);
            done(null, false);
          } else
            done(null, true); // Accept file for furhter investigation
        });
      }
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

});

function cleanupFiles(req) {
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
function validateFile(path, claimedType) {

  return new Promise((resolve, reject) => {

    readChunk(path, 0, 262)
      .then(buffer => {
        let type = fileType(buffer);
        if (!type)
          return reject(new Error('Unrecognized file type'));
        if (type.mime === claimedType)
          return resolve();
        if (type.mime !== claimedType)
          return reject(new Error(`Claimed MIME type was ${claimedType} but file appears to be ${type.mime}`));
      })
      .catch(error => reject(error));
  });

}

// SVGs can't be validated by magic number check. This, too, is a relatively
// shallow validation, not a full XML parse.
function validateSVG(path) {

  return new Promise((resolve, reject) => {

    fs.readFile(path, (error, data) => {
      if (error)
        return reject(error);

      if (isSVG(data))
        return resolve();
      else
        return reject(new Error(`Claimed MIME type was image/svg+xml but file does not appear to be valid SVG.`));
    });
  });

}

module.exports = router;
