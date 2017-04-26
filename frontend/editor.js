/* global $ */
/* eslint prefer-reflect: "off" */
'use strict';

// ProseMirror editor components
const { EditorState } = require('prosemirror-state');
const { EditorView } = require('prosemirror-view');
const { schema, defaultMarkdownParser, defaultMarkdownSerializer } = require('prosemirror-markdown');
const { keymap } = require('prosemirror-keymap');
const { baseKeymap } = require('prosemirror-commands');
const { menuBar } = require('prosemirror-menu');
// For indicating the drop target when dragging a text selection
const { dropCursor } = require('prosemirror-dropcursor');
const inputRules = require('prosemirror-inputrules');
const history = require('prosemirror-history');

// Custom keymap
const { getExtendedKeymap } = require('./editor-extended-keymap');

// Custom menu
const { buildMenuItems } = require('./editor-menu');

// For tracking contentEditable selection
const { saveSelection, restoreSelection } = require('./editor-selection');

const activeInputRules = [
  // Convert -- to —
  inputRules.emDash,
  // Convert ... to …
  inputRules.ellipsis,
  // Convert 1. , 2. .. at beginning of line to numbered list
  inputRules.orderedListRule(schema.nodes.ordered_list),
  // Convert * or - at beginning of line to bullet list
  inputRules.wrappingInputRule(/^\s*([-*]) $/, schema.nodes.bullet_list),
  // Convert > at beginning of line to quote
  inputRules.blockQuoteRule(schema.nodes.blockquote),
  // Convert #, ##, .. at beginning of line to heading
  inputRules.headingRule(schema.nodes.heading, 6)
];

// ProseMirror provides no native way to enable/disable the editor, so
// we add it here
EditorView.prototype.disable = function() {
  let editorElement = this.dom;
  $(editorElement)
    .removeAttr('contenteditable')
    .addClass('ProseMirror-disabled');
  $(editorElement)
    .prev('.ProseMirror-menubar')
    .addClass('ProseMirror-menubar-disabled');
};

EditorView.prototype.enable = function() {
  let editorElement = this.dom;
  $(editorElement)
    .attr('contenteditable', true)
    .removeClass('ProseMirror-disabled');
  $(editorElement)
    .prev('.ProseMirror-menubar')
    .removeClass('ProseMirror-menubar-disabled');
};

// Since we can have multiple RTE instances on a page, we use this array and
// counter to keep track of them
let rteCount = 0;

// Array of objects containing active view instances and associated information
let rtes = [];

let textareaCount = 0;

$('textarea[data-markdown]').each(function() {
  textareaCount++;
  let $switcherTemplate = getSwitcherTemplate({
    accessKeys: textareaCount == 1 ? true : false
  });
  let $switcher = $switcherTemplate.insertAfter($(this));
  addIndicator($switcher, '[data-enable-markdown]');
});

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
    $contentEditable = $rteContainer.find('[contenteditable="true"]'),
    editorID = $rteContainer[0].id.match(/\d+/)[0];

  if (selStart !== undefined && selEnd !== undefined)
    restoreSelection($contentEditable[0], { start: selStart, end: selEnd });

  if (scrollY !== undefined)
    $contentEditable.scrollTop(scrollY);

  rtes[editorID].editorView.focus();

});

// Switch back to markdown
$('[data-enable-markdown]').click(function enableMarkdown(event) {
  if (!isSelectable(this, 'data-markdown-enabled'))
    return false;

  let $rteContainer = $(this).parent().prev(),
    $textarea = $rteContainer.prev(),
    $contentEditable = $rteContainer.find('[contenteditable="true"]'),
    editorID = $rteContainer[0].id.match(/\d+/)[0];

  // .detail contains number of clicks. If 0, user likely got here via
  // accesskey, so the blur() event never fired.
  if (event.originalEvent.detail === 0) {
    updateRTESelectionData($textarea, $contentEditable);
    updateTextarea($textarea, $contentEditable, rtes[editorID].editorView);
  }

  $contentEditable.off();
  $(window).off('resize', rtes[editorID].resizeEventHandler);
  rtes[editorID].editorView.destroy();
  delete rtes[editorID].editorView;
  delete rtes[editorID].resizeEventHandler;
  $rteContainer.remove();
  $textarea.show();
  if ($textarea[0].hasAttribute('data-reset-textarea')) {
    $textarea.removeAttr('data-reset-textarea');
    $textarea[0].setSelectionRange(0, 0);
  }
  $textarea.focus();
});


