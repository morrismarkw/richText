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

| Element | Quill (Edit) | Quill Blot (Edit) | Salesforce (View) | Notes |
|---------|:------------:|:-----------------:|:-----------------:|-------|
| `<p>` | Yes | Yes | Yes | Paragraph |
| `<h1>` - `<h6>` | Yes | Yes | Yes | Headings |
| `<strong>`, `<b>` | Yes | Yes | Yes | Bold |
| `<em>`, `<i>` | Yes | Yes | Yes | Italic |
| `<u>` | Yes | Yes | Yes | Underline |
| `<s>`, `<strike>` | Yes | Yes | Yes | Strikethrough |
| `<a href="">` | Yes | Yes | Yes | Links |
| `<ul>`, `<ol>`, `<li>` | Yes | Yes | Yes | Lists |
| `<blockquote>` | Yes | Yes | Yes | Basic block quotes |
| `<blockquote style="">` | **No** | **Blot** | Yes | Styled blockquotes → component |
| `<pre>`, `<code>` | Yes | Yes | Yes | Code blocks |
| `<img>` | Yes | Yes | Yes | Images |
| `<br>` | Yes | Yes | Yes | Line breaks |
| `<table>` | **No** | **Blot** | Yes | Tables → component |
| `<div style="">` | **No** | **Blot** | Yes | Styled divs → component |
| `<span style="">` | Partial | Partial | Yes | Colors preserved, others stripped |
| `<hr>` | **No** | **Blot** | Yes | Plain HR stripped, styled → component |
| `<sub>`, `<sup>` | **No** | **No** | Yes | Not supported in Quill |

**Legend:**
- **Yes** = Native support
- **No** = Stripped/lost
- **Blot** = Preserved as component placeholder
- **Partial** = Some styles preserved (color, background)

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
            'STYLED_DIV': '📦',
            'BLOCKQUOTE': '💬',
            'HR': '➖',
            'SIGNATURE': '✍️',
            'CHOICE_FIELD': '☑️',
            'ENTRY_FIELD': '📝',
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

### Quill Configuration Options

When creating a Quill instance, you can configure:

```javascript
const quill = new Quill('#editor', {
    theme: 'snow',           // 'snow' (toolbar) or 'bubble' (tooltip)
    placeholder: 'Enter content here...',
    readOnly: false,         // Disable editing
    formats: [...],          // Whitelist of allowed formats (omit for all)
    modules: {
        toolbar: [...],      // Toolbar configuration
        history: {...},      // Undo/redo settings
        keyboard: {...},     // Custom shortcuts
        clipboard: {...}     // Paste handling
    }
});
```

#### The `formats` Whitelist

**Important**: If you specify a `formats` array, only those formats are allowed. If you omit it entirely, ALL formats are enabled.

```javascript
// RESTRICTED: Only these formats work
formats: ['bold', 'italic', 'link']

// UNRESTRICTED: All formats allowed (recommended for full functionality)
// Simply omit the formats property entirely
```

### Modules (Extensible)

#### Toolbar Module - Complete Configuration

The toolbar is configured as an array of arrays, where each inner array is a button group:

```javascript
const fullToolbarOptions = [
    // Text style dropdowns
    [{ font: [] }],                              // Font family dropdown
    [{ size: ['small', false, 'large', 'huge'] }], // Size dropdown (false = normal)
    [{ header: [1, 2, 3, 4, 5, 6, false] }],     // Header dropdown

    // Inline formatting buttons
    ['bold', 'italic', 'underline', 'strike'],   // Basic formatting
    [{ script: 'sub' }, { script: 'super' }],    // Subscript/superscript

    // Color pickers
    [{ color: [] }, { background: [] }],         // Text color, highlight

    // Block formats
    ['blockquote', 'code-block'],                // Quote, code

    // Lists and indentation
    [{ list: 'ordered' }, { list: 'bullet' }],   // Numbered, bulleted
    [{ indent: '-1' }, { indent: '+1' }],        // Decrease/increase indent

    // Alignment and direction
    [{ align: [] }],                             // Left, center, right, justify
    [{ direction: 'rtl' }],                      // Right-to-left toggle

    // Embeds
    ['link', 'image', 'video'],                  // Insert link, image, video

    // Utility
    ['clean']                                    // Remove formatting
];
```

