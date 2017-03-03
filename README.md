# lib.reviews

A free/libre code and information platform for reviews of absolutely anything.

The site is at: https://lib.reviews/

At this point, you need an invite code to make an account. Follow [lib_reviews on Twitter](https://twitter.com/lib_reviews) and send a public ping, and we'll respond with the private invite code. To keep up with development, add our [development diary](https://lib.reviews/team/6bfc0390-e218-4cb7-a446-2046cb886435/blog) to your favorite feed reader.

# Technical background

Our technical choices include:

- Node.js LTS (currently the Node.js 6 series)
- Express as lightweight framework
- RethinkDB as primary backend
- ElasticSearch as search backend
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
at the configured port number. Note we require access to two ports -- one for
HTTP, one for HTTPS.

The startup scripts use [pm2](https://www.npmjs.com/package/pm2), which you can
safely install globally alongside the local version. It's a handy tool that
keeps the process running in the background, balances it across multiple cores
if available, lets you manage log files, etc. If for any reason you just want
to run the server without pm2, you can always fire up `node bin/www` instead.

Any pull requests must be under the [CC-0 License](./LICENSE). This project has
adopted a [code of conduct](./CODE_OF_CONDUCT.md) to make sure all contributors
feel welcome.

# Using Vagrant

If you're familiar with Vagrant and VirtualBox, you may find it easier to
configure a working environment using our Vagrantfile. To install using
Vagrant, simply type

`vagrant up`

in the main directory, and follow the instructions printed on screen.
All dependencies will be installed automatically within a virtualized
Debian environment.

# Relevant related projects

- https://critiquebrainz.org/ - music reviews
- http://revyu.com/ - universal review site from ~2007, now defunct. We're
  discussing data recovery options.
