'use strict';
const AbstractBREADProvider = require('./abstract-bread-provider');
const Team = require('../../models/team');
const BlogPost = require('../../models/blog-post');
const mlString = require('../../models/helpers/ml-string.js');
class BlogPostProvider extends AbstractBREADProvider {

  constructor(req, res, next, options) {
    super(req, res, next, options);
    this.actions.browse.titleKey = 'team blog';
    this.actions.add.titleKey = 'new blog post';
    this.actions.edit.titleKey = 'edit blog post';
    this.actions.delete.titleKey = 'delete blog post';
    this.actions.add.loadData = this.loadData;
    this.actions.add.resourcePermissionCheck = this.userCanAdd;
    this.actions.browse.loadData = this.loadData;

    this.actions.browseBefore = {
      GET: this.browse_GET,
      loadData: this.loadData,
      titleKey: 'team blog',
      preFlightChecks: []
    };

    // The base level class is checking the team permissions, but post-level
    // permissions, once created, are independent of team permissions, and
    // handled separately
    this.actions.edit.resourcePermissionCheck = undefined;
    this.actions.delete.resourcePermissionCheck = undefined;

    // Team lookup failures take precedence, post lookup failures handled below
    this.messageKeyPrefix = 'team';

  }

  browse_GET(team) {

    let offsetDate;

    offsetDate = new Date(this.utcISODate);
    if (!offsetDate || offsetDate == 'Invalid Date')
      offsetDate = null;

    BlogPost.getMostRecentBlogPosts(team.id, {
        limit: 10,
        offsetDate
      })
      .then(result => {
        let blogPosts = result.blogPosts;
        let offsetDate = result.offsetDate;

        blogPosts.forEach(post => post.populateUserInfo(this.req.user));

        this.renderTemplate('team-blog', {
          titleKey: this.actions[this.action].titleKey,
          titleParam: mlString.resolve(this.req.language, team.name).str,
          blogPosts,
          blogPostsUTCISODate: offsetDate ? offsetDate.toISOString() : undefined,
          team,
          teamURL: `/team/${team.id}`,
          deferPageHeader: true // link in title
        });
      })
      .catch(error => this.next(error));
  }

  read_GET(team) {
    BlogPost
      .getWithCreator(this.postID)
      .then(blogPost => {

        blogPost.populateUserInfo(this.req.user);

        let pageMessages = this.req.flash('pageMessages');

        this.renderTemplate('blog-post', {
          team,
          blogPost,
          titleKey: 'blog post page title',
          titleParam: mlString.resolve(this.req.language, blogPost.title).str,
          teamURL: `/team/${team.id}`,
          deferPageHeader: true,
          pageMessages
        });
      })
      .catch(this.getResourceErrorHandler('post', this.postID));
  }

  add_GET(team, formValues) {
    let pageErrors = this.req.flash('pageErrors');

    this.renderTemplate('blog-post-form', {
      titleKey: this.actions[this.action].titleKey,
      pageErrors: !this.isPreview ? pageErrors : undefined,
      formValues,
      team,
      isPreview: this.isPreview,
      editing: this.editing
    });

  }

  edit_GET(team) {
    BlogPost
      .get(this.postID)
      .then(blogPost => {

        if (!this.userCanEditPost(blogPost))
          return false;

        this.editing = true;
        this.add_GET(team, blogPost);

      })
      .catch(this.getResourceErrorHandler('post', this.postID));
  }