#### Toolbar Options Reference

| Option | Type | Values | Description |
|--------|------|--------|-------------|
| `font` | dropdown | `[]` = all fonts | Font family selector |
| `size` | dropdown | `['small', false, 'large', 'huge']` | Font size (false = normal) |
| `header` | dropdown | `[1, 2, 3, 4, 5, 6, false]` | Heading levels |
| `bold` | button | - | Bold text |
| `italic` | button | - | Italic text |
| `underline` | button | - | Underlined text |
| `strike` | button | - | Strikethrough text |
| `script` | button | `'sub'` or `'super'` | Subscript/superscript |
| `color` | picker | `[]` = default palette | Text color |
| `background` | picker | `[]` = default palette | Highlight color |
| `blockquote` | button | - | Block quote |
| `code-block` | button | - | Code block |
| `list` | button | `'ordered'` or `'bullet'` | List type |
| `indent` | button | `'-1'` or `'+1'` | Indent level |
| `align` | dropdown | `[]` = all alignments | Text alignment |
| `direction` | button | `'rtl'` | Right-to-left |
| `link` | button | - | Insert/edit link |
| `image` | button | - | Insert image |
| `video` | button | - | Insert video |
| `clean` | button | - | Remove formatting |

#### Enabling/Disabling Toolbar Features

**To enable a feature**: Include it in the toolbar array
**To disable a feature**: Simply omit it from the toolbar array

```javascript
// Minimal toolbar - only basic formatting
const minimalToolbar = [
    ['bold', 'italic', 'underline'],
    ['link']
];

// No color support - omit color and background
const noColorToolbar = [
    ['bold', 'italic'],
    [{ list: 'ordered' }, { list: 'bullet' }]
];

// Custom header levels only
const limitedHeaders = [
    [{ header: [1, 2, false] }]  // Only H1, H2, and normal
];
```

#### Color/Background Style Attributors

**Critical**: To preserve inline color styles when loading content, register the style attributors:

```javascript
const Quill = window.Quill;
const ColorStyle = Quill.import('attributors/style/color');
const BackgroundStyle = Quill.import('attributors/style/background');
Quill.register(ColorStyle, true);
Quill.register(BackgroundStyle, true);

// THEN create the Quill instance
const quill = new Quill('#editor', {...});
```

Without this registration, colors are stored as classes (`ql-color-red`) which don't display outside Quill. With registration, colors are stored as inline styles (`style="color: red"`).

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

## Document Conversion Guidelines

This section covers converting various document formats to Quill-safe HTML.

### Supported Source Formats

| Format | Extension | Approach | Notes |
|--------|-----------|----------|-------|
| **PDF** | .pdf | LLM vision, pdf.js + LLM | Layout extraction is challenging |
| **Word (new)** | .docx | mammoth.js, LLM | DOCX is XML-based, easier to parse |
| **Word (old)** | .doc | Server-side conversion, LLM | Binary format, harder to parse |
| **Rich Text** | .rtf | rtf.js, LLM | Older format, moderate complexity |
| **HTML** | .html | Direct sanitization | Already HTML, just needs cleanup |
| **Markdown** | .md | marked.js, showdown.js | Clean conversion |

---

### DOCX Conversion (Recommended: mammoth.js)

DOCX files are ZIP archives containing XML. mammoth.js extracts and converts cleanly.

