'use strict';
// External dependencies
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');
const url = require('url');
const config = require('config');
const fs = require('fs');
const path = require('path');

// Internal dependencies
const Thing = require('../models/thing');
const File = require('../models/file');
const Review = require('../models/review');
const render = require('./helpers/render');
const flashError = require('./helpers/flash-error');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const languages = require('../locales/languages');
const feeds = require('./helpers/feeds');
const debug = require('../util/debug');
const ErrorMessage = require('../util/error');
const forms = require('./helpers/forms');

// For processing uploads
const uploadFormDef = [{
      name: 'upload-language',
      required: true
    }, {
      name: 'upload-%uuid',
      required: false,
      keyValueMap: 'uploads'
    }, {
      name: 'upload-%uuid-description',
      required: false,
      type: 'text',
      keyValueMap: 'descriptions'
    }, {
      name: 'upload-%uuid-by',
      required: false,
      type: 'string', // can be 'uploader' or 'other'
      keyValueMap: 'creators'
    }, {
      required: false,
      name: 'upload-%uuid-creator',
      type: 'text',
      keyValueMap: 'creatorDetails'
    },
    {
      name: 'upload-%uuid-source',
      required: false,
      type: 'text',
      keyValueMap: 'sources'
    },
    {
      name: 'upload-license-%uuid',
      required: false,
      type: 'string', // enum defined in model
      keyValueMap: 'licenses'
    }
  ];

