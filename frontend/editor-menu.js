/* global $, libreviews */
const {
  wrapItem,
  blockTypeItem,
  Dropdown,
  DropdownSubmenu,
  joinUpItem,
  liftItem,
  undoItem,
  redoItem,
  icons,
  MenuItem
} = require("prosemirror-menu");

// Load proper translations for built-in items
undoItem.spec.title = libreviews.msg('undo');
redoItem.spec.title = libreviews.msg('redo');
joinUpItem.spec.title = libreviews.msg('join with item above');
liftItem.spec.title = libreviews.msg('decrease item indentation');

const { NodeSelection, TextSelection } = require('prosemirror-state');
const { toggleMark, wrapIn } = require('prosemirror-commands');
const { wrapInList } = require('prosemirror-schema-list');
const { TextField, openPrompt } = require('./editor-prompt');
const { guessMediaType } = require('markdown-it-html5-media');

// Helpers to create specific types of items

function canInsert(state, nodeType, attrs) {
  let $from = state.selection.$from;
  for (let d = $from.depth; d >= 0; d--) {
    let index = $from.index(d);
    if ($from.node(d).canReplaceWith(index, index, nodeType, attrs))
      return true;
  }
  return false;
}

function insertMediaItem(nodeTypes) {
  return new MenuItem({
    title: libreviews.msg('insert media help'),
    label: libreviews.msg('insert media'),
    select(state) {
      return canInsert(state, nodeTypes.image);
    },
    run(state, _dispatch, view) {
      let { from, to } = state.selection,
        attrs = null;

      // Extract attributes from any media selection. We apply ALT text from
      // images to video/audio descriptions and vice versa
      if (state.selection instanceof NodeSelection) {
        switch (state.selection.node.type.name) {
          case 'image':
            attrs = {
              src: state.selection.node.attrs.src,
              alt: state.selection.node.attrs.alt ||
                state.selection.node.attrs.description || null
            };
            break;
          case 'video':
          case 'audio':
            attrs = {
              src: state.selection.node.attrs.src,
              description: state.selection.node.attrs.description ||
                state.selection.node.attrs.alt || null
            };
            break;
          default:
            // No default
        }
      }
      openPrompt({
        view,
        title: libreviews.msg('insert media dialog title'),
        fields: {
          src: new TextField({ label: libreviews.msg('media url'), required: true, value: attrs && attrs.src }),
          alt: new TextField({
            label: libreviews.msg('media alt text'),
            value: attrs ? attrs.alt || attrs.description : state.doc.textBetween(from, to, " ")
          })
        },
        callback(attrs) {
          const nodeType = guessMediaType(attrs.src);
          // <video>/<audio> tags do not support ALT; the text is rendered
          // as inner HTML alongside the fallback message.
          if (['video', 'audio'].includes(nodeType)) {
            attrs.description = attrs.alt;
            Reflect.deleteProperty(attrs, 'alt');
          }
          view.dispatch(view.state.tr.replaceSelectionWith(nodeTypes[nodeType].createAndFill(attrs)));
          view.focus();
        }
      });
    }
  });
}

function cmdItem(cmd, options) {
  let passedOptions = {
    label: options.title,
    run: cmd,
    select(state) {
      return cmd(state);
    }
  };
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return new MenuItem(passedOptions);
}

function markActive(state, type) {
  let { from, $from, to, empty } = state.selection;
  if (empty)
    return type.isInSet(state.storedMarks || $from.marks());
  else
    return state.doc.rangeHasMark(from, to, type);
}

function markItem(markType, options) {
  let passedOptions = {
    active(state) {
      return markActive(state, markType);
    }
  };
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return cmdItem(toggleMark(markType), passedOptions);
}

function fullScreenItem() {
  return new MenuItem({
    title: libreviews.msg('full screen mode', { accessKey: 'u' }),
    icon: { dom: $('<span class="fa fa-arrows-alt"></span>')[0] },
    active() {
      return this.enabled || false;
    },
    run(state, _dispatch, view) {
      let $rteContainer = $(view.dom).closest('.rte-container');
      let id = Number($rteContainer[0].id.match(/\d+/)[0]);
      if (!this.enabled) {
        libreviews.activeRTEs[id].enterFullScreen();
        this.enabled = true;
      } else {
        libreviews.activeRTEs[id].exitFullScreen();
        this.enabled = false;
      }
      view.updateState(state);
    }
  });
}

