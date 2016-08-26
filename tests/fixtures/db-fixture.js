'use strict';

import { exec, spawn } from 'child-process-promise';
import { logNotice, logOK } from '../helpers/test-helpers-es5';
import chalk from 'chalk';
import path from 'path';

class DBFixture {

  constructor() {
    this.loaded = false;
    this.dbLog = [];
    this.models = [];
    // Sanitize name
    let dbName = 'rethinkdb_data_' + process.env.NODE_APP_INSTANCE.replace(/[^a-zA-Z0-9]/g, '_');
    this.filename = path.join(__dirname, dbName);
  }

  async bootstrap(models) {

    process.env.NODE_CONFIG_DIR = path.join(__dirname, '../../config');

    logNotice(`Loading config for instance ${process.env.NODE_APP_INSTANCE} from ${process.env.NODE_CONFIG_DIR}.`);

    const config = require('config');

    logNotice('Starting up RethinkDB.');

    this.dbProcess = spawn('rethinkdb', ['-d', this.filename, '--driver-port', String(config.dbServers[0].port), '--cluster-port', String(config.dbServers[0].port + 1000), '--no-http-admin']).childProcess;

    try {
      await this.dbReady();
    } catch (error) {
      console.log(chalk.red('RethinkDB exited unexpectedly.'));
      if (this.dbLog.length) {
        console.log('It had the following to say for itself:');
        console.log(this.dbLog.join('\n'));
      }
      process.exit();
    }
    this.db = require('../../db');
    logOK('Database is up and running.');
    logNotice('Loading models.');
    let readyPromises = [];
    for (let m of models) {
      this.models[m.name] = require(`../../models/${m.file}`);
      readyPromises.push(this.models[m.name].ready());
    }
    logNotice('Waiting for tables and indices to be created by Thinky.');
    // Tables need to be created
    await Promise.all(readyPromises);
    logOK('Ready to go, starting tests. 🚀\n');
    this.loaded = true;
  }


  async cleanup() {
    logNotice('Killing test database process.');
    await this.killDB();
    logNotice('Cleaning up.');
    try {
      await exec(`rm -rf ${this.filename}`);
    } catch (error) {
      console.log(error);
    }
  }

  dbReady() {
    return new Promise((resolve, reject) => {
      this.dbProcess.stdout.on('data', buffer => {
        let str = buffer.toString();
        this.dbLog.push(str);
        if (/Server ready/.test(str))
          resolve();
      });
      this.dbProcess.stderr.on('data', buffer => {
        let str = buffer.toString();
        this.dbLog.push(str);
      });
      this.dbProcess.on('close', reject);
    });
  }

  killDB() {
    return new Promise((resolve, reject) => {
      this.dbProcess.on('close', resolve);
      this.dbProcess.on('error', reject);
      this.dbProcess.kill();
    });
  }


}

module.exports = new DBFixture();
