# Rich Text Editor Evaluation Project

A Salesforce DX project for testing and comparing the Salesforce standard Rich Text Editor (lightning-input-rich-text) and Quill.js in Lightning Web Components.

## Components

- **richTextEvaluator** - Main evaluator component for comparing editors
- **editorStandard** - Wrapper for Salesforce's lightning-input-rich-text
- **editorQuill** - Quill.js editor integration
- **editorQuillBlot** - Quill.js with custom blot support for embedded components
- **componentEditorDialog** - Dialog for editing embedded components
- **eventLogPanel** - Panel for logging editor events

## Installation

### 1. Deploy Metadata

```bash
sf project deploy start --source-dir force-app --target-org <your-org-alias>
```

### 2. Assign Permission Set

```bash
sf org assign permset --name Rich_Text_Editor_User --target-org <your-org-alias>
```

### 3. Import Demo Data

```bash
sf data import tree --files data/Rich_Text_Document__c.json --target-org <your-org-alias>
```

### 4. Activate Lightning Record Page

After deployment, you must activate the Lightning Record Page as the org default:

1. Go to **Setup** > **Lightning App Builder**
2. Find **"Rich Text Document Record Page"** in the list
3. Click the dropdown arrow and select **Edit**
4. Click **Activation** (top right)
5. Select the **Org Default** tab
6. Click **Assign as Org Default**
7. Click **Save**

## Demo Data

The project includes 6 test documents covering various rich text scenarios:

- Basic Formatting (headings, bold, italic, colors)
- Tables and Lists (complex tables, nested lists)
- Code and Blockquotes (code blocks, styled quotes)
- Links and Media Elements (various link types, media placeholders)
- Complex Layout (flexbox layouts, styled components)
- Edge Cases (Unicode, emoji, HTML entities)

## Project Structure

```
force-app/
  main/default/
    lwc/                    # Lightning Web Components
    objects/                # Rich_Text_Document__c custom object
    applications/           # Rich Text Evaluator app
    permissionsets/         # Rich_Text_Editor_User permission set
    flexipages/             # Record page configuration
data/                       # Demo data for import
```

## Resources

- [Salesforce LWC Documentation](https://developer.salesforce.com/docs/component-library/overview/components)
- [Quill.js Documentation](https://quilljs.com/docs/quickstart)
