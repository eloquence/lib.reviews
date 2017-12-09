'use strict';

const express = require('express');
const router = express.Router();

const render = require('./helpers/render');

router.get('/apitest', (req, res) => {

  render.template(req, res, 'apitest', { scripts: ['apitest.js'] });

});

module.exports = router;
