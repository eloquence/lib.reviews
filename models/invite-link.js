'use strict';
const thinky = require('../db');
const r = thinky.r;
const type = thinky.type;
const User = require('./user');
const config = require('config');

let inviteLinkSchema = {
  id: type.string().uuid(4),
  createdOn: type.date(),
  url: type.virtual().default(function() {
    return `${config.qualifiedURL}register/${this.id}`;
  })
};

let InviteLink = thinky.createModel("invite_link", inviteLinkSchema);

InviteLink.hasOne(User, 'usedByUser', 'usedBy', 'id');
InviteLink.hasOne(User, 'createdByUser', 'createdBy', 'id');
User.hasMany(InviteLink, "inviteCodes", "id", "createdBy");
User.hasMany(InviteLink, "registrationCodes", "id", "usedBy");

InviteLink.getAvailable = function(user) {

  return InviteLink
    .filter({
      createdBy: user.id,
      usedBy: false
    }, {
      default: true
    })
    .orderBy(r.desc('createdOn'));
};

InviteLink.getUsed = function(user) {

  return InviteLink
    .filter({
      createdBy: user.id
    })
    .filter(inviteLink => inviteLink('usedBy').ne(false))
    .getJoin({
      usedByUser: true
    })
    .orderBy(r.desc('createdOn'));

};

module.exports = InviteLink;
