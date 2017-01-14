'use strict';
const isUUID = require('is-uuid');

const Team = require('../../models/team');
const TeamSlug = require('../../models/team-slug');

const slugs = {

  // Helper function to resolve a team's "slug" or ID and load it with specified
  // options. Returns promise that resolves if team is successfully loaded,
  // and rejects if we can't find a team, or if we redirect.
  //
  // id - the slug or UUID of the team
  // options - an object documented in models/team.
  resolveAndLoadTeam(req, res, id, options) {

    return new Promise((resolve, reject) => {

      if (isUUID.v4(id)) {
        // If we have a slug for this UUID, we redirect to it,
        // otherwise we stay on the UUID version of the URL
        Team
          .getWithData(id, options)
          .then(team => {
            if (team.canonicalSlugName) {
              this.redirectToCanonicalTeam(req, res, id, team.canonicalSlugName);
              let e = new Error();
              e.name = 'RedirectedError';
              reject(e);
            } else
              resolve(team);
          })
          .catch(error => reject(error)); // ID not found or other error

      } else {
        // We'll assume that the provided /team/:id parameter refers to a slug
        TeamSlug
          .get(id)
          .then(slug => {
            Team
              .getWithData(slug.teamID, options)
              .then(team => {
                if (team.canonicalSlugName === slug.name)
                  resolve(team);
                // We always want to redirect to the canonical name
                else {
                  this.redirectToCanonicalTeam(req, res, id, team.canonicalSlugName);
                  let e = new Error();
                  e.name = 'RedirectedError';
                  reject(e);
                }
              })
              .catch(error => reject(error));
          })
          .catch(error => reject(error)); // Slug not found or other error
      }
    });

  },

  // Redirect from current page to the canonical URL
  redirectToCanonicalTeam(req, res, id, canonicalSlugName) {
    // Replace relevant substring of path so this works for any page
    let newPath = req.path.replace(`/team/${id}`, `/team/${canonicalSlugName}`);
    res.redirect(newPath);
  }

};

module.exports = slugs;
