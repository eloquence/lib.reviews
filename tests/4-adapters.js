import OpenLibraryBackendAdapter from '../adapters/openlibrary-backend-adapter';
import WikidataBackendAdapter from '../adapters/wikidata-backend-adapter';
import test from 'ava';
// Instance name must be set before fixture is loaded
process.env.NODE_APP_INSTANCE = 'testing-1';

const tests = {
  openlibrary: { // Must correspond to canonical source ID
    adapter: new OpenLibraryBackendAdapter(),
    validURLsWithData: [ // Should return data
      'https://openlibrary.org/works/OL16239864W/The_Storytelling_Animal',
      'https://openlibrary.org/works/OL16239864W',
      'https://openlibrary.org/books/OL25087046M',
      'http://openlibrary.org/books/OL25087046M'
    ],
    validURLsWithoutData: [ // Lookup should be attempted but no data returned
      'https://openlibrary.org/works/OL0W',
      'https://openlibrary.org/books/OL0M'

    ],
    invalidURLs: [ // Should not be considered acceptable by this adapter
      'https://openlibrary.org/authors/OL23919A/J._K._Rowling',
      'https://openlibrary.org/authors/OL3433440A.json',
      'https://openlibrary.org/works/OL16239864W.json',
      'https://openlibrary.org/works/OL16239864W.json'
    ]
  },
  wikidata: {
    adapter: new WikidataBackendAdapter(),
    validURLsWithData: [
      'https://www.wikidata.org/wiki/Q4921967',
      'https://www.wikidata.org/wiki/Q4921967#sitelinks-wikipedia',
      'https://www.wikidata.org/wiki/Q33205191',
      'https://www.wikidata.org/entity/Q33205191',
      'http://www.wikidata.org/entity/Q33205191'
    ],
    validURLsWithoutData: [
      'https://www.wikidata.org/wiki/Q0'
    ],
    invalidURLs: [
      'https://www.wikidata.org/wiki/Property:P4426',
      'https://www.wikidata.org/wiki/Special:NewItem',
      'https://www.wikidata.org/wiki/Wikidata:Introduction'
    ]
  }
};

test(`Adapters return correct source ID`, t => {
  for (let source in tests)
    t.is(tests[source].adapter.getSourceID(), source);
  t.pass();
});

test(`Adapters reject invalid URLs`, t => {
  for (let source in tests) {
    const invalidURLs = tests[source].invalidURLs.slice();
    // Add some generic invalid URLs for good measure
    invalidURLs.unshift(['https://zombo.com/', 'an elephant']);
    for (let url of invalidURLs)
      t.false(tests[source].adapter.ask(url));
  }
  t.pass();
});

test(`Adapters say they support valid URLs`, t => {
  for (let source in tests) {
    const validURLs = [
      ...tests[source].validURLsWithData,
      ...tests[source].validURLsWithoutData
    ];
    for (let url of validURLs)
      t.true(tests[source].adapter.ask(url));
  }
  t.pass();
});

test(`Adapters retrieve data with label and correct source ID from valid URLs with data`, async t => {
  for (let source in tests) {
    const urls = tests[source].validURLsWithData.slice();
    for (let url of urls) {
      // Note this is serial lookup. We can parallelize a bit, but let's try
      // not to hit external APIs too hard. Also note it's already parallelized
      // with the invalid URL lookups below.
      const result = await tests[source].adapter.lookup(url);
      t.is('object', typeof result);
      t.is('object', typeof result.data);
      t.is('object', typeof result.data.label); // multilingual string object
      t.is(tests[source].adapter.getSourceID(), result.sourceID);
    }
  }
  t.pass();
});

test(`Adapters don't retrieve data from valid URLs that contain no data`, async t => {
  for (let source in tests) {
    const urls = tests[source].validURLsWithoutData.slice();
    for (let url of urls)
      await t.throws(tests[source].adapter.lookup(url));
  }
  t.pass();
});
