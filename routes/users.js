'use strict';
const express = require('express');
const router = express.Router();
const escapeHTML = require('escape-html');

const render = require('./helpers/render');
const User = require('../models/user');
const Review = require('../models/review');

const userHandlers = require('./handlers/user-handlers');

router.get('/:name', userHandlers.getUserHandler());

router.get('/:name/feed', userHandlers.getUserFeedHandler());

router.get('/:name/feed/before/:utcisodate', userHandlers.getUserFeedHandler());

router.get('/:name/feed/atom/:language', userHandlers.getUserFeedHandler({format: 'atom'}));

router.get('/:name/edit/bio', userHandlers.getUserHandler({ editBio: true }));

router.post('/:name/edit/bio', userHandlers.processEdit);

module.exports = router;
