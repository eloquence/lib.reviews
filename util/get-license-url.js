'use strict';

const urls = {
  'cc-0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'cc-by': 'https://creativecommons.org/licenses/by/4.0/'
};

module.exports = function getLicenseURL(license) {
  return urls[license.toLowerCase()];
};
