import chalk from 'chalk';
import debug from '../../util/debug';

exports.logNotice = (notice) => {
  debug.tests(chalk.dim(notice));
};

exports.logOK = (notice) => {
  debug.tests(chalk.green('✔') + ' ' + notice);
};
