'use strict';

// External dependencies
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const util = require('util');

// Internal dependencies
const File = require('../models/file');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const render = require('./helpers/render');


router.get('/file/:id/delete', function(req, res, next) {
  const { id } = req.params;
  File
    .getNotStaleOrDeleted(id)
    .then(file => {
      const titleKey = 'delete file';
      file.populateUserInfo(req.user);
      if (!file.userCanDelete)
        return render.permissionError(req, res, { titleKey });

      render.template(req, res, 'delete-file', {
        file,
        titleKey
      });
    })
    .catch(getResourceErrorHandler(req, res, next, 'file', id));
});

router.post('/file/:id/delete', function(req, res, next) {
  const { id } = req.params;
  File
    .getNotStaleOrDeleted(id)
    .then(file => {
      const titleKey = 'file deleted';
      file.populateUserInfo(req.user);
      if (!file.userCanDelete)
        return render.permissionError(req, res, { titleKey });

      deleteFile(file, req.user)
        .then(() => {
          render.template(req, res, 'file-deleted', {
            file,
            titleKey
          });
        })
        .catch(next);
      })
    .catch(getResourceErrorHandler(req, res, next, 'file', id));
});

async function deleteFile(file, user) {
  const rename = util.promisify(fs.rename),
   oldPath = path.join(__dirname, '../static/uploads', file.name),
   newPath = path.join(__dirname, '../deleted', file.name);

  await file.deleteAllRevisions(user);
  await rename(oldPath, newPath);
}

module.exports = router;
