'use strict';
const express = require('express');
const router = express.Router();

router.get('/en', function(req, res) {
  res.cookie('locale', 'en', {
    maxAge: 900000, // 15 mins
    httpOnly: true
  });
  res.redirect('back');
});

router.get('/de', function(req, res) {
  res.cookie('locale', 'de', {
    maxAge: 900000, // 15 mins
    httpOnly: true
  });
  res.redirect('back');
});

module.exports = router;
