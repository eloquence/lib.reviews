'use strict';
// External dependencies
const unescapeHTML = require('unescape-html');
const isUUID = require('is-uuid');

// Internal dependencies
const mlString = require('./ml-string');
const AbstractGenericError = require('../../util/abstract-generic-error');
const debug = require('../../util/debug');

const slugNameHelper = {

  // Returns a model handler that is used to create/update a unique
  // human-readable short string (slug) that identifies the current document.
  // The handler itself returns a promise that resolves when the update is
  // complete or if no update is necessary, and rejects if the slug name is
  // invalid or duplicated.
  //
  // Configuration object:
  //
  //   SlugModel: Model class where the slugs are stored
  //   slugForeignKey: Key used in slug table to identify foreign  document
  //   slugSourceField: field in document table that is used to derive slug names
  //    -- is assumed to be a multilingual string
  getUpdateSlugHandler(modelConfig) {
    // Destructure for convenient access
    let {
      SlugModel,
      slugForeignKey,
      slugSourceField
    } = modelConfig;

    return function(userID, language) {
      let document = this;
      return new Promise((resolve, reject) => {

        let originalLanguage = document.originalLanguage || 'en';

        // No update needed if changing language other than original.
        if (language !== originalLanguage)
          return resolve(document);

        let sourceString = mlString.resolve(language, document[slugSourceField]);

        if (typeof sourceString !== 'object')
          throw new InvalidSlugStringError({
            message: 'Invalid source for slug string - must be multilingual string object.'
          });

        let slugName;

        // May throw
        slugName = slugNameHelper.generateSlugName(sourceString.str);

        // No update needed if name hasn't changed
        if (slugName === document.canonicalSlugName)
          return resolve(document);

        debug.app(`Changing slug for document with ID ${document.id} from ${document.canonicalSlugName} to ${slugName}`);

        document
          // If this is a new revision, it does not have a primary key yet
          .setID()
          .then(document => {
            // Create new slug
            let slug = new SlugModel({
              name: slugName,
              [slugForeignKey]: document.id,
              createdOn: new Date(),
              createdBy: userID
            });

            slug
              .qualifiedSave() // Will add qualifier to de-duplicate if supported by SlugModel
              .then(slug => {
                document.canonicalSlugName = slug.name;
                resolve(document);
              })
              .catch(error => {
                // Should only be passed through if SlugModel does not support de-duplication
                if (error.name === 'DuplicatePrimaryKeyError') {
                  SlugModel
                    .get(slugName)
                    .then(slug => {
                      // We already have this slug; let's associate it and call it a day
                      if (slug[slugForeignKey] === document.id) {
                        document.canonicalSlugName = slug.name;
                        resolve(document);
                      } else
                        throw new DuplicateSlugNameError(slug);
                    })
                    .catch(reject);
                } else {
                  reject(error);
                }
              });
          })
          .catch(reject); // Problem obtaining ID for document
      });

    };
  },

  // Converts a source string (e.g., a team name, or a thing label) into a slug
  // or throws an error if this is not possible. String must be monolingual.
  generateSlugName(str) {
    if (typeof str !== 'string')
      throw new InvalidSlugStringError({
        message: 'Source string is undefined or not a string.'
      });

    str = str.trim();

    if (str === '')
      throw new InvalidSlugStringError({
        message: 'Source string cannot be empty.'
      });

    let slugName = unescapeHTML(str)
      .trim()
      .toLowerCase()
      .replace(/[?&"″'`’<>:]/g, '')
      .replace(/[ _/]/g, '-')
      .replace(/-{2,}/g, '-'); // Avoid consecutive hyphens

    if (!slugName)
      throw new InvalidSlugStringError({
        message: 'Source string %s cannot be converted to a valid slug.',
        messageParams: [str]
      }); // Expected depending on user input

    if (isUUID.v4(slugName))
      throw new InvalidSlugStringError({
        message: 'Source string cannot be a UUID.'
      });

    return slugName;
  }

};

class InvalidSlugStringError extends AbstractGenericError {}

class DuplicateSlugNameError extends AbstractGenericError {
  constructor(slug) {
    super({
      message: 'Slug name "%s" is already in use.',
      messageParams: [slug.name],
      payload: { slug }
    });
  }
}

module.exports = slugNameHelper;
