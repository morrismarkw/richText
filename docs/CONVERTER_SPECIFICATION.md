# Document Converter HTML Specification

This specification defines the HTML format that document converters (PDF, DOC, DOCX) should output for compatibility with the Quill Blot editor system.

## Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Source Document│────>│    Converter     │────>│  Quill-Compatible   │
│  (PDF/DOC/DOCX) │     │  (follows spec)  │     │  HTML + Components  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

The converter produces two outputs:
1. **HTML Content** - Quill-native format for editable content
2. **Component Registry** - Preserved complex elements as JSON

---

## Output Format

### JSON Structure

```json
{
    "html": "<p>Document content with {{COMPONENT:TABLE:uuid}} placeholders...</p>",
    "components": {
        "uuid-1234": {
            "type": "TABLE",
            "html": "<table>...</table>",
            "displayMode": "badge",
            "preview": null
        }
    }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `html` | string | Quill-compatible HTML with component placeholders |
| `components` | object | Registry of preserved complex elements keyed by UUID |

### Component Registry Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Component type identifier |
| `html` | string | Yes | Original HTML to restore on output |
| `displayMode` | string | No | How to display in editor: `badge`, `render`, `preview` |
| `preview` | string | No | Custom preview HTML (when displayMode is `preview`) |

---

## Quill-Native Elements

The converter SHOULD output these elements directly in the HTML. Quill handles them natively.

### Block Elements

```html
<!-- Paragraphs -->
<p>Normal paragraph text</p>

<!-- Headings -->
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
<h4>Heading 4</h4>
<h5>Heading 5</h5>
<h6>Heading 6</h6>

<!-- Lists (flat with indent classes) -->
<ul>
    <li>First level item</li>
    <li class="ql-indent-1">Second level item</li>
    <li class="ql-indent-2">Third level item</li>
</ul>

<ol>
    <li>Numbered item</li>
    <li class="ql-indent-1">Nested numbered item</li>
</ol>

<!-- Block quote (basic, no styling) -->
<blockquote>Quoted text</blockquote>

<!-- Code block -->
<pre class="ql-syntax" spellcheck="false">code content here</pre>
```

### Inline Elements

```html
<!-- Text formatting -->
<strong>Bold text</strong>
<em>Italic text</em>
<u>Underlined text</u>
<s>Strikethrough text</s>

<!-- Inline code -->
<code>inline code</code>

<!-- Links -->
<a href="https://example.com" target="_blank">Link text</a>

<!-- Line breaks -->
<br>
```

### Inline Styles (Supported)

```html
<!-- Colors (preserved via style attributors) -->
<span style="color: #ff0000;">Red text</span>
<span style="background-color: #ffff00;">Highlighted text</span>

<!-- Combined -->
<span style="color: #ffffff; background-color: #0000ff;">White on blue</span>
```

### Quill Format Classes

```html
<!-- Alignment -->
<p class="ql-align-center">Centered text</p>
<p class="ql-align-right">Right-aligned text</p>
<p class="ql-align-justify">Justified text</p>

<!-- Font family -->
<span class="ql-font-serif">Serif font</span>
<span class="ql-font-monospace">Monospace font</span>

<!-- Font size -->
<span class="ql-size-small">Small text</span>
<span class="ql-size-large">Large text</span>
<span class="ql-size-huge">Huge text</span>

<!-- Direction -->
<p class="ql-direction-rtl">Right-to-left text</p>

<!-- List indentation -->
<li class="ql-indent-1">Indented list item</li>
<li class="ql-indent-2">Double indented</li>
```

### Embeds

```html
<!-- Images -->
<img src="https://example.com/image.jpg" alt="Description">
<img src="data:image/png;base64,..." alt="Embedded image">

