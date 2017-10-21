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
const ReportedError = require('../util/reported-error');
const Thing = require('../models/thing');
const File = require('../models/file');
const Review = require('../models/review');
const render = require('./helpers/render');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const languages = require('../locales/languages');
const feeds = require('./helpers/feeds');
const debug = require('../util/debug');
const forms = require('./helpers/forms');
const slugs = require('./helpers/slugs');
const search = require('../search');
const getMessages = require('../util/get-messages');
const urlUtils = require('../util/url-utils');

// For handling form fields
const editableFields = ['description', 'label'];

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

router.get('/:id', function(req, res, next) {
  let id = req.params.id.trim();
  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => loadThingAndReviews(req, res, next, thing))
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.get('/:id/manage/urls', function(req, res, next) {
  const id = req.params.id.trim();
  const titleKey = 'manage links';

  if (!req.user)
    return render.signinRequired(req, res, { titleKey });

  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, { titleKey });

      sendThingURLsForm({ req, res, titleKey, thing });

    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

});


// Update the set of URLs associated with a given thing from user input. The
// first URL in the array is the "primary" URL, used wherever we want to
// offer a convenient single external link related to a review subject.
router.post('/:id/manage/urls', function(req, res, next) {
  const id = req.params.id.trim();
  const titleKey = 'manage links';

  if (!req.user)
    return render.signinRequired(req, res, { titleKey });

  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, { titleKey });

      processThingURLsUpdate({ req, res, thing, titleKey });
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

});


