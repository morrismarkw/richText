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

