'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const r = thinky.r;
const bcrypt = require('bcrypt-nodejs');
const ErrorMessage = require('../util/error.js');
const UserMeta = require('./user-meta');

const options = {
  maxChars: 128,
  illegalChars: /[<>;"&?!./_]/,
  minPasswordLength: 6
};

/* eslint-disable no-useless-escape */ // False positive

// Erm, if we add [, ] or \ to forbidden chars, we'll have to fix this :)
options.illegalCharsReadable = options.illegalChars.source.replace(/[\[\]\\]/g, '');

/* eslint-enable no-useless-escape */

// Table generation is handled by thinky
let User = thinky.createModel("users", {
  id: type.string(),
  displayName: type.string().max(options.maxChars).validator(containsOnlyLegalCharacters),
  canonicalName: type.string().max(options.maxChars).validator(containsOnlyLegalCharacters),
  urlName: type.virtual().default(function() {
    return this.displayName ? encodeURIComponent(this.displayName.replace(/ /g, '_')) : undefined;
  }),
  email: type.string().max(options.maxChars).email(),
  password: type.string(),
  userMetaID: type.string().uuid(4), // Versioned
  trustedBy: [{
    trustedByUser: type.string().uuid(4),
    trustedOnDate: type.date(),
  }],
  // Trusted users gain invite codes as they write reviews
  inviteCodeCount: type.number().integer().default(0),
  registrationDate: type.date().default(() => new Date()),
  showErrorDetails: type.boolean().default(false),
  // Basic trust - not a spammer. Can confer trust, can edit things + create teams
  isTrusted: type.boolean().default(false),
  // Advanced trust - can (reversibly) delete content, but _not_ edit arbitrary content
  isSiteModerator: type.boolean().default(false),
  // Can do anything
  isSuperUser: type.boolean().default(false),
  suppressedNotices: [type.string()],
  // Permission field, populated using _currently logged in user_, to determine
  // whether they can edit _this_ user's metadata.
  userCanEditMetadata: type.virtual().default(false)
});


// Relations. For team relations see team model

User.belongsTo(UserMeta, "meta", "userMetaID", "id");

User.options = options; // for external visibility
Object.freeze(User.options);


User.define("populateUserInfo", function(user) {

  if (!user)
    return; // Permissions at default (false)

  // For now, only the user may edit metadata like bio.
  // In future, translators may also be able to.
  if (user.id == this.id)
    this.userCanEditMetadata = true;

});

User.define("setName", function(displayName) {
  displayName = displayName.trim();
  this.displayName = displayName;
  this.canonicalName = User.canonicalize(displayName);
  this.generateVirtualValues();
});


User.define("setPassword", function(password) {
  let user = this;
  return new Promise((resolve, reject) => {
    if (password.length < options.minPasswordLength) {
      // This check can't be run as a validator since by then it's a fixed-length hash
      reject(new ErrorMessage('password too short', [String(options.minPasswordLength)]));
    } else {
      bcrypt.hash(password, null, null, function(error, hash) {
        if (error)
          reject(error);
        else {
          user.password = hash;
          resolve(user.password);
        }
      });
    }
  });
});

// Will resolve to true if password matches, false otherwise, and only
// reject in case of error
User.define("checkPassword", function(password) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, this.password, function(error, result) {
      if (error)
        reject(error);
      else
        resolve(result);
    });
  });
});

User.ensureUnique = function(name) {
  name = name.trim();
  return new Promise((resolve, reject) => {
    User.filter({
      canonicalName: User.canonicalize(name)
    }).then(users => {
      if (users.length)
        reject(new ErrorMessage('username exists'));
      else
        resolve();
    }).catch(error => {
      // Most likely, table does not exist. Will be auto-created on restart.
      reject(error);
    });
  });
};

// Performs check for uniqueness, password length & validity, and throws
// appropriate errors
User.create = function(userObj) {
  return new Promise((resolve, reject) => {
    User
      .ensureUnique(userObj.name)
      .then(() => {
        let user = new User({});
        user.setName(userObj.name);
        if (userObj.email)
          user.email = userObj.email;
        user
          // Async hash generation, will be rejected if PW too short
          .setPassword(userObj.password)
          .then(() => {
            user.save().then(user => {
              resolve(user);
            })
            .catch(error => { // Save failed
              switch (error.message) {
                case 'Value for [email] must be a valid email.':
                  reject(new ErrorMessage('invalid email format', [userObj.email], error));
                  break;
                case `Value for [displayName] must be shorter than ${options.maxChars}.`:
                  reject(new ErrorMessage('username too long', [String(options.maxChars)], error));
                  break;
                case `Value for [email] must be shorter than 128.`:
                  reject(new ErrorMessage('email too long', [String(options.maxChars)], error));
                  break;
                default:
                  reject(error);
                }
            });
          })
          .catch(error => { // Password too short or hash error
            reject(error);
          });
      })
      .catch(errorMessage => { // Uniqueness check or pre-save code failed
        reject(errorMessage);
      });
  });
};

User.getWithTeams = function (id) {
  return User
    .get(id)
    .getJoin({
      teams: true
    });
};

User.findByURLName = function(name, options) {

  options = Object.assign({
    withPassword: false,
    withData: false, // include metadata
    withTeams: false // include full information about teams
  }, options);

  name = name.trim().replace(/_/g, ' ');

  return new Promise((resolve, reject) => {

    let p = User.filter({
      canonicalName: User.canonicalize(name)
    });

    if (!options.withPassword)
      p = p.without('password');

    if (options.withData)
      p = p.getJoin({
        meta: true
      });

    if (options.withTeams)
      p =
        p.getJoin({
          teams: true
        })
        .getJoin({
          moderatorOf: true
        });

    p.then(users => {
        if (users.length)
          resolve(users[0]);
        else
          reject(new Errors.DocumentNotFound('User not found'));
      })
      .catch(error => {
        reject(error);
      });
  });
};

User.canonicalize = function(name) {
  return name.toUpperCase();
};

User.createBio = function(user, bioObj) {

  return new Promise((resolve, reject) => {

    r
      .uuid()
      .then(uuid => {
        let userMeta = new UserMeta(bioObj);
        userMeta._revID = uuid;
        userMeta._revUser = user.id;
        userMeta._revDate = new Date();
        userMeta._revTags = ['create-bio-via-user'];
        userMeta
          .save()
          .then(savedMeta => {
            user.userMetaID = savedMeta.id;
            resolve(user.save()); // Pass along promise to update user with new info
          })
          .catch(error => { // Failure to save user metadata
            reject(error);
          });
      })
      .catch(error => {
        reject(error);
      });
  });

};

function containsOnlyLegalCharacters(name) {
  if (options.illegalChars.test(name))
    throw new ErrorMessage('invalid username characters', [options.illegalCharsReadable]);
  else
    return true;
}

module.exports = User;
