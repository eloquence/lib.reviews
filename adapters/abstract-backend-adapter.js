'use strict';

// There is a corresponding abstract frontend class in the frontend/ directory.
// While similar, due to client/server differences and likely functional
// divergence, we are keeping these separate.
class AbstractBackendAdapter {

  constructor() {
    // Replace w/ new.target after upgrading to Babel 7.0
    if (new.target === AbstractBackendAdapter)
      throw new TypeError('AbstractBackendAdapter is an abstract class, please instantiate a derived class.');
  }

  // Does this adapter support a given URL? Usually a simple regex check.
  ask(_url) {
    return false;
  }

  // Perform a lookup for a given URL. Return a promise that resolves
  // with an object on success, and rejects with an error (if any) on
  // failure. The object should take the form:
  //
  // {
  //   data: {
  //     label: 'String'  (required)
  //     description: 'String' (optional)
  //     thing: Thing model (optional, really only useful for native adapter)
  //   }
  // }
  lookup(_url) {
    return Promise.reject(new Error('Not implemented.'));
  }

}

module.exports = AbstractBackendAdapter;
