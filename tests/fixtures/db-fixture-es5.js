'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _childProcessPromise = require('child-process-promise');

var _testHelpersEs = require('../helpers/test-helpers-es5');

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DBFixture = function () {
  function DBFixture() {
    (0, _classCallCheck3.default)(this, DBFixture);

    this.loaded = false;
    this.dbLog = [];
    this.models = [];
    // Sanitize name
    var dbName = 'rethinkdb_data_' + process.env.NODE_APP_INSTANCE.replace(/[^a-zA-Z0-9]/g, '_');
    this.filename = _path2.default.join(__dirname, dbName);
  }

  (0, _createClass3.default)(DBFixture, [{
    key: 'bootstrap',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(models) {
        var config, readyPromises, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, m;

        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:

                process.env.NODE_CONFIG_DIR = _path2.default.join(__dirname, '../../config');

                (0, _testHelpersEs.logNotice)('Loading config for instance ' + process.env.NODE_APP_INSTANCE + ' from ' + process.env.NODE_CONFIG_DIR + '.');

                config = require('config');


                (0, _testHelpersEs.logNotice)('Starting up RethinkDB.');

                this.dbProcess = (0, _childProcessPromise.spawn)('rethinkdb', ['-d', this.filename, '--driver-port', String(config.dbServers[0].port), '--cluster-port', String(config.dbServers[0].port + 1000), '--no-http-admin']).childProcess;

                _context.prev = 5;
                _context.next = 8;
                return this.dbReady();

              case 8:
                _context.next = 15;
                break;

              case 10:
                _context.prev = 10;
                _context.t0 = _context['catch'](5);

                console.log(_chalk2.default.red('RethinkDB exited unexpectedly.'));
                if (this.dbLog.length) {
                  console.log('It had the following to say for itself:');
                  console.log(this.dbLog.join('\n'));
                }
                process.exit();

              case 15:
                this.db = require('../../db');
                (0, _testHelpersEs.logOK)('Database is up and running.');
                (0, _testHelpersEs.logNotice)('Loading models.');
                readyPromises = [];
                _iteratorNormalCompletion = true;
                _didIteratorError = false;
                _iteratorError = undefined;
                _context.prev = 22;

                for (_iterator = (0, _getIterator3.default)(models); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                  m = _step.value;

                  this.models[m.name] = require('../../models/' + m.file);
                  readyPromises.push(this.models[m.name].ready());
                }
                _context.next = 30;
                break;

              case 26:
                _context.prev = 26;
                _context.t1 = _context['catch'](22);
                _didIteratorError = true;
                _iteratorError = _context.t1;

              case 30:
                _context.prev = 30;
                _context.prev = 31;

                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }

              case 33:
                _context.prev = 33;

                if (!_didIteratorError) {
                  _context.next = 36;
                  break;
                }

                throw _iteratorError;

              case 36:
                return _context.finish(33);

              case 37:
                return _context.finish(30);

              case 38:
                (0, _testHelpersEs.logNotice)('Waiting for tables and indices to be created by Thinky.');
                // Tables need to be created
                _context.next = 41;
                return _promise2.default.all(readyPromises);

              case 41:
                (0, _testHelpersEs.logOK)('Ready to go, starting tests. 🚀\n');
                this.loaded = true;

              case 43:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[5, 10], [22, 26, 30, 38], [31,, 33, 37]]);
      }));

      function bootstrap(_x) {
        return _ref.apply(this, arguments);
      }

      return bootstrap;
    }()
  }, {
    key: 'cleanup',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                (0, _testHelpersEs.logNotice)('Killing test database process.');
                _context2.next = 3;
                return this.killDB();

              case 3:
                (0, _testHelpersEs.logNotice)('Cleaning up.');
                _context2.prev = 4;
                _context2.next = 7;
                return (0, _childProcessPromise.exec)('rm -rf ' + this.filename);

              case 7:
                _context2.next = 12;
                break;

              case 9:
                _context2.prev = 9;
                _context2.t0 = _context2['catch'](4);

                console.log(_context2.t0);

              case 12:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[4, 9]]);
      }));

      function cleanup() {
        return _ref2.apply(this, arguments);
      }

      return cleanup;
    }()
  }, {
    key: 'dbReady',
    value: function dbReady() {
      var _this = this;

      return new _promise2.default(function (resolve, reject) {
        _this.dbProcess.stdout.on('data', function (buffer) {
          var str = buffer.toString();
          _this.dbLog.push(str);
          if (/Server ready/.test(str)) resolve();
        });
        _this.dbProcess.stderr.on('data', function (buffer) {
          var str = buffer.toString();
          _this.dbLog.push(str);
        });
        _this.dbProcess.on('close', reject);
      });
    }
  }, {
    key: 'killDB',
    value: function killDB() {
      var _this2 = this;

      return new _promise2.default(function (resolve, reject) {
        _this2.dbProcess.on('close', resolve);
        _this2.dbProcess.on('error', reject);
        _this2.dbProcess.kill();
      });
    }
  }]);
  return DBFixture;
}();

module.exports = new DBFixture();

//# sourceMappingURL=db-fixture-es5.js.map