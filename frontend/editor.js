/* global $ */
'use strict';

// ProseMirror editor components
const EditorState = require('prosemirror-state').EditorState;
const EditorView = require('prosemirror-view').EditorView;
const { schema, defaultMarkdownParser, defaultMarkdownSerializer } = require('prosemirror-markdown');
const history = require('prosemirror-history');
const keymap = require('prosemirror-keymap').keymap;
const baseKeymap = require('prosemirror-commands').baseKeymap;
const menuBar = require('prosemirror-menu').menuBar;
// For indicating the drop target when dragging a text selection
const dropCursor = require('prosemirror-dropcursor').dropCursor;
const inputRules = require('prosemirror-inputrules');

// For on-the-fly conversion of "--", "..."
const activeInputRules = [inputRules.emDash, inputRules.ellipsis];

// Custom keymap
const getExtendedKeymap = require('./editor-extended-keymap').getExtendedKeymap;

// Custom menu
const buildMenuItems = require('./editor-menu').buildMenuItems;

// For tracking contentEditable selection
const { saveSelection, restoreSelection } = require('./editor-selection');

// Since we can have multiple RTE instances on a page, we use this array and
// counter to keep track of them
let rteCount = 0;
let rtes = [];

// Add control for switching between modes
let $switcher = $('<div class="switcher-control" data-markdown-enabled>' +
    '<span class="switcher-option switcher-option-selected" data-enable-markdown>' +
    window.config.messages['markdown format'] +
    '</span>' +
    '<span class="switcher-option" data-enable-rte>' +
    window.config.messages['rich text format'] +
    '</span>' +
    '</div>')
  .insertAfter('textarea[data-markdown]');

// Add little checkbox indicator to show which mode is enabled
addIndicator($switcher, '[data-enable-markdown]');

// We keep track of the RTE's caret and scroll position, but only if the
// markdown representation hasn't been changed.
$('textarea[data-markdown]').change(function() {
  $(this)
    .removeAttr('data-rte-sel-start')
    .removeAttr('data-rte-sel-end')
    .removeAttr('data-rte-scroll-y');
});

// Switch to the RTE
$('[data-enable-rte]').click(function enableRTE() {
  if (!isSelectable(this, 'data-rte-enabled'))
    return false;

  let $textarea = $(this).parent().prev(),
    selStart = $textarea.attr('data-rte-sel-start'),
    selEnd = $textarea.attr('data-rte-sel-end'),
    scrollY = $textarea.attr('data-rte-scroll-y');

  $textarea.hide();

  // Do the heavy lifting of creating a new RTE instance
  let $rteContainer = renderRTE($textarea),
    $contentEditable = $rteContainer.find('[contenteditable="true"]');

  if (selStart !== undefined && selEnd !== undefined)
    restoreSelection($contentEditable[0], { start: selStart, end: selEnd });

  if (scrollY !== undefined)
    $contentEditable.scrollTop(scrollY);

  $contentEditable.focus();
});

// Switch back to markdown
$('[data-enable-markdown]').click(function enableMarkdown() {
  if (!isSelectable(this, 'data-markdown-enabled'))
    return false;

  let $rteContainer = $(this).parent().prev(),
    $textarea = $rteContainer.prev(),
    $contentEditable = $rteContainer.find('[contenteditable="true"]'),
    editorID = $rteContainer[0].id.match(/\d+/)[0];

  $contentEditable.off();
  rtes[editorID].destroy();
  $rteContainer.remove();
  $textarea.show();
  $textarea.focus();
});


// Create a new RTE (ProseMirror) instance and add it to the DOM; register
// relevant event handlers.
function renderRTE($textarea) {
  let $rteContainer = $(`<div id="pm-edit-${rteCount}" class="rte-container"></div>`)
    .insertAfter($textarea);

  const state = EditorState.create({
    doc: defaultMarkdownParser.parse($textarea.val()),
    plugins: [
      inputRules.inputRules({
        rules: activeInputRules
      }),
      keymap(baseKeymap),
      keymap(getExtendedKeymap(schema)),
      history.history(),
      dropCursor(),
      menuBar({
        floating: false,
        content: buildMenuItems(schema).fullMenu
      })
    ]
  });

  let rte = new EditorView($(`#pm-edit-${rteCount}`)[0], {
    state
  });
  rtes.push(rte);

  let $ce = $rteContainer.find('[contenteditable="true"]');

  // We want to be able to preserve the user's place in the document unless
  // they've changed it. To do so, we stash the current RTE selection in the
  // textarea, since we create a new RTE instance every time the user switches
  // between editing environments.
  $ce.blur(function updateRTESelection() {
    if (saveSelection) {
      let sel = saveSelection(this);
      let scrollY = $(this).scrollTop();
      $textarea.attr('data-rte-sel-start', sel.start);
      $textarea.attr('data-rte-sel-end', sel.end);
      $textarea.attr('data-rte-scroll-y', scrollY);
    }
  });

  // So the textarea value can be safely submitted or queried, we update the
  // markdown representation on blur. (We could update more frequently, but
  // there are few obvious advantages.)
  $ce.blur(function updateTextarea() {
    let markdown = defaultMarkdownSerializer.serialize(rte.state.doc);
    if (markdown !== $textarea.val()) {
      $textarea.val(markdown);
      $textarea
        .trigger('keyup')
        .trigger('change');
      // Reset cursor, otherwise it will be at the end due to value reset
      $textarea[0].setSelectionRange(0, 0);
    }
  });
  rteCount++;

  $(window).on('beforeunload', function() {
    $ce.blur();
  });

  return $rteContainer;
}

// Toggle a switcher if it is selectable, return status
function isSelectable(optionElement, activeOptionAttr) {
  let switcher = $(optionElement).parent()[0];
  if (switcher.hasAttribute(activeOptionAttr))
    return false;
  else {
    toggleSwitcher(switcher);
    return true;
  }
}

// Flip classes and data- attributes for the two modes (markdown, RTE)
function toggleSwitcher(switcher) {
  let activateOption, activateState, deactivateOption, deactivateState;
  let controlData = ['[data-enable-rte]', '[data-enable-markdown]', 'data-rte-enabled', 'data-markdown-enabled'];
  if (switcher.hasAttribute('data-rte-enabled')) { // => switch to markdown
    [activateOption, deactivateOption, deactivateState, activateState] = controlData;
    addIndicator($(switcher), '[data-enable-markdown]');
    removeIndicator($(switcher), '[data-enable-rte]');
  } else { // => switch to RTE
    [deactivateOption, activateOption, activateState, deactivateState] = controlData;
    removeIndicator($(switcher), '[data-enable-markdown]');
    addIndicator($(switcher), '[data-enable-rte]');
  }

  $(switcher).removeAttr(deactivateState).attr(activateState, '');
  $(switcher).find(activateOption).removeClass('switcher-option-selected');
  $(switcher).find(deactivateOption).addClass('switcher-option-selected');
}

// Checkbox indicator for mode switcher
function addIndicator($switcher, selector) {
  let $selectedIndicator = $('<span class="fa fa-check-circle spaced-icon switcher-selected-indicator">');
  $switcher.find(selector).prepend($selectedIndicator);
}

function removeIndicator($switcher, selector) {
  $switcher.find(selector + ' .switcher-selected-indicator').remove();
}
