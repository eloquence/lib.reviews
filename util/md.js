'use strict';
// We use markdown-it with a few standard settings and a plugin to
// handle ::: spoiler fencing (using the generalized container plugin).
// Because this adds
const MarkdownIt = require('markdown-it');
const container = require('markdown-it-container');
const { html5Media } = require('markdown-it-html5-media');
const i18n = require('i18n');

const markdownMessages = ['nsfw warning', 'spoiler warning'];
MarkdownIt.prototype.getMarkdownMessageKeys = () => markdownMessages.slice();

const md = new MarkdownIt({
  linkify: true,
  breaks: true,
  typographer: true
});

md.use(container, 'warning', {

  // Can take the form of specific built-in notices ("::: spoiler", "::: nsfw")
  // which are mapped against internationalized messages (that are treated
  // as content, i.e. they'll be saved into the rendered output), or a custom
  // notice text (":::warning Here there be dragons")
  validate(params) {
    return /^(spoiler|nsfw)$/.test(params.trim()) || /^warning\s+\S{1}.*$/.test(params.trim());
  },

  render(tokens, idx, options, env) {
    if (tokens[idx].nesting === 1) { // Opening tag
      let match, notice;
      if ((match = tokens[idx].info.trim().match(/^(spoiler|nsfw)$/))) {
        notice = i18n.__({
          phrase: `${match[1]} warning`,
          locale: env.language || 'en'
        });
      } else if ((match = tokens[idx].info.trim().match(/^warning\s+(\S{1}.*)$/))) {
        notice = md.utils.escapeHtml(match[1]);
      } else { // Should not occur given validate function above
        notice = '';
      }
      return `<details class="content-warning"><summary tabindex="0" class="content-warning-notice">${notice}</summary><div class="dangerous-content nojs-visible">\n`;
    } else { // Closing tag
      return '</div></details>\n';
    }
  }
});

md.use(html5Media);

module.exports = md;
