'use strict';

// External deps
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// Internal deps
const thinky = require('./db');
const User = require('./models/user');

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.get(id).then(user => {
    done(null, user);
  }).catch(err => {
    done(err);
  });
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.filter({ canonicalName: User.canonicalize(username) }).run((err, users) => {
      if (err) { return done(err); }
      let user = users[0];
      if (!user) {
        return done(null, false, { message: 'bad username' });
      }
      if (!user.checkPassword(password)) {
        return done(null, false, { message: 'bad password' });
      }
      return done(null, user);
    });
  }
));
