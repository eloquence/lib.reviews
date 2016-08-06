'use strict';
// External dependencies
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const serveIndex = require('serve-index');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const i18n = require('i18n');
const hbs = require('hbs'); // handlebars templating
const hbsutils = require('hbs-utils')(hbs);
const lessMiddleware = require('less-middleware');
const thinky = require('./db');
const r = thinky.r;
const session = require('express-session');
const RDBStore = require('session-rethinkdb')(session);
const flash = require('express-flash');
const useragent = require('express-useragent');
const passport = require('passport');
const csrf = require('csurf'); // protect against request forgery using tokens
const config = require('config');
const compression = require('compression');

// Internal dependencies
const reviews = require('./routes/reviews');
const actions = require('./routes/actions');
const users = require('./routes/users');
const teams = require('./routes/teams');
const pages = require('./routes/pages');
const blogPosts = require('./routes/blog-posts');
const api = require('./routes/api');
const apiHelper = require('./routes/helpers/api');
const things = require('./routes/things');
const errors = require('./routes/errors');
const debug = require('./util/debug');
const render = require('./routes/helpers/render');
const hbsMiddlewareHelpers = require('./util/handlebars-helpers.js');

// Auth setup
require('./auth');

// i18n setup
i18n.configure({
  locales: ['en', 'de'],
  cookie: 'locale',
  autoReload: true,
  updateFiles: false,
  directory: "" + __dirname + "/locales"
});


// express setup
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
hbsutils.registerWatchedPartials(__dirname + '/views/partials');
app.set('view engine', 'hbs');

// Handlebars helpers that depend on request object, including i18n helpers
app.use(hbsMiddlewareHelpers);

app.use(cookieParser());

app.use(useragent.express()); // expose UA object to req.useragent

const store = new RDBStore(r, {
  table: 'sessions'
});

app.use(session({
  key: 'libreviews_session',
  resave: true,
  saveUninitialized: true,
  secret: config.get('sessionSecret'),
  cookie: {
    maxAge: config.get('sessionCookieDuration') * 1000 * 60
  },
  store
}));
app.use(flash());

app.use(function(req, res, next) {
  req.flashHas = (key) => {
    if (!req.session || !req.session.flash || !req.session.flash[key])
      return false;
    else
      return req.session.flash[key].length > 0;
  };
  next();
});

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());


app.use(i18n.init);
app.use(favicon(path.join(__dirname, 'static/img/favicon.ico')));

app.use(app.get('env') == 'production' ?
  logger('combined') :
  logger('dev'));


// API requests do not require CSRF protection (hence declared before CSRF
// middleware), but session-authenticated POST requests do require the
// X-Requested-With header to be set, which ensures they're subject to CORS
// rules. This middleware also sets req.isAPI to true for API requests.
app.use('/api', apiHelper.prepareRequest);


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));


app.use(compression());

app.use('/static/downloads', serveIndex(`${__dirname}/static/downloads`, {'icons': true, template: 'views/downloads.html'}));

let cssPath = path.join(__dirname, 'static', 'css');
app.use('/static/css', lessMiddleware(cssPath));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/robots.txt', (req, res) => {
  res.type('text');
  res.send( 'User-agent: *\nDisallow: /api/\n');
});

if (config.maintenanceMode) {
  // Will not pass along control to any future routes but just render
  // generic maintenance mode message instead
  app.use('/', errors.maintenanceMode);
}

app.use('/api', api);

app.use(csrf());
app.use('/', pages);
app.use('/', reviews);
app.use('/', actions);
app.use('/', things);
app.use('/', teams);
app.use('/', blogPosts);
app.use('/user', users);

// Catches 404s and serves "not found" page
app.use(errors.notFound);

// Catches the following:
// - bad JSON data in POST bodies
// - errors explicitly passed along with next(error)
// - other unhandled errors
app.use(errors.generic);

let mode = app.get('env') == 'production' ? 'PRODUCTION' : 'DEVELOPMENT';
debug.app(`Running in ${mode} mode.`);

module.exports = app;
