# Rich Text Editor Evaluator - Rebuild Prompt

Use this prompt to rebuild the Salesforce Rich Text Editor Evaluator application from scratch.

---

## Project Overview

Build a **Salesforce Lightning Web Components (LWC) application** that allows developers to evaluate and compare three different rich text editing approaches side-by-side:

1. **Standard** - Salesforce's native `lightning-input-rich-text` component
2. **Quill** - The Quill.js editor with full features
3. **Quill Blot** - An enhanced Quill implementation with custom Blots that preserve unsupported elements (tables, styled divs, blockquotes, etc.)

The application demonstrates how different editors handle HTML content, particularly focusing on edge cases and unsupported elements.

---

## Architecture

### Custom Object: `Rich_Text_Document__c`

Create a custom object to store rich text documents with these fields:

| Field Name | Type | Description |
|------------|------|-------------|
| Name | Standard | Document title |
| Content__c | Long Text Area (131072) | HTML content |
| Editor_Type__c | Picklist | Values: Standard, Quill, QuillBlot |
| Last_Editor_Event__c | Text (255) | Last event timestamp or status |

### Apex Controller: `RichTextController`

Create an Apex controller with these methods:

```apex
public with sharing class RichTextController {

    @AuraEnabled(cacheable=true)
    public static Rich_Text_Document__c getDocument(Id recordId) {
        // Query document with SECURITY_ENFORCED
        // Return: Name, Content__c, Editor_Type__c, Last_Editor_Event__c,
        //         CreatedDate, LastModifiedDate, CreatedById, LastModifiedById
    }

    @AuraEnabled
    public static Rich_Text_Document__c saveDocument(Id recordId, String content, String editorType) {
        // Update record with content and editor type
        // Log editor event with timestamp
    }

    @AuraEnabled
    public static Rich_Text_Document__c createDocument(String name, String content, String editorType) {
        // Create new document record
    }

    @AuraEnabled(cacheable=true)
    public static List<Rich_Text_Document__c> getRecentDocuments(Integer limitCount) {
        // Return recent documents ordered by LastModifiedDate DESC
    }

    @AuraEnabled
    public static void logEditorEvent(Id recordId, String eventInfo) {
        // Truncate eventInfo to 255 chars and update Last_Editor_Event__c
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDocumentMetrics(Id recordId) {
        // Return: contentLength, wordCount, editorType, hasContent
    }
}
```

---

## Lightning Web Components

### 1. richTextEvaluator (Main Container)

The master evaluation harness that orchestrates all editors.

**Features:**
- Tab-based interface with 5 tabs: Standard, Quill, Quill Blot, Preview, Source
- Load Salesforce record content via wire service
- Track content changes across all three editors independently
- Maintain separate "source" and "converted" content versions for each editor
- Event logging system to capture all editor interactions
- "Dirty" flag to track unsaved changes
- HTML formatting for pretty-printing source code
- Clipboard copy functionality
- Per-editor Load/Inject Sample/Clear operations

**Content Tracking Properties:**
```javascript
// Standard editor
standardContent

// Quill editor
quillSourceContent      // Raw Quill output (with ql-* classes)
quillPreviewContent     // Converted Quill (standard HTML)

// Quill Blot editor
quillBlotSourceContent  // Quill Blot with components restored
quillBlotPreviewContent // Quill Blot converted
```

**Event Handlers:**
- `handleStandardContentChange` - Captures content from standard editor
- `handleQuillContentChange` - Captures both source and converted content
- `handleQuillBlotContentChange` - Captures both source and converted content
- `handleSave` - Saves current editor content to database
- `handleReload` - Reloads content from database

**Tab Actions (per editor):**
- Load from Record - Load content from Salesforce record into this editor
- Inject Sample - Insert sample HTML with various elements
- Clear - Empty the editor content

### 2. editorStandard (Salesforce Standard Editor Wrapper)

Simple wrapper around Salesforce's native `lightning-input-rich-text` component.

**Template:**
```html
<lightning-input-rich-text
    value={content}
    onchange={handleChange}
    placeholder="Enter rich text here...">
</lightning-input-rich-text>
```

