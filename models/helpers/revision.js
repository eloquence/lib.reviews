'use strict';
const thinky = require('../../db');
const r = thinky.r;
const type = thinky.type;

let revision = {

  getNewRevisionHandler: function(Model) {
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
          }).catch(err => { // Problem getting ID
            reject(err);
          });
        }).catch(err => { // Problem saving old rev
          reject(err);
        });
      });
    };
  },

  getDeleteAllRevisionsHandler: function(Model) {
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
          }).catch(error => {
            reject(error); // Something went wrong with revision creation
          });
      });
    };
  },

  getSchema: function() {
    return {
      _revUser: type.string().required(true),
      _revDate: type.date().required(true),
      _revID: type.string().uuid(4).required(true), // Set this for all revisions, including current
      _revOf: type.string(), // Only set if it's an old revision of an existing thing
      _revDeleted: type.boolean(), // Set to true for all deleted revisions (not all revisions have to be deleted)
      _revTags: [type.string()] // Optional tags to describe action performed through this revision, e.g. edit, delete, etc.
    };
  }
};

module.exports = revision;
