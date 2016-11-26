'use strict';
const thinky = require('../db');
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
module.exports = InviteLink;
