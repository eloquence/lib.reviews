'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const r = thinky.r;
const bcrypt = require('bcrypt-nodejs');
const ErrorMessage = require('../util/error.js');
const UserMeta = require('./user-meta');
const mlString = require('./helpers/ml-string');

const options = {
  maxChars: 128,
  illegalChars: /[<>;"&\?!\.\/]/,
  minPasswordLength: 6
};

// Erm, if we add [, ] or \ to forbidden chars, we'll have to fix this :)
options.illegalCharsReadable = options.illegalChars.source.replace(/[\[\]\\]/g, '');

// Table generation is handled by thinky
let User = thinky.createModel("users", {
  id: type.string(),
  displayName: type.string().max(options.maxChars).validator(containsOnlyLegalCharacters),
  canonicalName: type.string().max(options.maxChars).validator(containsOnlyLegalCharacters),
  urlName: type.virtual().default(function() {
    return encodeURIComponent(this.displayName);
  }),
  email: type.string().max(options.maxChars).email(),
  password: type.string(),
  userMetaID: type.string().uuid(4), // Versioned
  trustedBy: [{
    trustedByUser: type.string().uuid(4),
    trustedOnDate: type.date(),
  }],
  registrationDate: type.date().default(() => new Date()),
  showErrorDetails: type.boolean().default(false),
  isTrusted: type.boolean().default(false), // Basic trust - not a spammer, can confer trust
  isModerator: type.boolean().default(false),
  isEditor: type.boolean().default(false),
  suppressedNotices: [type.string()]
});

User.belongsTo(UserMeta, "meta", "userMetaID", "id");

User.options = options; // for external visibility
Object.freeze(User.options);

User.define("setName", function(displayName) {
  displayName = displayName.trim();
  this.displayName = displayName;
  this.canonicalName = User.canonicalize(displayName);
  this.generateVirtualValues();
});


// FIXME: switch to async code, these are pretty slow by design
User.define("setPassword", function(password) {
  if (password.length < options.minPasswordLength)
  // Can't be run as a validator since by then it's a hash
    throw new ErrorMessage('password too short', [String(options.minPasswordLength)]);
  else
    this.password = bcrypt.hashSync(password);
});

User.define("canDeleteReview", function(review) {
  if (this.isModerator || (this.id && this.id === review.createdBy))
    return true;
  else
    return false;
});

User.define("canEditReview", function(review) {
  // Identical permissions for now. Maybe later "editor" group will be able
  // to edit, or translate, but for now editors can only edit things (since they
  // are inherently collaborative).
  return this.canDeleteReview(review);
});

User.define("checkPassword", function(password) {
  return bcrypt.compareSync(password, this.password);
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
        user.setPassword(userObj.password); // may throw if too short
        if (userObj.email)
          user.email = userObj.email;
        user.save().then(user => {
          resolve(user);
        }).catch(error => { // Save failed
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
      .catch(errorMessage => { // Uniqueness check or pre-save code failed
        reject(errorMessage);
      });
  });
};

User.findByURLName = function(name, options) {

  options = Object.assign({
    withPassword: false,
    withData: false // include metadata
  }, options);

  name = name.trim();

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
