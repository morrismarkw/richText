import { LightningElement, api, track, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import QUILL from '@salesforce/resourceUrl/quilljs';
import NAME_FIELD from '@salesforce/schema/Rich_Text_Document__c.Name';
import CONTENT_FIELD from '@salesforce/schema/Rich_Text_Document__c.Content__c';

const SAMPLE_CONTENT = `
<h2>Sample Rich Text Content</h2>
<p>This is a <strong>sample document</strong> with various formatting to test the editor capabilities.</p>
<ul>
    <li>First item with <em>italic text</em></li>
    <li>Second item with <u>underlined text</u></li>
    <li>Third item with <a href="https://salesforce.com">a link</a></li>
</ul>
<p>Here is a table:</p>
<table border="1">
    <tr>
        <th>Header 1</th>
        <th>Header 2</th>
    </tr>
    <tr>
        <td>Cell 1</td>
        <td>Cell 2</td>
    </tr>
</table>
<p>And some code: <code>console.log('Hello World');</code></p>
`;

const EDITOR_MAP = {
    standard: 'Standard',
    quill: 'Quill',
    quillblot: 'QuillBlot',
    preview: 'Preview',
    source: 'Source'
};

export default class RichTextEvaluator extends LightningElement {
    @api recordId;

    @track activeTab = 'standard';
    @track showEventLog = true;
    @track isDirty = false;
    @track showToast = false;
    @track toastMessage = '';
    @track toastVariant = 'success';
    @track sourceViewEditor = 'quill'; // Which editor's source to show in Source tab
    @track previewViewEditor = 'source'; // Which editor's content to show in Preview tab (default to original source)

    // Content for each editor (raw = source tab, converted = preview tab)
    @track standardContent = '';  // Standard doesn't need conversion
    @track quillSourceContent = '';  // Raw Quill output for Source tab
    @track quillPreviewContent = '';  // Converted for Preview tab
    @track quillBlotSourceContent = '';  // Raw with blots restored for Source tab
    @track quillBlotPreviewContent = '';  // Converted for Preview tab

    _recordName = '';
    _recordContent = '';
    _contentPushedToEditors = false;
    _hasRendered = false;
    _quillScriptsLoaded = false;

    // ==================== LIFECYCLE ====================

    async connectedCallback() {
        // Load Quill scripts
        try {
            await Promise.all([
                loadStyle(this, QUILL + '/quill.snow.css'),
                loadScript(this, QUILL + '/quill.min.js')
            ]);
            this._quillScriptsLoaded = true;
            this.logInternalEvent('quill-scripts-loaded', 'lifecycle', { success: true });
        } catch (error) {
            this.logInternalEvent('quill-scripts-load-error', 'lifecycle', {
                error: error.message || 'Unknown error'
            });
        }
    }

    renderedCallback() {
        // On first render with content, push to active editor
        if (!this._hasRendered) {
            this._hasRendered = true;

            if (this._recordContent && !this._contentPushedToEditors) {
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => {
                    this.pushContentToAllEditors();
                }, 100);
            }
        }
    }

    // ==================== CONTENT PUSH ====================

    pushContentToAllEditors() {
        if (this._contentPushedToEditors || !this._recordContent) return;

        // Push to Standard
        const standard = this.template.querySelector('c-editor-standard');
        if (standard) {
            standard.setContent(this._recordContent);
            this.standardContent = this._recordContent;
        }

        // Push to Quill component
        const quill = this.template.querySelector('c-editor-quill');
        if (quill) {
            quill.setContent(this._recordContent);
            this.quillSourceContent = this._recordContent;
            this.quillPreviewContent = this._recordContent;
        }

        // Push to Quill Blot component
        const quillBlot = this.template.querySelector('c-editor-quill-blot');
        if (quillBlot) {
            quillBlot.setContent(this._recordContent);
            this.quillBlotSourceContent = this._recordContent;
            this.quillBlotPreviewContent = this._recordContent;
        }

        this._contentPushedToEditors = true;
        this.logInternalEvent('content-pushed-all', 'api', {
            contentLength: this._recordContent.length
        });
    }

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [NAME_FIELD, CONTENT_FIELD]
    })
    wiredRecord({ error, data }) {
        if (data) {
            this._recordName = data.fields.Name?.value || '';
            this._recordContent = data.fields.Content__c?.value || '';

            // Initialize content with record content
            this.standardContent = this._recordContent;
            this.quillSourceContent = this._recordContent;
            this.quillPreviewContent = this._recordContent;
            this.quillBlotSourceContent = this._recordContent;
            this.quillBlotPreviewContent = this._recordContent;

            this.logInternalEvent('record-loaded', 'lifecycle', {
                recordId: this.recordId,
                contentLength: this._recordContent.length
            });

            if (this._hasRendered && !this._contentPushedToEditors) {
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => {
                    this.pushContentToAllEditors();
                }, 100);
            }
        } else if (error) {
            this.logInternalEvent('record-load-error', 'lifecycle', {
                error: error.body?.message || error.message
            });
        }
    }

    // ==================== GETTERS ====================

    get editorContainerClass() {
        return this.showEventLog ? 'editor-container with-log' : 'editor-container full-width';
    }

    get recordName() {
        return this._recordName || 'Rich Text Document';
    }

    get toggleLogLabel() {
        return this.showEventLog ? 'Hide Log' : 'Show Log';
    }

    get toggleLogIcon() {
        return this.showEventLog ? 'utility:chevronright' : 'utility:chevronleft';
    }

    get toastClass() {
        return `custom-toast toast-${this.toastVariant}`;
    }

    get toastIcon() {
        return this.toastVariant === 'success' ? 'utility:success' : 'utility:error';
    }

    get formattedStandardSource() {
        return this.formatHtml(this.standardContent);
    }

    get formattedQuillSource() {
        return this.formatHtml(this.quillSourceContent);
    }

    get sourceOriginalVariant() {
        return this.sourceViewEditor === 'original' ? 'brand' : 'neutral';
    }

    get sourceStandardVariant() {
        return this.sourceViewEditor === 'standard' ? 'brand' : 'neutral';
    }

    get sourceQuillVariant() {
        return this.sourceViewEditor === 'quill' ? 'brand' : 'neutral';
    }

    get sourceQuillBlotVariant() {
        return this.sourceViewEditor === 'quillblot' ? 'brand' : 'neutral';
    }

    get formattedActiveSource() {
        let content;
        if (this.sourceViewEditor === 'original') {
            content = this._recordContent;
        } else if (this.sourceViewEditor === 'standard') {
            content = this.standardContent;
        } else if (this.sourceViewEditor === 'quillblot') {
            content = this.quillBlotSourceContent;
        } else {
            content = this.quillSourceContent;
        }
        return this.formatHtml(content);
    }

    get activeSourceContent() {
        if (this.sourceViewEditor === 'original') {
            return this._recordContent;
        } else if (this.sourceViewEditor === 'standard') {
            return this.standardContent;
        } else if (this.sourceViewEditor === 'quillblot') {
            return this.quillBlotSourceContent;
        }
        return this.quillSourceContent;
    }

    get previewSourceVariant() {
        return this.previewViewEditor === 'source' ? 'brand' : 'neutral';
    }

    get previewStandardVariant() {
        return this.previewViewEditor === 'standard' ? 'brand' : 'neutral';
    }

    get previewQuillVariant() {
        return this.previewViewEditor === 'quill' ? 'brand' : 'neutral';
    }

    get previewQuillBlotVariant() {
        return this.previewViewEditor === 'quillblot' ? 'brand' : 'neutral';
    }

    get quillBlotRegistryCount() {
        const editor = this.template.querySelector('c-editor-quill-blot');
        return editor ? editor.getRegistryCount() : 0;
    }

    get activePreviewContent() {
        if (this.previewViewEditor === 'source') {
            return this._recordContent;  // Original from database - never changes
        } else if (this.previewViewEditor === 'standard') {
            return this.standardContent;
        } else if (this.previewViewEditor === 'quillblot') {
            return this.quillBlotPreviewContent;
        }
        return this.quillPreviewContent;
    }

    // ==================== EVENT HANDLERS ====================

    handleTabSelect(event) {
        const previousTab = this.activeTab;
        this.activeTab = event.target.value;

        this.logInternalEvent('tab-change', 'lifecycle', {
            previousTab,
            newTab: this.activeTab,
            editorName: EDITOR_MAP[this.activeTab]
        });
    }

    handleEditorEvent(event) {
        const { editor, eventType, category, details } = event.detail;

        const eventLog = this.getEventLogPanel();
        if (eventLog) {
            eventLog.logEvent({ editor, eventType, category, details });
        }

        // When an editor signals it's ready, push saved content to it
        if (eventType === 'editor-ready' && this._recordContent) {
            this.pushContentToEditor(editor);
        }
    }

    pushContentToEditor(editorName) {
        const editorMap = {
            'Standard': 'c-editor-standard',
            'Quill': 'c-editor-quill',
            'QuillBlot': 'c-editor-quill-blot'
        };

        const selector = editorMap[editorName];
        if (!selector) return;

        const editor = this.template.querySelector(selector);
        if (editor && typeof editor.setContent === 'function') {
            editor.setContent(this._recordContent);

            // Update content
            if (editorName === 'Standard') {
                this.standardContent = this._recordContent;
            } else if (editorName === 'Quill') {
                this.quillSourceContent = this._recordContent;
                this.quillPreviewContent = this._recordContent;
            } else if (editorName === 'QuillBlot') {
                this.quillBlotSourceContent = this._recordContent;
                this.quillBlotPreviewContent = this._recordContent;
            }

            this.logInternalEvent('content-pushed', 'api', {
                editor: editorName,
                contentLength: this._recordContent.length,
                trigger: 'editor-ready'
            });
        }
    }

    // Separate content change handlers for each editor
    handleStandardContentChange(event) {
        const { content } = event.detail;
        this.standardContent = content;
        this.isDirty = true;
        this.logInternalEvent('content-updated', 'content', { editor: 'Standard', contentLength: content.length });
    }

    handleQuillContentChange(event) {
        const { content, convertedContent } = event.detail;
        this.quillSourceContent = content;  // Raw for Source tab
        this.quillPreviewContent = convertedContent || content;  // Converted for Preview tab
        this.isDirty = true;
        this.logInternalEvent('content-updated', 'content', {
            editor: 'Quill',
            rawLength: content.length,
            convertedLength: (convertedContent || content).length
        });
    }

    handleQuillBlotContentChange(event) {
        const { content, convertedContent, registry } = event.detail;
        this.quillBlotSourceContent = content;  // Raw with blots restored for Source tab
        this.quillBlotPreviewContent = convertedContent || content;  // Converted for Preview tab
        this.isDirty = true;
        this.logInternalEvent('content-updated', 'content', {
            editor: 'QuillBlot',
            rawLength: content.length,
            convertedLength: (convertedContent || content).length,
            registeredComponents: Object.keys(registry || {}).length
        });
    }

    handleReloadAll() {
        if (!this._recordContent) {
            this.showToastMessage('No saved content to reload', 'error');
            return;
        }

        // Reload all editors from original record content
        const standard = this.template.querySelector('c-editor-standard');
        const quill = this.template.querySelector('c-editor-quill');
        const quillBlot = this.template.querySelector('c-editor-quill-blot');

        if (standard) {
            standard.setContent(this._recordContent);
            this.standardContent = this._recordContent;
        }
        if (quill && quill.getIsLoaded()) {
            quill.setContent(this._recordContent);
            this.quillSourceContent = this._recordContent;
            this.quillPreviewContent = this._recordContent;
        }
        if (quillBlot && quillBlot.getIsLoaded()) {
            quillBlot.setContent(this._recordContent);
            this.quillBlotSourceContent = this._recordContent;
            this.quillBlotPreviewContent = this._recordContent;
        }

        this.isDirty = false;
        this.logInternalEvent('content-reloaded-all', 'api', {
            contentLength: this._recordContent.length
        });
        this.showToastMessage('All editors reloaded from saved content', 'success');
    }

    handleToggleLog() {
        this.showEventLog = !this.showEventLog;
        this.logInternalEvent('log-toggled', 'lifecycle', { visible: this.showEventLog });
    }

    // ==================== STANDARD TAB ACTIONS ====================

    handleStandardLoad() {
        const editor = this.template.querySelector('c-editor-standard');
        if (editor && this._recordContent) {
            editor.setContent(this._recordContent);
            this.standardContent = this._recordContent;
            this.logInternalEvent('content-loaded', 'api', { editor: 'Standard', contentLength: this._recordContent.length });
            this.showToastMessage('Content loaded', 'success');
        } else if (!this._recordContent) {
            this.showToastMessage('No saved content to load', 'error');
        }
    }

    handleStandardInject() {
        const editor = this.template.querySelector('c-editor-standard');
        if (editor) {
            editor.insertContent(SAMPLE_CONTENT, 'end');
            this.logInternalEvent('sample-injected', 'api', { editor: 'Standard' });
        }
    }

    handleStandardClear() {
        const editor = this.template.querySelector('c-editor-standard');
        if (editor) {
            editor.setContent('');
            this.standardContent = '';
            this.logInternalEvent('content-cleared', 'api', { editor: 'Standard' });
        }
    }

    handleStandardCopy() {
        const editor = this.template.querySelector('c-editor-standard');
        if (editor) {
            this.copyToClipboard(editor.getContent(), 'Standard');
        }
    }

    // ==================== QUILL TAB ACTIONS ====================

    handleQuillLoad() {
        const editor = this.template.querySelector('c-editor-quill');
        if (editor && this._recordContent) {
            editor.setContent(this._recordContent);
            this.quillSourceContent = this._recordContent;
            this.quillPreviewContent = this._recordContent;
            this.logInternalEvent('content-loaded', 'api', { editor: 'Quill', contentLength: this._recordContent.length });
            this.showToastMessage('Content loaded', 'success');
        } else if (!this._recordContent) {
            this.showToastMessage('No saved content to load', 'error');
        } else {
            this.showToastMessage('Quill editor is still loading...', 'error');
        }
    }

    handleQuillInject() {
        const editor = this.template.querySelector('c-editor-quill');
        if (editor && editor.getIsLoaded()) {
            editor.insertContent(SAMPLE_CONTENT, 'end');
            this.logInternalEvent('sample-injected', 'api', { editor: 'Quill' });
        } else {
            this.showToastMessage('Quill editor is still loading...', 'error');
        }
    }

    handleQuillClear() {
        const editor = this.template.querySelector('c-editor-quill');
        if (editor && editor.getIsLoaded()) {
            editor.setContent('');
            this.quillSourceContent = '';
            this.quillPreviewContent = '';
            this.logInternalEvent('content-cleared', 'api', { editor: 'Quill' });
        } else {
            this.showToastMessage('Quill editor is still loading...', 'error');
        }
    }

    handleQuillCopy() {
        const editor = this.template.querySelector('c-editor-quill');
        if (editor && editor.getIsLoaded()) {
            this.copyToClipboard(editor.getContent(), 'Quill');
        } else {
            this.showToastMessage('Quill editor is still loading...', 'error');
        }
    }

    // ==================== QUILL BLOT TAB ACTIONS ====================

    handleQuillBlotLoad() {
        const editor = this.template.querySelector('c-editor-quill-blot');
        if (editor && this._recordContent) {
            editor.setContent(this._recordContent);
            this.quillBlotSourceContent = this._recordContent;
            this.quillBlotPreviewContent = this._recordContent;
            this.logInternalEvent('content-loaded', 'api', {
                editor: 'QuillBlot',
                contentLength: this._recordContent.length
            });
            this.showToastMessage('Content loaded', 'success');
        } else if (!this._recordContent) {
            this.showToastMessage('No saved content to load', 'error');
        } else {
            this.showToastMessage('Quill Blot editor is still loading...', 'error');
        }
    }

    handleQuillBlotInject() {
        const editor = this.template.querySelector('c-editor-quill-blot');
        if (editor && editor.getIsLoaded()) {
            editor.insertContent(SAMPLE_CONTENT, 'end');
            this.logInternalEvent('sample-injected', 'api', { editor: 'QuillBlot' });
        } else {
            this.showToastMessage('Quill Blot editor is still loading...', 'error');
        }
    }

    handleQuillBlotClear() {
        const editor = this.template.querySelector('c-editor-quill-blot');
        if (editor && editor.getIsLoaded()) {
            editor.setContent('');
            this.quillBlotSourceContent = '';
            this.quillBlotPreviewContent = '';
            this.logInternalEvent('content-cleared', 'api', { editor: 'QuillBlot' });
        } else {
            this.showToastMessage('Quill Blot editor is still loading...', 'error');
        }
    }

    // ==================== PREVIEW TAB ACTIONS ====================

    handlePreviewSelectSource() {
        this.previewViewEditor = 'source';
        this.logInternalEvent('preview-view-changed', 'interaction', { editor: 'Source (Original)' });
    }

    handlePreviewSelectStandard() {
        this.previewViewEditor = 'standard';
        this.logInternalEvent('preview-view-changed', 'interaction', { editor: 'Standard' });
    }

    handlePreviewSelectQuill() {
        this.previewViewEditor = 'quill';
        this.logInternalEvent('preview-view-changed', 'interaction', { editor: 'Quill' });
    }

    handlePreviewSelectQuillBlot() {
        this.previewViewEditor = 'quillblot';
        this.logInternalEvent('preview-view-changed', 'interaction', { editor: 'QuillBlot' });
    }

    handleRefreshPreview() {
        const standardEditor = this.template.querySelector('c-editor-standard');
        const quillEditor = this.template.querySelector('c-editor-quill');
        const quillBlotEditor = this.template.querySelector('c-editor-quill-blot');

        // Preview uses converted content for proper rendering
        // Trim to prevent whitespace accumulation
        if (standardEditor) {
            this.standardContent = (standardEditor.getContent() || '').trim();
        }
        if (quillEditor && quillEditor.getIsLoaded()) {
            this.quillPreviewContent = (quillEditor.getConvertedContent() || '').trim();
        }
        if (quillBlotEditor && quillBlotEditor.getIsLoaded()) {
            this.quillBlotPreviewContent = (quillBlotEditor.getConvertedContent() || '').trim();
        }

        this.logInternalEvent('preview-refreshed', 'api', {
            editor: this.previewViewEditor
        });
        this.showToastMessage('Preview refreshed', 'success');
    }

    // ==================== SOURCE TAB ACTIONS ====================

    handleSourceSelectOriginal() {
        this.sourceViewEditor = 'original';
        this.logInternalEvent('source-view-changed', 'interaction', { editor: 'Original' });
    }

    handleSourceSelectStandard() {
        this.sourceViewEditor = 'standard';
        this.logInternalEvent('source-view-changed', 'interaction', { editor: 'Standard' });
    }

    handleSourceSelectQuill() {
        this.sourceViewEditor = 'quill';
        this.logInternalEvent('source-view-changed', 'interaction', { editor: 'Quill' });
    }

    handleSourceSelectQuillBlot() {
        this.sourceViewEditor = 'quillblot';
        this.logInternalEvent('source-view-changed', 'interaction', { editor: 'QuillBlot' });
    }

    handleCopyActiveSource() {
        const content = this.activeSourceContent;
        const editorNames = { standard: 'Standard', quill: 'Quill', quillblot: 'Quill Blot' };
        const editorName = editorNames[this.sourceViewEditor] || 'Unknown';
        this.copyToClipboard(content, `${editorName} Source`);
    }

    handleRefreshSource() {
        // Refresh source from all editors (raw content)
        // Trim to prevent whitespace accumulation
        const standardEditor = this.template.querySelector('c-editor-standard');
        const quillEditor = this.template.querySelector('c-editor-quill');
        const quillBlotEditor = this.template.querySelector('c-editor-quill-blot');

        if (standardEditor) {
            this.standardContent = (standardEditor.getContent() || '').trim();
        }
        if (quillEditor && quillEditor.getIsLoaded()) {
            this.quillSourceContent = (quillEditor.getContent() || '').trim();
        }
        if (quillBlotEditor && quillBlotEditor.getIsLoaded()) {
            this.quillBlotSourceContent = (quillBlotEditor.getContent() || '').trim();
        }

        this.logInternalEvent('source-refreshed', 'api', {
            standardLength: this.standardContent?.length || 0,
            quillLength: this.quillSourceContent?.length || 0,
            quillBlotLength: this.quillBlotSourceContent?.length || 0
        });
        this.showToastMessage('Source refreshed', 'success');
    }

    // ==================== UTILITY ====================

    formatHtml(html) {
        if (!html) return '(empty)';

        // Simple HTML formatter - add newlines and indentation
        let formatted = html;
        const indent = '  ';
        let indentLevel = 0;

        // Add newlines before and after tags
        formatted = formatted
            // Remove existing whitespace between tags
            .replace(/>\s+</g, '><')
            // Add newline before opening tags (except inline tags)
            .replace(/<(?!\/?(span|strong|em|b|i|u|a|code|br)[ >])/gi, '\n<')
            // Add newline after closing tags (except inline tags)
            .replace(/<\/((?!span|strong|em|b|i|u|a|code)[^>]+)>/gi, '</$1>\n');

        // Process line by line to add indentation
        const lines = formatted.split('\n').filter(line => line.trim());
        const result = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Decrease indent for closing tags
            if (trimmed.startsWith('</')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // Add the line with current indentation
            result.push(indent.repeat(indentLevel) + trimmed);

            // Increase indent for opening tags (that aren't self-closing)
            if (trimmed.match(/^<[^\/!][^>]*[^\/]>$/) && !trimmed.match(/^<(br|hr|img|input|meta|link)/i)) {
                indentLevel++;
            }

            // Handle self-closing tags or tags that open and close on same line
            if (trimmed.match(/<[^>]+>.*<\/[^>]+>/)) {
                // Tag opens and closes on same line, no indent change
            }
        }

        return result.join('\n');
    }

    copyToClipboard(content, editorName) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(content)
                .then(() => {
                    this.showToastMessage('HTML copied to clipboard', 'success');
                    this.logInternalEvent('html-copied', 'api', { editor: editorName, contentLength: content.length });
                })
                .catch(err => {
                    this.showToastMessage('Failed to copy: ' + err.message, 'error');
                });
        } else {
            this.showToastMessage('Clipboard API not available', 'error');
        }
    }

    getEventLogPanel() {
        return this.template.querySelector('c-event-log-panel');
    }

    logInternalEvent(eventType, category, details) {
        const eventLog = this.getEventLogPanel();
        if (eventLog) {
            eventLog.logEvent({ editor: 'System', eventType, category, details });
        }
    }

    showToastMessage(message, variant) {
        this.toastMessage = message;
        this.toastVariant = variant;
        this.showToast = true;

        this.dispatchEvent(new ShowToastEvent({
            title: variant === 'success' ? 'Success' : 'Error',
            message,
            variant
        }));

        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.showToast = false;
        }, 3000);
    }
}
