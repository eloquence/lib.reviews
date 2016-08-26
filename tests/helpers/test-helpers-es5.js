'use strict';

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.logNotice = function (notice) {
  console.log(_chalk2.default.dim(notice));
};

exports.logOK = function (notice) {
  console.log(_chalk2.default.green('✔') + ' ' + notice);
};

//# sourceMappingURL=test-helpers-es5.js.map