router.get('/thing/:id', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.getWithData(id)
    .then(thing => loadThingAndReviews(req, res, next, thing))
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.get('/thing/:id/before/:utcisodate', function(req, res, next) {
  let id = req.params.id.trim();
  let utcISODate = req.params.utcisodate.trim();
  Thing.getWithData(id)
    .then(thing => {
      let offsetDate = new Date(utcISODate);
      if (!offsetDate || offsetDate == 'Invalid Date')
        offsetDate = null;
      loadThingAndReviews(req, res, next, thing, offsetDate);
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.get('/thing/:id/atom/:language', function(req, res, next) {
  let id = req.params.id.trim();
  let language = req.params.language.trim();
  Thing
    .getNotStaleOrDeleted(id)
    .then(thing => {

      if (!languages.isValid(language))
        return res.redirect(`/thing/${id}/atom/en`);

      Review.getFeed({
          thingID: thing.id,
          withThing: false
        })
        .then(result => {


          let updatedDate;
          result.feedItems.forEach(review => {
            if (!updatedDate || (review.createdOn && review.createdOn > updatedDate))
              updatedDate = review.createdOn;
          });

          req.setLocale(language);
          res.type('application/atom+xml');
          render.template(req, res, 'thing-feed-atom', {
            titleKey: 'reviews of',
            thing,
            layout: 'layout-atom',
            language,
            updatedDate,
            feedItems: result.feedItems,
            selfURL: url.resolve(config.qualifiedURL, `/thing/${id}/atom/${language}`),
            htmlURL: url.resolve(config.qualifiedURL, `/thing/${id}`)
          });

        })
        .catch(error => next(error));


    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

});

router.get('/thing/:id/edit/label', function(req, res, next) {
  if (!req.user)
    return render.signinRequired(req, res, {
      titleKey: 'edit label'
    });

  let id = req.params.id.trim();
  Thing.getWithData(id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, {
          titleKey: 'edit label'
        });

      let edit = {
        label: true,
        titleKey: 'edit label'
      };
      sendThing(req, res, thing, {
        edit
      });
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.post('/thing/:id/edit/label', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.getWithData(id)
    .then(thing => {

      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, {
          titleKey: 'edit label'
        });

      thing.newRevision(req.user).then(newRev => {
          if (!newRev.label)
            newRev.label = {};
          newRev.label[req.body['thing-label-language']] = escapeHTML(req.body['thing-label']);
          newRev.save().then(() => {
              res.redirect(`/thing/${id}`);
            })
            .catch(error => {
              let errorMessage = Thing.resolveError(error);
              flashError(req, errorMessage, 'editing label - saving');
              sendThing(req, res, thing);
            });
        })
        .catch(error => {
          flashError(req, error, 'editing label - creating new revision');
          sendThing(req, res, thing);
        });
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

// This route handles step 2 of a file upload, the addition of metadata.
// Step 1 is handled as an earlier middleware in process-uploads.js, due to the
// requirement of handling file streams and a multipart form.
router.post('/thing/:id/upload', function(req, res, next) {
  let id = req.params.id.trim();
  Thing.getWithData(id)
    .then(thing => {

      thing.populateUserInfo(req.user);
      if (!thing.userCanUpload)
        return render.permissionError(req, res, {
          titleKey: 'add media'
        });

      let language = req.body['upload-language'];
      if (!languages.isValid(language)) {
        req.flash('pageErrors', req.__('invalid language code', language));
        return res.redirect(`/thing/${thing.id}`);
      }

      let formData = forms.parseSubmission(req, {
        formDef: uploadFormDef,
        formKey: 'upload-file',
        language
      });

      if (req.flashHas('pageErrors'))
        return res.redirect(`/thing/${thing.id}`);

      if (!formData.formValues.uploads || !Object.keys(formData.formValues.uploads).length) {
        // No valid uploads
        req.flash('pageErrors', req.__('data missing'));
        return res.redirect(`/thing/${thing.id}`);
      }

      let uploadPromises = [];
      for (let uploadID in formData.formValues.uploads) {
        uploadPromises.push(File.getNotStaleOrDeleted(uploadID));
      }

      // The execution sequence here is:
      // 1) Parse the form and abort if there's a problem with any given upload.
      // 2) If there's no problem, move the upload to its final location,
      //    update its metadata and mark it as finished.
      Promise
        .all(uploadPromises)
        .then(uploads => {
          let finishUploadPromises = [];

          uploads.forEach(upload => {

            let getVal = obj => !Array.isArray(obj) || !obj[upload.id] ? null : obj[upload.id];

            upload.description = getVal(formData.formValues.descriptions);

            if (!upload.description || !upload.description[language])
              throw new ErrorMessage('upload needs description', [upload.name]);

            let by = getVal(formData.formValues.creators);
            if (!by)
              throw new ErrorMessage('data missing');

            if (by === 'other') {
              upload.creator = getVal(formData.formValues.creatorDetails);

              if (!upload.creator || !upload.creator[language])
                throw new ErrorMessage('upload needs creator', [upload.name]);

              upload.source = getVal(formData.formValues.sources);

              if (!upload.source || !upload.source[language])
                throw new ErrorMessage('upload needs source', [upload.name]);

              upload.license = getVal(formData.formValues.licenses);

              if (!upload.license)
                throw new ErrorMessage('upload needs license', [upload.name]);

            } else if (by === 'uploader') {
              upload.license = 'cc-by-sa';
            } else {
              throw new ErrorMessage('unexpected form data');
            }
            upload.completed = true;

            let finishUpload = new Promise((resolve, reject) => {

              // File names are sanitized on input but ..
              // This error is not shown to the user but logged, hence native.
              if (!upload.name || /[\/<>]/.test(upload.name))
                throw new Error(`Invalid filename: ${upload.name}`);

              // Move the file to its final location so it can be served
              let oldPath = path.join(config.uploadTempDir, upload.name);
              let newPath = path.join(__dirname, '../static/uploads', upload.name);

              fs.rename(oldPath, newPath, error => {
                if (error)
                  reject(error);
                else
                  upload
                  .save()
                  .then(() => {
                    resolve();
                  })
                  .catch(error => {
                    // Problem saving the metadata. Move upload back to
                    // temporary stash.
                    fs.rename(newPath, oldPath, renameError => {
                      debug.error({
                        context: 'upload->moving unsucessful upload back',
                        error: renameError,
                        req
                      });
                    });
                    reject(error);
                  });
              });
            });
            finishUploadPromises.push(finishUpload);
          });
          Promise
            .all(finishUploadPromises)
            .then(() => {
              req.flash('pageMessages', req.__('upload completed'));
              res.redirect(`/thing/${thing.id}`);
            })
            .catch(error => next(error));
        })
        .catch(error => {
          flashError(req, error);
          return res.redirect(`/thing/${thing.id}`);
        });
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

function loadThingAndReviews(req, res, next, thing, offsetDate) {

  let p1, p2;

  thing.populateUserInfo(req.user);

  // We don't use a join so we can use the orderBy index on this query.
  p1 = Review.getFeed({
    thingID: thing.id,
    withThing: false,
    withoutCreator: req.user ? req.user.id : false, // Obtained separately below
    offsetDate
  });

  // Separate query for any reviews by the user (might otherwise not be
  // within the date range captured above). Populates with user info.
  p2 = thing.getReviewsByUser(req.user);

  Promise
    .all([p1, p2])
    .then(result => {

      result[0].feedItems.forEach(review => {
        review.populateUserInfo(req.user);

      });
      sendThing(req, res, thing, {
        otherReviews: result[0],
        userReviews: result[1]
      });
    })
    .catch(error => next(error));

}

function sendThing(req, res, thing, options) {
  options = Object.assign({
    // Set to an object that specifies which part of the thing are to be
    // loaded into edit mode, e.g. { titleKey: 'some title', label: true },
    // otherwise leave undefined
    edit: undefined,
    // Set to a feed of reviews not written by the currently logged in user
    otherReviews: [],
    // Set to a feed of reviews written by the currently logged in user.
    userReviews: []
  }, options);

  let pageErrors = req.flash('pageErrors');
  let pageMessages = req.flash('pageMessages');
  let showLanguageNotice = false;
  let user = req.user;

  if (options.edit && req.method == 'GET' && (!user.suppressedNotices ||
      user.suppressedNotices.indexOf('language-notice-thing') == -1))
    showLanguageNotice = true;

  let embeddedFeeds = feeds.getEmbeddedFeeds(req, {
    atomURLPrefix: `/thing/${thing.id}/atom`,
    atomURLTitleKey: 'atom feed of all reviews of this item'
  });

  let offsetDate = options.otherReviews && options.otherReviews.offsetDate ?
    options.otherReviews.offsetDate : undefined;

  let paginationURL;
  if (offsetDate)
    paginationURL = `/thing/before/${offsetDate.toISOString()}`;

  render.template(req, res, 'thing', {
    deferHeader: options.edit ? true : false,
    titleKey: options.edit ? options.edit.titleKey : undefined,
    titleString: Thing.getLabel(thing, req.locale),
    thing,
    edit: options.edit,
    pageErrors,
    pageMessages,
    embeddedFeeds,
    deferPageHeader: true,
    showLanguageNotice,
    userReviews: options.userReviews,
    paginationURL,
    otherReviews: options.otherReviews ? options.otherReviews.feedItems : undefined,
    scripts: ['upload.js']
  }, {
    messages: {
      "one file selected": req.__('1 file selected'),
      "files selected": req.__('files selected')
    }
  });
}

module.exports = router;
