'use strict';

// External deps
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// Internal deps
const User = require('./models/user');

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User
    .get(id)
    .then(user => {
      done(null, user);
    })
    .catch(error => {
      done(error);
    });
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    User
      .filter({
        canonicalName: User.canonicalize(username)
      })
      .limit(1)
      .then(users => {
        if (!users.length)
          return done(null, false, {
            message: 'bad username'
          });

        let user = users[0];

        user
          .checkPassword(password)
          .then(result => {

            if (!result)
              return done(null, false, {
                message: 'bad password'
              });
            else
              return done(null, user);
          })
          .catch(error => { // Problem with password check
            done(error);
          });
      })
      .catch(error => { // Problem with query
        done(error);
      });
  }
));
