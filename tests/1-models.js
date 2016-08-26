'use strict';
import isUUID from 'is-uuid';
import test from 'ava';
process.env.NODE_APP_INSTANCE = 'testing-1';
const dbFixture = require('./fixtures/db-fixture-es5');

let user;

test.before(async () => {
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
});

test.serial(`We can create a user`, async t => {
  await dbFixture.db.r.table('users').wait();
  user = await dbFixture.models.User.create({
    name: 'Eloquence',
    password: 'password',
    email: 'eloquence+libreviews@gmail.com',
  });
  t.true(isUUID.v4(user.id), 'User has valid v4 UUID');
});

test(`We can create a review`, async t => {
  let review = await dbFixture.models.Review.create({
    title: { en: 'A terribly designed test' },
    text: { en: 'Whoever wrote this test was clearly *drunk*, or asleep, or something.' },
    html: { en: '<p>Whoever wrote this test was clearly <em>drunk</em>, or asleep, or something.</p>' },
    url: 'https://github.com/eloquence/lib.reviews/blob/master/tests/models.js',
    starRating: 1,
    createdOn: new Date(),
    createdBy: user.id,
    originalLanguage: 'en',
    tags: ['test_revision', 'test_revision_create']
  });
  t.true(isUUID.v4(review.id), 'Review has valid v4 UUID');
  t.true(isUUID.v4(review.thingID), 'Implicitly created Thing has valid v4 UUID');
});

test.after.always(async () => {
  await dbFixture.cleanup();
});
