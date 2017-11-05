const chalk = require('chalk');
const debug = require('../../util/debug');

exports.logNotice = (notice) => {
  debug.tests(chalk.dim(notice));
};

exports.logOK = (notice) => {
  debug.tests(chalk.green('✔') + ' ' + notice);
};
