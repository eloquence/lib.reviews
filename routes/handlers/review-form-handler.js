'use strict';

// Lots of complex interdependent actions here, therefore a more OOP pattern.
// If it makes sense for other forms, we may end up subclassing this from a
// generic form handler class.
const md = require('markdown-it')({
  linkify: true,
  breaks: true,
  typographer: true
});
const escapeHTML = require('escape-html');
const render = require('../helpers/render');
const Review = require('../../models/review.js');
const forms = require('../helpers/forms');
const flashError = require('../helpers/flash-error');
const mlString = require('../../models/helpers/ml-string.js');
const prettifyURL = require('../../util/url-normalizer').prettify;
const reviewHandlers = require('./review-handlers');

// Shared across instances
const formDefs = {
  'new': [{
    name: 'review-url',
    required: true
  }, {
    name: 'review-title',
    required: true,
  }, {
    name: 'review-text',
    required: true
  }, {
    name: 'review-rating',
    required: true,
    radioMap: true
  }, {
    name: 'review-language',
    required: false,
    radioMap: false
  }, {
    name: 'review-action', // Logic, not saved
    required: true
  }],
  'delete': [{
    name: 'delete-action',
    required: true,
  }, {
    name: 'delete-thing',
    required: false
  }],
  'edit': [{
    name: 'review-title',
    required: true,
  }, {
    name: 'review-text',
    required: true
  }, {
    name: 'review-rating',
    required: true,
    radioMap: true
  }, {
    name: 'review-language',
    required: true
  }, {
    name: 'review-action', // Logic, not saved
    required: true
  }]
};

class ReviewFormHandler {

  constructor(options) {

    if (!options || typeof options !== 'object' || !options.req || !options.res ||
      !options.next)
      throw new Error('ReviewForm needs at least req, res, and next options from middleware.');

    if (options.type && ['new', 'edit', 'delete'].indexOf(options.type) == -1)
      throw new Error('Type of form not recognized.');

    let defaultOptions = {
      req: undefined, // must be provided
      res: undefined, // must be provided
      next: undefined, // must be provided
      type: 'new',
      isPreview: false,
      submitted: false,
      formData: {},
      titleKey: 'write a review',
      reviewID: undefined // only for editing/deleting
    };

    Object.assign(this, defaultOptions);
    Object.assign(this, options);

    if (this.isPreview)
      this.preview = this.getPreview();

  }

  handleRequest() {

    if (!this.req.user)
      return render.signinRequired(this.req, this.res, {
        titleKey: this.titleKey
      });

    switch (this.type) {
      case 'new':
        if (!this.submitted)
          this.sendNewReviewForm();
        else
          this.processNewReviewForm();
        break;
      case 'edit':
        this.prepareEditForm(); // performs async permission checks + continues
        break;
      case 'delete':
        this.prepareDeletion(); // performs async permission checks + continues
        break;
      default:
        throw new Error('Form behavior not specified.');
    }
  }
  sendNewReviewForm() {

    let pageErrors = this.req.flash('pageErrors');
    let user = this.req.user;
    let showLanguageNotice = true;

    if (user.suppressedNotices &&
      user.suppressedNotices.indexOf('language-notice-review') !== -1)
      showLanguageNotice = false;

    return render.template(this.req, this.res, 'review-form', {
      formValues: this.formData.formValues,
      titleKey: this.titleKey,
      pageErrors: !this.isPreview ? pageErrors : undefined, // Don't show errors on preview
      isPreview: this.isPreview,
      preview: this.preview,
      scripts: ['sisyphus.min.js', 'markdown-it.min.js', 'review.js'],
      showLanguageNotice
    });
  }

  processNewReviewForm() {

    this.formData = forms.parseSubmission({
      req: this.req,
      formDef: formDefs['new'],
      formKey: 'new'
    });

    // We're previewing or have basic problems with the submission -- back to form
    if (this.isPreview || this.req.flashHas('pageErrors'))
      this.sendNewReviewForm();
    else
      this.saveNewReviewAndRedirect();
  }


  saveNewReviewAndRedirect() {
    let date = new Date();
    let lang = this.req.body['review-language'];
    let reviewObj = {
      title: {},
      text: {},
      url: encodeURI(this.req.body['review-url']),
      html: {},
      createdAt: date,
      createdBy: this.req.user.id,
      originalLanguage: lang,
      starRating: Number(this.req.body['review-rating'])
    };
    reviewObj.title[lang] = escapeHTML(this.req.body['review-title']);
    reviewObj.text[lang] = escapeHTML(this.req.body['review-text']);
    reviewObj.html[lang] = md.render(this.req.body['review-text']);

    Review
      .create(reviewObj)
      .then(review => {
        let id = review.id || '';
        this.res.redirect(`/feed#review-${id}`);
      })
      .catch(errorMessage => {
        flashError(this.req, errorMessage, 'saving review');
        this.sendNewReviewForm();
      });
  }