```javascript
import mammoth from 'mammoth';

async function convertDocxToQuillSafe(file) {
    const arrayBuffer = await file.arrayBuffer();

    // mammoth converts to clean semantic HTML
    const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
            // Custom style mappings
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Quote'] => blockquote:fresh",
                "r[style-name='Code'] => code"
            ]
        }
    );

    const html = result.value;
    const warnings = result.messages; // Log these for debugging

    // Post-process to extract tables as components
    return extractComponentsFromHtml(html);
}

// Extract tables and other unsupported elements
function extractComponentsFromHtml(html) {
    const registry = {};

    // Replace tables with placeholders
    const processedHtml = html.replace(
        /<table[\s\S]*?<\/table>/gi,
        (match) => {
            const id = generateUUID();
            registry[id] = { type: 'TABLE', html: match };
            return `{{COMPONENT:TABLE:${id}}}`;
        }
    );

    return { html: processedHtml, components: registry };
}
```

### DOC Conversion (Legacy Binary Format)

For .doc files (pre-2007 Word), options are limited:

```javascript
// Option 1: Server-side with LibreOffice
// Requires LibreOffice installed on server
async function convertDocServerSide(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/convert-doc', {
        method: 'POST',
        body: formData
    });

    return response.json(); // { html, components }
}

// Option 2: Use LLM with file upload capability
// See LLM-Based Conversion section below
```

---

### PDF Conversion

PDFs are challenging because they're designed for print layout, not document structure.

**Approaches:**

| Method | Best For | Limitations |
|--------|----------|-------------|
| **LLM Vision** | Complex layouts, tables | Cost, latency |
| **pdf.js + LLM** | Text extraction + AI structuring | Two-step process |
| **pdf-parse** | Simple text PDFs | Loses formatting |

```javascript
// Using pdf.js for text extraction, then LLM for structuring
import * as pdfjsLib from 'pdfjs-dist';

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    // Send to LLM for structuring
    return await structureWithLLM(fullText);
}
```

---

### LLM-Based Conversion (Recommended for Complex Documents)

LLMs excel at understanding document structure and producing clean output. This approach works for any format.

**Conversion Flow:**

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Document   │────>│  LLM Conversion │────>│  Quill-Safe HTML │
│  (any format)│     │  (with prompt)  │     │  + Components    │
└──────────────┘     └─────────────────┘     └──────────────────┘
```

**System Prompt for Document Conversion:**

```
You are a document converter. Convert the provided document to clean HTML
suitable for a rich text editor with LIMITED capabilities.

## OUTPUT FORMAT

Return a JSON object with two properties:
{
    "html": "...",      // Quill-safe HTML content
    "components": {}    // Registry of preserved complex elements
}

## ALLOWED HTML ELEMENTS (use ONLY these)

Block elements:
- <p> for paragraphs
- <h1>, <h2>, <h3>, <h4>, <h5>, <h6> for headings
- <ul>, <ol>, <li> for lists
- <blockquote> for quoted text
- <pre> for code blocks

Inline elements:
- <strong> for bold
- <em> for italic
- <u> for underline
- <s> for strikethrough
- <a href="..."> for links
- <code> for inline code
- <br> for line breaks

Embeds:
- <img src="..." alt="..."> for images

## FORBIDDEN (never use)

- <table>, <tr>, <td>, <th> - see special handling below
- <div>, <span>
- style="" attributes
- class="" attributes
- <font>, <center>, or deprecated elements

## SPECIAL HANDLING FOR TABLES

When you encounter a table:
1. Generate a UUID for it
2. Store the full table HTML in the components registry
3. Insert a placeholder in the main HTML

Example:
- Original has a 3x3 table with sales data
- In "html": include {{COMPONENT:TABLE:abc-123}}
- In "components": { "abc-123": { "type": "TABLE", "html": "<table>...</table>" } }

## SPECIAL HANDLING FOR COMPLEX LAYOUTS

For sidebars, callout boxes, multi-column layouts:
1. If content is simple, flatten to sequential paragraphs
2. If layout is meaningful, preserve as component with type "LAYOUT"

## PRESERVE MEANING, NOT FORMATTING

