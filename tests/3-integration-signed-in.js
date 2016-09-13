'use strict';
import { extractCSRF } from './helpers/integration-helpers-es5';
import { getModels } from './helpers/model-helpers-es5';
import request from 'supertest-as-promised';
import test from 'ava';

process.env.NODE_APP_INSTANCE = 'testing-3';
const dbFixture = require('./fixtures/db-fixture-es5');

// Share cookies across testss
let agent;

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
});

// This test needs to run before all the following. It creates a user and logs
// them in
test.serial(`We can register an account via the form (captcha disabled)`, async t => {
  agent = request.agent(t.context.app);
  let registerResponse = await agent.get('/register');
  let csrf = extractCSRF(registerResponse.text);
  if (!csrf)
    return t.fail('Could not obtain CSRF token');

  let postResponse = await agent
    .post('/register')
    .type('form')
    .send({
      _csrf: csrf,
      username: 'A friend of many GNUs',
      password: 'toGNUornottoGNU',
    })
    .expect(302)
    .expect('location', '/');

  await agent
    .get(postResponse.headers.location)
    .expect(200)
    .expect(/Thank you for registering a lib.reviews account, A friend of many GNUs!/);

});

// This may fail if we add more than one review concurrently to the feed
test(`We can create and edit a review`, async t => {
  let newReviewResponse = await agent.get('/new/review');
  let csrf = extractCSRF(newReviewResponse.text);
  if (!csrf)
    return t.fail('Could not obtain CSRF token');

  let postResponse = await agent
    .post('/new/review')
    .type('form')
    .send({
      _csrf: csrf,
      'review-url': 'http://zombo.com/',
      'review-title': 'The unattainable is unknown',
      'review-text': 'This is a decent enough resource if you want to do anything, although the newsletter is not available yet and it requires Flash. Check out http://html5zombo.com/ as well.',
      'review-rating': 3,
      'review-language': 'en',
      'review-action': 'publish'
    })
    .expect(302);

  let feedResponse = await agent
    .get(postResponse.headers.location)
    .expect(200)
    .expect(/<p>This is a decent enough resource if you want to do anything/) //  Text ..
    .expect(/Written by <a href="\/user\/A_friend_of_many_GNUs">A friend of/); // was saved

  let m = feedResponse.text.match(/<a href="(\/review\/.*?\/edit)/);
  if (!m)
    return t.fail('Could not find edit link');

  let editURL = m[1];
  let editResponse = await agent.get(editURL)
    .expect(200)
    .expect(/Editing a review of/) // We're in edit mode
    .expect(/value="The unattainable is unknown"/); // There's a field with expected text

  csrf = extractCSRF(editResponse.text);

  let editPostResponse = await agent
    .post(editURL)
    .type('form')
    .send({
      _csrf: csrf,
      'review-title': 'The unattainable is still unknown',
      'review-text': 'I just checked, and I can still do anything on Zombo.com.',
      'review-rating': '3',
      'review-language': 'en',
      'review-action': 'publish'
    })
    .expect(302);

  await agent
    .get(editPostResponse.headers.location)
    .expect(200)
    .expect(/I just checked/) // New text is there ..
    .expect(/Written by <a href="\/user\/A_friend_of_many_GNUs">A friend of/); // .. and byline indicates save

});

test.after.always(async() => {
  await dbFixture.cleanup();
});
