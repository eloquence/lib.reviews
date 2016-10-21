/**
 * Simple IRC bot / webapp that listens to lib.reviews new review
 * webhook events at /post and echoes them to IRC.
 *
 * No auth for now; webapp listens only on loopback interface.
 */
const config = require('config');

const irc = require('irc');
const bot = new irc.Client(config.irc.server, config.irc.botName, config.irc.options);

const bodyParser = require('body-parser');
const express = require('express');
const app = express();

app.use(bodyParser.json());

app.post('/reviews', function (req, res) {
  const data = req.body.data;
  const message = 'New review: ' + data.reviewURL;

  config.irc.options.channels.forEach(function (channel) {
    bot.say(channel, message);
  });

  res.sendStatus(204);
});

app.listen(config.irc.appPort, '127.0.0.1', function () {
  console.log('Listening on port ' + config.irc.appPort);
});
