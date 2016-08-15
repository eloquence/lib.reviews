'use strict';
const render = require('../helpers/render');
const forms = require('../helpers/forms');
const router = require('express').Router();
const getResourceErrorHandler = require('./resource-error-handler');

// This is a generic class to provide middleware for Browse/Read/Edit/Add/Delete
// operations and forms. It comes with some baked-in pre-flight checks but needs
// to be extended to do useful work. All default actions except reads require
// being logged in.
//
// Use the bakery method to create standard BREAD routes. :)
class AbstractBREADProvider {

  constructor(req, res, next, options) {

    if (!req || !res || !next)
      throw new Error('Form needs at least req, res, and next functions from middleware.');

    this.actions = {
      browse: {
        // Function to call for GET requests
        GET: this.browse_GET,
        // Checks to perform before either of above functions are called.
        // If checks fail, they are not called (checks have to handle
        // the request).
        preFlightChecks: [],
        // Title for all "browse" actions
        titleKey: undefined
      },
      read: {
        GET: this.read_GET,
        preFlightChecks: [],
        // Function to call to load data and pass it to GET/POST function.
        // This must perform exclusion of deleted or stale revisions.
        loadData: this.loadData,
        titleKey: undefined
      },
      add: {
        GET: this.add_GET,
        // Function to call for POST requests
        POST: this.add_POST,
        preFlightChecks: [this.userIsSignedIn],
        titleKey: undefined
      },
      edit: {
        GET: this.edit_GET,
        POST: this.edit_POST,
        preFlightChecks: [this.userIsSignedIn],
        // Function to call to load data and pass it to GET/POST function
        loadData: this.loadData,
        // Function to call to validate that user can perform this action,
        // once we have a resource to check against.
        resourcePermissionCheck: this.userCanEdit,
        titleKey: undefined
      },
      delete: {
        GET: this.delete_GET,
        POST: this.delete_POST,
        preFlightChecks: [this.userIsSignedIn],
        loadData: this.loadData,
        resourcePermissionCheck: this.userCanDelete,
        titleKey: undefined
      }
    };

    // Middleware functions
    this.req = req;
    this.res = res;
    this.next = next;

    // This is used for "not found" messages that must be in the format
    // "x not found" (for the body) and "x not found title" (for the title)
    this.messageKeyPrefix = '';

    // Defaults
    options = Object.assign({
      action: 'add',
      method: 'GET',
      id: undefined // only for edit/delete operations
    }, options);

    Object.assign(this, options);

    // Shortcuts to common helpers, which also lets us override these with
    // custom methods if appropriate
    this.renderTemplate = render.template.bind(render, this.req, this.res);
    this.renderResourceError = render.resourceError.bind(render, this.req, this.res);
    this.renderPermissionError = render.permissionError.bind(render, this.req, this.res);
    this.renderSigninRequired = render.signinRequired.bind(render, this.req, this.res);
    this.getResourceErrorHandler = getResourceErrorHandler.bind(getResourceErrorHandler, this.req, this.res, this.next);
    this.parseForm = forms.parseSubmission.bind(forms, this.req);

  }

  execute() {

    let actions = Object.keys(this.actions);
    if (actions.indexOf(this.action) == -1)
      throw new Error('Did not recognize form action: ' + this.type);

    if (typeof this.actions[this.action][this.method] != 'function')
      throw new Error('No defined handler for this method.');

    // Perform pre-flight checks (e.g., permission checks). Pre-flight checks
    // are responsible for rendering failure/result messages, so no
    // additional rendering will take place if any checks fail.
    let mayProceed = true;

    for (let check of this.actions[this.action].preFlightChecks) {
      let result = check.call(this);
      if (!result)
        mayProceed = false;
    }

    if (!mayProceed)
      return;

    if (!this.actions[this.action].loadData)
      this.actions[this.action][this.method].call(this); // Call appropriate handler
    else {
      // Asynchronously load data and show 404 if not found
      this.actions[this.action]
        .loadData.call(this)
        .then(data => {

          // If we have a permission check, only proceeds if it succeeds.
          // If we don't have a permission check, proceed.
          if (!this.actions[this.action].resourcePermissionCheck ||
            this.actions[this.action].resourcePermissionCheck.call(this, data))

            this.actions[this.action][this.method].call(this, data);

        })
        .catch(this.getResourceErrorHandler(this.messageKeyPrefix, this.id));
    }

  }

  userIsSignedIn() {
    if (!this.req.user) {
      this.renderSigninRequired({
        titleKey: this.actions[this.action].titleKey
      });
      return false;
    } else
      return true;
  }

  userIsTrusted() {
    if (!this.req.user || !this.req.user.isTrusted) {
      this.renderPermissionError({
        titleKey: this.actions[this.action].titleKey,
        detailsKey: "must be trusted",
      });
      return false;
    } else
      return true;
  }

  userCan(action, data) {
    data.populateUserInfo(this.req.user);
    if (action == 'edit' && data.userCanEdit)
      return true;
    else if (action == 'delete' && data.userCanDelete)
      return true;
    else {
      this.renderPermissionError({
        titleKey: this.actions[this.action].titleKey
      });
      return false;
    }
  }

  userCanEdit(data) {
    return this.userCan('edit', data);
  }

  userCanDelete(data) {
    return this.userCan('delete', data);
  }

  // Adds a pre-flight check to all actions in provided array.
  // If not defined, adds to all actions
  addPreFlightCheck(actions, check) {
    if (!actions)
      actions = Object.keys(this.actions);

    for (let action of actions)
      this.actions[action].preFlightChecks.push(check);
  }

}

// This registers default routes that are common for editable resources,
// following a standard pattern.
//
// resource -- the identifier used in URLs for the resource
//  that is being configured.
//
// routes (optional) -- actions and associated Express routes that we want to
//   set up. POST routes will only be created for add/edit/delete actions.
AbstractBREADProvider.bakeRoutes = function(resource, routes) {

  let Provider = this;

  if (!routes)
  // Default does not (yet) include a browse route. Code below parses the
  // route pattern, so be careful with non-standard patterns.
    routes = {
    add: `/new/${resource}`,
    read: `/${resource}/:id`,
    edit: `/${resource}/:id/edit`,
    delete: `/${resource}/:id/delete`,
  };

  let _bakeRoute = (action, method, route, idArray) => {

    return function(req, res, next) {

      let options = {
        action,
        method
      };

      // We always initialize each provider with the provided IDs, trimmed
      // and ready for use as object properties.
      idArray.forEach(id => options[id] = req.params[id].trim());

      let provider = new Provider(req, res, next, options);

      provider.execute();
    };
  };

  for (let action in routes) {
    // Extract variable placeholders
    let idMatches = routes[action].match(/\/:(.*?)(\/|$)/g);
    // Extract variable names
    let idArray = idMatches ? idMatches.map(id => id.match(/\w+/)[0]) : [];

    router.get(routes[action], _bakeRoute(action, 'GET', routes[action], idArray));
    // Routes with write acces must handle POST requests
    if (action == 'edit' || action == 'add' || action == 'delete')
      router.post(routes[action], _bakeRoute(action, 'POST', routes[action], idArray));
  }

  return router;

};

module.exports = AbstractBREADProvider;