**Public API:**
```javascript
@api get content()
@api set content(value)
@api getContent()
@api setContent(html)
@api insertContent(html, position) // position: 'start' | 'end' (no cursor support)
@api focus()
@api blur()

// Capabilities (what this editor can do)
@api get capabilities() {
    return {
        toolbar: false,
        selectionEvents: false,
        clickEvents: false,
        cursorPosition: false
    };
}
```

**Events Dispatched:**
- `contentchange` - `{ content: string }`

### 3. editorQuill (Quill.js Integration)

Integrates Quill.js editor into LWC with full toolbar and HTML conversion.

**Static Resource Required:**
- Upload Quill.js library as static resource named `quilljs`
- Include quill.min.js and quill.snow.css

**Toolbar Configuration:**
```javascript
const TOOLBAR_OPTIONS = [
    [{ font: [] }],
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ script: 'sub' }, { script: 'super' }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ direction: 'rtl' }],
    [{ align: [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean']
];
```

**Critical: Register Style Attributors for Color Preservation:**
```javascript
// Before initializing Quill
const ColorStyle = Quill.import('attributors/style/color');
const BackgroundStyle = Quill.import('attributors/style/background');
Quill.register(ColorStyle, true);
Quill.register(BackgroundStyle, true);
```

**Public API:**
```javascript
@api getContent()           // Returns raw HTML with ql-* classes
@api getConvertedContent()  // Returns converted standard HTML
@api setContent(html)
@api insertContent(html, position) // position: 'cursor' | 'start' | 'end'
@api focus()
@api blur()
@api executeCommand(command, value) // Programmatic formatting
```

**Events Dispatched:**
```javascript
'contentchange'     // { content, convertedContent, source }
'selectionchange'   // { range, oldRange, source }
'focus'             // {}
'blur'              // {}
'paste'             // { text, html }
'keydown'           // { key, code, ctrlKey, shiftKey, altKey, metaKey }
'click'             // { target, blot, index }
'toolbarclick'      // { format, value }
```

**HTML Conversion Methods (Critical):**

Quill uses internal classes (ql-*) that must be converted to inline styles for portability:

```javascript
convertToStandardHtml(html) {
    let result = html;
    result = this.convertAlignmentClasses(result);
    result = this.convertFontClasses(result);
    result = this.convertSizeClasses(result);
    result = this.convertDirectionClasses(result);
    result = this.convertCodeBlocks(result);
    result = this.convertIndentedLists(result);
    result = this.removeQuillClasses(result);
    return result;
}

// Convert ql-align-* to text-align styles
convertAlignmentClasses(html) {
    // ql-align-center → style="text-align: center;"
    // ql-align-right → style="text-align: right;"
    // ql-align-justify → style="text-align: justify;"
}

// Convert ql-font-* to font-family styles
convertFontClasses(html) {
    // ql-font-serif → style="font-family: Georgia, serif;"
    // ql-font-monospace → style="font-family: Monaco, monospace;"
}

// Convert ql-size-* to font-size styles
convertSizeClasses(html) {
    // ql-size-small → style="font-size: 0.75em;"
    // ql-size-large → style="font-size: 1.5em;"
    // ql-size-huge → style="font-size: 2.5em;"
}

// Convert ql-direction-rtl to dir attribute
convertDirectionClasses(html) {
    // ql-direction-rtl → dir="rtl"
}

// Convert Quill code blocks to styled pre elements
convertCodeBlocks(html) {
    // <pre class="ql-syntax"> → <pre style="background-color: #23241f; ...">
}

// CRITICAL: Convert ql-indent-N to nested list structures
convertIndentedLists(html) {
    // Quill uses flat lists with ql-indent-1, ql-indent-2, etc.
    // Convert to proper nested <ul><li><ul><li> structure
    // This is complex - requires parsing and rebuilding list hierarchy
}

// Remove any remaining ql-* classes
removeQuillClasses(html) {
    // Strip class="ql-*" attributes
}
```

### 4. editorQuillBlot (Quill with Component Preservation)

**This is the most complex component.** It extends Quill to preserve unsupported elements using Custom Blots.

**Key Innovation: Component Registry Pattern**

1. Before loading content into Quill, extract unsupported elements
2. Replace them with visual placeholders
3. Store original HTML in a registry
4. When saving, restore original HTML from registry

