/**
 * Simple IRC bot / webapp that listens to lib.reviews new review
 * webhook events at /post and echoes them to IRC.
 *
 * No auth for now; webapp listens only on loopback interface.
 */

'use strict';
const path = require('path');
process.env.NODE_CONFIG_DIR = path.join(__dirname, '../config');

const config = require('config');
const irc = require('irc');
const bot = new irc.Client(config.irc.server, config.irc.options.userName, config.irc.options);

const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const decodeHTML = require('entities').decodeHTML;

bot.once('names', function () {
  // Every thirty seconds, check that the bot is operating under its canonical
  // nickname, and attempt to regain it if not. (NickServ's "regain" command
  // will modify the bot's nickname, if successful.)
  setInterval(function () {
    if (bot.nick !== config.irc.options.userName) {
      bot.say('NickServ', `regain ${config.irc.options.userName} ${config.irc.options.password}`);
    }
  }, 30 * 1000);
});

app.use(bodyParser.json());

app.post('/reviews', function (req, res) {
  let data = req.body.data;
  let url;
  if (Array.isArray(data.thingURLs) && data.thingURLs[0])
    url = data.thingURLs[0];

  let resolvedLabel = resolve(data.thingLabel);
  if (resolvedLabel)
    resolvedLabel = decodeHTML(resolvedLabel);
  let subject = resolvedLabel || url || 'unknown subject';
  let message = `New review of ${subject} by ${data.author} at ${data.reviewURL}`;

  config.irc.options.channels.forEach(function (channel) {
    bot.say(channel, message);
  });

  res.sendStatus(204);
});

app.listen(config.irc.appPort, '127.0.0.1', function () {
  console.log('Listening on port ' + config.irc.appPort);
});


// Quickly resolve multilingual string to English or first non-English language
function resolve(str) {

  if (typeof str !== 'object')
    return undefined;

  let langs = Object.keys(str);
  if (!langs.length)
    return undefined;

  return str.en || str[langs[0]];

}
