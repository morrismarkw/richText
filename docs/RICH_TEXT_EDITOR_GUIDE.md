# Rich Text Editor Guide for AI Agents

This document provides grounding information for AI agents working with rich text content in Salesforce LWC applications. It documents the capabilities and limitations of two editor approaches and a pattern for handling unsupported elements.

## Editor Overview

### Salesforce Standard (`lightning-input-rich-text`)

**Best for**: Viewing rich content
**Limitation**: Strips unsupported formatting when user focuses/edits

The Salesforce standard rich text component renders most HTML excellently but has a restricted editing model. When a user clicks into the editor, it normalizes content to its supported subset, potentially losing complex formatting.

### Quill.js

**Best for**: Editing rich content
**Limitation**: Only renders elements it has "Blots" for; unsupported elements are stripped or converted to plain text

Quill uses an internal Delta format. HTML is parsed, converted to Delta, then rendered. Elements without corresponding Blots are lost in this conversion.

---

## Supported Elements Matrix

| Element | Quill (Edit) | Salesforce (View) | Notes |
|---------|:------------:|:-----------------:|-------|
| `<p>` | Yes | Yes | Paragraph |
| `<h1>` - `<h6>` | Yes | Yes | Headings |
| `<strong>`, `<b>` | Yes | Yes | Bold |
| `<em>`, `<i>` | Yes | Yes | Italic |
| `<u>` | Yes | Yes | Underline |
| `<s>`, `<strike>` | Yes | Yes | Strikethrough |
| `<a href="">` | Yes | Yes | Links |
| `<ul>`, `<ol>`, `<li>` | Yes | Yes | Lists |
| `<blockquote>` | Yes | Yes | Block quotes |
| `<pre>`, `<code>` | Yes | Yes | Code blocks |
| `<img>` | Yes | Yes | Images |
| `<br>` | Yes | Yes | Line breaks |
| `<table>` | **No** | Yes | Tables - Quill needs extension |
| `<div>` | **No** | Yes | Generic containers |
| `<span style="">` | **No** | Yes | Inline styles |
| Custom CSS classes | **No** | Yes | Styling classes |
| `<hr>` | **No** | Yes | Horizontal rules |
| `<sub>`, `<sup>` | **No** | Yes | Subscript/superscript |

---

## The Quill-Safe HTML Specification

When generating HTML for Quill editing, constrain output to these elements only:

```html
<!-- Block Elements -->
<p>Paragraph text</p>
<h1>Heading 1</h1> through <h6>Heading 6</h6>
<blockquote>Quoted text</blockquote>
<pre>Code block</pre>
<ul><li>Unordered list item</li></ul>
<ol><li>Ordered list item</li></ol>

<!-- Inline Elements -->
<strong>Bold text</strong>
<em>Italic text</em>
<u>Underlined text</u>
<s>Strikethrough text</s>
<code>Inline code</code>
<a href="https://example.com">Link text</a>

<!-- Embeds -->
<img src="url" alt="description">

<!-- Line Breaks -->
<br>
```

### Elements to AVOID in Quill Content

```html
<!-- These will be stripped or corrupted -->
<table>, <tr>, <td>, <th>
<div>, <span>
<hr>
<sub>, <sup>
<font>, <center>
style="" attributes
class="" attributes (mostly)
```

---

## Placeholder Pattern for Unsupported Elements

When content contains elements Quill cannot edit (like tables), use a placeholder pattern:

### Concept

1. **Storage**: Keep two versions of complex elements:
   - Full HTML (for Salesforce viewing)
   - Placeholder token (for Quill editing)

2. **Edit Flow**: Replace complex HTML with placeholder before loading into Quill
3. **View Flow**: Replace placeholder with full HTML before displaying in Salesforce
4. **Save Flow**: Store both the edited content and the preserved complex elements

### Implementation Example

