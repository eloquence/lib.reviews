'use strict';
const hbs = require('hbs');

// Current iteration value will be passed as {{this}} into the block,
// starts at 1 for more human-readable counts. First and last set @first, @last
hbs.registerHelper('times', function(n, block) {
  let rv = '', data = {};
  if (block.data)
    data = hbs.handlebars.createFrame(block.data);

  for (let i = 1; i <= n; i++) {
    data.first = i == 1 ? true : false;
    data.last = i == n ? true : false;
    rv += block.fn(i, { data } ).trim();
  }
  return rv;
});

hbs.registerHelper('link', function(url, title) {
  return `<a href="${url}">${title}</a>`;
});

hbs.registerHelper('userLink', function(user) {
  return `<a href="/user/${user.urlName}">${user.displayName}</a>`;
});

hbs.registerHelper('prettify', function(url) {
  return url
    .replace(/^.*?:\/\//, '') // strip protocol
    .replace(/\/$/, ''); // remove trailing slashes for display only
});