- Convert font sizes to appropriate heading levels
- Convert colored text to semantic meaning (red warning → <strong>)
- Convert indentation to lists where appropriate
- Keep the document readable and well-structured
```

**LLM Conversion Function:**

```javascript
async function convertWithLLM(document, fileType) {
    const systemPrompt = DOCUMENT_CONVERSION_PROMPT; // Above prompt

    const userMessage = buildUserMessage(document, fileType);

    const response = await callLLM({
        model: 'claude-sonnet-4-20250514', // or gpt-4-vision for images
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 16000
    });

    // Parse the JSON response
    const result = JSON.parse(response.content);

    return {
        html: result.html,
        components: result.components || {}
    };
}

function buildUserMessage(document, fileType) {
    switch (fileType) {
        case 'pdf':
            // For vision models, send as image
            return [
                { type: 'text', text: 'Convert this PDF to HTML:' },
                { type: 'image', source: { type: 'base64', data: document } }
            ];
        case 'docx':
        case 'doc':
            // Extract text first, send as text
            return `Convert this document to HTML:\n\n${document}`;
        case 'html':
            return `Clean and simplify this HTML for Quill editor:\n\n${document}`;
        default:
            return `Convert this content to HTML:\n\n${document}`;
    }
}
```

**Hybrid Approach (Library + LLM):**

```javascript
async function convertDocument(file) {
    const fileType = file.name.split('.').pop().toLowerCase();

    // Step 1: Initial conversion with appropriate library
    let rawContent;
    switch (fileType) {
        case 'docx':
            const mammothResult = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
            rawContent = mammothResult.value;
            break;
        case 'pdf':
            rawContent = await extractPdfText(file);
            break;
        case 'html':
            rawContent = await file.text();
            break;
        default:
            rawContent = await file.text();
    }

    // Step 2: Use LLM to clean up and extract components
    const result = await convertWithLLM(rawContent, 'html');

    // Step 3: Final sanitization pass
    result.html = sanitizeForQuill(result.html);

    return result;
}
```

---

### Post-Processing Sanitizer

Always sanitize as a final safety pass:

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

### Conversion Quality Checklist

| Check | Description |
|-------|-------------|
| ✓ Headings preserved | H1-H6 hierarchy makes sense |
| ✓ Lists intact | Bullet/numbered lists converted properly |
| ✓ Links work | Href attributes present and valid |
| ✓ Images included | Base64 or valid URLs |
| ✓ Tables captured | Stored in component registry |
| ✓ No style attributes | Clean semantic HTML |
| ✓ No divs/spans | Only allowed elements |
| ✓ Readable flow | Document makes sense sequentially |

---

## Architecture Recommendation

```
┌─────────────────────────────────────────────────────────────────┐
│                        Content Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐                                                    │
│  │   PDF   │──┐                                                 │
│  └─────────┘  │                                                 │
│  ┌─────────┐  │  ┌──────────────┐    ┌─────────────────────┐   │
│  │  DOCX   │──┼─>│  Converter   │───>│  Quill-Safe HTML    │   │
│  └─────────┘  │  │ (mammoth.js  │    │  + Component Registry│   │
│  ┌─────────┐  │  │  + LLM)      │    └──────────┬──────────┘   │
│  │   DOC   │──┘  └──────────────┘               │               │
│  └─────────┘                                    │               │
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

## Quill Output Conversion Pattern

Quill produces HTML with its own formatting classes (e.g., `ql-indent-1` for nested lists). These render correctly within Quill but **will not display properly** in standard HTML viewers like Salesforce's `lightning-formatted-rich-text`.

### The Problem: Quill's List Output

**What Quill produces:**
```html
<ul>
    <li>First level item</li>
    <li class="ql-indent-1">Second level item</li>
    <li class="ql-indent-2">Third level item</li>
</ul>
```

**What standard HTML expects:**
```html
<ul>
    <li>First level item
        <ul>
            <li>Second level item
                <ul>
                    <li>Third level item</li>
                </ul>
            </li>
        </ul>
    </li>
</ul>
```

### Solution: Dual Content APIs

