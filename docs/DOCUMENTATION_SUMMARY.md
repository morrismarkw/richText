# Documentation Summary

This document provides an overview of all documentation files in this project.

---

## 1. README.md - Basic Project Setup

- Salesforce DX project setup
- Deployment models
- Configuration (`sfdx-project.json`)
- Links to Salesforce documentation resources

---

## 2. docs/RICH_TEXT_EDITOR_GUIDE.md - Comprehensive Editor Guide (1,776 lines)

### Editor Comparison

- Salesforce Standard (`lightning-input-rich-text`) capabilities/limitations
- Quill.js capabilities/limitations
- Quill Blot custom implementation
- Supported elements matrix

### Quill-Safe HTML Specification

- Allowed elements (p, h1-h6, lists, formatting)
- Forbidden elements (tables, divs, spans, hr)

### Component Placeholder Pattern

- Registry-based preservation of unsupported elements
- Placeholder format: `{{COMPONENT:TYPE:UUID}}`
- Custom Blot implementation
- Component editor dialog architecture

### Quill Features Reference

- Delta format
- Module configuration (toolbar, keyboard, clipboard, history)
- Complete toolbar options reference
- Events API
- Color/background style attributors

### Document Conversion

- PDF, DOCX, DOC conversion approaches
- LLM-based conversion with system prompts
- mammoth.js for DOCX
- Hybrid library + LLM approach

### Quill Output Conversion

- `getContent()` vs `getConvertedContent()` dual API
- Converting `ql-*` classes to inline styles
- Nested list conversion algorithm
- Data flow diagrams

### Salesforce Platform Considerations

- Locker Service / LWS restrictions
- Loading external scripts via static resources
- Field size limits

### Lessons Learned

- LWC textarea binding patterns
- `oninput` vs `onchange`
- Nested HTML extraction algorithms
- Preview mode insights

---

## 3. docs/CONVERTER_SPECIFICATION.md - Converter Output Format (606 lines)

### Output Format

- JSON structure: `{ html, components }`
- Component registry entry fields

### Quill-Native Elements

- Block elements (p, h1-h6, lists, blockquote, pre)
- Inline elements (strong, em, u, s, code, a)
- Quill format classes (ql-align, ql-font, ql-size, ql-indent)
- Embeds (img, video)

### Component Types

- TABLE - Detection and placeholder format
- STYLED_DIV - Flex/background/border-radius detection
- BLOCKQUOTE - Styled blockquotes
- HR - Styled horizontal rules
- SIGNATURE - Signature blocks
- CHOICE_FIELD - Form selections
- ENTRY_FIELD - Text inputs
- CHART, CODE, RAW_HTML

### Display Modes

- badge (icon + label)
- render (actual HTML)
- preview (custom preview)

### Conversion Examples

- Simple documents
- Documents with tables
- Documents with form fields

---

## 4. REBUILD_PROMPT.md - Application Rebuild Guide (764 lines)

### Architecture

- `Rich_Text_Document__c` custom object schema
- `RichTextController` Apex methods

### LWC Components

- `richTextEvaluator` - Main container with tabs
- `editorStandard` - Salesforce native wrapper
- `editorQuill` - Quill.js integration
- `editorQuillBlot` - Custom Blot implementation
- `eventLogPanel` - Event monitoring
- `componentEditorDialog` - Component editing modal

### Implementation Details

- Color preservation with style attributors
- List indentation conversion
- Content dirty tracking
- Sample content for testing
- HTML formatting utilities

### Salesforce Configuration

- Permission set setup
- Flexible page creation
- Tab configuration

### Testing

- Jest unit test requirements per component

---

## Quick Topic Index

| Topic                                    | File                       |
| ---------------------------------------- | -------------------------- |
| Editor capabilities comparison           | RICH_TEXT_EDITOR_GUIDE.md  |
| Quill toolbar configuration              | RICH_TEXT_EDITOR_GUIDE.md  |
| Document conversion (PDF/DOCX)           | RICH_TEXT_EDITOR_GUIDE.md  |
| Quill class → inline style conversion    | RICH_TEXT_EDITOR_GUIDE.md  |
| Component types (TABLE, SIGNATURE, etc.) | CONVERTER_SPECIFICATION.md |
| Converter JSON output format             | CONVERTER_SPECIFICATION.md |
| LWC component structure                  | REBUILD_PROMPT.md          |
| Apex controller methods                  | REBUILD_PROMPT.md          |
| Custom Blot implementation               | REBUILD_PROMPT.md          |
| Jest testing requirements                | REBUILD_PROMPT.md          |

---

## File Locations

```
richText/
├── README.md                           # Basic project setup
├── REBUILD_PROMPT.md                   # Application rebuild guide
└── docs/
    ├── DOCUMENTATION_SUMMARY.md        # This file
    ├── RICH_TEXT_EDITOR_GUIDE.md       # Comprehensive editor guide
    └── CONVERTER_SPECIFICATION.md      # Converter output format
```