  edit_POST(team) {
    BlogPost
      .get(this.postID)
      .then(blogPost => {

        if (!this.userCanEditPost(blogPost))
          return false;

        this.editing = true;

        let formKey = 'edit-post';
        let language = this.req.body['post-language'];
        let formValues = this.parseForm({
          formDef: BlogPostProvider.formDefs[formKey],
          formKey,
          language
        }).formValues;

        if (this.req.body['post-action'] == 'preview') {
          // Pass along original authorship info for preview
          formValues.createdOn = blogPost.createdOn;
          formValues.creator = blogPost.creator;
          formValues.originalLanguage = blogPost.originalLanguage;
          this.isPreview = true;
        }

        if (this.isPreview || this.req.flashHas('pageErrors'))
          return this.add_GET(team, formValues);

        blogPost.newRevision(this.req.user, {
            tags: ['edit-via-form']
          })
          .then(newRev => {
            newRev.title[language] = formValues.title[language];
            newRev.post.text[language] = formValues.post.text[language];
            newRev.post.html[language] = formValues.post.html[language];
            newRev.save().then(savedRev => {
                this.req.flash('pageMessages', this.req.__('edit saved'));
                this.res.redirect(`/team/${team.id}/post/${newRev.id}`);
              })
              .catch(error => { // Problem saving  updates
                this.next(error);
              });
          })
          .catch(error => { // Problem creating new revision
            this.next(error);
          });

      })
      .catch(this.getResourceErrorHandler('post', this.postID));

  }

  add_POST(team) {

    this.isPreview = this.req.body['post-action'] == 'preview' ? true : false;

    let formKey = 'new-post';
    let language = this.req.body['post-language'];
    let postObj = this.parseForm({
      formDef: BlogPostProvider.formDefs[formKey],
      formKey,
      language
    }).formValues;

    postObj.createdBy = this.req.user.id;
    postObj.createdOn = new Date();
    postObj.teamID = team.id;

    // We're previewing or have basic problems with the submission -- back to form
    if (this.isPreview || this.req.flashHas('pageErrors'))
      return this.add_GET(team, postObj);


    BlogPost
      .createFirstRevision(this.req.user, {
        tags: ['create-via-form']
      })
      .then(rev => {
        Object.assign(rev, postObj);
        rev
          .save()
          .then(savedRev => {
            this.res.redirect(`/team/${team.id}/post/${savedRev.id}`);
          })
          .catch(error => { // Problem saving revision
            this.next(error);
          });
      })
      .catch(error => { // Problem getting revision metadata
        this.next(error);
      });

  }

  delete_GET(team) {
    BlogPost
      .getWithCreator(this.postID)
      .then(blogPost => {

        if (!this.userCanDeletePost(blogPost))
          return false;

        this.renderTemplate('delete-blog-post', {
          team,
          blogPost
        });

      })
      .catch(this.getResourceErrorHandler('post', this.postID).bind(this));

  }

  delete_POST(team) {

    BlogPost
      .getWithCreator(this.postID)
      .then(blogPost => {

        if (!this.userCanDeletePost(blogPost))
          return false;

        blogPost.deleteAllRevisions(this.req.user, {
            tags: 'delete-via-form'
          })
          .then(() => {
            this.renderTemplate('post-deleted', {
              titleKey: 'blog post deleted'
            });
          })
          .catch(error => {
            this.next(error);
          });

      })
      .catch(this.getResourceErrorHandler('post', this.postID).bind(this));

  }


  userCanAdd(team) {

    team.populateUserInfo(this.req.user);
    if (!team.userCanBlog) {
      this.renderPermissionError({
        titleKey: this.actions[this.action].titleKey
      });
    } else
      return true;
  }

  userCanEditPost(post) {
    post.populateUserInfo(this.req.user);
    if (!post.userCanEdit) {
      this.renderPermissionError({
        titleKey: this.actions[this.action].titleKey
      });
    } else
      return true;
  }

  userCanDeletePost(post) {
    post.populateUserInfo(this.req.user);
    if (!post.userCanDelete) {
      this.renderPermissionError({
        titleKey: this.actions[this.action].titleKey
      });
    } else
      return true;
  }


  loadData() {
    return Team.getWithData(this.id);
  }


}

BlogPostProvider.formDefs = {
  'new-post': [{
    name: 'post-title',
    required: true,
    type: 'text',
    key: 'title'
  }, {
    name: 'post-text',
    required: true,
    type: 'markdown',
    key: 'post'
  }, {
    name: 'post-language',
    required: true,
    key: 'originalLanguage'
  }, {
    name: 'post-action',
    required: true,
    skipValue: true
  }]
};

BlogPostProvider.formDefs['edit-post'] = BlogPostProvider.formDefs['new-post'];

module.exports = BlogPostProvider;
