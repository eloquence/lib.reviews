'use strict';

// This module performs label lookups in OpenStreetMap for ways or nodes, based
// on the 'name' property in OpenStreetMap

// External deps
const request = require('request-promise-native');
const config = require('config');
const escapeHTML = require('escape-html');
const debug = require('../util/debug');

const languages = require('../locales/languages');
const validLanguages = languages.getValidLanguages();

// Internal deps
const AbstractBackendAdapter = require('./abstract-backend-adapter');

class OpenStreetMapBackendAdapter extends AbstractBackendAdapter {

  constructor() {
    super();

    // Let's break it down:
    // - nodes or ways
    // - ID number
    // - maybe followed by a fragment
    // - case doesn't matter
    this.supportedPattern =
      new RegExp('^https://www.openstreetmap.org/(node|way)/(\\d+)(?:#.*)?$', 'i');
    this.supportedFields = ['label'];
    this.sourceID = 'openstreetmap';
    this.sourceURL = 'https://openstreetmap.org/';
  }

  async lookup(url) {
    const m = url.match(this.supportedPattern);
    if (m === null)
      throw new Error('URL does not appear to reference an OpenStreetMap way or node.');

    // 'way' or 'node'
    const osmType = m[1];
    const osmID = m[2];

    const query =
      '[out:json];\n' +
      `${osmType}(${osmID});\n` +
      'out;\n';

    const options = {
      method: 'POST',
      uri: 'https://overpass-api.de/api/interpreter',
      headers: {
        'User-Agent': config.adapterUserAgent,
      },
      form: {
        data: query,
      },
      json: true,
      timeout: config.adapterTimeout
    };

    const data = await request(options);
    debug.adapters('Received data from OpenStreetMap adapter (way/node lookup):\n' +
      JSON.stringify(data, null, 2));

    if (typeof data !== 'object' || !data.elements || !data.elements.length)
      throw new Error('Result from OpenStreetMap did not include any data.');

    if (!data.elements[0].tags)
      throw new Error(`No tags set for ${osmType} ID: ${osmID}`);


    const tags = data.elements[0].tags;
    const label = {};

    // Names without a language code are stores as 'undetermined' - while those
    // could sometimes be inferred from the country, this is often tricky in
    // practice.
    if (tags['name']) {
      label['und'] = escapeHTML(tags['name']);
    }

    for (let language of validLanguages) {
      // OSM language IDs map correctly against lib.reviews. The two notable
      // exceptions are 'pt' (where OSM does not appear to distinguish between
      // Brazilian and European Portuguese) and 'zh' (where OSM does not appear
      // to distinguish between Traditional and Simplified Chinese). In both
      // cases we're mapping against the more common (Brazilian Portuguese,
      // Simplified Chinese).
      if (tags['name:' + language]) {
        label[language] = tags['name:' + language];
      }
    }

    if (!Object.keys(label).length)
      throw new Error(`No usable name tag set for ${osmType} ID: ${osmID}`);

    const result = {
      data: {
        label
      },
      sourceID: this.sourceID
    };
    debug.adapters('result:' + JSON.stringify(result, null, 2));

    return result;
  }

}

module.exports = OpenStreetMapBackendAdapter;