```javascript
// Placeholder format
const PLACEHOLDER_PATTERN = /\{\{COMPONENT:(\w+):([a-zA-Z0-9-]+)\}\}/g;

// Example: {{COMPONENT:TABLE:uuid-1234}}
// Example: {{COMPONENT:CHART:uuid-5678}}

// Registry of preserved components
const componentRegistry = {
    'uuid-1234': {
        type: 'TABLE',
        html: '<table border="1"><tr><th>Header</th></tr><tr><td>Data</td></tr></table>'
    },
    'uuid-5678': {
        type: 'CHART',
        html: '<div class="chart-container">...</div>'
    }
};
```

### Before Loading into Quill (Edit Mode)

```javascript
function prepareForQuillEdit(html, registry) {
    // Replace tables with placeholders
    return html.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        const id = generateUUID();
        registry[id] = { type: 'TABLE', html: match };
        return `{{COMPONENT:TABLE:${id}}}`;
    });
}

// User sees in Quill:
// "Here is the data: {{COMPONENT:TABLE:uuid-1234}}"
// They can edit around it but not corrupt the table
```

### Before Displaying in Salesforce (View Mode)

```javascript
function prepareForSalesforceView(content, registry) {
    return content.replace(PLACEHOLDER_PATTERN, (match, type, id) => {
        const component = registry[id];
        return component ? component.html : `[Missing ${type}]`;
    });
}

// Salesforce renders the full table
```

### Storage Schema

```javascript
// Salesforce Record Fields
Rich_Text_Document__c {
    Content__c: "Long Text Area"      // Quill-edited content with placeholders
    Components__c: "Long Text Area"   // JSON registry of preserved HTML
    Rendered_Content__c: "Formula"    // Optional: computed full HTML for viewing
}
```

---

## Custom Blot Pattern (Recommended)

Instead of showing raw `{{COMPONENT:TABLE:uuid}}` text in Quill, use a **Custom Blot** to render placeholders as visual, non-editable badges. This is the officially supported Quill extension mechanism.

### What is a Blot?

Blots are the fundamental building blocks of Quill's document model (called "Parchment"). Every element in Quill is a Blot:
- Paragraphs, headers → Block Blots
- Bold, italic, links → Inline Blots
- Images, videos → Embed Blots

**Custom Blots are not a hack** - they are the intended way to extend Quill.

### Component Placeholder Blot

```javascript
const BlockEmbed = Quill.import('blots/block/embed');

class ComponentPlaceholder extends BlockEmbed {
    static blotName = 'component-placeholder';
    static tagName = 'div';
    static className = 'ql-component-placeholder';

    static create(value) {
        const node = super.create();
        node.setAttribute('data-component-id', value.id);
        node.setAttribute('data-component-type', value.type);
        node.setAttribute('contenteditable', 'false');

        // Render as a styled badge
        node.innerHTML = `
            <span class="component-icon">${this.getIcon(value.type)}</span>
            <span class="component-label">${value.type}</span>
            <button class="component-edit-btn" data-action="edit">Edit</button>
            <button class="component-delete-btn" data-action="delete">×</button>
        `;
        return node;
    }

    static value(node) {
        return {
            id: node.getAttribute('data-component-id'),
            type: node.getAttribute('data-component-type')
        };
    }

    static getIcon(type) {
        const icons = {
            'TABLE': '📊',
            'CHART': '📈',
            'CODE': '💻',
            'RAW_HTML': '🔧'
        };
        return icons[type] || '📦';
    }
}

// Register the Blot
Quill.register(ComponentPlaceholder);
```

### Blot Styling (CSS)

```css
.ql-component-placeholder {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin: 4px 0;
    background: #f0f4f8;
    border: 1px solid #c9d4e0;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
}

.ql-component-placeholder:hover {
    background: #e4eaf0;
}

.component-edit-btn {
    padding: 2px 8px;
    background: #0176d3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.component-delete-btn {
    padding: 2px 6px;
    background: transparent;
    color: #706e6b;
    border: none;
    cursor: pointer;
}
```

