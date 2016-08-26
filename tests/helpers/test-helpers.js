import chalk from 'chalk';

exports.logNotice = (notice) => {
  console.log(chalk.dim(notice));
};

exports.logOK = (notice) => {
  console.log(chalk.green('✔') + ' ' + notice);
};
