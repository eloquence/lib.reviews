exports.getReviewData = (userID) => ({
  title: { en: 'A terribly designed test' },
  text: { en: 'Whoever wrote this test was clearly *drunk*, or asleep, or something.' },
  html: { en: '<p>Whoever wrote this test was clearly <em>drunk</em>, or asleep, or something.</p>' },
  url: 'https://github.com/eloquence/lib.reviews/blob/master/tests/1-models.js',
  tags: ['test_revision', 'test_revision_create'],
  createdOn: new Date(),
  createdBy: userID,
  starRating: 1,
  originalLanguage: 'en',
  // not provisioned: createdBy, revision metadata
});