### Visual Result in Editor

```
┌──────────────────────────────────────────────────────────┐
│  Quill Editor                                            │
│                                                          │
│  Here is the quarterly data:                             │
│                                                          │
│  ┌────────────────────────────────────────┐             │
│  │ 📊 TABLE          [Edit] [×]           │  ← Blot     │
│  └────────────────────────────────────────┘             │
│                                                          │
│  As you can see, revenue increased by 15%.               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Component Editor Dialog Pattern

Each Blot type can have its own editor dialog for modifying the embedded content.

### Dialog Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Table Component                              [×]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌───────────────────────────────┐│
│  │ HTML Source         │  │ Preview                       ││
│  │                     │  │ (lightning-formatted-rich-    ││
│  │ <table>             │  │  text or iframe)              ││
│  │   <tr>              │  │                               ││
│  │     <th>Q1</th>     │  │  ┌──────┬──────┬──────┐      ││
│  │     <th>Q2</th>     │  │  │  Q1  │  Q2  │  Q3  │      ││
│  │   </tr>             │  │  ├──────┼──────┼──────┤      ││
│  │   <tr>              │  │  │ $10K │ $12K │ $15K │      ││
│  │     <td>$10K</td>   │  │  └──────┴──────┴──────┘      ││
│  │   </tr>             │  │                               ││
│  │ </table>            │  │                               ││
│  └─────────────────────┘  └───────────────────────────────┘│
│                                                             │
│                                    [Cancel]  [Save]         │
└─────────────────────────────────────────────────────────────┘
```

### Type-Specific Dialogs

| Blot Type | Editor Experience |
|-----------|-------------------|
| `TABLE` | Visual table builder OR raw HTML editor |
| `CODE` | Code editor with syntax highlighting |
| `CHART` | Chart configuration UI |
| `RAW_HTML` | Generic HTML textarea + preview |

### LWC Component Structure

```
force-app/main/default/lwc/
├── editorQuill/                    # Main Quill editor with Blot
├── componentEditorDialog/          # Modal wrapper
│   ├── componentEditorDialog.html
│   ├── componentEditorDialog.js
│   └── componentEditorDialog.css
├── componentEditorTable/           # Table-specific editor
├── componentEditorCode/            # Code-specific editor
└── componentEditorRawHtml/         # Generic HTML editor
```

### Dialog Flow

```javascript
// In editorQuill.js

handleBlotEditClick(componentId, componentType) {
    const componentData = this.componentRegistry[componentId];

    // Open the appropriate dialog
    this.openComponentDialog({
        id: componentId,
        type: componentType,
        html: componentData.html,
        onSave: (updatedHtml) => {
            this.componentRegistry[componentId].html = updatedHtml;
            this.showToast('Component updated');
        },
        onDelete: () => {
            delete this.componentRegistry[componentId];
            this.removeBlotFromEditor(componentId);
        }
    });
}
```

---

## Quill Features Reference

### Core Architecture

| Concept | Description |
|---------|-------------|
| **Delta** | JSON format representing document content and changes |
| **Parchment** | Document model library; Blots are its building blocks |
| **Modules** | Pluggable functionality (toolbar, keyboard, clipboard, history) |
| **Formats** | Text formatting definitions (bold, italic, custom) |
| **Themes** | Visual themes (Snow = toolbar, Bubble = tooltip) |

### Modules (Extensible)

#### Toolbar Module
```javascript
const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ 'header': 1 }, { 'header': 2 }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    ['link', 'image'],
    ['clean']
];

const quill = new Quill('#editor', {
    modules: { toolbar: toolbarOptions },
    theme: 'snow'
});
```

