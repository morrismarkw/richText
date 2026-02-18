# Rich Text Editor Evaluation Project

This project is a Salesforce DX project for testing and comparing the Salesforce standard Rich Text Editor (lightning-input-rich-text) and Quill.js in Lightning Web Components.

## Project Structure

- `force-app/` - Main Salesforce metadata
  - `main/default/lwc/` - Lightning Web Components
    - `richTextEvaluator` - Main evaluator component
    - `editorStandard` - Standard lightning-input-rich-text wrapper
    - `editorQuill` - Quill.js editor integration
    - `editorQuillBlot` - Quill.js with custom blot support
    - `componentEditorDialog` - Dialog for editing embedded components
    - `eventLogPanel` - Panel for logging editor events
  - `main/default/objects/Rich_Text_Document__c/` - Custom object for storing documents
  - `main/default/applications/` - Rich Text Evaluator app
  - `main/default/permissionsets/` - Rich_Text_Editor_User permission set
  - `main/default/flexipages/` - Record page with LWC
- `data/` - Demo data for import

## Deployment Steps

### 1. Deploy Metadata

Deploy the source to your target org:

```bash
sf project deploy start --source-dir force-app --target-org <your-org-alias>
```

### 2. Assign Permission Set

Assign the permission set to your user:

```bash
sf org assign permset --name Rich_Text_Editor_User --target-org <your-org-alias>
```

### 3. Import Demo Data

Import the demo records after deploying the object:

```bash
sf data import tree --files data/Rich_Text_Document__c.json --target-org <your-org-alias>
```

### 4. Activate Lightning Record Page (Manual Step Required)

After deployment, you must activate the Lightning Record Page as the org default:

1. Go to **Setup** > **Lightning App Builder**
2. Find **"Rich Text Document Record Page"** in the list
3. Click the dropdown arrow and select **Edit**
4. Click **Activation** (top right)
5. Select the **Org Default** tab
6. Click **Assign as Org Default**
7. Click **Save**

This step is required for the custom LWC component to display on record pages.

### Full Deployment (All Steps)

Run deployment steps in sequence:

```bash
sf project deploy start --source-dir force-app --target-org <your-org-alias> && \
sf org assign permset --name Rich_Text_Editor_User --target-org <your-org-alias> && \
sf data import tree --files data/Rich_Text_Document__c.json --target-org <your-org-alias>
```

**Note:** After deployment, you must manually activate the record page (see step 4 above).

## Demo Data

The `data/Rich_Text_Document__c.json` file contains 6 test documents:

1. **Basic Formatting Test** - Headings, bold, italic, underline, colors
2. **Tables and Lists Test** - Complex tables, nested lists
3. **Code and Blockquotes** - Code blocks, inline code, blockquotes
4. **Links and Media Elements** - Various link types, media placeholders
5. **Complex Layout Test** - Flexbox layouts, styled components
6. **Edge Cases and Special Characters** - Unicode, emoji, HTML entities

## Notes

- The record page (`Rich_Text_Document_Record_Page`) already includes the `richTextEvaluator` LWC
- The app is named "Rich Text Evaluator" (visible in App Launcher)
- Static resources include: quilljs, ckeditor5, tinymce