// Create a new RTE (ProseMirror) instance and add it to the DOM; register
// relevant event handlers. FIXME: Refactor me!
function renderRTE($textarea) {
  let $rteContainer = $(`<div id="pm-edit-${rteCount}" class="rte-container"></div>`)
    .insertAfter($textarea);

  const menu = buildMenuItems(schema);
  const state = EditorState.create({
    doc: defaultMarkdownParser.parse($textarea.val()),
    plugins: [
      inputRules.inputRules({
        rules: activeInputRules
      }),
      keymap(getExtendedKeymap(schema, menu)),
      keymap(baseKeymap),
      history.history(),
      dropCursor(),
      menuBar({
        floating: false,
        content: menu.fullMenu
      })
    ]
  });

  let editorView = new EditorView($(`#pm-edit-${rteCount}`)[0], {
    state
  });

  rtes.push({
    editorView
  });

  let $ce = $rteContainer.find('[contenteditable="true"]');

  // Adjust height to match textarea
  let setRTEHeight = () => {
    let textareaHeight = $textarea.css('height');
    if (textareaHeight)
      $rteContainer.css('height', textareaHeight);
    else
      $rteContainer.css('height', '10em');
    textareaHeight = parseInt($textarea.css('height'), 10);
    let menuHeight = parseInt($rteContainer.find('.ProseMirror-menubar').css('height'), 10) || 41;
    let rteHeight = textareaHeight - (menuHeight + 2);
    $ce.css('height', rteHeight + 'px');
  };
  setRTEHeight();

  // Menu can wrap, so keep an eye on the height
  $(window).resize(setRTEHeight);
  rtes[rteCount].resizeEventHandler = setRTEHeight;

  $ce.blur(function() {
    updateRTESelectionData($textarea, $(this));
    // Re-generating the markdown on blur is a performance compromise; we may want
    // to add more triggers if this is insufficient.
    updateTextarea($textarea, $(this), editorView);
  });

  $(window).on('beforeunload', function() {
    // Let's be nice to scripts that try to rescue form data
    updateTextarea($textarea, $ce, editorView);
  });

  $ce.focus(function() {
    $rteContainer.addClass('rte-focused');
  });

  $ce.focusout(function() {
    $rteContainer.removeClass('rte-focused');
  });

  rteCount++;
  return $rteContainer;
}

// Serialize RTE content into Markdown and update textarea
function updateTextarea($textarea, $ce, editorView) {
  let markdown = defaultMarkdownSerializer.serialize(editorView.state.doc);
  if (markdown !== $textarea.val()) {
    $textarea.val(markdown);
    $textarea
      .trigger('keyup')
      .trigger('change');
    // Make a note that cursor needs to be reset. This must happen after
    // the textarea's visibility is restored to work correctly in Firefox.
    $textarea.attr('data-reset-textarea', '');
  }
}

// We want to be able to preserve the user's place in the document unless
// they've changed it. To do so, we stash the current RTE selection in the
// textarea, since we create a new RTE instance every time the user switches
// between editing environments.
function updateRTESelectionData($textarea, $ce) {
  if (saveSelection) {
    let sel = saveSelection($ce[0]);
    let scrollY = $($ce[0]).scrollTop();
    if (typeof sel == 'object' && typeof sel.start == 'number' && typeof sel.end == 'number') {
      $textarea.attr('data-rte-sel-start', sel.start);
      $textarea.attr('data-rte-sel-end', sel.end);
    }
    $textarea.attr('data-rte-scroll-y', scrollY);
  }
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

// The actual template for the switcher. Can have access keys, but for multiple
// textareas, we want to only add them to one.
function getSwitcherTemplate(options) {
  options = Object.assign({
    accessKeys: false // Should we generate access keys for this switcher?
  }, options);

  let $switcherTemplate = $(
    '<div class="switcher-control" data-markdown-enabled>' +
    '<span class="switcher-option switcher-option-selected" data-enable-markdown>' +
    window.config.messages['markdown format'] +
    '</span>' +
    '<span class="switcher-option" data-enable-rte>' +
    window.config.messages['rich text format'] +
    '</span>' +
    '</div>'
  );

  if (options.accessKeys) {
    let addAccessKey = (selector, key) => $switcherTemplate
      .find(selector)
      .attr('accesskey', key)
      .attr('title', window.config.messages['accesskey'].replace('%s', key));
    addAccessKey('[data-enable-markdown]', 'm');
    addAccessKey('[data-enable-rte]', ',');
  }
  return $switcherTemplate;
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
