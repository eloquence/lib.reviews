'use strict';
const render = require('../helpers/render');
const api = require('../helpers/api');

let actionHandler = {

  // Handler for hiding interface messages, announcements, etc., permanently for a given user
  suppressNotice(req, res, next) {

    let noticeType = req.body.noticeType.trim();
    let user = req.user;
    let output = req.isAPI ? api : render;
    if (!user)
      return output.signinRequired(req, res);

    switch (noticeType) {
      case 'language-notice-review':
      case 'language-notice-thing':
        if (!user.suppressedNotices)
          user.suppressedNotices = [noticeType];
        else
        if (user.suppressedNotices.indexOf(noticeType) == -1)
          user.suppressedNotices.push(noticeType);

        user.save().then(() => {
          if (req.isAPI) {
            let response = {};
            response.message = `Success. Messages of type "${noticeType}" will no longer be shown.`;
            response.errors = [];
            res.type('json');
            res.status(200);
            res.send(JSON.stringify(response, null, 2));
          } else {
            render.template(req, res, 'notice-suppressed', {
              titleKey: 'notice suppressed',
              noticeMessage: req.__(`notice type ${noticeType}`)
            });
          }
        }).catch(error => {
          next(error);
        });
        break;

      default:
        if (req.isAPI) {
          let response = {};
          response.message = 'The request could not be processed.';
          response.errors = [`The given notice type, ${noticeType}, was not recognized.`];
          res.type('json');
          res.status(400);
          res.send(JSON.stringify(response, null, 2));
        } else {
          render.template(req, res, 'unsupported-notice', {
            titleKey: 'unsupported notice',
            noticeType
          });
        }
    }

  }

};
module.exports = actionHandler;
