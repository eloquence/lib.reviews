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
const lessMiddleware = require('less-middleware');
const thinky = require('./db');
const r = thinky.r;
const session = require('express-session');
const RDBStore = require('session-rethinkdb')(session);
const flash = require('express-flash');
const useragent = require('express-useragent');
const passport = require('passport');
const csrf = require('csurf'); // protect against request forgery using tokens

// Internal dependencies
const reviews = require('./routes/reviews');
const languages = require('./routes/languages'); // routes to change UI language
const actions = require('./routes/actions');
const users = require('./routes/users');
const pages = require('./routes/pages');

// Auth setup
require('./auth');

// Handlebars helper setup
require('./util/handlebars-helpers.js');

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

// Ensure we have current request locale available to i18n
app.use(function(req, res, next) {
  hbs.registerHelper('__', function() {
    return i18n.__.apply(req, arguments);
  });
  hbs.registerHelper('__n', function() {
    return i18n.__n.apply(req, arguments);
  });
  next();
});

app.use(cookieParser());

app.use(useragent.express()); // expose UA object to req.useragent

let store = new RDBStore(r, {
  table: 'sessions'
});

app.use(session({
  key: 'libreviews_session',
  resave: true,
  saveUninitialized: true,
  secret: 'joeyTheCanadianStoreOwner',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30
  },
  store
}));
app.use(flash());

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


app.use(i18n.init);
//app.use(favicon(path.join(__dirname, 'static', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));


let cssPath = path.join(__dirname, 'static', 'css');
app.use('/static/css', lessMiddleware(cssPath));
app.use('/static', express.static(path.join(__dirname, 'static')));


app.use(csrf());
app.use('/', pages);
app.use('/', reviews);
app.use('/', languages);
app.use('/', actions);
app.use('/user', users);

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