**Component Types to Preserve:**
```javascript
const COMPONENT_TYPES = {
    TABLE: { icon: '📊', label: 'Table' },
    STYLED_DIV: { icon: '📦', label: 'Styled Container' },
    BLOCKQUOTE: { icon: '💬', label: 'Blockquote' },
    CODE_BLOCK: { icon: '💻', label: 'Code Block' },
    HR: { icon: '➖', label: 'Horizontal Rule' },
    SIGNATURE: { icon: '✍️', label: 'Signature' },
    CHOICE_FIELD: { icon: '☑️', label: 'Choice Field' },
    ENTRY_FIELD: { icon: '📝', label: 'Entry Field' },
    CHART: { icon: '📈', label: 'Chart' },
    RAW_HTML: { icon: '🔧', label: 'Raw HTML' }
};
```

**Detection Patterns:**
```javascript
const TABLE_PATTERN = /<table[\s\S]*?<\/table>/gi;
const HR_PATTERN = /<hr\s+[^>]*style="[^"]*"[^>]*\/?>/gi;
const BLOCKQUOTE_PATTERN = /<blockquote\s+[^>]*style="[^"]*"[^>]*>[\s\S]*?<\/blockquote>/gi;
const STYLED_PRE_PATTERN = /<pre\s+[^>]*style="[^"]*"[^>]*>[\s\S]*?<\/pre>/gi;

// Styled divs need special handling - look for:
// display: flex, background-color with actual color, border-radius
const STYLED_DIV_START_PATTERN = /<div\s+[^>]*style="[^"]*(?:display:\s*flex|background(?:-color)?:\s*(?:#[0-9a-f]|rgb)|border-radius:)[^"]*"[^>]*>/i;
```

**Custom Blot Definition:**
```javascript
// Register custom Blot with Quill
const BlockEmbed = Quill.import('blots/block/embed');

class ComponentPlaceholder extends BlockEmbed {
    static blotName = 'component-placeholder';
    static tagName = 'DIV';
    static className = 'component-placeholder';

    static create(value) {
        const node = super.create();
        node.setAttribute('data-component-id', value.id);
        node.setAttribute('data-component-type', value.type);
        node.setAttribute('data-display-mode', value.displayMode || 'badge');
        node.setAttribute('contenteditable', 'false');

        // Render based on display mode
        if (value.displayMode === 'badge') {
            node.innerHTML = `
                <span class="component-badge">
                    <span class="component-icon">${COMPONENT_TYPES[value.type].icon}</span>
                    <span class="component-label">${COMPONENT_TYPES[value.type].label}</span>
                </span>
            `;
        } else if (value.displayMode === 'render') {
            node.innerHTML = value.html;
        } else if (value.displayMode === 'preview') {
            node.innerHTML = value.preview || value.html;
        }

        return node;
    }

    static value(node) {
        return {
            id: node.getAttribute('data-component-id'),
            type: node.getAttribute('data-component-type'),
            displayMode: node.getAttribute('data-display-mode')
        };
    }
}

Quill.register(ComponentPlaceholder);
```

**Component Registry:**
```javascript
_componentRegistry = new Map();

// Structure:
// 'uuid-1234' → {
//     type: 'TABLE',
//     html: '<table>...</table>',
//     preview: '<table>...</table>',
//     displayMode: 'badge',
//     created: '2025-01-26T...'
// }
```

**Content Processing Flow:**
```javascript
setContent(html) {
    // 1. Extract components from HTML
    const { processedHtml, components } = this.extractComponents(html);

    // 2. Store components in registry
    components.forEach(comp => {
        this._componentRegistry.set(comp.id, comp);
    });

    // 3. Load processed HTML (with placeholders) into Quill
    this.quill.root.innerHTML = processedHtml;
}

getContent() {
    // 1. Get HTML from Quill
    let html = this.quill.root.innerHTML;

    // 2. Restore components from registry
    html = this.restoreComponents(html);

    return html;
}
```

