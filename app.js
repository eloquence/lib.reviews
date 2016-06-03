'use strict';
// External dependencies
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const i18n = require('i18n');
const hbs = require('hbs'); // handlebars templating

// Internal dependencies
const routes = require('./routes/index');
const users = require('./routes/users');


// i18n setup
i18n.configure({
  locales: ['en', 'de'],
  cookie: 'locale',
  autoReload: true,
  updateFiles: false,
  directory: "" + __dirname + "/locales"
});

// express setup

var app = express();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

hbs.registerHelper('__', function () {
  return i18n.__.apply(this, arguments);
});
hbs.registerHelper('__n', function () {
  return i18n.__n.apply(this, arguments);
});

app.use(cookieParser());
app.use(i18n.init);
//app.use(favicon(path.join(__dirname, 'static', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(require('less-middleware')(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'static')));

app.use('/', routes);
app.use('/users', users);

app.get('/en', function (req, res) {
  res.cookie('locale', 'en', { maxAge: 900000, httpOnly: true });
  res.redirect('back');
});

app.get('/de', function (req, res) {
  res.cookie('locale', 'de', { maxAge: 900000, httpOnly: true });
  res.redirect('back');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