router.get('/:id/edit/:field', function(req, res, next) {

  if (!editableFields.includes(req.params.field))
    return next();

  const titleKey = `edit ${req.params.field}`;
  const edit = {
    [req.params.field]: true
  };
  const id = req.params.id.trim();

  if (!req.user)
    return render.signinRequired(req, res, { titleKey });

  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, { titleKey });

      let descriptionSyncActive = thing.sync && thing.sync.description && thing.sync.description.active;
      if (req.params.field === 'description' && descriptionSyncActive)
        return render.permissionError(req, res, {
          titleKey,
          detailsKey: 'cannot edit synced field'
        });

      sendForm(req, res, thing, edit, titleKey);
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.post('/:id/edit/:field', processTextFieldUpdate);

router.get('/:id/before/:utcisodate', function(req, res, next) {
  let id = req.params.id.trim();
  let utcISODate = req.params.utcisodate.trim();
  slugs.resolveAndLoadThing(req, res, id)
    .then(thing => {
      let offsetDate = new Date(utcISODate);
      if (!offsetDate || offsetDate == 'Invalid Date')
        offsetDate = null;
      loadThingAndReviews(req, res, next, thing, offsetDate);
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.get('/:id/atom/:language', function(req, res, next) {
  let id = req.params.id.trim();
  let language = req.params.language.trim();
  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => {

      if (!languages.isValid(language))
        return res.redirect(`/${id}/atom/en`);

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
            selfURL: url.resolve(config.qualifiedURL, `/${id}/atom/${language}`),
            htmlURL: url.resolve(config.qualifiedURL, `/${id}`)
          });

        })
        .catch(next);


    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

});

// This route handles step 2 of a file upload, the addition of metadata.
// Step 1 is handled as an earlier middleware in process-uploads.js, due to the
// requirement of handling file streams and a multipart form.
router.post('/:id/upload', function(req, res, next) {
  let id = req.params.id.trim();
  slugs.resolveAndLoadThing(req, res, id)
    .then(thing => {

      thing.populateUserInfo(req.user);
      if (!thing.userCanUpload)
        return render.permissionError(req, res, {
          titleKey: 'add media'
        });

      let language = req.body['upload-language'];
      if (!languages.isValid(language)) {
        req.flash('pageErrors', req.__('invalid language code', language));
        return res.redirect(`/${thing.urlID}`);
      }

      let formData = forms.parseSubmission(req, {
        formDef: uploadFormDef,
        formKey: 'upload-file',
        language
      });

      if (req.flashHas('pageErrors'))
        return res.redirect(`/${thing.urlID}`);

      if (!formData.formValues.uploads || !Object.keys(formData.formValues.uploads).length) {
        // No valid uploads
        req.flash('pageErrors', req.__('data missing'));
        return res.redirect(`/${thing.urlID}`);
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
              throw new ReportedError({
                message: `Form data for upload %s lacks a description.`,
                messageParams: [upload.name],
                userMessage: 'upload needs description',
              });

            let by = getVal(formData.formValues.creators);
            if (!by)
              throw new ReportedError({
                message: `Form data for upload missing creator information.`,
                userMessage: 'data missing'
              });

            if (by === 'other') {
              upload.creator = getVal(formData.formValues.creatorDetails);

              if (!upload.creator || !upload.creator[language])
                throw new ReportedError({
                  message: 'Form data for upload %s lacks creator information.',
                  messageParams: [upload.name],
                  userMessage: 'upload needs creator'
                });

              upload.source = getVal(formData.formValues.sources);

              if (!upload.source || !upload.source[language])
                throw new ReportedError({
                  message: 'Form data for upload %s lacks source information.',
                  messageParams: [upload.name],
                  userMessage: 'upload needs source'
                });

              upload.license = getVal(formData.formValues.licenses);

              if (!upload.license)
                throw new ReportedError({
                  message: 'Form data for upload %s lacks license information.',
                  messageParams: [upload.name],
                  userMessage: 'upload needs license'
                });

            } else if (by === 'uploader') {
              upload.license = 'cc-by-sa';
            } else {
              throw new ReportedError({
                message: 'Upload form contained unexpected form data.',
                userMessage: 'unexpected form data'
              });
            }
            upload.completed = true;

            let finishUpload = new Promise((resolve, reject) => {

              // File names are sanitized on input but ..
              // This error is not shown to the user but logged, hence native.
              if (!upload.name || /[/<>]/.test(upload.name))
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
                      debug.error({ error: renameError, req });
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
              res.redirect(`/${thing.urlID}`);
            })
            .catch(next);
        })
        .catch(error => {
          req.flashError(error);
          return res.redirect(`/${thing.urlID}`);
        });
    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

// Legacy redirects

router.get('/thing/:id', function(req, res) {
  let id = req.params.id.trim();
  return res.redirect(`/${id}`);
});

router.get('/thing/:id/before/:utcisodate', function(req, res) {
  let id = req.params.id.trim();
  let utcISODate = req.params.utcisodate.trim();
  return res.redirect(`/${id}/before/${utcISODate}`);
});

router.get('/thing/:id/atom/:language', function(req, res) {
  let id = req.params.id.trim();
  let language = req.params.language.trim();
  return res.redirect(`/${id}/atom/${language}`);
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
    .catch(next);

}

function processTextFieldUpdate(req, res, next) {

  const field = req.params.field,
    id = req.params.id.trim();

  if (!editableFields.includes(field))
    return next();

  const titleKey = `edit ${field}`;

  slugs.resolveAndLoadThing(req, res, id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, {
          titleKey
        });

      let descriptionSyncActive = thing.sync && thing.sync.description && thing.sync.description.active;
      if (req.params.field === 'description' && descriptionSyncActive)
        return render.permissionError(req, res, {
          titleKey,
          detailsKey: 'cannot edit synced field'
        });

      thing
        .newRevision(req.user)
        .then(newRev => {
          if (!newRev[field])
            newRev[field] = {};

          let language = req.body['thing-language'];
          languages.validate(language);
          let text = req.body[`thing-${field}`];
          newRev[field][language] = escapeHTML(text);
          if (!newRev.originalLanguage)
            newRev.originalLanguage = language;

          let maybeUpdateSlug;
          if (field === 'label') // Must update slug to match label change
            maybeUpdateSlug = newRev.updateSlug(req.user.id, language);
          else
            maybeUpdateSlug = Promise.resolve(newRev); // Nothing to do

          maybeUpdateSlug
            .then(updatedRev => {
              updatedRev
                .save()
                .then(() => {
                  search.indexThing(updatedRev);
                  res.redirect(`/${id}`);
                })
                .catch(next);
            })
            .catch(error => {
              if (error.name === 'InvalidLanguageError') {
                req.flashError(error);
                sendThing(req, res, thing);
              } else
                return next(error);
            });
        });

    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
}

function sendForm(req, res, thing, edit, titleKey) {
  edit = Object.assign({
    label: false,
    description: false
  }, edit);
  let pageErrors = req.flash('pageErrors');
  let pageMessages = req.flash('pageMessages');
  let showLanguageNotice = false;
  let user = req.user;

  // If not suppressed, show a notice informing the user that UI language
  // is content language
  if (req.method == 'GET' && (!user.suppressedNotices ||
      user.suppressedNotices.indexOf('language-notice-thing') == -1))
    showLanguageNotice = true;

  render.template(req, res, 'thing-form', {
    titleKey,
    deferPageHeader: true,
    thing,
    pageErrors,
    showLanguageNotice,
    pageMessages,
    edit
  });

}

function sendThing(req, res, thing, options) {
  options = Object.assign({
    // Set to a feed of reviews not written by the currently logged in user
    otherReviews: [],
    // Set to a feed of reviews written by the currently logged in user.
    userReviews: []
  }, options);

  let pageErrors = req.flash('pageErrors');
  let pageMessages = req.flash('pageMessages');
  let embeddedFeeds = feeds.getEmbeddedFeeds(req, {
    atomURLPrefix: `/${thing.urlID}/atom`,
    atomURLTitleKey: 'atom feed of all reviews of this item'
  });

  let offsetDate = options.otherReviews && options.otherReviews.offsetDate ?
    options.otherReviews.offsetDate : undefined;

  let paginationURL;
  if (offsetDate)
    paginationURL = `/before/${offsetDate.toISOString()}`;

  // If there are URLs beyond the main URL, we show them in categorized form
  let taggedURLs = Array.isArray(thing.urls) && thing.urls.length > 1 ?
    urlUtils.getURLsByTag(thing.urls.slice(1), { onlyOneTag: true, sortResults: true }) : {};

  render.template(req, res, 'thing', {
    titleKey: 'reviews of',
    titleParam: Thing.getLabel(thing, req.locale),
    thing,
    pageErrors,
    pageMessages,
    embeddedFeeds,
    deferPageHeader: true,
    userReviews: options.userReviews,
    paginationURL,
    hasMoreThanOneReview: thing.numberOfReviews > 1,
    otherReviews: options.otherReviews ? options.otherReviews.feedItems : undefined,
    taggedURLs,
    scripts: ['upload.js']
  }, {
    messages: {
      "one file selected": req.__('one file selected'),
      "files selected": req.__('files selected')
    }
  });
}

// Send the form for the "manage URLs" route, either with the current
// URLs, or with data from the POST request
function sendThingURLsForm(paramsObj) {
  const { req, res, titleKey, thing, formValues } = paramsObj;
  const pageErrors = req.flash('pageErrors'),
    pageMessages = req.flash('pageMessages');
  let numberOfFields = thing.urls.length + 2;
  render.template(req, res, 'thing-urls', {
    titleKey,
    thing,
    numberOfFields,
    pageErrors,
    pageMessages,
    singleColumn: true,
    // Preserve submission content, if any
    urls: formValues ? formValues.urls : thing.urls,
    primary: formValues ? formValues.primary : 0,
    scripts: ['manage-urls.js']
  }, {
    messages: getMessages(req.locale, ['not a url', 'add http', 'add https', 'enter web address short'])
  });
}

// Handle data from a POST request for the "manage URLs" route
function processThingURLsUpdate(paramsObj) {
  const { req, res, titleKey, thing } = paramsObj;
  const formDef = [{
    name: 'primary',
    type: 'number',
    required: true
  }];
  // This will parse fields like url-0 to an array of URLs
  for (let field in req.body) {
    if (/^url-[0-9]+$/.test(field))
      formDef.push({
        name: field,
        type: 'url',
        required: false,
        keyValueMap: 'urls'
      });
  }

  let parsed = forms.parseSubmission(req, { formDef, formKey: 'thing-urls' });

  // Process errors handled by form parser
  if (parsed.hasUnknownFields || !parsed.hasRequiredFields)
    return sendThingURLsForm({ req, res, titleKey, thing, formValues: parsed.formValues });

  // Detect additional case of primary pointing to a blank field
  let primaryURL = parsed.formValues.urls[parsed.formValues.primary];
  if (typeof primaryURL !== 'string' || !primaryURL.length) {
    req.flash('pageErrors', req.__('need primary'));
    return sendThingURLsForm({ req, res, titleKey, thing, formValues: parsed.formValues });
  }

  // The primary URL is simply the first one in the array, so we
  // have to re-order -- and also filter any empty fields. Validation
  // is done by the model (and client-side for JS users).
  let thingURLs = [primaryURL].concat(parsed.formValues.urls.filter(
    url => url !== primaryURL && typeof url === 'string' && url.length
  ));

  // Now we need to make sure that none of the URLs are currently in use.
  let urlLookups = [];
  thingURLs.forEach(url => {
    urlLookups.push(
      Thing
      .filter(t => t('urls').contains(url))
      .filter(t => t('id').ne(thing.id))
      .filter({ _revOf: false }, { default: true })
      .filter({ _revDeleted: false }, { default: true })
    );
  });

  // Perform lookups
  Promise
    .all(urlLookups)
    .then(results => {
      let hasDuplicate = false;
      results.forEach((r, index) => {
        if (r.length) {
          req.flash('pageErrors', req.__('web address already in use', thingURLs[index], `/${r[0].urlID}`));
          hasDuplicate = true;
        }
      });

      if (hasDuplicate)
        return sendThingURLsForm({ req, res, titleKey, thing, formValues: parsed.formValues });

      // No dupes -- continue!
      thing
        .newRevision(req.user)
        .then(newRev => {
          // Reset sync settings for adapters
          newRev.setURLs(thingURLs);
          // Fetch external data for any URLs that support it and update thing, search index
          newRev
            .updateActiveSyncs(req.user.id)
            .then(savedRev => {
              req.flash('pageMessages', req.__('links updated'));
              sendThingURLsForm({ req, res, titleKey, thing: savedRev });
            })
            .catch(error => { // Problem with syncs
              req.flashError(error);
              sendThingURLsForm({ req, res, titleKey, thing, formValues: parsed.formValues });
            });
        });

    })
    .catch(error => { // Problem with lookup
      req.flashError(error);
      sendThingURLsForm({ req, res, titleKey, thing, formValues: parsed.formValues });
    });
}

module.exports = router;
