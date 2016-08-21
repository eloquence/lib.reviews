# lib.reviews

A free/libre code and information platform for reviews of absolutely anything.

See [this libreplanet-discuss post](https://lists.gnu.org/archive/html/libreplanet-discuss/2016-05/msg00093.html) for background.

Our technical choices include:

- Node.js LTS (currently the Node.js 4 series)
- Express as lightweight framework
- RethinkDB as primary backend
- Thinky as ODM
- Handlebars for front-end templating
- LESS for CSS
- PureCSS for grid system & basic styling
- Grunt as a build system
- Babel to transpile ES6+ code
- ava as a test runner
- pm2 for process management, monitoring and deployment

This project follows a strong philosophy of progressive enhancement. That means that client-side UI features should always be optional, not required -- the primary functionality of the site should be available without JavaScript and on low-end devices.

We also try to add keyboard shortcuts where relevant, and generally follow existing conventions for those (from Wikipedia, Google and other sites).

We aim to be multilingual in UI and content, and are exclusively using translatable strings throughout the user interface.

# Setup & contributing

This is very much an open project and we'd love your help! :) To get started,
clone the repository to your local computer. You will need the current Node.js
stable release. Switch to your check-out directory and then run `npm install`.
Run `grunt` to build the JavaScript. Make sure you also have RethinkDB up
and running before starting the service.

You can customize your development configuration by copying `config/default.json5`
to `config/development.json5`. Finally, run `npm start` and visit `localhost`
at the configured port number.

Any pull requests must be under the [CC-0 License](./LICENSE). This project has
adopted a [code of conduct](./CODE_OF_CONDUCT.md) to make sure all contributors
feel welcome.

# Relevant related projects

- https://critiquebrainz.org/ - music reviews
- http://revyu.com/ - universal review site from ~2007, now defunct. We're
  discussing data recovrey options.
