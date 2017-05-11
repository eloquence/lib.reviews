'use strict';

// For parsing markdown
const MarkdownIt = require('markdown-it');

// For custom ::: fenced elements (spoiler warnings, NSFW warnings, etc.)
const container = require('markdown-it-container');

// Provides ProseMirror integration with default schema
const {
  MarkdownParser,
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer
} = require('prosemirror-markdown');

// We need to create a new schema with our customizations, though
const { Schema } = require('prosemirror-model');

const md = new MarkdownIt('commonmark', { html: false });

// Container module with our custom fenced blocks
md.use(container, 'warning', {
  validate: params => /^(spoiler|nsfw)$/.test(params.trim()) || /^warning\s+\S{1}.*$/.test(params.trim())
});

// Customize the schema to add a new node type that ProseMirror can understand
const markdownSchema = new Schema({
  nodes: schema.spec.nodes.append({
    container_warning: {
      content: "block+",
      group: "block",
      attrs: { message: { default: "" }, markup: { default: "" } },
      parseDOM: [{ tag: "details" }],
      toDOM(node) {
        return [
          "details",
          {
            open: "true",
            class: "content-warning"
          },
          [
            "summary",
            {
              class: "content-warning-notice",
              style: "pointer-events:none;user-select:none;-moz-user-select:none;",
              contenteditable: "false"
            },
            node.attrs.message
          ],
          [
            "div",
            {
              class: "dangerous-content-in-editor"
            },
            0 // Placeholder for actual content
          ]
        ];
      }
    }
  }),
  marks: schema.spec.marks
});

exports.markdownSchema = markdownSchema;

// Serialize warnings back into markdown
defaultMarkdownSerializer.nodes['container_warning'] = (state, node) => {
  state.write(`::: ${node.attrs.markup}\n\n`);
  state.renderContent(node);
  state.write(':::');
  state.closeBlock(node);
};

exports.markdownSerializer = defaultMarkdownSerializer;

const defaultMarkdownParserTokens = defaultMarkdownParser.tokens;

// Translate tokens from markdown parser into metadata for the ProseMirror node
defaultMarkdownParserTokens.container_warning = {
  block: "container_warning",
  attrs: tok => {
    let info = tok.info.trim(),
      rv = {};
    rv.markup = info;
    if (info === 'spoiler' || info === 'nsfw') {
      rv.message = window.config.messages[`${info} warning`];
    } else if (/^warning\s+\S{1}.*/.test(info)) {
      rv.message = (info.match(/^warning\s+(\S{1}.*)$/) || [])[1];
    }
    return rv;
  }
};

const markdownParser = new MarkdownParser(markdownSchema, md, defaultMarkdownParserTokens);

exports.markdownParser = markdownParser;
