'use strict';
const express = require('express');
const router = express.Router();

const maxAge = 1000 * 60 * 60 * 24 * 30; // cookie age: 30 days

router.get('/en', function(req, res) {
  res.cookie('locale', 'en', {
    maxAge,
    httpOnly: true
  });
  res.redirect('back');
});

router.get('/de', function(req, res) {
  res.cookie('locale', 'de', {
    maxAge,
    httpOnly: true
  });
  res.redirect('back');
});

module.exports = router;