#### Keyboard Module (Custom Shortcuts)
```javascript
const quill = new Quill('#editor', {
    modules: {
        keyboard: {
            bindings: {
                // Ctrl+Shift+T inserts a component placeholder
                insertComponent: {
                    key: 'T',
                    shortKey: true,
                    shiftKey: true,
                    handler: function(range) {
                        this.quill.insertEmbed(range.index, 'component-placeholder', {
                            id: generateUUID(),
                            type: 'TABLE'
                        });
                    }
                }
            }
        }
    }
});
```

#### Clipboard Module (Paste Handling)
```javascript
// Customize how pasted content is processed
const quill = new Quill('#editor', {
    modules: {
        clipboard: {
            matchers: [
                // Convert pasted tables to component placeholders
                ['TABLE', (node, delta) => {
                    const id = generateUUID();
                    componentRegistry[id] = { type: 'TABLE', html: node.outerHTML };
                    return new Delta().insert({ 'component-placeholder': { id, type: 'TABLE' } });
                }]
            ]
        }
    }
});
```

#### History Module (Undo/Redo)
```javascript
// Built-in, enabled by default
quill.history.undo();
quill.history.redo();

// Configuration
modules: {
    history: {
        delay: 1000,      // Merge changes within 1 second
        maxStack: 100,    // Max undo stack size
        userOnly: true    // Only track user changes, not API changes
    }
}
```

### Delta Format

Quill's internal document format. Useful for tracking changes or collaborative editing.

```javascript
// Get content as Delta
const delta = quill.getContents();
// { ops: [{ insert: 'Hello ' }, { insert: 'World', attributes: { bold: true } }] }

// Set content from Delta
quill.setContents(delta);

// Get changes between two deltas
const diff = oldDelta.diff(newDelta);

// Apply changes
quill.updateContents(diff);
```

### Events

```javascript
// Content changed
quill.on('text-change', (delta, oldDelta, source) => {
    // source: 'user' or 'api'
    console.log('Content changed:', delta);
});

// Selection changed
quill.on('selection-change', (range, oldRange, source) => {
    if (range) {
        console.log('Cursor at:', range.index);
    } else {
        console.log('Editor lost focus');
    }
});

// Any change (text or selection)
quill.on('editor-change', (eventName, ...args) => {
    // eventName: 'text-change' or 'selection-change'
});
```

### Useful API Methods

```javascript
// Content
quill.getText();                    // Plain text
quill.getContents();               // Delta
quill.setContents(delta);          // Replace all
quill.updateContents(delta);       // Apply changes
quill.getHTML();                   // Not built-in, use: quill.root.innerHTML

// Selection
quill.getSelection();              // { index, length }
quill.setSelection(index, length);
quill.focus();
quill.blur();

// Formatting
quill.format('bold', true);        // Apply to selection
quill.formatLine(0, 10, 'header', 1);
quill.removeFormat(0, 10);

// Insert
quill.insertText(index, 'text', { bold: true });
quill.insertEmbed(index, 'image', 'https://...');
quill.insertEmbed(index, 'component-placeholder', { id, type });

// Delete
quill.deleteText(index, length);
```

### Themes

| Theme | Description |
|-------|-------------|
| **Snow** | Classic toolbar above editor |
| **Bubble** | Tooltip-style toolbar on selection |

```javascript
// Snow theme (default)
new Quill('#editor', { theme: 'snow' });

// Bubble theme
new Quill('#editor', { theme: 'bubble' });
```

---

## PDF to HTML Conversion Guidelines

When converting PDF documents to HTML for Quill editing:

### Prompt Template for AI Converters

```
Convert this PDF to HTML using ONLY these elements:

ALLOWED BLOCK ELEMENTS:
- <p> for paragraphs
- <h1> through <h6> for headings
- <ul> and <ol> with <li> for lists
- <blockquote> for quoted text
- <pre> for code blocks

ALLOWED INLINE ELEMENTS:
- <strong> or <b> for bold
- <em> or <i> for italic
- <u> for underline
- <a href=""> for links
- <code> for inline code
- <br> for line breaks

FORBIDDEN (do not use):
- <table>, <tr>, <td>, <th> - describe tables as lists or paragraphs
- <div>, <span> - use semantic elements instead
- style="" attributes - no inline styles
- class="" attributes - no CSS classes
- <font>, <center>, or other deprecated elements

For complex tables: Convert to a structured list or use placeholder {{COMPONENT:TABLE:description}}
For images: Use <img src="base64..." alt="description">
```