function formatCustomWarningItem(nodeType) {
  return new MenuItem({
    title: libreviews.msg('format as custom warning help'),
    label: libreviews.msg('format as custom warning'),
    run(state, dispatch, view) {
      let prompt = {
        view,
        title: libreviews.msg('format as custom warning dialog title'),
        fields: {
          message: new TextField({
            label: libreviews.msg('custom warning text'),
            required: true
          })
        },
        callback(attrs) {
          // Used to translate node back into markdown
          attrs.markup = `warning ${attrs.message}`;
          wrapIn(nodeType, attrs)(state, dispatch);
          view.focus();
        }
      };
      openPrompt(prompt);
    },
    select(state) {
      return wrapIn(nodeType)(state);
    }
  });
}

function linkItem(markType) {
  return new MenuItem({
    title: libreviews.msg('add or remove link', { accessKey: 'k' }),
    icon: icons.link,
    active(state) {
      return markActive(state, markType);
    },
    select(state) {
      return !state.selection.empty;
    },
    onDeselected: "disable",
    run(state, dispatch, view) {
      if (markActive(state, markType)) {
        toggleMark(markType)(state, dispatch);
        return true;
      }
      openPrompt({
        view,
        title: libreviews.msg('add link dialog title'),
        fields: {
          href: new TextField({
            label: libreviews.msg('web address'),
            required: true,
            clean: (val) => {
              if (!/^https?:\/\//i.test(val))
                val = 'http://' + val;
              return val;
            }
          })
        },
        callback(attrs) {
          // Transform selected text into link
          toggleMark(markType, attrs)(view.state, view.dispatch);
          // Advance cursor to end of selection (not necessarily head,
          // depending on selection direction)
          let rightmost = view.state.selection.$anchor.pos > view.state.selection.$head.pos ?
            view.state.selection.$anchor : view.state.selection.$head;
          view.dispatch(view.state.tr.setSelection(TextSelection.between(rightmost, rightmost)));
          // Disable link mark so user can now type normally again
          toggleMark(markType, attrs)(view.state, view.dispatch);
          view.focus();
        }
      });
    }
  });
}

function wrapListItem(nodeType, options) {
  return cmdItem(wrapInList(nodeType, options.attrs), options);
}

// :: (Schema) → Object
// Given a schema, look for default mark and node types in it and
// return an object with relevant menu items relating to those marks:
//
// **`toggleStrong`**`: MenuItem`
//   : A menu item to toggle the [strong mark](#schema-basic.StrongMark).
//
// **`toggleEm`**`: MenuItem`
//   : A menu item to toggle the [emphasis mark](#schema-basic.EmMark).
//
// **`toggleCode`**`: MenuItem`
//   : A menu item to toggle the [code font mark](#schema-basic.CodeMark).
//
// **`toggleLink`**`: MenuItem`
//   : A menu item to toggle the [link mark](#schema-basic.LinkMark).
//
// **`insertMedia`**`: MenuItem`
//   : A menu item to insert an image, video or sound file
//
// **`wrapBulletList`**`: MenuItem`
//   : A menu item to wrap the selection in a [bullet list](#schema-list.BulletList).
//
// **`wrapOrderedList`**`: MenuItem`
//   : A menu item to wrap the selection in an [ordered list](#schema-list.OrderedList).
//
// **`wrapBlockQuote`**`: MenuItem`
//   : A menu item to wrap the selection in a [block quote](#schema-basic.BlockQuote).
//
// **`makeParagraph`**`: MenuItem`
//   : A menu item to set the current textblock to be a normal
//     [paragraph](#schema-basic.Paragraph).
//
// **`makeCodeBlock`**`: MenuItem`
//   : A menu item to set the current textblock to be a
//     [code block](#schema-basic.CodeBlock).
//
// **`makeHead[N]`**`: MenuItem`
//   : Where _N_ is 1 to 6. Menu items to set the current textblock to
//     be a [heading](#schema-basic.Heading) of level _N_.
//
// **`insertHorizontalRule`**`: MenuItem`
//   : A menu item to insert a horizontal rule.
//
// The return value also contains some prefabricated menu elements and
// menus, that you can use instead of composing your own menu from
// scratch:
//
// **`insertMenu`**`: Dropdown`
//   : A dropdown containing the `insertMedia` and
//     `insertHorizontalRule` items.
//
// **`typeMenu`**`: Dropdown`
//   : A dropdown containing the items for making the current
//     textblock a paragraph, code block, or heading.
//
// **`fullMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the full menu
//     for, for example the [menu bar](https://github.com/prosemirror/prosemirror-menu#user-content-menubar).
function buildMenuItems(schema) {
  /* eslint no-cond-assign: "off" */

  let r = {},
    type;

  if (type = schema.marks.strong)
    r.toggleStrong = markItem(type, { title: libreviews.msg('toggle bold', { accessKey: 'b' }), icon: icons.strong });
  if (type = schema.marks.em)
    r.toggleEm = markItem(type, { title: libreviews.msg('toggle italic', { accessKey: 'i' }), icon: icons.em });
  if (type = schema.marks.code)
    r.toggleCode = markItem(type, { title: libreviews.msg('toggle code', { accessKey: '`' }), icon: icons.code });
  if (type = schema.marks.link)
    r.toggleLink = linkItem(type);

  if (schema.nodes.image && schema.nodes.video && schema.nodes.audio)
    r.insertMedia = insertMediaItem({
      image: schema.nodes.image,
      video: schema.nodes.video,
      audio: schema.nodes.audio
    });

  if (type = schema.nodes.bullet_list)
    r.wrapBulletList = wrapListItem(type, {
      title: libreviews.msg('format as bullet list', { accessKey: '8' }),
      icon: icons.bulletList
    });
  if (type = schema.nodes.ordered_list)
    r.wrapOrderedList = wrapListItem(type, {
      title: libreviews.msg('format as numbered list', { accessKey: '9' }),
      icon: icons.orderedList
    });
  if (type = schema.nodes.blockquote)
    r.wrapBlockQuote = wrapItem(type, {
      title: libreviews.msg('format as quote', { accessKey: '>' }),
      icon: icons.blockquote
    });
  if (type = schema.nodes.paragraph)
    r.makeParagraph = blockTypeItem(type, {
      title: libreviews.msg('format as paragraph help', { accessKey: '0' }),
      label: libreviews.msg('format as paragraph')
    });
  if (type = schema.nodes.code_block)
    r.makeCodeBlock = blockTypeItem(type, {
      title: libreviews.msg('format as code block help'),
      label: libreviews.msg('format as code block')
    });
  if (type = schema.nodes.container_warning) {
    r.formatSpoilerWarning = wrapItem(type, {
      title: libreviews.msg('format as spoiler help'),
      label: libreviews.msg('format as spoiler'),
      attrs: { markup: 'spoiler', message: libreviews.msg('spoiler warning') }
    });
    r.formatNSFWWarning = wrapItem(type, {
      title: libreviews.msg('format as nsfw help'),
      label: libreviews.msg('format as nsfw'),
      attrs: { markup: 'nsfw', message: libreviews.msg('nsfw warning') }
    });
    r.formatCustomWarning = formatCustomWarningItem(type);
  }

  if (type = schema.nodes.heading)
    for (let i = 1; i <= 10; i++)
      r["makeHead" + i] = blockTypeItem(type, {
        title: libreviews.msg('format as level heading help', { accessKey: String(i), numberParam: i }),
        label: libreviews.msg('format as level heading', { numberParam: i }),
        attrs: { level: i }
      });
  if (type = schema.nodes.horizontal_rule) {
    let hr = type;
    r.insertHorizontalRule = new MenuItem({
      title: libreviews.msg('insert horizontal rule help', { accessKey: '_' }),
      label: libreviews.msg('insert horizontal rule'),
      select(state) {
        return canInsert(state, hr);
      },
      run(state, dispatch) {
        dispatch(state.tr.replaceSelectionWith(hr.create()));
      }
    });
  }

  let cut = arr => arr.filter(x => x);
  r.insertMenu = new Dropdown(cut([r.insertMedia, r.insertHorizontalRule]), {
    label: libreviews.msg('insert'),
    title: libreviews.msg('insert help')
  });
  r.typeMenu = new Dropdown(cut([r.makeParagraph, r.makeCodeBlock, r.formatSpoilerWarning, r.formatNSFWWarning, r.formatCustomWarning, r.makeHead1 && new DropdownSubmenu(cut([
    r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6
  ]), { label: libreviews.msg('format as heading') })]), { label: libreviews.msg('format block'), title: libreviews.msg('format block help') });

  r.fullScreen = fullScreenItem();

  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink]), [r.insertMenu]];
  r.blockMenu = [cut([r.typeMenu, r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem,
    liftItem
  ])];

  r.fullMenu = r.inlineMenu.concat(r.blockMenu).concat([
    [undoItem, redoItem]
  ]).concat([
    [r.fullScreen]
  ]);

  return r;
}

exports.buildMenuItems = buildMenuItems;