**Extraction Logic:**
```javascript
extractComponents(html) {
    let processedHtml = html;
    const components = [];

    // Extract tables
    processedHtml = processedHtml.replace(TABLE_PATTERN, (match) => {
        const id = generateUUID();
        components.push({ id, type: 'TABLE', html: match, displayMode: 'badge' });
        return `<div class="component-placeholder" data-component-id="${id}" data-component-type="TABLE"></div>`;
    });

    // Extract styled HRs
    processedHtml = processedHtml.replace(HR_PATTERN, (match) => {
        const id = generateUUID();
        components.push({ id, type: 'HR', html: match, displayMode: 'badge' });
        return `<div class="component-placeholder" data-component-id="${id}" data-component-type="HR"></div>`;
    });

    // ... similar for other types

    // Styled divs require depth-counting algorithm (not regex)
    processedHtml = this.extractStyledDivs(processedHtml, components);

    return { processedHtml, components };
}
```

**Styled Div Extraction (Depth-Counting Algorithm):**
```javascript
extractStyledDivs(html, components) {
    // Cannot use regex for nested divs - use character-by-character parsing
    // 1. Find opening <div with styled pattern
    // 2. Count depth (increment on <div, decrement on </div>)
    // 3. Extract when depth returns to 0
    // 4. Replace with placeholder
    // 5. Repeat until no more matches
}
```

**Public API:**
```javascript
@api getContent()           // Returns HTML with components restored
@api getConvertedContent()  // Returns converted standard HTML
@api setContent(html)
@api getComponentRegistry() // Returns Map of all components
@api updateComponent(id, html) // Update component HTML
@api deleteComponent(id)    // Remove component from registry
@api setComponentDisplayMode(id, mode) // 'badge' | 'render' | 'preview'
```

**Events Dispatched:**
- All events from editorQuill, plus:
- `componentclick` - `{ componentId, componentType, componentHtml }`

### 5. eventLogPanel (Event Monitoring Dashboard)

Real-time event tracking system for debugging and analysis.

**Features:**
- Capture up to 500 events with timestamps
- Color-coded by category
- Filter by text, editor name, or category
- Expandable event details (JSON display)
- Export to JSON file
- Copy filtered events to clipboard
- Scroll-to-top on new events

**Event Categories:**
```javascript
const CATEGORIES = {
    interaction: { color: 'blue', label: 'Interaction' },
    content: { color: 'green', label: 'Content' },
    selection: { color: 'purple', label: 'Selection' },
    api: { color: 'orange', label: 'API' },
    lifecycle: { color: 'gray', label: 'Lifecycle' },
    debug: { color: 'red', label: 'Debug' }
};
```

**Event Structure:**
```javascript
{
    id: 'evt-123',
    timestamp: '14:35:22.042',
    editor: 'Quill',          // Which editor
    eventType: 'content-change',
    category: 'content',
    details: { /* varies */ },
    expanded: false
}
```

**Public API:**
```javascript
@api logEvent(editor, eventType, category, details)
@api clearEvents()
@api exportEvents()
```

### 6. componentEditorDialog (Modal for Editing Components)

Modal dialog for editing Quill Blot component HTML directly.

**Template:**
```html
<template if:true={isOpen}>
    <section class="slds-modal slds-fade-in-open">
        <div class="slds-modal__container">
            <header class="slds-modal__header">
                <h2>{componentTypeIcon} Edit {componentTypeLabel}</h2>
                <button class="slds-modal__close" onclick={handleCancel}>×</button>
            </header>
            <div class="slds-modal__content">
                <textarea class="html-editor" onchange={handleHtmlChange}></textarea>
                <div class="preview-panel">
                    <lightning-formatted-rich-text value={previewHtml}></lightning-formatted-rich-text>
                </div>
            </div>
            <footer class="slds-modal__footer">
                <button onclick={handleDelete}>Delete</button>
                <button onclick={handleCancel}>Cancel</button>
                <button onclick={handleSave}>Save</button>
            </footer>
        </div>
    </section>
    <div class="slds-backdrop slds-backdrop_open"></div>
</template>
```

**Public API:**
```javascript
@api open(componentId, componentType, componentHtml)
@api close()
```

**Events Dispatched:**
- `save` - `{ componentId, html }`
- `delete` - `{ componentId }`
- `cancel` - `{}`

---

## Static Resources

### quilljs

Upload Quill.js library (v1.3.7 recommended) as a static resource:

```
quilljs/
├── quill.min.js
├── quill.snow.css
└── quill.bubble.css (optional)
```

---

## Key Implementation Details

### 1. Quill Color Preservation

By default, Quill uses CSS classes for colors. Register style attributors to preserve inline styles:

