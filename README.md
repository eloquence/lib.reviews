# lib.reviews

A free/libre code and information platform for reviews of absolutely anything.

See [this libreplanet-discuss post](https://lists.gnu.org/archive/html/libreplanet-discuss/2016-05/msg00093.html) for background.

Technical choices include:

- Node.js LTS (currently the Node.js 4 series)
- Express as lightweight framework
- RethinkDB as primary backend
- Thinky as ODM
- Handlebars for front-end templating
- LESS for CSS
- PureCSS for grid system & basic styling
- Grunt as a build system
- Babel to transpile ES6+ code

Still TBD:
- Testing framework - probably Mocha

This project follows a strong philosophy of progressive enhancement. That means that client-side UI features should always be optional, not required -- the primary functionality of the site should be available without JavaScript and on low-end devices.

We also try to add keyboard shortcuts where relevant, and generally follow existing conventions for those (from Wikipedia, Google and other sites).

We aim to be multilingual in UI and content, and are exclusively using translatable strings throughout the user interface.

Relevant related projects:

- https://critiquebrainz.org/ - music reviews
