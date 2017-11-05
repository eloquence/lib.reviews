'use strict';
// Standard env settings
process.env.NODE_ENV = 'development';
process.env.NODE_APP_INSTANCE = 'testing-2';

const dbFixture = require('./fixtures/db-fixture');
const { extractCSRF } = require('./helpers/integration-helpers');
const { getModels } = require('./helpers/model-helpers');
const request = require('supertest');
const test = require('ava');

let routeTests = [{
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
    path: '/+not+a+thing+',
    status: 404,
    regex: /Thing not found/
  }
];

test.before(async() => {
  await dbFixture.bootstrap(getModels());
  // Initialize once so sessions table is created if needed
  let getApp = require('../app');
  await getApp();
});

test.beforeEach(async t => {
  // Ensure we initialize from scratch
  Reflect.deleteProperty(require.cache, require.resolve('../app'));
  let getApp = require('../app');
  t.context.app = await getApp();
  t.context.agent = request.agent(t.context.app);
});

for (let route of routeTests) {
  test(`${route.path} returns ${route.status} and body containing ${route.regex}`, async t => {
    t.context.app.locals.test = 'route test';
    await t.context.agent
      .get(route.path)
      .expect(route.status)
      .expect(route.regex);

    t.pass();
  });
}

test(`Changing to German returns German strings`, async t => {
  let mainPageResponse = await t.context.agent.get('/');
  let csrf = extractCSRF(mainPageResponse.text);
  if (!csrf)
    return t.fail('Could not obtain CSRF token');

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

  t.pass();

});

test.after.always(async() => {
  await dbFixture.cleanup();
});
