'use strict';
// External dependencies
const isUUID = require('is-uuid');

// Internal dependencies
const Team = require('../../models/team');
const TeamSlug = require('../../models/team-slug');
const Thing = require('../../models/thing');
const ThingSlug = require('../../models/thing-slug');

const slugs = {

  // Helper function to resolve a team's "slug" or ID and load it with specified
  // options. Returns promise that resolves if team is successfully loaded,
  // and rejects if we can't find a team, or if we redirect.
  //
  // id - the slug or UUID of the team
  // loadOptions - an object documented in models/team.
  resolveAndLoadTeam(req, res, id, loadOptions) {

    return _resolveAndLoad(req, res, id, loadOptions, {
      DocumentModel: Team,
      SlugModel: TeamSlug,
      slugForeignKey: 'teamID',
      basePath: '/team/'
    });

  },

  // As above, for review subjects ('things')
  resolveAndLoadThing(req, res, id, loadOptions) {

    return _resolveAndLoad(req, res, id, loadOptions, {
      DocumentModel: Thing,
      SlugModel: ThingSlug,
      slugForeignKey: 'thingID',
      basePath: '/'
    });
  }

};

// Generic internal function to resolve a document's unique human-readable short
// identifier (slug) or UUID. modelConfig object:
//
//   DocumentModel: class name of Model for document we're trying to look up
//   SlugModel: class name of Model for relevant slugs
//   slugForeignKey: name of the ID key in the slug table that refers back to the
//     document
//   basePath: base URL of any canonical URL we redirect to
function _resolveAndLoad(req, res, id, loadOptions, modelConfig) {

  return new Promise((resolve, reject) => {

    if (isUUID.v4(id)) {
      // If we have a slug for this UUID, we redirect to it,
      // otherwise we stay on the UUID version of the URL
      modelConfig.DocumentModel
        .getWithData(id, loadOptions)
        .then(document => {
          if (document.canonicalSlugName) {
            _redirectToCanonical(req, res, id, modelConfig.basePath, document.canonicalSlugName);
            let e = new Error();
            e.name = 'RedirectedError';
            reject(e);
          } else
            resolve(document);
        })
        .catch(reject); // ID not found or other error

    } else {
      // We'll assume that the provided ID refers to a slug
      modelConfig.SlugModel
        .get(id)
        .then(slug => {
          modelConfig.DocumentModel
            .getWithData(slug[modelConfig.slugForeignKey], loadOptions)
            .then(document => {
              if (document.canonicalSlugName === slug.name)
                resolve(document);
              // We always want to redirect to the canonical name
              else {
                _redirectToCanonical(req, res, id, modelConfig.basePath, document.canonicalSlugName);
                let e = new Error();
                e.name = 'RedirectedError';
                reject(e);
              }
            })
            .catch(reject);
        })
        .catch(reject); // Slug not found or other error
    }
  });

}

// Redirect from current page to the canonical URL
function _redirectToCanonical(req, res, id, basePath, canonicalSlugName) {
  // Replace relevant substring of path so this works for any page
  let newPath = req.path.replace(basePath + encodeURIComponent(id), basePath + encodeURIComponent(canonicalSlugName));
  res.redirect(newPath);
}

module.exports = slugs;
