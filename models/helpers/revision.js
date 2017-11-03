'use strict';
const thinky = require('../../db');
const r = thinky.r;
const type = thinky.type;

/**
 * Common handler functions for managing revisions. These are typically attached
 * to models, see models/thing.js for examples.
 *
 * @namespace Revision
 */

const revision = {


  /**
   * Get a function that lets us create a new revision (including saving a copy
   * of the current revision) for the given Model
   *
   * @param {Model} Model
   *  the Model we need a handler for
   * @return {Function}
   *  function that can be attached as an instance method to the Model via
   *  Model.define. See {@link Revision~_newRevision} for the handler itself.
   * @memberof Revision
   */
  getNewRevisionHandler(Model) {

    /**
     * Save a copy of the current revision as an old revision and create (but
     * do not save) a new revision object.
     *
     * @param {User} user
     *  the user to associate with this revision
     * @param {Object} [options]
     *  revision options
     * @param {String[]} options.tags
     *  set of tags to associate with this revision
     * @return {Model}
     *  new revision of the given Model
     * @memberof Revision
     * @inner
     * @protected
     * @this Model
     */
    const _newRevision = async function(user, { tags } = {}) {
      let newRev = this;
      // Archive current revision
      let oldRev = new Model(newRev);
      oldRev._revOf = newRev.id;
      oldRev.id = undefined;
      await oldRev.save();
      const uuid = await r.uuid();
      newRev._revID = uuid;
      newRev._revUser = user.id;
      newRev._revDate = new Date();
      newRev._revTags = tags;
      return newRev;
    };
    return _newRevision;
  },

  /**
   * A common operation is to narrow a search by eliminating old or deleted
   * revisions. This function returns a handler that can be attached to a model
   * to provide a shortcut for this operation.
   *
   * @param {Model} Model
   *  the table to filter
   * @return {Function}
   *  function that returns a Query object for this Model
   * @memberof Revision
   */
  getNotStaleOrDeletedFilterHandler(Model) {
    return () => Model
      .filter({
        _revOf: false
      }, {
        default: true
      })
      .filter({
        _revDeleted: false
      }, {
        default: true
      });
  },

  /**
   * Get handler to obtain ("get", hence the double get in the name) an object
   * by its ID and reject with standardized error if it is an old or deleted
   * revision.
   *
   * @param  {Model} Model
   *  the table to query with this handler
   * @return {Function}
   *  async function that accepts an ID parameter and returns a
   *  promise which rejects if the revision is old or deleted. See
   *  {@link Revision~_getNotStaleOrDeleted}
   * @memberof Revision
   */
  getNotStaleOrDeletedGetHandler(Model) {

    /**
     * Function obtained via {@link Revision.getNotStaleOrDeletedGetHandler}
     *
     * @param {String} id
     *  the ID to look up
     * @param {Object} [join]
     *  an object specifying a join to another table
     * @return {Model}
     *  an object of the specified Model
     * @memberof Revision
     * @inner
     * @protected
     */
    const _getNotStaleOrDeleted = async (id, join) => {
      let data;
      if (typeof join == 'object')
        data = await Model.get(id).getJoin(join);
      else
        data = await Model.get(id);

      if (data._revDeleted)
        throw revision.deletedError;
      else if (data._revOf)
        throw revision.staleError;
      else
        return data;
    };
    return _getNotStaleOrDeleted;
  },


  /**
   * Get a function that lets us create the first revision of a given model.
   * Does not save.
   *
   * @param {Model} Model
   *  the Model we want to attach the handler to
   * @return {Function}
   *  a function we can attach as a static method to the Model via
   *  `Model.createFirstRevision = fn`. See
   *  {@link Revision~_createFirstRevision}.
   * @memberof Revision
   */
  getFirstRevisionHandler(Model) {

    /**
     * Handler for creating (but not saving) the initial revision for an object
     * of this Model. Asynchronously obtains UUID.
     *
     * @param {User} user
     *  the user to associate with this revision
     * @param {Object} [options]
     *  revision options
     * @param {String[]} options.tags
     *  set of tags to associate with this revision
     * @return {Model}
     *  first revision
     * @memberof Revision
     * @inner
     * @protected
     */
    const _createFirstRevision = async function(user, { tags } = {}) {
      let firstRev = new Model({});
      const uuid = await r.uuid();
      firstRev._revID = uuid;
      firstRev._revUser = user.id;
      firstRev._revDate = new Date();
      firstRev._revTags = tags;
      return firstRev;
    };
    return _createFirstRevision;
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
