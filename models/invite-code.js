'use strict';
const thinky = require('../db');
const type = thinky.type;
const User = require('./user');

let inviteCodeSchema = {
  id: type.string().uuid(4),
  generatedOn: type.date(),
  usedOn: type.date(),
};

let InviteCode = thinky.createModel("invite_code", inviteCodeSchema);

User.hasMany(InviteCode, "inviteCodes", "id", "createdByuserID");
User.hasMany(InviteCode, "registrationCode", "id", "usedByUserID");
