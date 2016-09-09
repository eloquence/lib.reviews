'use strict';
import request from 'supertest-as-promised';
import test from 'ava';

process.env.NODE_APP_INSTANCE = 'testing-2';
const dbFixture = require('./fixtures/db-fixture-es5');

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

test.before(async() => {
  await dbFixture.bootstrap([{
      name: 'User',
      file: 'user.js'
    },
    {
      name: 'UserMeta',
      file: 'user-meta.js'
    },
    {
      name: 'Review',
      file: 'review.js'
    },
    {
      name: 'Thing',
      file: 'thing.js'
    },
    {
      name: 'Team',
      file: 'team.js'
    },
    {
      name: 'BlogPost',
      file: 'blog-post.js'
    },
    {
      name: 'TeamJoinRequest',
      file: 'team-join-request.js'
    }
  ]);
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

});

test(`We can register an account via the form (captcha disabled)`, async t => {
  let registerResponse = await t.context.agent.get('/register');
  let csrf = extractCSRF(registerResponse.text);
  if (!csrf)
    return t.fail('Could not obtain CSRF token');

  let postResponse = await t.context.agent
    .post('/register')
    .type('form')
    .send({
      _csrf: csrf,
      username: 'A friend of many GNUs',
      password: 'toGNUornottoGNU',
    })
    .expect(302)
    .expect('location', '/');

  await t.context.agent
    .get(postResponse.headers.location)
    .expect(200)
    .expect(/Thank you for registering a lib.reviews account, A friend of many GNUs!/);

});

test.after.always(async() => {
  await dbFixture.cleanup();
});

// Extract CSRF code from given HTML response. Returns null if code cannot be found.
function extractCSRF(html) {
  let matches = html.match(/<input type="hidden" value="(.*?)" name="_csrf">/);
  return matches && matches[1] ? matches[1] : null;
}
