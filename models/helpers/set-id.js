'use strict';
const thinky = require('../../db');
const r = thinky.r;

// A convenience function that lets us assign an ID before we perform
// additional operations on a thinky document. Assumes the primary key
// is a UUID stored in a field called 'id'.
module.exports = function getSetIDHandler() {

  return function() {
    let document = this;
    return new Promise((resolve, reject) => {
      if (document.id)
        resolve(document);
      else {
        r
          .uuid()
          .then(uuid => {
            document.id = uuid;
            resolve(document);
          })
          .catch(error => reject(error));
      }
    });
  };

};
