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
const { promisify } = require('util');

// Internal dependencies
const File = require('../models/file');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const render = require('./helpers/render');
const slugs = require('./helpers/slugs');
const debug = require('../util/debug');
const ReportedError = require('../util/reported-error');

const allowedTypes = ['image/png', 'image/gif', 'image/svg+xml', 'image/jpeg', 'video/webm', 'audio/ogg', 'video/ogg', 'audio/mpeg', 'image/webp'];

// Uploading is a two step process. In the first step, the user simply posts the
// file or files. In the second step, they provide information such as the
// license and description. This first step has to be handled separately
// because of the requirement of managing upload streams and multipart forms.
//
// Whether or not an upload is finished, as long as we have a valid file, we
// keep it on disk, initially in a temporary directory. We also create a
// record in the "files" table for it that can be completed later.
router.post('/:id/upload', function(req, res, next) {

  // req.body won't be populated if this is a multipart request, and we pass
  // it along to the middleware for step 2, which can be found in things.js
  if (typeof req.body == "object" && Object.keys(req.body).length)
    return next();

  let id = req.params.id.trim();
  slugs.resolveAndLoadThing(req, res, id)
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
          req.flashError(error);
          return res.redirect(`/${thing.urlID}`);
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
            .then(types => {
              let fileRevPromises = [];
              req.files.forEach(() => fileRevPromises.push(File.createFirstRevision(req.user)));
              Promise
                .all(fileRevPromises)
                .then(fileRevs => {
                  let newFiles = [];
                  req.files.forEach((file, index) => {
                    fileRevs[index].name = file.filename;
                    // We don't use the reported MIME type from the upload
                    // because it may be wrong in some edge cases like Ogg
                    // audio vs. Ogg video
                    fileRevs[index].mimeType = types[index];
                    fileRevs[index].uploadedBy = req.user.id;
                    fileRevs[index].uploadedOn = new Date();
                    thing.addFile(fileRevs[index]);
                    newFiles.push(fileRevs[index]);
                  });
                  thing
                    .saveAll() // saves joined files
                    .then(thing => render.template(req, res, 'thing-upload-step-2', {
                      titleKey: 'add media',
                      thing,
                      newFiles
                    }))
                    .catch(next); // Problem saving file metadata
                })
                .catch(next); // Problem starting file revisions
            })
            .catch(error => { // One of the files couldn't be validated
              cleanupFiles(req);
              req.flashError(error);
              res.redirect(`/${thing.urlID}`);
            });

        } else {
          req.flash('pageErrors', req.__('no file received'));
          res.redirect(`/${thing.urlID}`);
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
            done(new ReportedError({
              userMessage: 'unsupported file type',
              userMessageParams: [file.originalname, file.mimetype]
            }));
          } else
            done(null, true); // Accept file for further investigation
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
        debug.error({ error, req });
    });
  });
}


// Verify that a file's contents match its claimed MIME type. This is shallow,
// fast validation. If files are manipulated, we need to pay further attention
// to any possible exploits.
async function validateFile(filePath, claimedType) {
  const buffer = await readChunk(filePath, 0, 262);
  const type = fileType(buffer);

  // Browser sometimes misreports media type for Ogg files. We don't throw an
  // error in this case, but return the correct type.
  const twoOggs = (type1, type2) => /\/ogg$/.test(type1) && /\/ogg$/.test(type2);

  if (!type)
    throw new ReportedError({
      userMessage: 'unrecognized file type',
      userMessageParams: [path.basename(filePath)],
    });
  else if (type.mime !== claimedType && !twoOggs(type.mime, claimedType))
    throw new ReportedError({
      userMessage: 'mime mismatch',
      userMessageParams: [path.basename(filePath), claimedType, type.mime],
    });
  else
    return type.mime;
}

// SVGs can't be validated by magic number check. This, too, is a relatively
// shallow validation, not a full XML parse.
async function validateSVG(filePath) {
  const readFile = promisify(fs.readFile);
  const data = await readFile(filePath);
  if (isSVG(data))
    return 'image/svg';
  else
    throw new ReportedError({
      userMessage: 'not valid svg',
      userMessageParams: [path.basename(filePath)],
    });
}

module.exports = router;
