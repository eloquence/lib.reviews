'use strict';
const express = require('express');
const router = express.Router();

// locale names and message keys

/* GET home page. */
router.get('/', function(req, res, next) {
  let languages = { 'de': 'german', 'en': 'english' };
  // We don't offer the active language
  delete languages[req.locale];
  res.render('index', { languages });
});

module.exports = router;