Provide two methods on Quill editor components:

| Method | Returns | Use Case |
|--------|---------|----------|
| `getContent()` | Raw Quill HTML | Source tab, debugging, storage |
| `getConvertedContent()` | Standard HTML | Preview, Salesforce display |

### Implementation

```javascript
// In editorQuill.js

@api
getContent() {
    // Returns raw Quill output - preserves ql-* classes
    return this.quillInstance.root.innerHTML;
}

@api
getConvertedContent() {
    // Returns standard HTML - converts Quill classes to inline styles
    const rawContent = this.quillInstance.root.innerHTML;
    return this.convertToStandardHtml(rawContent);
}

// Complete conversion logic
convertToStandardHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Convert Quill classes to inline styles BEFORE removing them
    this.convertAlignmentClasses(temp);  // ql-align-* → text-align style
    this.convertFontClasses(temp);       // ql-font-* → font-family style
    this.convertSizeClasses(temp);       // ql-size-* → font-size style
    this.convertDirectionClasses(temp);  // ql-direction-rtl → dir attribute

    // Convert indented lists to nested structure
    this.convertIndentedLists(temp);     // ql-indent-N → nested <ul>/<ol>

    // Remove remaining Quill-specific classes
    this.removeQuillClasses(temp);

    return temp.innerHTML;
}

// Alignment: ql-align-center → style="text-align: center"
convertAlignmentClasses(container) {
    const alignmentMap = {
        'ql-align-center': 'center',
        'ql-align-right': 'right',
        'ql-align-justify': 'justify'
    };

    Object.entries(alignmentMap).forEach(([className, alignValue]) => {
        container.querySelectorAll(`.${className}`).forEach(el => {
            el.style.textAlign = alignValue;
            el.classList.remove(className);
        });
    });
}

// Font: ql-font-serif → style="font-family: Georgia, serif"
convertFontClasses(container) {
    const fontMap = {
        'ql-font-serif': 'Georgia, Times New Roman, serif',
        'ql-font-monospace': 'Monaco, Courier New, monospace'
    };

    Object.entries(fontMap).forEach(([className, fontValue]) => {
        container.querySelectorAll(`.${className}`).forEach(el => {
            el.style.fontFamily = fontValue;
            el.classList.remove(className);
        });
    });
}

// Size: ql-size-large → style="font-size: 1.5em"
convertSizeClasses(container) {
    const sizeMap = {
        'ql-size-small': '0.75em',
        'ql-size-large': '1.5em',
        'ql-size-huge': '2.5em'
    };

    Object.entries(sizeMap).forEach(([className, sizeValue]) => {
        container.querySelectorAll(`.${className}`).forEach(el => {
            el.style.fontSize = sizeValue;
            el.classList.remove(className);
        });
    });
}

// Direction: ql-direction-rtl → dir="rtl"
convertDirectionClasses(container) {
    container.querySelectorAll('.ql-direction-rtl').forEach(el => {
        el.setAttribute('dir', 'rtl');
        el.classList.remove('ql-direction-rtl');
    });
}

convertIndentedLists(container) {
    const lists = container.querySelectorAll('ul, ol');

    lists.forEach(list => {
        const items = Array.from(list.children).filter(el => el.tagName === 'LI');
        let currentLevel = 0;
        let currentParent = list;
        const parentStack = [{ element: list, level: 0 }];

        items.forEach(item => {
            // Extract indent level from class (safely handle missing className)
            const className = item.className || '';
            const indentMatch = className.match(/ql-indent-(\d+)/);
            const itemLevel = indentMatch ? parseInt(indentMatch[1], 10) : 0;

            // Remove the indent class
            if (itemLevel > 0) {
                item.classList.remove(`ql-indent-${itemLevel}`);
            }

            if (itemLevel > currentLevel) {
                // Nest deeper - create sublists
                for (let i = currentLevel; i < itemLevel; i++) {
                    const newList = document.createElement(list.tagName.toLowerCase());
                    const lastItem = currentParent.lastElementChild;
                    if (lastItem && lastItem.tagName === 'LI') {
                        lastItem.appendChild(newList);
                        parentStack.push({ element: newList, level: i + 1 });
                        currentParent = newList;
                    }
                }
            } else if (itemLevel < currentLevel) {
                // Go back up
                while (parentStack.length > 1 &&
                       parentStack[parentStack.length - 1].level > itemLevel) {
                    parentStack.pop();
                }
                currentParent = parentStack[parentStack.length - 1].element;
            }

            currentLevel = itemLevel;
            if (item.parentElement !== currentParent) {
                currentParent.appendChild(item);
            }
        });
    });
}

removeQuillClasses(container) {
    const elements = container.querySelectorAll('[class*="ql-"]');
    elements.forEach(el => {
        const classes = Array.from(el.classList);
        classes.forEach(cls => {
            if (cls.startsWith('ql-')) {
                el.classList.remove(cls);
            }
        });
        if (el.classList.length === 0) {
            el.removeAttribute('class');
        }
    });
}
```

