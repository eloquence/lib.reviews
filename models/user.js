'use strict';
const thinky = require('../db');
const type = thinky.type;
const Errors = thinky.Errors;
const r = thinky.r;
const bcrypt = require('bcrypt-nodejs');
const ReportedError = require('../util/reported-error');
const UserMeta = require('./user-meta');

const userOptions = {
  maxChars: 128,
  illegalChars: /[<>;"&?!./_]/,
  minPasswordLength: 6
};

/* eslint-disable no-useless-escape */ // False positive

// Erm, if we add [, ] or \ to forbidden chars, we'll have to fix this :)
userOptions.illegalCharsReadable = userOptions.illegalChars.source.replace(/[\[\]\\]/g, '');

/* eslint-enable no-useless-escape */

// Table generation is handled by thinky
let User = thinky.createModel("users", {
  id: type.string(),
  displayName: type.string().max(userOptions.maxChars).validator(containsOnlyLegalCharacters),
  canonicalName: type.string().max(userOptions.maxChars).validator(containsOnlyLegalCharacters),
  urlName: type.virtual().default(function() {
    return this.displayName ? encodeURIComponent(this.displayName.replace(/ /g, '_')) : undefined;
  }),
  email: type.string().max(userOptions.maxChars).email(),
  password: type.string(),
  userMetaID: type.string().uuid(4), // Versioned
  // Trusted users gain invite codes as they write reviews
  inviteLinkCount: type.number().integer().default(0),
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
  userCanEditMetadata: type.virtual().default(false),
  prefersRichTextEditor: type.boolean().default(false)
});

// Relations. For team relations see team model

User.belongsTo(UserMeta, "meta", "userMetaID", "id");

User.options = userOptions; // for external visibility
Object.freeze(User.options);

/**
 * Increase the invite link count by 1 for a given user
 *
 * @param {String} id
 *  unique ID of the user
 * @returns {Number}
 *  updated invite count
 */
User.increaseInviteLinkCount = async function(id) {
  const updatedUser = await User.get(id).update({
      inviteLinkCount: r.row("inviteLinkCount").add(1)
    });
  return updatedUser.inviteLinkCount;
};

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
    if (password.length < userOptions.minPasswordLength) {
      // This check can't be run as a validator since by then it's a fixed-length hash
      reject(new NewUserError({
        message: 'Password for new user is too short, must be at least %s characters.',
        userMessage: 'password too short',
        messageParams: [String(userOptions.minPasswordLength)]
      }));
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

// Which preferences can be toggled via the API for/by this user? May be
// restricted in future based on access control limits.
User.define("getValidPreferences", function() {
  return ['prefersRichTextEditor'];
});

User.ensureUnique = function(name) {
  name = name.trim();
  return new Promise((resolve, reject) => {
    User
      .filter({
        canonicalName: User.canonicalize(name)
      })
      .then(users => {
        if (users.length)
          reject(new NewUserError({
            message: 'A user named %s already exists.',
            userMessage: 'username exists',
            messageParams: [name]
          }));
        else
          resolve();
      })
      .catch(reject); // Most likely, table does not exist. Will be auto-created on restart.
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
                if (error instanceof NewUserError)
                  reject(error);
                else
                  reject(new NewUserError({
                    payload: { user },
                    parentError: error
                  }));
              });
          })
          .catch(reject); // Password too short or hash error
      })
      .catch(reject);
  });
};

User.getWithTeams = function(id) {
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
  if (userOptions.illegalChars.test(name))
    throw new NewUserError({
      message: 'Username %s contains invalid characters.',
      messageParams: [name],
      userMessage: 'invalid username characters',
      userMessageParams: [userOptions.illegalCharsReadable]
    });
  else
    return true;
}

module.exports = User;

// Error class for reporting registration related problems.
// Behaves as a normal ReportedError, but comes with built-in translation layer
// for DB level errors.
class NewUserError extends ReportedError {
  constructor(options) {
    if (typeof options == 'object' && options.parentError instanceof Error &&
      typeof options.payload.user == 'object') {
      switch (options.parentError.message) {
        case 'Value for [email] must be a valid email.':
          options.userMessage = 'invalid email format';
          options.userMessageParams = [options.payload.user.email];
          break;
        case `Value for [displayName] must be shorter than ${User.options.maxChars}.`:
          options.userMessage = 'username too long';
          options.userMessageParams = [String(User.options.maxChars)];
          break;
        case `Value for [email] must be shorter than ${User.options.maxChars}.`:
          options.userMessage = 'email too long';
          options.userMessageParams = [String(User.options.maxChars)];
          break;
        default:
      }
    }
    super(options);
  }

}
