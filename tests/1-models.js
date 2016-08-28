'use strict';
import { getModels } from './helpers/model-helpers-es5';
import { getReviewData } from './helpers/content-helpers-es5';
import isUUID from 'is-uuid';
import test from 'ava';

// Instance name must be set before fixture is loaded
process.env.NODE_APP_INSTANCE = 'testing-1';
const dbFixture = require('./fixtures/db-fixture-es5');

let user;

test.before(async() => {
  await dbFixture.bootstrap(getModels());
});

test.serial('We can create a user', async t => {
  await dbFixture.db.r.table('users').wait();
  user = await dbFixture.models.User.create({
    name: 'Eloquence',
    password: 'password',
    email: 'eloquence+libreviews@gmail.com',
  });
  t.true(isUUID.v4(user.id), 'User has valid v4 UUID');
  t.is(user.password.length, 60, 'Password appears to be hashed correctly');
});

test('We can create a review', async t => {
  t.plan(9);

  let tags = ['create_test_revision', 'test_rev'];
  // Destructuring for easy access to tests
  let { title, text, html, url, starRating, createdOn, createdBy, originalLanguage } = getReviewData(user.id);
  let review = await dbFixture.models.Review.create({
    title,
    text,
    html,
    url,
    starRating,
    originalLanguage,
    createdOn,
    createdBy
  }, { tags });
  t.true(isUUID.v4(review.id), 'Review has valid v4 UUID');
  t.true(isUUID.v4(review.thingID), 'Implicitly created Thing has valid v4 UUID');
  t.is(review._revUser, user.id, 'Review revision attributed to user');
  t.true(review._revDate instanceof Date && !isNaN(review._revDate), 'Review revision has valid date');
  t.is(review.createdOn.valueOf(), createdOn.valueOf(), 'Review creation date is expected value');

  t.true(isUUID.v4(review._revID), 'Review revision has valid v4 UUID');
  t.deepEqual(review._revTags, tags, 'Review revision has expected tags');

  let thing = await dbFixture.models.Thing.get(review.thingID);
  t.is(review.thingID, thing.id, 'Thing record can be located.');
  t.deepEqual(thing.urls, [url], 'Thing URL is stored in an array.');
});

test('Trying to save review with bad rating results in expected error', async t => {
  let reviewObj = getReviewData(user.id);
  reviewObj.starRating = 99;

  try {
    await dbFixture.models.Review.create(reviewObj);
  } catch (e) {
    return t.is(e.msgKey, 'invalid star rating');
  }
  t.fail();
});

test('We can create a new revision of a review', async t => {
  t.plan(6);

  let reviewObj = getReviewData(user.id);
  let review = await dbFixture.models.Review.create(reviewObj);
  // Object is modified by newRevision function - so we extract what we need
  let { _revID, id } = review;
  let tags = ['test-new-rev'];

  let newRev = await review.newRevision(user, { tags });
  t.true(isUUID.v4(newRev._revID), 'New review revision has valid v4 UUID');
  t.not(newRev._revID, _revID, 'New review revision has a newly assigned ID');
  t.is(newRev.id, id, 'New review revision retains old stable ID');
  t.is(newRev._revUser, user.id, 'New review revision is attributed to user');
  t.true(newRev._revDate instanceof Date && !isNaN(newRev._revDate), 'New review revision has valid date');
  newRev.title.de = 'Ein wirklich schlechter Test';
  let savedRev = await newRev.save();
  t.deepEqual(savedRev.title, {
    en: 'A terribly designed test',
    de: 'Ein wirklich schlechter Test'
  }, 'We can add a translation to a review title');
});

test('We can retrieve and paginate a feed of reviews', async t => {

  t.plan(4);
  let reviewObj = getReviewData(user.id);
  for (let i = 0; i < 5; i++) {
    reviewObj.createdOn = new Date();
    await dbFixture.models.Review.create(reviewObj);
  }

  let feed = await dbFixture.models.Review.getFeed({
    limit: 2
  });

  let { offsetDate, feedItems } = feed;

  t.is(feedItems.length, 2, 'Received expected number of feed items');
  t.true(offsetDate instanceof Date && !isNaN(offsetDate),
    'Received pagination offset date');

  feed = await dbFixture.models.Review.getFeed({
    limit: 3,
    offsetDate
  });

  ({ feedItems } = feed);
  t.is(feedItems.length, 3, 'Received expected number of additional feed items');
  t.true(feedItems[0].createdOn.valueOf() < offsetDate.valueOf(),
    'Feed items received with pagination offset are older than earlier ones');

});

test('We can delete multiple revisions of a review and its associated thing', async t => {

  let reviewObj = getReviewData(user.id);
  // Different URL, so we don't delete thing created from other tests
  reviewObj.url = 'http://bad.horse';

  let review = await dbFixture.models.Review.create(reviewObj);

  let thingID = review.thingID;

  let id1 = review._revID;

  let newRev = await review.newRevision(user);
  let savedRev = await newRev.save();

  let id2 = savedRev._revID;

  savedRev.thing = await dbFixture.models.Thing.get(savedRev.thingID);
  await savedRev.deleteAllRevisionsWithThing(user);
  let deleted1 = await dbFixture.models.Review.filter({ _revID: id1 });
  let deleted2 = await dbFixture.models.Review.filter({ _revID: id2 });
  let deletedThing = await dbFixture.models.Thing.get(thingID);
  t.true(deleted1[0]._revDeleted, 'Original revision has been deleted');
  t.true(deleted2[0]._revDeleted, 'Updated revision has been deleted');
  t.true(deletedThing._revDeleted, 'Associated thing has been deleted');
});

test.after.always(async() => {
  await dbFixture.cleanup();
});