### Quill Class to Style Conversion Reference

| Quill Class | Converted To | Example Output |
|-------------|--------------|----------------|
| `ql-align-center` | `style="text-align: center"` | `<p style="text-align: center">` |
| `ql-align-right` | `style="text-align: right"` | `<p style="text-align: right">` |
| `ql-align-justify` | `style="text-align: justify"` | `<p style="text-align: justify">` |
| `ql-font-serif` | `style="font-family: Georgia, Times New Roman, serif"` | `<span style="font-family: ...">` |
| `ql-font-monospace` | `style="font-family: Monaco, Courier New, monospace"` | `<span style="font-family: ...">` |
| `ql-size-small` | `style="font-size: 0.75em"` | `<span style="font-size: 0.75em">` |
| `ql-size-large` | `style="font-size: 1.5em"` | `<span style="font-size: 1.5em">` |
| `ql-size-huge` | `style="font-size: 2.5em"` | `<span style="font-size: 2.5em">` |
| `ql-direction-rtl` | `dir="rtl"` attribute | `<p dir="rtl">` |
| `ql-indent-1` | Nested `<ul>` or `<ol>` | `<li><ul><li>nested</li></ul></li>` |
| `ql-indent-2` | Double nested list | Two levels of nesting |
| `ql-syntax` (on `<pre>`) | Inline dark theme styles | `<pre style="background-color: #23241f; color: #f8f8f2; ...">` |
| `style="color: ..."` | Preserved (via attributor) | No conversion needed |
| `style="background: ..."` | Preserved (via attributor) | No conversion needed |

### Content Change Event Pattern

When dispatching content change events, include both versions:

```javascript
quill.on('text-change', (delta, oldDelta, source) => {
    const rawHtml = quill.root.innerHTML;

    this.dispatchEvent(new CustomEvent('contentchange', {
        detail: {
            editor: 'Quill',
            content: rawHtml,                           // Raw for Source tab
            convertedContent: this.convertToStandardHtml(rawHtml)  // For Preview tab
        }
    }));
});
```

### Parent Component Tracking

Track both versions in the parent component:

```javascript
// Tracked properties
@track quillSourceContent = '';    // Raw - for Source tab
@track quillPreviewContent = '';   // Converted - for Preview tab

// Content change handler
handleQuillContentChange(event) {
    const { content, convertedContent } = event.detail;
    this.quillSourceContent = content;
    this.quillPreviewContent = convertedContent || content;
}

// Refresh handlers use appropriate method
handleRefreshSource() {
    this.quillSourceContent = editor.getContent();        // Raw
}

handleRefreshPreview() {
    this.quillPreviewContent = editor.getConvertedContent();  // Converted
}
```

### Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Data Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Database (Standard HTML)                                    │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────┐                                            │
│  │ Load into   │                                            │
│  │ Quill       │                                            │
│  └──────┬──────┘                                            │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────┐     User edits in Quill                    │
│  │   Quill     │     (internal format with ql-* classes)    │
│  │   Editor    │                                            │
│  └──────┬──────┘                                            │
│         │                                                    │
│    ┌────┴────┐                                              │
│    │         │                                              │
│    ▼         ▼                                              │
│ getContent() getConvertedContent()                          │
│    │              │                                         │
│    ▼              ▼                                         │
│ ┌──────────┐  ┌───────────────────┐                        │
│ │ Source   │  │ Preview Tab       │                        │
│ │ Tab      │  │ (lightning-       │                        │
│ │ (raw)    │  │  formatted-rich-  │                        │
│ │          │  │  text)            │                        │
│ └──────────┘  └───────────────────┘                        │
│                                                              │
│ For storage: use getConvertedContent() for portable HTML    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Quill Blot Extension

For `editorQuillBlot`, the conversion happens **after** blot restoration:

```javascript
@api
getContent() {
    // 1. Get raw Quill HTML
    // 2. Restore blot placeholders to original HTML
    let html = this.quillInstance.root.innerHTML;
    html = this.restoreComponents(html);  // Blots → original HTML
    return html;
}

@api
getConvertedContent() {
    // 1. Get raw Quill HTML
    // 2. Restore blots
    // 3. Convert Quill classes to standard HTML
    let html = this.quillInstance.root.innerHTML;
    html = this.restoreComponents(html);
    html = this.convertToStandardHtml(html);
    return html;
}
```

---

## Key Constraints for AI Agents

1. **Never assume Quill can render arbitrary HTML** - Always validate against the supported elements list

2. **Preserve complex elements** - Use the placeholder pattern for tables, charts, or custom components

3. **Test round-trip integrity** - Content should survive: Load → Edit → Save → View → Load

4. **Salesforce viewing is permissive** - `lightning-formatted-rich-text` renders most HTML safely

5. **Quill editing is restrictive** - Only Quill-safe elements will survive the edit cycle

6. **When in doubt, simplify** - Convert complex structures to simpler equivalents (tables to lists, styled text to semantic markup)

---

---

## Component Types Reference

The Quill Blot editor supports these component types for preserving complex elements:

| Type | Icon | Description | Default Display |
|------|------|-------------|-----------------|
| `TABLE` | 📊 | HTML tables with any structure | badge |
| `STYLED_DIV` | 📦 | Divs with flex, background, border-radius | badge |
| `BLOCKQUOTE` | 💬 | Blockquotes with custom styling | badge |
| `HR` | ➖ | Horizontal rules with styling | render |
| `SIGNATURE` | ✍️ | Signature blocks for document signing | preview |
| `CHOICE_FIELD` | ☑️ | Dropdowns, radio buttons, checkboxes | preview |
| `ENTRY_FIELD` | 📝 | Text input fields | preview |
| `CHART` | 📈 | Chart containers | badge |
| `CODE` | 💻 | Complex code blocks | badge |
| `RAW_HTML` | 🔧 | Other preserved HTML | badge |

### Display Modes

Components can be displayed in three modes:

- **badge** - Icon + type label (default for most)
- **render** - Actual HTML rendered inline (good for simple elements)
- **preview** - Custom preview HTML (good for form fields)

### Component API

```javascript
// Insert a custom component
const componentId = editor.insertComponent({
    type: 'SIGNATURE',
    html: '<div class="sig-block">...</div>',
    preview: '<div>✍️ Signature Line</div>',
    displayMode: 'preview'
});

// Update component display
editor.updateComponentDisplay(componentId, 'render');

// Set default display mode for all components
editor.setDefaultDisplayMode('render');
```

---

## Document Converter Specification

For detailed specifications on converting PDF, DOC, and DOCX documents to Quill-compatible HTML, see:

**[CONVERTER_SPECIFICATION.md](./CONVERTER_SPECIFICATION.md)**

This specification covers:
- Quill-native HTML elements
- Component extraction patterns
- Placeholder format
- Display mode configuration
- Conversion examples

---

