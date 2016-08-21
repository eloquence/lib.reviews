'use strict';
import request from 'supertest-as-promised';
import test from 'ava';

// Ensure we load -testing specific configuration settings
process.env.NODE_APP_INSTANCE = 'testing';
process.env.NODE_CONFIG_DIR = '../../config';

let routeTests = [
  {
    path: '/',
    status: 200,
    regex: /Welcome/
  },
  {
    path: '/signin',
    status: 200,
    regex: /Sign in/
  },
  {
    path: '/register',
    status: 200,
    regex: /Register/
  },
  {
    path: '/teams',
    status: 200,
    regex: /Browse teams/
  },
  {
    path: '/feed',
    status: 200,
    regex: /Latest reviews/
  },
  {
    path: '/terms',
    status: 200,
    regex: /Terms of use/
  },
  {
    path: '/static/downloads',
    status: 200,
    regex: /Downloads/
  },
  {
    path: '/+not+a+page+',
    status: 404,
    regex: /Page not found/
  },
  {
    path: '/review/+not+a+review+',
    status: 404,
    regex: /Review not found/
  },
  {
    path: '/team/+not+a+team+',
    status: 404,
    regex: /Team not found/
  },
  {
    path: '/thing/+not+a+thing+',
    status: 404,
    regex: /Thing not found/
  }
];

test.beforeEach(async t => {
  // Ensure we initialize from scratch
  Reflect.deleteProperty(require.cache, require.resolve('../../app'));
  let getApp = require('../../app');
  let app = await getApp();
  let agent = request.agent(app);
  t.context.agent = agent;
});

for (let route of routeTests) {
  test(`${route.path} returns ${route.status} and body containing ${route.regex}`, async t =>
    await t.context.agent
    .get(route.path)
    .expect(route.status)
    .expect(route.regex)
  );
}

test(`Changing to German returns German strings`, async t => {
  let mainPageResponse = await t.context.agent.get('/');
  let matches = mainPageResponse.text.match(/<input type="hidden" value="(.*?)" name="_csrf">/);
  if (matches && matches.length) {
    let csrf = matches[1];
    let postResponse = await t.context.agent
      .post('/actions/change-language')
      .type('form')
      .send({
        _csrf: csrf,
        lang: 'de' // Change language
      })
      .expect(302)
      .expect('location', '/');

    await t.context.agent
      .get(postResponse.headers.location)
      .expect(200)
      .expect(/respektiert deine Freiheit/); // String in footer

  } else
    t.fail('Could not obtain CSRF token');
});
