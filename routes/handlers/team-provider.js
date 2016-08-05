'use strict';
const AbstractBREADProvider = require('./abstract-bread-provider');
const Team = require('../../models/team');
const mlString = require('../../models/helpers/ml-string.js');
const BlogPost = require('../../models/blog-post');

class TeamProvider extends AbstractBREADProvider {

  constructor(req, res, next, options) {
    super(req, res, next, options);
    this.addPreFlightCheck(['add', 'edit', 'delete'], this.userIsTrusted);
    this.actions.browse.titleKey = 'browse teams';
    this.actions.add.titleKey = 'new team';
    this.actions.edit.titleKey = 'edit team';
    this.actions.delete.titleKey = 'delete team';
    this.documentNotFoundTitleKey = 'team not found title';
    this.documentNotFoundTemplate = 'no-team';
  }

  browse_GET() {

    Team
      .filter({
        _revOf: undefined
      }, {
        default: true
      })
      .filter({
        _revDeleted: false
      }, {
        default: true
      })
      .then(teams => {


        this.renderTemplate('teams', {
          teams,
          titleKey: this.actions.browse.titleKey
        });

      });

  }


  // For incomplete submissions, pass formValues so form can be pre-populated.
  add_GET(formValues) {

    let pageErrors = this.req.flash('pageErrors');
    this.renderTemplate('team-form', {
      titleKey: this.actions[this.action].titleKey,
      pageErrors,
      formValues
    });

  }

  loadData() {

    return Team.get(this.id);

  }

  edit_GET(team) {

    this.add_GET(team);

  }

  read_GET(team) {

    let titleParam = mlString.resolve(this.req.locale, team.name).str;
    team.populateUserInfo(this.req.user);
    BlogPost.getMostRecentBlogPosts(team.id, {
        limit: 3
      })
      .then(blogPosts => {

        blogPosts.forEach(post => post.populateUserInfo(this.req.user));

        this.renderTemplate('team', {
          team,
          titleKey: 'team title',
          titleParam,
          blogPosts,
          deferPageHeader: true // Two-column-layout
        });

      });

  }

  edit_POST(team) {

    let formKey = 'edit-team';
    let language = this.req.body['team-language'];
    let formData = this.parseForm({
      formDef: TeamProvider.formDefs[formKey],
      formKey,
      language
    });

    if (this.req.flashHas('pageErrors'))
      return this.edit_GET(formData.formValues);

    team
      .newRevision(this.req.user, {
        tags: ['edit-via-form']
      })
      .then(newRev => {

        let f = formData.formValues;
        newRev.motto[language] = f.motto[language];
        newRev.name[language] = f.name[language];
        newRev.description.text[language] = f.description.text[language];
        newRev.description.html[language] = f.description.html[language];
        newRev.rules.text[language] = f.rules.text[language];
        newRev.rules.html[language] = f.rules.html[language];
        newRev.onlyModsCanBlog = f.onlyModsCanBlog;
        newRev.modApprovalToJoin = f.modApprovalToJoin;
        newRev
          .save()
          .then(savedRev => {
            this.res.redirect(`/team/${savedRev.id}`);
          })
          .catch(error => { // Saving new revision failed
            this.next(error);
          });
      })
      .catch(error => { // Creating new revision failed
        this.next(error);
      });

  }

  add_POST() {

    let formKey = 'new-team';
    let formData = this.parseForm({
      formDef: TeamProvider.formDefs[formKey],
      formKey,
      language: this.req.body['team-language']
    });

    if (this.req.flashHas('pageErrors'))
      return this.add_GET(formData.formValues);

    Team
      .createFirstRevision(this.req.user, {
        tags: ['create-via-form']
      })
      .then(team => {

        // Associate parsed form data with revision
        Object.assign(team, formData.formValues);

        // Creator is first moderator
        team.moderators = [this.req.user.id];

        team
          .save()
          .then(team => {
            // Add user to team
            if (!this.req.user.teams)
              this.req.user.teams = [];

            this.req.user.teams.push(team.id);
            this.req.user
              .save()
              .then(() => {
                this.res.redirect(`/team/${team.id}`);
              })
              .catch(error => {
                this.next(error); // Problem adding user to team
              });
          })
          .catch(error => { // Problem saving team
            this.next(error);
          });
      }).catch(error => { // Problem getting first revision metadata
        this.next(error);
      });
  }

  delete_GET(team) {

    let pageErrors = this.req.flash('pageErrors');
    this.renderTemplate('team', {
      team,
      titleKey: this.actions[this.action].titleKey,
      deferPageHeader: true,
      pageErrors,
      deleteForm: true
    });

  }

  delete_POST(team) {
    team
      .deleteAllRevisions(this.req.user, {
        tags: ['delete-via-form']
      })
      .then(() => {
        this.renderTemplate('team-deleted', {
          titleKey: 'team deleted'
        });
      })
      .catch(error => {
        this.next(error);
      });
  }

}

// Shared by all instances
TeamProvider.formDefs = {
  'new-team': [{
    name: 'team-name',
    required: true,
    type: 'text',
    key: 'name'
  }, {
    name: 'team-motto',
    required: true,
    type: 'text',
    key: 'motto'
  }, {
    name: 'team-description',
    required: true,
    type: 'markdown',
    key: 'description'
  }, {
    name: 'team-rules',
    required: false,
    type: 'markdown',
    key: 'rules'
  }, {
    name: 'team-mod-approval-to-join',
    required: false,
    type: 'boolean',
    key: 'modApprovalToJoin'
  }, {
    name: 'team-only-mods-can-blog',
    required: false,
    type: 'boolean',
    key: 'onlyModsCanBlog'
  }, {
    name: 'team-language',
    required: true,
    key: 'originalLanguage'
  }, {
    name: 'team-action',
    required: true,
    skipValue: true // Only logic, not saved
  }],
};

TeamProvider.formDefs['edit-team'] = TeamProvider.formDefs['new-team'];

module.exports = TeamProvider;
