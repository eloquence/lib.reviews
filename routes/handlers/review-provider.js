'use strict';
const render = require('../helpers/render');
const Review = require('../../models/review.js');
const forms = require('../helpers/forms');
const flashError = require('../helpers/flash-error');
const mlString = require('../../models/helpers/ml-string.js');
const urlUtils = require('../../util/url-utils');
const BREADProvider = require('./bread-provider');

class ReviewProvider extends BREADProvider {

  constructor(req, res, next, options) {

    super(req, res, next, options);
    this.actions.add.titleKey = 'new review';
    this.actions.edit.titleKey = 'edit review';
    this.actions.delete.titleKey = 'delete review';
    this.documentNotFoundTitleKey = 'review not found title';
    this.documentNotFoundTemplate = 'no-review';

  }

  read_GET(review) {

    let titleParam;
    if (review.thing) {
      if (review.thing.label)
        titleParam = mlString.resolve(this.req.locale, review.thing.label).str;
      else
        titleParam = urlUtils.prettify(review.thing.urls[0]);
    }

    // No permission checks on reads, so we have to do this manually
    review.populateUserInfo(this.req.user);

    render.template(this.req, this.res, 'review', {
      titleKey: titleParam ? 'review of' : 'review',
      titleParam,
      deferPageHeader: true,
      review
    });

  }

  add_GET(formValues) {

    let pageErrors = this.req.flash('pageErrors');
    let user = this.req.user;
    let showLanguageNotice = true;

    // For easier processing in the template
    if (formValues && formValues.starRating)
      formValues.hasRating = {
        [formValues.starRating]: true
      };

    if (user.suppressedNotices &&
      user.suppressedNotices.indexOf('language-notice-review') !== -1)
      showLanguageNotice = false;

    return render.template(this.req, this.res, 'review-form', {
      formValues,
      titleKey: this.actions[this.action].titleKey,
      pageErrors: !this.isPreview ? pageErrors : undefined, // Don't show errors on preview
      isPreview: this.isPreview,
      preview: this.preview,
      scripts: ['markdown-it.min.js', 'review.js'],
      showLanguageNotice,
      editing: this.editing ? true : false
    }, {
      editing: this.editing ? true : false
    });
  }

  add_POST() {

    this.isPreview = this.req.body['review-action'] == 'preview' ? true : false;

    let formKey = 'new-review';
    let language = this.req.body['review-language'];
    let formData = forms.parseSubmission({
      req: this.req,
      formDef: ReviewProvider.formDefs[formKey],
      formKey,
      language
    });

    formData.formValues.createdBy = this.req.user.id;
    formData.formValues.createdAt = new Date();
    formData.formValues.originalLanguage = language;

    // We're previewing or have basic problems with the submission -- back to form
    if (this.isPreview || this.req.flashHas('pageErrors'))
      return this.add_GET(formData.formValues);

    let reviewObj = Object.assign({}, formData.formValues);

    Review
      .create(reviewObj, {
        tags: ['create-via-form']
      })
      .then(review => {
        let id = review.id || '';
        this.res.redirect(`/feed#review-${id}`);
      })
      .catch(errorMessage => {
        flashError(this.req, errorMessage, 'saving review');
        this.add_GET(formData.formValues);
      });

  }

  loadData() {

    return new Promise((resolve, reject) => {
      Review.getWithData(this.id).then(review => {
        // For permission checks on associated thing
        review.thing.populateUserInfo(this.req.user);
        resolve(review);
      })
      .catch(error => {
        reject(error);
      });
    });

  }

  edit_GET(review) {

    this.editing = true;
    this.add_GET(review);

  }

  edit_POST(review) {

    let formKey = 'edit-review';
    let language = this.req.body['review-language'];
    let formData = forms.parseSubmission({
      req: this.req,
      formDef: ReviewProvider.formDefs[formKey],
      formKey,
      language
    });

    // We no longer accept URL edits if we're in edit-mode
    this.editing = true;

    if (this.req.body['review-action'] == 'preview') {
      // Pass along original authorship info for preview
      formData.formValues.createdAt = review.createdAt;
      formData.formValues.creator = review.creator;
      this.isPreview = true;
    }
    // As with creation, back to edit form if we have errors or
    // are previewing
    if (this.isPreview || this.req.flashHas('pageErrors'))
      return this.add_GET(formData.formValues);

    // Save the edit
    review
      .newRevision(this.req.user, {
        tags: ['edit-via-form']
      })
      .then(newRev => {
        let f = formData.formValues;
        newRev.title[language] = f.title[language];
        newRev.text[language] = f.text[language];
        newRev.html[language] = f.html[language];
        newRev.starRating = f.starRating;
        newRev
          .save()
          .then(savedRev => {
            this.req.flash('pageMessages', this.req.__('edit saved'));
            this.res.redirect(`/review/${newRev.id}`);
          })
          .catch(error => {
            flashError(this.req, error, 'edit review->save');
            this.add_GET(formData.formValues);
          });
      })
      .catch(error => {
        flashError(this.req, error, 'edit review->new revision');
        this.add_GET(formData.formValues);
      });

  }

  delete_GET(review) {
    let pageErrors = this.req.flash('pageErrors');

    render.template(this.req, this.res, 'delete-review', {
      review: review,
      pageErrors
    });
  }

  delete_POST(review) {
    let withThing = this.req.body['delete-thing'] ? true : false;
    let formInfo = forms.parseSubmission({
      req: this.req,
      formDef: ReviewProvider.formDefs['delete-review'],
      formKey: 'delete-review'
    });

    // Trying to delete recursively, but can't!
    if (withThing && !review.thing.userCanDelete)
      return render.permissionError(this.req, this.res, {
        titleKey: this.actions[this.action].titleKey
      });

    if (this.req.flashHas('pageErrors'))
      return this.delete_GET(review);

    let options = {};
    let deleteFunc = withThing ?
      review.deleteAllRevisionsWithThing :
      review.deleteAllRevisions;

    deleteFunc
      .call(review, this.req.user)
      .then(() => {
        render.template(this.req, this.res, 'review-deleted', {
          titleKey: 'review deleted'
        });
      })
      .catch(err => {
        this.next(err);
      });
  }


}

module.exports = ReviewProvider;


// Shared across instances
ReviewProvider.formDefs = {
  'new-review': [{
    name: 'review-url',
    required: true,
    type: 'url',
    key: 'url'
  }, {
    name: 'review-title',
    required: true,
    type: 'text',
    key: 'title'
  }, {
    name: 'review-text',
    required: true,
    type: 'markdown',
    key: 'text',
    flat: true,
    htmlKey: 'html'
  }, {
    name: 'review-rating',
    required: true,
    type: 'number',
    key: 'starRating'
  }, {
    name: 'review-language',
    required: false,
    key: 'originalLanguage'
  }, {
    name: 'review-action',
    required: true,
    skipValue: true // Logic, not saved
  }],
  'delete-review': [{
    name: 'delete-action',
    required: true
  }, {
    name: 'delete-thing',
    required: false
  }],
  'edit-review': [{
    name: 'review-title',
    required: true,
    type: 'text',
    key: 'title'
  }, {
    name: 'review-text',
    required: true,
    type: 'markdown',
    key: 'text',
    flat: true,
    htmlKey: 'html'
  }, {
    name: 'review-rating',
    required: true,
    type: 'number',
    key: 'starRating'
  }, {
    name: 'review-language',
    required: true
  }, {
    name: 'review-action',
    required: true,
    skipValue: true
  }]
};
