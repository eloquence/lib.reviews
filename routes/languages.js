'use strict';
const express = require('express');
const router = express.Router();
const maxAge = 1000 * 60 * 60 * 24 * 30; // cookie age: 30 days

router.get('/en', function(req, res) {
  res.cookie('locale', 'en', {
    maxAge,
    httpOnly: true
  });
  req.locale = 'en';
  req.flash('messages', req.__('notification language-changed'));
  res.redirect('back');
});

router.get('/de', function(req, res) {
  res.cookie('locale', 'de', {
    maxAge,
    httpOnly: true
  });
  req.locale = 'de';
  req.flash('messages', req.__('notification language-changed'));
  res.redirect('back');
});

module.exports = router;
