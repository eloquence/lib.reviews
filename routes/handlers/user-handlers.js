'use strict';
const escapeHTML = require('escape-html');

const render = require('../helpers/render');
const User = require('../../models/user');
const Review = require('../../models/review');
const flashError = require('../helpers/flash-error');
const ErrorMessage = require('../../util/error');
const UserMeta = require('../../models/user-meta');
const md = require('markdown-it')({
  linkify: true,
  breaks: true,
  typographer: true
});

let userHandlers = {

  processEdit(req, res, next) {

    let name = req.params.name.trim();
    User
      .findByURLName(name, {
        withData: true,
        withPassword: true // Since user needs to be updated
      })
      .then(user => {
        user.populateUserInfo(req.user);
        if (!user.userCanEditMetadata)
          return render.permissionError(req, res, next);

        let bio = req.body['bio-text'];
        let bioLanguage = req.body['bio-language'];
        if (bio === undefined || bioLanguage === undefined) {
          flashError(req, new ErrorMessage('data missing'));
          return res.redirect(`/user/${user.urlName}/edit/bio`);
        }

        let p;
        if (user.meta === undefined || user.meta.bio === undefined) {
          let bioObj = {
            bio: {
              text: {},
              html: {}
            },
            originalLanguage: bioLanguage
          };
          bioObj.bio.text[bioLanguage] = escapeHTML(bio);
          bioObj.bio.html[bioLanguage] = md.render(bio);
          bioObj.originalLanguage = bioLanguage;
          User
            .createBio(user, bioObj)
            .then(() => {
              res.redirect(`/user/${user.urlName}`);
            })
            .catch(error => {
              next(error);
            });
        } else {
          user.meta
            .newRevision(req.user, { tags: ['update-bio-via-user'] })
            .then(metaRev => {
              if (metaRev.bio === undefined)
                metaRev.bio = {};

              metaRev.bio.text[bioLanguage] = escapeHTML(bio);
              metaRev.bio.html[bioLanguage] = md.render(bio);
              metaRev
                .save()
                .then(() => {
                  res.redirect(`/user/${user.urlName}`);
                })
                .catch(error => { // Problem saving metadata
                  next(error);
                });
            })
            .catch(error => { // Problem creating metadata revision
              next(error);
            });
        }
      })
      .catch(userHandlers.getUserNotFoundHandler(req, res, next, name));
  },

  getUserHandler(options) {
    options = Object.assign({
      editBio: false,
      offsetEpoch: undefined // for reviews feed pagination
    }, options);

    return function(req, res, next) {
      let name = req.params.name.trim();
      let offsetEpoch;
      if (options.getOffsetEpoch) {
        offsetEpoch = Number(req.params.epoch.trim());
        if (new Date(offsetEpoch) == 'Invalid Date')
          offsetEpoch = undefined;
      }

      User
        .findByURLName(name, {
          withData: true
        })
        .then(user => {

          user.populateUserInfo(req.user);

          if (options.editBio && !user.userCanEditMetadata)
            return render.permissionError(req, res, next);

          if (user.displayName !== name) // Redirect to chosen display name form
            return res.redirect(`/user/${user.urlName}`);

          Review
            .getFeed({
              createdBy: user.id,
              offsetEpoch
            })
            .then(result => {
              let feedItems = result.feedItems;
              let offsetEpoch = result.offsetEpoch;

              for (let item of feedItems) {
                item.populateUserInfo(req.user);
                if (item.thing) {
                  item.thing.populateUserInfo(req.user);
                }
              }
              let edit = {
                bio: options.editBio
              };

              let pageErrors = req.flash('pageErrors');

              render.template(req, res, 'user', {
                titleKey: 'user',
                titleParam: user.displayName,
                userInfo: user,
                feedItems,
                edit,
                scripts: ['user.js'],
                pageErrors,
                offsetEpoch
              });
            });
        })
        .catch(userHandlers.getUserNotFoundHandler(req, res, next, name));
    };
  },

  sendUserNotFound(req, res, name) {
    res.status(404);
    render.template(req, res, 'no-user', {
      titleKey: 'user not found',
      name: escapeHTML(name)
    });
  },

  getUserNotFoundHandler(req, res, next, name) {
    return function(error) {
      if (error.name == 'DocumentNotFoundError')
        userHandlers.sendUserNotFound(req, res, name);
      else
        next(error);
    };
  }

};

module.exports = userHandlers;