## Lessons Learned & Implementation Notes

### LWC Textarea Value Binding

**Problem**: The `value` attribute on `<textarea>` doesn't bind reactively in LWC.

**Solution**: Use `renderedCallback` with a pending content pattern:

```javascript
_pendingContent = null;

renderedCallback() {
    if (this._pendingContent !== null && this.isOpen) {
        const textarea = this.template.querySelector('.html-editor');
        if (textarea) {
            textarea.value = this._pendingContent;
            this._pendingContent = null;
        }
    }
}

@api
open(data) {
    this._pendingContent = data.html || '';
    this.isOpen = true;
}
```

### Real-Time Preview Updates

**Problem**: Using `onchange` on textarea only fires on blur, not during typing.

**Solution**: Use `oninput` for real-time updates:

```html
<textarea oninput={handleHtmlChange}></textarea>
```

### Extracting Nested HTML Elements

**Problem**: Regex can't reliably match nested elements like `<div>` containing other `<div>` tags.

**Solution**: Use depth-counting algorithm:

```javascript
extractStyledDivs(html) {
    let depth = 1;
    let pos = startIndex + openTag.length;

    while (depth > 0 && pos < html.length) {
        const openMatch = /<div[\s>]/i.exec(remaining);
        const closeMatch = /<\/div>/i.exec(remaining);

        if (openMatch && openMatch.index < closeMatch.index) {
            depth++;
        } else {
            depth--;
            if (depth === 0) {
                // Found matching closing tag
            }
        }
    }
}
```

### Quill Strips Styled Pre Tags

**Problem**: Quill converts `<pre style="...">` to `<pre class="ql-syntax">`, losing custom styling.

**Solution**: Extract styled pre tags as CODE_BLOCK components before loading into Quill:

```javascript
const STYLED_PRE_PATTERN = /<pre\s+[^>]*style="[^"]*"[^>]*>[\s\S]*?<\/pre>/gi;
```

### Video Responsiveness in Quill

**Problem**: Embedded videos have fixed dimensions.

**Solution**: Add CSS for responsive videos:

```css
:host .ql-video {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
}

:host .ql-editor .ql-video {
    display: block;
    max-width: 100%;
}
```

### Preview Mode for Blots

**Insight**: Showing the actual source HTML as a preview (instead of a badge icon) gives users better context of what the component contains while still protecting it from Quill's processing.

```javascript
_defaultDisplayMode = 'preview';  // Shows source HTML as preview

// When extracting components:
const component = {
    type: 'TABLE',
    html: match,
    preview: match,  // Use source HTML as preview
    displayMode: this._defaultDisplayMode
};
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-25 | Initial documentation |
| 1.1 | 2025-01-25 | Added Custom Blot pattern, Component Editor Dialog, Quill features reference |
| 1.2 | 2025-01-25 | Added Paste Interception patterns, Salesforce platform considerations (Locker Service, LWS, static resources) |
| 1.3 | 2025-01-25 | Expanded Document Conversion: DOCX (mammoth.js), DOC, PDF, LLM-based conversion with system prompts |
| 1.4 | 2025-01-25 | Added Quill Output Conversion Pattern: dual API (getContent/getConvertedContent), ql-indent to nested lists, data flow diagram |
| 1.5 | 2025-01-25 | Added Quill Configuration Options: full toolbar reference, formats whitelist, color attributor registration, enable/disable features. Complete HTML converter: alignment, font, size, direction class conversions |
| 1.6 | 2025-01-26 | Added Component Types Reference (TABLE, STYLED_DIV, BLOCKQUOTE, HR, SIGNATURE, CHOICE_FIELD, ENTRY_FIELD). Added display modes (badge, render, preview). Added Component API documentation. Created separate CONVERTER_SPECIFICATION.md for document conversion |
| 1.7 | 2025-01-26 | Added Lessons Learned section: LWC textarea binding, oninput vs onchange, nested element extraction, styled pre handling, video responsiveness, preview mode insights |