  getPreview() {
    // Values are escaped in the template, with the exception of review text,
    // which is escaped by markdown parser
    let preview = {
      'review-title': this.req.body['review-title'],
      'review-url': this.req.body['review-url'],
      'review-url-text': prettifyURL(this.req.body['review-url'] || ''),
      'review-text': md.render(this.req.body['review-text'] || ''),
      'review-rating': Number(this.req.body['review-rating']),
      'review-date': new Date().toLocaleString(this.req.locale)
    };
    return preview;
  }

  prepareEditForm() {
    Review.getWithData(this.reviewID).then(review => {
      if (review._revDeleted)
        return this.sendReviewNotFound();
      review.populateUserInfo(this.req.user);
      if (!review.userCanEdit) {
        return render.permissionError(this.req, this.res, {
          titleKey: 'edit review'
        });
      } else {
        this.review = review;
        if (!this.submitted)
          this.sendEditForm();
        else {
          this.processEditForm();
        }
      }
    }).catch(reviewHandlers.getReviewNotFoundHandler(this.req, this.res, this.next, this.reviewID));
  }


  sendEditForm() {
    let pageErrors = this.req.flash('pageErrors');
    let titleKey = 'edit review';
    let formValues = {};

    if (!this.formData.formValues) {
      formValues['review-title'] = mlString.resolve(this.req.locale, this.review.title).str;
      formValues['review-text'] = mlString.resolve(this.req.locale, this.review.text).str;
      formValues['review-rating'] = {};
      formValues['review-rating'].value = this.review.starRating;
      formValues['review-rating'][String(this.review.starRating)] = true;
    }

    render.template(this.req, this.res, 'review-form', {
      formValues: this.formData.formValues || formValues,
      titleKey,
      editing: true,
      pageErrors: !this.isPreview ? pageErrors : undefined,
      isPreview: this.isPreview,
      preview: this.preview,
      scripts: ['sisyphus.min.js', 'markdown-it.min.js', 'review.js'],
      showLanguageNotice: false
    }, {
      editing: true, // expose to JS
    });
  }

  processEditForm() {

    this.formData = forms.parseSubmission({
      req: this.req,
      formDef: formDefs.edit,
      formKey: 'edit'
    });

    if (this.isPreview || this.req.flashHas('pageErrors')) {
      this.preview = this.getPreview();
      this.sendEditForm();
    } else {
      this.saveEdit();
    }
  }

  saveEdit() {
    this.review.newRevision(this.req.user).then(newRev => {
      let lang = this.req.body['review-language'];
      newRev.title[lang] = escapeHTML(this.req.body['review-title']);
      newRev.text[lang] = escapeHTML(this.req.body['review-text']);
      newRev.html[lang] = md.render(this.req.body['review-text']);
      newRev.starRating = Number(this.req.body['review-rating']);
      newRev.save().then((review) =>  {
        this.req.flash('pageMessages', this.req.__('edit saved'));
        this.res.redirect(`/review/${review.id}`);
      }).catch(errorMessage => {
        flashError(this.req, errorMessage, 'edit review->save');
        this.sendEditForm();
      });
    })
    .catch(errorMessage => {
      flashError(this.req, errorMessage, 'edit review->new revision');
      this.sendEditForm();
    });
  }

  prepareDeletion() {
    Review.getWithData(this.reviewID).then(review => {
      if (review._revDeleted)
        return reviewHandlers.sendReviewNotFound(this.req, this.res, this.id);
      review.thing.populateUserInfo(this.req.user);
      review.populateUserInfo(this.req.user);
      if (!review.userCanDelete)
        return reviewHandlers.sendPermissionError(this.req, this.res);

      this.review = review;

      if (!this.submitted)
        this.sendDeleteForm();
      else
        this.processDeleteForm();
    }).catch(reviewHandlers.getReviewNotFoundHandler(this.req, this.res, this.next, this.id));
  }


  sendDeleteForm() {
    let pageErrors = this.req.flash('pageErrors');

    render.template(this.req, this.res, 'delete-review', {
      review: this.review,
      pageErrors
    });
  }

  processDeleteForm() {
    let withThing = this.req.body['delete-thing'] ? true : false;
    let formInfo = forms.parseSubmission({
      req: this.req,
      formDef: formDefs['delete'],
      formKey: 'delete-review'
    });

    if (this.req.flashHas('pageErrors'))
      return reviewHandlers.sendDeleteForm(this.req, this.res, this.review);

    let options = {};
    let deleteFunc = withThing ?
      this.review.deleteAllRevisionsWithThing :
      this.review.deleteAllRevisions;

    deleteFunc
      .call(this.review, this.req.user)
      .then(() => {
        return render.template(this.req, this.res, 'review-deleted', {
          titleKey: 'review deleted'
        });
      })
      .catch(err => {
        this.next(err);
      });
  }

}

module.exports = ReviewFormHandler;
