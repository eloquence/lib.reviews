'use strict';

class AbstractAdapter {

  // Any extension to the constructor should run synchronously.
  //
  // updateCallback: (function) optional callback to run after a lookup
  constructor(updateCallback) {
    // Replace w/ new.target after upgrading to Babel 7.0
    if (this.constructor.name === AbstractAdapter.name)
      throw new TypeError('AbstractAdapter is an abstract class, please instantiate a derived class.');

    this.updateCallback = updateCallback;
  }

  // Perform any necessary UI setup. May in future be parametrized to
  // distinguish between different pages/contexts.
  setup() {
    return;
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

module.exports = AbstractAdapter;