### Post-Processing Sanitizer

```javascript
function sanitizeForQuill(html) {
    const allowedTags = [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'strong', 'b', 'em', 'i', 'u', 's',
        'a', 'code', 'pre', 'blockquote',
        'img', 'br'
    ];

    const allowedAttributes = {
        'a': ['href', 'target'],
        'img': ['src', 'alt', 'width', 'height']
    };

    // Use DOMPurify or similar library with this config
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'width', 'height']
    });
}
```

---

## Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────────┐
│                        Content Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────────────┐    │
│  │   PDF   │───>│  Converter   │───>│  Quill-Safe HTML    │    │
│  └─────────┘    │  (AI/Tool)   │    │  + Component Registry│    │
│                 └──────────────┘    └──────────┬──────────┘    │
│                                                 │                │
│                                                 v                │
│                                     ┌─────────────────────┐     │
│                                     │    Quill Editor     │     │
│                                     │  (Edit with         │     │
│                                     │   placeholders)     │     │
│                                     └──────────┬──────────┘     │
│                                                 │                │
│                                                 v                │
│                                     ┌─────────────────────┐     │
│                                     │   Save to Record    │     │
│                                     │  - Content__c       │     │
│                                     │  - Components__c    │     │
│                                     └──────────┬──────────┘     │
│                                                 │                │
│                                                 v                │
│                                     ┌─────────────────────┐     │
│                                     │  Salesforce Viewer  │     │
│                                     │  (Render full HTML  │     │
│                                     │   with components)  │     │
│                                     └─────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Paste Interception for Component Preservation

A key workflow consideration: users may paste content from external sources (Word, Excel, web pages) that contains unsupported elements. The clipboard module can intercept these and convert them to component placeholders automatically.

### Complete Paste Handling Implementation

```javascript
// Component registry (stored in Components__c field)
const componentRegistry = {};

// Helper to generate UUIDs
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Configure Quill with paste interception
const quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
        toolbar: [...],
        clipboard: {
            matchers: [
                // Intercept pasted tables
                ['TABLE', (node, delta) => {
                    const id = generateUUID();
                    componentRegistry[id] = {
                        type: 'TABLE',
                        html: node.outerHTML,
                        created: new Date().toISOString(),
                        source: 'paste'
                    };
                    // Return a Delta that inserts the component placeholder
                    return new Delta().insert({
                        'component-placeholder': { id: id, type: 'TABLE' }
                    });
                }],

                // Intercept styled divs (often from Word)
                ['DIV', (node, delta) => {
                    // Check if it has significant styling
                    if (node.style.cssText || node.className) {
                        const id = generateUUID();
                        componentRegistry[id] = {
                            type: 'STYLED_BLOCK',
                            html: node.outerHTML,
                            created: new Date().toISOString(),
                            source: 'paste'
                        };
                        return new Delta().insert({
                            'component-placeholder': { id: id, type: 'STYLED_BLOCK' }
                        });
                    }
                    // Otherwise, let Quill handle it normally
                    return delta;
                }],

                // Strip style attributes from allowed elements
                [Node.ELEMENT_NODE, (node, delta) => {
                    // Remove inline styles that Quill can't handle
                    if (node.style) {
                        node.removeAttribute('style');
                    }
                    return delta;
                }]
            ]
        }
    }
});
```

### Handling Paste from Different Sources

