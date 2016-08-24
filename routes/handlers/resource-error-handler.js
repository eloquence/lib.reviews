'use strict';
const render = require('../helpers/render');
const escapeHTML = require('escape-html');

// Generic handler for 404s, missing revisions or old revisions (when we don't
// want them!).
module.exports = function getResourceErrorHandler(req, res, next, messageKeyPrefix, bodyParam) {

  if (!messageKeyPrefix || !bodyParam)
    throw new Error('We need a prefix for message keys, and a parameter containing e.g. the ID fo the resource.');

  bodyParam = escapeHTML(bodyParam);

  return function(error) {
    switch (error.name) {
      case 'DocumentNotFoundError':
      case 'RevisionDeletedError':
        res.status(404);
        render.resourceError(req, res, {
          titleKey: `${messageKeyPrefix} not found title`,
          bodyKey: `${messageKeyPrefix} not found`,
          bodyParam
        });
        break;
      case 'RevisionStaleError':
        res.status(403);
        render.resourceError(req, res, {
          titleKey: 'stale revision error title',
          bodyKey: 'stale revision error',
          bodyParam
        });
        break;
      default:
        return next(error);
    }
  };
};