```javascript
const ColorStyle = Quill.import('attributors/style/color');
const BackgroundStyle = Quill.import('attributors/style/background');
Quill.register(ColorStyle, true);
Quill.register(BackgroundStyle, true);
```

### 2. List Indentation Conversion

Quill outputs flat lists with `ql-indent-N` classes:
```html
<ul>
    <li>Item 1</li>
    <li class="ql-indent-1">Nested item</li>
    <li class="ql-indent-2">Double nested</li>
</ul>
```

Convert to proper nested structure:
```html
<ul>
    <li>Item 1
        <ul>
            <li>Nested item
                <ul>
                    <li>Double nested</li>
                </ul>
            </li>
        </ul>
    </li>
</ul>
```

### 3. Content Dirty Tracking

Track when content has been modified since last save:

```javascript
@track isDirty = false;

handleContentChange(event) {
    this.isDirty = true;
    // ... update content
}

handleSave() {
    // ... save to database
    this.isDirty = false;
}

handleReload() {
    // ... reload from database
    this.isDirty = false;
}
```

### 4. Sample Content for Testing

Provide sample HTML that exercises all editor capabilities:

```html
<h1>Sample Document</h1>
<p>This is <strong>bold</strong> and <em>italic</em> text.</p>
<p style="color: red;">Colored text</p>
<ul>
    <li>List item 1</li>
    <li>List item 2
        <ul>
            <li>Nested item</li>
        </ul>
    </li>
</ul>
<table border="1">
    <tr><td>Cell 1</td><td>Cell 2</td></tr>
</table>
<blockquote style="border-left: 4px solid blue; padding-left: 10px;">
    A styled blockquote
</blockquote>
<hr style="border: 2px dashed red;" />
<div style="display: flex; background-color: #f0f0f0; padding: 10px;">
    A styled container
</div>
```

### 5. HTML Formatting for Display

Pretty-print HTML in the Source tab:

```javascript
formatHtml(html) {
    // Add newlines and indentation for readability
    // Handle self-closing tags
    // Preserve content within <pre> and <code> tags
}
```

---

## Salesforce Configuration

### Permission Set: `Rich_Text_Editor_User`

Grant access to:
- Rich_Text_Document__c object (Read, Create, Edit)
- All fields on Rich_Text_Document__c
- RichTextController Apex class

### Flexible Page

Create a Record Page for Rich_Text_Document__c that embeds the `richTextEvaluator` component.

### Tab

Create a Tab for Rich_Text_Document__c for navigation.

---

## Testing

### Jest Unit Tests

Create tests for each component covering:

1. **editorStandard**
   - Content get/set
   - Event dispatch on change
   - Insert content at start/end

2. **editorQuill**
   - Quill initialization
   - Content get/set
   - HTML conversion methods
   - Event dispatch

3. **editorQuillBlot**
   - Component extraction
   - Component restoration
   - Registry management
   - Nested div extraction

4. **eventLogPanel**
   - Event logging
   - Filtering
   - Export functionality

5. **richTextEvaluator**
   - Wire service integration
   - Tab switching
   - Save/reload functionality
   - Content synchronization

---

## Development Setup

```bash
# Clone and setup
npm install

# Run linting
npm run lint

# Run tests
npm run test

# Deploy to scratch org
sfdx force:source:push

# Open org
sfdx force:org:open
```

---

## Version History

- **v3.24.0** - Add Quill Blot editor with component preservation
- **v3.5.0** - Simplify tab structure - focus on raw component behavior
- Earlier versions included TinyMCE and CKEditor (since removed)

---

## Key Files Reference

```
force-app/main/default/
├── classes/
│   └── RichTextController.cls          # Apex controller
├── lwc/
│   ├── richTextEvaluator/              # Main container (720 lines)
│   ├── editorStandard/                 # Standard editor wrapper (143 lines)
│   ├── editorQuill/                    # Quill integration (596 lines)
│   ├── editorQuillBlot/                # Quill with Blots (901 lines)
│   ├── eventLogPanel/                  # Event monitoring (224 lines)
│   └── componentEditorDialog/          # Component editor modal (86 lines)
├── objects/Rich_Text_Document__c/      # Custom object
├── staticresources/quilljs/            # Quill.js library
└── flexipages/                         # Record page layouts
```