| Source | Common Issues | Handling Strategy |
|--------|---------------|-------------------|
| **Microsoft Word** | Tables, styled spans, custom fonts, embedded objects | Convert tables to placeholders, strip styles |
| **Microsoft Excel** | Tables with merged cells, formulas shown as text | Convert entire table to placeholder |
| **Web Pages** | Divs, spans, CSS classes, inline styles | Strip classes/styles, convert complex layouts to placeholders |
| **Google Docs** | Spans with inline styles, custom fonts | Strip styles, preserve semantic markup |
| **PDF Copy** | Often loses structure, may have weird spacing | May need manual cleanup |

### User Notification on Paste

```javascript
quill.on('text-change', (delta, oldDelta, source) => {
    if (source === 'user') {
        // Check if any component placeholders were just inserted
        delta.ops.forEach(op => {
            if (op.insert && op.insert['component-placeholder']) {
                const type = op.insert['component-placeholder'].type;
                showToast(`Complex ${type.toLowerCase()} preserved as component`);
            }
        });
    }
});
```

---

## Salesforce Platform Considerations

### Locker Service / Lightning Web Security (LWS)

Salesforce enforces security restrictions on Lightning components:

| Restriction | Impact | Workaround |
|-------------|--------|------------|
| **DOM Isolation** | Can't access other components' DOM | Use events for cross-component communication |
| **iframe srcdoc** | May be blocked or restricted | Use `lightning-formatted-rich-text` instead |
| **eval() / Function()** | Blocked | Pre-compile any dynamic code |
| **Global window access** | Limited | Use Quill's built-in APIs |
| **External scripts** | Must be in static resources | Upload Quill to static resource |

### Loading Quill in LWC

```javascript
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import QUILL from '@salesforce/resourceUrl/quilljs';

async connectedCallback() {
    try {
        await Promise.all([
            loadStyle(this, QUILL + '/quill.snow.css'),
            loadScript(this, QUILL + '/quill.min.js')
        ]);
        // Quill is now available as window.Quill
        this.initializeQuill();
    } catch (error) {
        console.error('Failed to load Quill:', error);
    }
}
```

### Static Resource Structure

```
quilljs.zip/
├── quill.min.js          # Core Quill library
├── quill.snow.css        # Snow theme styles
├── quill.bubble.css      # Bubble theme styles (optional)
└── quill.core.css        # Core styles
```

### Content Security Considerations

```javascript
// Always sanitize before rendering in Salesforce
// lightning-formatted-rich-text does this automatically

// For custom rendering, use DOMPurify
import DOMPurify from 'dompurify';  // Add to static resource

function safeRender(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'img', 'table', 'tr', 'td', 'th', 'br'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'border', 'cellpadding', 'cellspacing']
    });
}
```

### Field Size Limits

| Field Type | Max Size | Use Case |
|------------|----------|----------|
| `Rich Text Area` | 131,072 chars | Standard rich text storage |
| `Long Text Area` | 131,072 chars | HTML storage, component registry JSON |
| `Text Area` | 255 chars | Not suitable for HTML |

For very large documents, consider:
- Storing in Files (ContentVersion)
- Compressing the HTML
- Splitting into chunks with references

---

## Key Constraints for AI Agents

1. **Never assume Quill can render arbitrary HTML** - Always validate against the supported elements list

2. **Preserve complex elements** - Use the placeholder pattern for tables, charts, or custom components

3. **Test round-trip integrity** - Content should survive: Load → Edit → Save → View → Load

4. **Salesforce viewing is permissive** - `lightning-formatted-rich-text` renders most HTML safely

5. **Quill editing is restrictive** - Only Quill-safe elements will survive the edit cycle

6. **When in doubt, simplify** - Convert complex structures to simpler equivalents (tables to lists, styled text to semantic markup)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-25 | Initial documentation |
| 1.1 | 2025-01-25 | Added Custom Blot pattern, Component Editor Dialog, Quill features reference |
| 1.2 | 2025-01-25 | Added Paste Interception patterns, Salesforce platform considerations (Locker Service, LWS, static resources) |