<!-- Video (Quill native) -->
<iframe class="ql-video" src="https://youtube.com/embed/..."></iframe>
```

---

## Component Types (Preserved Elements)

These elements MUST be extracted and stored in the component registry. They cannot be edited directly in Quill.

### TABLE

Tables with any structure or styling.

**Detection**: Any `<table>` element

```html
<!-- Original -->
<table border="1" style="width: 100%;">
    <thead>
        <tr><th>Header 1</th><th>Header 2</th></tr>
    </thead>
    <tbody>
        <tr><td>Cell 1</td><td>Cell 2</td></tr>
    </tbody>
</table>

<!-- Placeholder in HTML -->
{{COMPONENT:TABLE:uuid-1234}}
```

**Registry Entry**:
```json
{
    "type": "TABLE",
    "html": "<table border=\"1\" style=\"width: 100%;\">...</table>",
    "displayMode": "badge"
}
```

---

### STYLED_DIV

Divs with significant styling (layouts, backgrounds, borders).

**Detection**: `<div>` with style containing:
- `display: flex`
- `background` or `background-color` with color value
- `border-radius`

```html
<!-- Original -->
<div style="display: flex; gap: 20px;">
    <div style="flex: 1; background: #f0f7ff; padding: 15px; border-radius: 8px;">
        <h3>Column 1</h3>
        <p>Content here</p>
    </div>
    <div style="flex: 1; background: #f0fff4; padding: 15px; border-radius: 8px;">
        <h3>Column 2</h3>
        <p>More content</p>
    </div>
</div>

<!-- Placeholder -->
{{COMPONENT:STYLED_DIV:uuid-5678}}
```

**Registry Entry**:
```json
{
    "type": "STYLED_DIV",
    "html": "<div style=\"display: flex; gap: 20px;\">...</div>",
    "displayMode": "badge"
}
```

---

### BLOCKQUOTE

Blockquotes with custom styling (borders, backgrounds).

**Detection**: `<blockquote>` with `style` attribute

```html
<!-- Original -->
<blockquote style="border-left: 4px solid #0070d2; padding-left: 15px; color: #666;">
    <p>"The best way to predict the future is to invent it."</p>
    <p>— Alan Kay</p>
</blockquote>

<!-- Placeholder -->
{{COMPONENT:BLOCKQUOTE:uuid-9abc}}
```

**Registry Entry**:
```json
{
    "type": "BLOCKQUOTE",
    "html": "<blockquote style=\"border-left: 4px solid #0070d2;...\">...</blockquote>",
    "displayMode": "badge"
}
```

---

### HR

Horizontal rules with custom styling.

**Detection**: `<hr>` with `style` attribute

```html
<!-- Original -->
<hr style="border: none; border-top: 2px solid #0070d2;">

<!-- Placeholder -->
{{COMPONENT:HR:uuid-def0}}
```

**Registry Entry**:
```json
{
    "type": "HR",
    "html": "<hr style=\"border: none; border-top: 2px solid #0070d2;\">",
    "displayMode": "render"
}
```

**Note**: HR components default to `displayMode: "render"` since they're simple and display well inline.

---

### SIGNATURE

Signature blocks for document signing workflows.

**Detection**: Elements with `data-signature`, `class="signature"`, or similar markers

```html
<!-- Original -->
<div class="signature-block" data-signer="primary" data-required="true">
    <div style="border-bottom: 2px solid #000; width: 250px; margin-top: 40px;"></div>
    <p style="font-size: 10px; margin-top: 4px;">Signature</p>
    <p style="font-size: 10px;">Date: _______________</p>
</div>

<!-- Placeholder -->
{{COMPONENT:SIGNATURE:uuid-1111}}
```

**Registry Entry**:
```json
{
    "type": "SIGNATURE",
    "html": "<div class=\"signature-block\" data-signer=\"primary\">...</div>",
    "displayMode": "preview",
    "preview": "<div style=\"border-bottom: 2px solid #000; width: 200px; padding-top: 40px;\"><span style=\"font-size: 10px;\">Signature: Primary Signer</span></div>"
}
```

---

### CHOICE_FIELD

Selection fields (dropdowns, radio buttons, checkboxes).

**Detection**: Form elements or custom choice markup

```html
<!-- Original -->
<div class="choice-field" data-field-id="status" data-type="dropdown">
    <label>Status:</label>
    <select>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
    </select>
