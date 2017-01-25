'use strict';
const thinky = require('../../db');
const r = thinky.r;
const type = thinky.type;

const revision = {

  getNewRevisionHandler(Model) {
    return function(user, options) {
      if (!options)
        options = {};

      return new Promise((resolve, reject) => {
        let newRev = this;
        // Archive current revision
        let oldRev = new Model(newRev);
        oldRev._revOf = newRev.id;
        oldRev.id = undefined;
        oldRev.save().then(() => {
            r.uuid().then(uuid => {
                newRev._revID = uuid;
                newRev._revUser = user.id;
                newRev._revDate = new Date();
                newRev._revTags = options.tags ? options.tags : undefined;
                resolve(newRev);
              })
              .catch(error => { // Problem getting ID
                reject(error);
              });
          })
          .catch(error => { // Problem saving old rev
            reject(error);
          });
      });
    };
  },

  getNotStaleOrDeletedHandler(Model) {

    return function(id) {

      return new Promise((resolve, reject) => {

        Model.get(id).then(data => {

            if (data._revDeleted)
              return reject(revision.deletedError);

            if (data._revOf)
              return reject(revision.staleError);

            resolve(data);

          })
          .catch(error => {
            reject(error);
          });

      });

    };

  },

  getFirstRevisionHandler(Model) {
    return function(user, options) {
      if (!options)
        options = {};

      return new Promise((resolve, reject) => {
        let firstRev = new Model({});
        r.uuid()
          .then(uuid => {
            firstRev._revID = uuid;
            firstRev._revUser = user.id;
            firstRev._revDate = new Date();
            if (options.tags)
              firstRev._revTags = options.tags;
            resolve(firstRev);
          })
          .catch(error => { // Problem getting ID
            reject(error);
          });
      });
    };
  },

  getDeleteAllRevisionsHandler(Model) {
    return function(user, options) {
      if (!options)
        options = {};

      let id = this.id;
      let tags = ['delete'];

      if (options.tags)
        tags = tags.concat(options.tags);

      return new Promise((resolve, reject) => {

        // A deletion results in a new revision which contains
        // information about the deletion itself (date, user who
        // performed it, tags, etc.)
        this.newRevision(user, {
            tags
          })
          .then(newRev => {
            newRev._revDeleted = true;
            newRev
              .save()
              .then(() => {
                resolve(Model // This dependent query is itself a promise
                  .filter({
                    _revOf: id
                  })
                  .update({
                    _revDeleted: true
                  }));
              });
          })
          .catch(error => {
            reject(error); // Something went wrong with revision creation
          });
      });
    };
  },

  getSchema() {
    return {
      _revUser: type
        .string()
        .required(true),
      _revDate: type
        .date()
        .required(true),
      _revID: type
        .string()
        .uuid(4)
        .required(true), // Set this for all revisions, including current
      _revOf: type.string(), // Only set if it's an old revision of an existing thing
      _revDeleted: type.boolean(), // Set to true for all deleted revisions (not all revisions have to be deleted)
      _revTags: [type.string()] // Optional tags to describe action performed through this revision, e.g. edit, delete, etc.
    };
  }
};

revision.deletedError = new Error('Revision has been deleted.');
revision.staleError = new Error('Outdated revision.');
revision.deletedError.name = 'RevisionDeletedError';
revision.staleError.name = 'RevisionStaleError';

module.exports = revision;
