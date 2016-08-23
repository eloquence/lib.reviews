window.markdown = new window.markdownit({
  linkify: true,
  breaks: true,
  typographer: true
});

window.markdown.use(window.markdownitContainer, 'warning', {

  // Can take the form of specific built-in notices ("::: spoiler", "::: nsfw")
  // which are mapped against internationalized messages (that are treated
  // as content, i.e. they'll be saved into the rendered output), or a custom
  // notice text (":::warning Here there be dragons")
  validate(params) {
    return /^(spoiler|nsfw)$/.test(params.trim()) || /^warning\s+\S{1}.*$/.test(params.trim());
  },

  render(tokens, idx) {
    if (tokens[idx].nesting === 1) { // Opening tag
      let match, notice;
      if ((match = tokens[idx].info.trim().match(/^(spoiler|nsfw)$/))) {
        notice = window.config.messages[`${match[1]} warning`];
      } else if ((match = tokens[idx].info.trim().match(/^warning\s+(\S{1}.*)$/))) {
        notice = window.markdown.utils.escapeHtml(match[1]);
      } else { // Should not occur given validate function above
        notice = '';
      }
      return `<details class="content-warning"><summary class="content-warning-notice">${notice}</summary><div class="dangerous-content">\n`;
    } else { // Closing tag
      // closing tag
      return '</div></details>\n';
    }
  }
});