</div>

<!-- Placeholder -->
{{COMPONENT:CHOICE_FIELD:uuid-2222}}
```

**Registry Entry**:
```json
{
    "type": "CHOICE_FIELD",
    "html": "<div class=\"choice-field\" data-field-id=\"status\">...</div>",
    "displayMode": "preview",
    "preview": "<span style=\"padding: 4px 8px; background: #e0e0e0; border-radius: 4px;\">☑️ Status [Dropdown]</span>"
}
```

---

### ENTRY_FIELD

Text input fields for data entry.

**Detection**: Input elements or custom entry markup

```html
<!-- Original -->
<div class="entry-field" data-field-id="company_name" data-type="text">
    <label>Company Name:</label>
    <input type="text" placeholder="Enter company name">
</div>

<!-- Placeholder -->
{{COMPONENT:ENTRY_FIELD:uuid-3333}}
```

**Registry Entry**:
```json
{
    "type": "ENTRY_FIELD",
    "html": "<div class=\"entry-field\" data-field-id=\"company_name\">...</div>",
    "displayMode": "preview",
    "preview": "<span style=\"padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; background: #fff;\">📝 Company Name [Text]</span>"
}
```

---

## Display Modes

Components can be displayed in three modes within the editor:

### badge (Default)

Shows an icon and type label. Best for most components.

```
┌─────────────────────────────────────┐
│ 📊 TABLE    8f2c3d1a...            │
└─────────────────────────────────────┘
```

### render

Renders the actual HTML inline. Best for simple elements like HR.

```
─────────────────────────────────────
```

### preview

Shows custom preview HTML. Best for form fields and signatures.

```
┌─────────────────────────────────────┐
│ ✍️ Signature: Primary Signer        │
│ ________________________________    │
└─────────────────────────────────────┘
```

---

## Placeholder Format

Placeholders in the HTML output use this format:

```
{{COMPONENT:TYPE:UUID}}
```

- `TYPE` - Component type (TABLE, STYLED_DIV, HR, BLOCKQUOTE, SIGNATURE, etc.)
- `UUID` - Unique identifier matching a key in the components registry

**Example**:
```html
<p>Please review the following data:</p>
{{COMPONENT:TABLE:550e8400-e29b-41d4-a716-446655440000}}
<p>Sign below to confirm:</p>
{{COMPONENT:SIGNATURE:6fa459ea-ee8a-3ca4-894e-db77e160355e}}
```

---

## Elements to NEVER Output

These elements will be stripped or corrupted by Quill:

```html
<!-- Generic containers (use semantic elements instead) -->
<div>content</div>
<span>text</span>

<!-- Deprecated elements -->
<font color="red">text</font>
<center>text</center>
<b>text</b>  <!-- Use <strong> -->
<i>text</i>  <!-- Use <em> -->

<!-- Form elements (use CHOICE_FIELD/ENTRY_FIELD components) -->
<input>
<select>
<textarea>
<button>

<!-- Unsupported inline styles on native elements -->
<p style="margin-left: 50px;">indented</p>  <!-- Use ql-indent-N -->
<blockquote style="border-left: 4px solid blue;">  <!-- Use BLOCKQUOTE component -->
```

---

## Conversion Examples

### Simple Document

**Input (DOCX content)**:
```
HEADING: Quarterly Report
PARAGRAPH: Revenue increased by 15% this quarter.
BULLET LIST:
  - Sales: $1.2M
  - Expenses: $800K
  - Profit: $400K
```

**Output**:
```json
{
    "html": "<h1>Quarterly Report</h1><p>Revenue increased by 15% this quarter.</p><ul><li>Sales: $1.2M</li><li>Expenses: $800K</li><li>Profit: $400K</li></ul>",
    "components": {}
}
```

---

### Document with Table

**Input**:
```
HEADING: Sales Data
TABLE:
  | Region | Q1    | Q2    |
  |--------|-------|-------|
  | North  | $500K | $600K |
  | South  | $400K | $450K |
