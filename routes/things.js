'use strict';
// External dependencies
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');
const url = require('url');
const config = require('config');

// Internal dependencies
const Thing = require('../models/thing');
const Review = require('../models/review');
const render = require('./helpers/render');
const getResourceErrorHandler = require('./handlers/resource-error-handler');
const languages = require('../locales/languages');
const feeds = require('./helpers/feeds');
const forms = require('./helpers/forms');
const slugs = require('./helpers/slugs');
const search = require('../search');
const getMessages = require('../util/get-messages');
const urlUtils = require('../util/url-utils');
const signinRequiredRoute = require('./handlers/signin-required-route');

// For handling form fields
const editableFields = ['description', 'label'];


router.get('/:id', function(req, res, next) {
  const { id } = req.params;
  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => loadThingAndReviews(req, res, next, thing))
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));
});

router.get('/:id/manage/urls', signinRequiredRoute('manage links', (req, res, next) => {
  const { id } = req.params,
    titleKey = res.locals.titleKey;

  slugs
    .resolveAndLoadThing(req, res, id)
    .then(thing => {
      thing.populateUserInfo(req.user);
      if (!thing.userCanEdit)
        return render.permissionError(req, res, { titleKey });

      sendThingURLsForm({ req, res, titleKey, thing });

    })
    .catch(getResourceErrorHandler(req, res, next, 'thing', id));

}));


// Update the set of URLs associated with a given thing from user input. The
// first URL in the array is the "primary" URL, used wherever we want to
// offer a convenient single external link related to a review subject.
router.post('/:id/manage/urls', signinRequiredRoute('manage links',
  (req, res, next) => {
    const { id } = req.params,
      titleKey = res.locals.titleKey;

    slugs
      .resolveAndLoadThing(req, res, id)
      .then(thing => {
        thing.populateUserInfo(req.user);
        if (!thing.userCanEdit)
          return render.permissionError(req, res, { titleKey });

        processThingURLsUpdate({ req, res, thing, titleKey });
      })
      .catch(getResourceErrorHandler(req, res, next, 'thing', id));

  }));


router.get('/:id/edit/:field', function(req, res, next) {

  if (!editableFields.includes(req.params.field))
    return next();

  const titleKey = `edit ${req.params.field}`;
  const edit = {
    [req.params.field]: true
  };
  const { id } = req.params;

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
  const { id } = req.params;
  let utcISODate = req.params.utcisodate;
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
  const { id } = req.params;
  let language = req.params.language;
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

// Legacy redirects

router.get('/thing/:id', function(req, res) {
  const { id } = req.params;
  return res.redirect(`/${id}`);
});

router.get('/thing/:id/before/:utcisodate', function(req, res) {
  const { id } = req.params;
  let utcISODate = req.params.utcisodate;
  return res.redirect(`/${id}/before/${utcISODate}`);
});

router.get('/thing/:id/atom/:language', function(req, res) {
  const { id } = req.params;
  let language = req.params.language;
  return res.redirect(`/${id}/atom/${language}`);
});

function loadThingAndReviews(req, res, next, thing, offsetDate) {

  let p1, p2;

  thing.populateUserInfo(req.user);
  if (Array.isArray(thing.files))
    thing.files.map(file => file.populateUserInfo(req.user));

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

  const { field, id } = req.params;

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
      if (field === 'description' && descriptionSyncActive)
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
    activeSourceIDs: thing.getSourceIDsOfActiveSyncs(),
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
      .filter({ _oldRevOf: false }, { default: true })
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
