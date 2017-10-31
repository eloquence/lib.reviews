'use strict';


/**
 * Adapter that, given a URL, looks up metadata that can identify a review
 * subject, such as a book's title or a restauraunt name.
 *
 * @abstract
 */
class AbstractLookupAdapter {

  /**
   * @param {Function} updateCallback - `(optional)` callback to run after a
   *  successful lookup
   */
  constructor(updateCallback) {
    // Replace w/ new.target after upgrading to Babel 7.0
    if (this.constructor.name === AbstractLookupAdapter.name)
      throw new TypeError('AbstractAdapter is an abstract class, please instantiate a derived class.');

    this.updateCallback = updateCallback || null;

    /**
     * Canonical identifier for this source. Lower-case string, no whitespace.
     *
     * @type {String}
     */
    this.sourceID = undefined;

    /**
     * RegExp for URLs this adapter can handle.
     *
     * @type {RegExp}
     */
    this.supportedPattern = undefined;
  }

  /**
   * Does this adapter support the given URL? By default, performs a simple
   * regex check.
   *
   * @param  {String} url - the URL to test
   * @returns {Boolean} true if supported
   */
  ask(url) {
    return this.supportedPattern.test(url);
  }

  // Perform a lookup for a given URL. Return a promise that resolves
  // with an object on success, and rejects with an error (if any) on
  // failure. The object should take the form:

  /**
   * Perform a lookup for a given URL.
   *
  *  @abstract
   * @param {String} _url - the URL to perform lookup for
   * @returns {Promise} promise that resolves with a result object on success,
   *  and rejects with an error on failure
   *
   * @property {object} result - The result object
   * @property {object} result.data - *(required)* data for this result
   * @property {string} result.data.label - *(required)* name to be rendered for
   *   this result
   * @property {string} result.data.subtitle - subtitle to be shown below label
   * @property {string} result.data.description - short textual description
   * @property {Thing} result.data.thing - native object representing the review
   *   subject, used by native lookup adapter
   * @property {string} result.sourceID - *(required)* canonical source that
   *  identifies this adapter
   */
  lookup(_url) {
    return Promise.reject(new Error('Not implemented.'));
  }

  //
  // {
  //   data: {
  //     label: 'String'  (required)
  //     description: 'String' (optional)
  //     thing: Thing model (optional, really only useful for native adapter)
  //   }
  //
  // }

  getSourceID() {
    return this.sourceID || 'no source ID defined';
  }

}

module.exports = AbstractLookupAdapter;
