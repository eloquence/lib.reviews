'use strict';
// External dependencies
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const checkCSRF = require('csurf')();

// Internal dependencies
const Thing = require('../models/thing');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const render = require('./helpers/render');

const allowedTypes = ['image/png', 'image/gif', 'image/svg', 'image/jpeg', 'video/webm', 'audio/ogg', 'video/ogg', 'audio/mpeg'];

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

        // TODO: We need to inspect files to ensure they are the claimed MIME
        // type.

        if (req.files.length) {
          req.files.forEach(f => thing.addFile(f.filename));

          thing
            .save()
            .then(() => {
              req.flash('pageMessages', req.__('upload completed'));
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

module.exports = router;
