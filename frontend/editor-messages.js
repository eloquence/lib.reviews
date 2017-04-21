'use strict';
const msgArr = [
  'accesskey',
  'markdown format',
  'rich text format',
  'insert image',
  'insert image help',
  'insert',
  'insert horizontal rule',
  'insert horizontal rule help',
  'image url',
  'image alt text',
  'toggle bold',
  'toggle italic',
  'toggle code',
  'format block',
  'format block help',
  'format as bullet list',
  'format as numbered list',
  'format as quote',
  'format as paragraph help',
  'format as paragraph',
  'format as code block',
  'format as code block help',
  'format as heading',
  'format as level heading help',
  'format as level heading'
];
const getMessages = require('../util/get-messages');

module.exports.getEditorMessageKeys = function() {
  return msgArr.slice();
};

module.exports.getEditorMessages = function(locale) {
  return getMessages(locale, msgArr.slice());
};