PARAGRAPH: See table above for details.
```

**Output**:
```json
{
    "html": "<h1>Sales Data</h1>{{COMPONENT:TABLE:a1b2c3d4}}<p>See table above for details.</p>",
    "components": {
        "a1b2c3d4": {
            "type": "TABLE",
            "html": "<table><thead><tr><th>Region</th><th>Q1</th><th>Q2</th></tr></thead><tbody><tr><td>North</td><td>$500K</td><td>$600K</td></tr><tr><td>South</td><td>$400K</td><td>$450K</td></tr></tbody></table>",
            "displayMode": "badge"
        }
    }
}
```

---

### Document with Form Fields

**Input**:
```
HEADING: Service Agreement
PARAGRAPH: This agreement is between:
ENTRY_FIELD: Company Name
PARAGRAPH: The undersigned agrees to the terms.
SIGNATURE_BLOCK: Client Signature
```

**Output**:
```json
{
    "html": "<h1>Service Agreement</h1><p>This agreement is between:</p>{{COMPONENT:ENTRY_FIELD:e1f2g3h4}}<p>The undersigned agrees to the terms.</p>{{COMPONENT:SIGNATURE:s1t2u3v4}}",
    "components": {
        "e1f2g3h4": {
            "type": "ENTRY_FIELD",
            "html": "<div class=\"entry-field\" data-field-id=\"company_name\"><input type=\"text\" placeholder=\"Company Name\"></div>",
            "displayMode": "preview",
            "preview": "<span style=\"padding: 4px 8px; border: 1px dashed #999; background: #fafafa;\">📝 Company Name</span>"
        },
        "s1t2u3v4": {
            "type": "SIGNATURE",
            "html": "<div class=\"signature-block\" data-signer=\"client\"><div style=\"border-bottom: 2px solid #000; width: 250px; margin-top: 40px;\"></div><p>Client Signature</p><p>Date: ___________</p></div>",
            "displayMode": "preview",
            "preview": "<div style=\"border-bottom: 2px solid #000; width: 200px; padding-top: 30px;\"><span style=\"font-size: 11px;\">✍️ Client Signature</span></div>"
        }
    }
}
```

---

## Component Type Reference

| Type | Icon | Detection Pattern | Default Display |
|------|------|-------------------|-----------------|
| `TABLE` | 📊 | `<table>` element | badge |
| `STYLED_DIV` | 📦 | `<div style="...flex/background/border-radius...">` | badge |
| `BLOCKQUOTE` | 💬 | `<blockquote style="...">` | badge |
| `HR` | ➖ | `<hr style="...">` | render |
| `SIGNATURE` | ✍️ | Signature markers/classes | preview |
| `CHOICE_FIELD` | ☑️ | Form selection elements | preview |
| `ENTRY_FIELD` | 📝 | Form input elements | preview |
| `CHART` | 📈 | Chart containers | badge |
| `CODE` | 💻 | Complex code blocks | badge |
| `RAW_HTML` | 🔧 | Other preserved HTML | badge |

---

## API Integration

### Quill Blot Editor Methods

```javascript
// Set content from converter output
editor.setContent(converterOutput.html);
// Note: Components are auto-extracted from placeholders

// Or load components separately
Object.entries(converterOutput.components).forEach(([id, component]) => {
    editor.insertComponent({
        type: component.type,
        html: component.html,
        displayMode: component.displayMode,
        preview: component.preview
    });
});

// Set default display mode before loading
editor.setDefaultDisplayMode('render'); // or 'badge', 'preview'

// Get content for storage
const output = {
    html: editor.getContent(),           // With placeholders restored to HTML
    convertedHtml: editor.getConvertedContent()  // Quill classes converted
};
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-26 | Initial specification |

