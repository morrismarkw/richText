import { LightningElement, api, track, wire } from 'lwc';
import { getRecord, updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import QUILL from '@salesforce/resourceUrl/quilljs';
import Id from '@salesforce/schema/Rich_Text_Document__c.Id';
import CONTENT_FIELD from '@salesforce/schema/Rich_Text_Document__c.Content__c';
import EDITOR_TYPE_FIELD from '@salesforce/schema/Rich_Text_Document__c.Editor_Type__c';
import LAST_EVENT_FIELD from '@salesforce/schema/Rich_Text_Document__c.Last_Editor_Event__c';

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
    quill: 'Quill'
};

export default class RichTextEvaluator extends LightningElement {
    @api recordId;

    @track activeTab = 'standard';
    @track showEventLog = true;
    @track isSaving = false;
    @track showToast = false;
    @track toastMessage = '';
    @track toastVariant = 'success';

    _recordContent = '';
    _recordEditorType = '';
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
        if (standard) standard.setContent(this._recordContent);

        // Push to Quill component
        const quill = this.template.querySelector('c-editor-quill');
        if (quill) quill.setContent(this._recordContent);

        this._contentPushedToEditors = true;
        this.logInternalEvent('content-pushed-all', 'api', {
            contentLength: this._recordContent.length
        });
    }

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [CONTENT_FIELD, EDITOR_TYPE_FIELD, LAST_EVENT_FIELD]
    })
    wiredRecord({ error, data }) {
        if (data) {
            this._recordContent = data.fields.Content__c?.value || '';
            this._recordEditorType = data.fields.Editor_Type__c?.value || 'Standard';

            this.logInternalEvent('record-loaded', 'lifecycle', {
                recordId: this.recordId,
                contentLength: this._recordContent.length,
                editorType: this._recordEditorType
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
            'Quill': 'c-editor-quill'
        };

        const selector = editorMap[editorName];
        if (!selector) return;

        const editor = this.template.querySelector(selector);
        if (editor && typeof editor.setContent === 'function') {
            editor.setContent(this._recordContent);
            this.logInternalEvent('content-pushed', 'api', {
                editor: editorName,
                contentLength: this._recordContent.length,
                trigger: 'editor-ready'
            });
        }
    }

    handleContentChange(event) {
        const { content } = event.detail;
        this._recordContent = content;
    }

    async handleSave() {
        if (!this.recordId) {
            this.showToastMessage('No record to save to', 'error');
            return;
        }

        this.isSaving = true;

        try {
            let content = '';

            // Get content from active editor
            switch (this.activeTab) {
                case 'standard':
                    content = this.template.querySelector('c-editor-standard')?.getContent() || '';
                    break;
                case 'quill':
                    content = this.template.querySelector('c-editor-quill')?.getContent() || '';
                    break;
            }

            const editorType = EDITOR_MAP[this.activeTab];

            const fields = {
                [Id.fieldApiName]: this.recordId,
                [CONTENT_FIELD.fieldApiName]: content,
                [EDITOR_TYPE_FIELD.fieldApiName]: editorType,
                [LAST_EVENT_FIELD.fieldApiName]: `Saved at ${new Date().toISOString()}`
            };

            await updateRecord({ fields });

            this.logInternalEvent('record-saved', 'api', {
                recordId: this.recordId,
                contentLength: content.length,
                editorType
            });

            this.showToastMessage('Document saved successfully', 'success');
        } catch (error) {
            this.logInternalEvent('save-error', 'api', {
                error: error.body?.message || error.message
            });
            this.showToastMessage('Error saving: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isSaving = false;
        }
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

    // ==================== UTILITY ====================

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
