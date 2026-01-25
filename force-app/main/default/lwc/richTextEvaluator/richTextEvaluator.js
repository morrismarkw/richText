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
    quill: 'Quill',
    cinline: 'cInline',
    ccomponent: 'cComponent'
};

export default class RichTextEvaluator extends LightningElement {
    @api recordId;

    @track activeTab = 'standard';
    @track showEventLog = true;
    @track isSaving = false;
    @track showToast = false;
    @track toastMessage = '';
    @track toastVariant = 'success';

    // cInline (Custom Inline) editor state
    @track customCharCount = 0;
    @track customWordCount = 0;
    @track customSelectionInfo = '';

    _recordContent = '';
    _recordEditorType = '';
    _customLastContent = '';
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
            console.log('[RichTextEvaluator] Quill scripts loaded');
        } catch (error) {
            console.error('[RichTextEvaluator] Failed to load Quill:', error);
        }
    }

    renderedCallback() {
        // On first render with content, push to active editor
        if (!this._hasRendered) {
            this._hasRendered = true;

            if (this._recordContent && !this._contentPushedToEditors) {
                console.log('[renderedCallback] First render with content, pushing to editors');
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

        console.log('[pushContentToAllEditors] Pushing content to all editors');

        // Push to Standard
        const standard = this.template.querySelector('c-editor-standard');
        if (standard) standard.setContent(this._recordContent);

        // Push to Quill component
        const quill = this.template.querySelector('c-editor-quill');
        if (quill) quill.setContent(this._recordContent);

        // Push to cComponent (Custom component)
        const ccomponent = this.template.querySelector('c-editor-custom');
        if (ccomponent) ccomponent.setContent(this._recordContent);

        // cInline will get content when tab is selected
        const cinline = this.template.querySelector('.custom-editor-content');
        if (cinline) {
            cinline.innerHTML = this._recordContent;
            this._customLastContent = this._recordContent;
            this.updateCustomCounts();
        }

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
                console.log('[wiredRecord] Already rendered, pushing content to editors');
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

        console.log('[handleTabSelect] Tab changed:', previousTab, '->', this.activeTab);

        this.logInternalEvent('tab-change', 'lifecycle', {
            previousTab,
            newTab: this.activeTab,
            editorName: EDITOR_MAP[this.activeTab]
        });

        // Push content to cInline if switching to that tab
        if (this.activeTab === 'cinline' && this._recordContent) {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                const el = this.template.querySelector('.custom-editor-content');
                if (el && !el.innerHTML.trim()) {
                    el.innerHTML = this._recordContent;
                    this._customLastContent = this._recordContent;
                    this.updateCustomCounts();
                }
            }, 50);
        }
    }

    handleEditorEvent(event) {
        const { editor, eventType, category, details } = event.detail;

        const eventLog = this.getEventLogPanel();
        if (eventLog) {
            eventLog.logEvent({ editor, eventType, category, details });
        }

        // When an editor signals it's ready, push saved content to it
        if (eventType === 'editor-ready' && this._recordContent) {
            console.log(`[handleEditorEvent] ${editor} is ready, pushing saved content`);
            this.pushContentToEditor(editor);
        }
    }

    pushContentToEditor(editorName) {
        const editorMap = {
            'Standard': 'c-editor-standard',
            'Quill': 'c-editor-quill',
            'Component': 'c-editor-custom'
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
                case 'cinline':
                    content = this.template.querySelector('.custom-editor-content')?.innerHTML || '';
                    break;
                case 'ccomponent':
                    content = this.template.querySelector('c-editor-custom')?.getContent() || '';
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

    // ==================== CINLINE TAB ACTIONS ====================

    handleCInlineLoad() {
        const el = this.template.querySelector('.custom-editor-content');
        if (el && this._recordContent) {
            el.innerHTML = this._recordContent;
            this._customLastContent = this._recordContent;
            this.updateCustomCounts();
            this.logInternalEvent('content-loaded', 'api', { editor: 'cInline', contentLength: this._recordContent.length });
            this.showToastMessage('Content loaded', 'success');
        } else if (!this._recordContent) {
            this.showToastMessage('No saved content to load', 'error');
        }
    }

    handleCInlineInject() {
        const el = this.template.querySelector('.custom-editor-content');
        if (el) {
            el.innerHTML += SAMPLE_CONTENT;
            this.updateCustomCounts();
            this.logInternalEvent('sample-injected', 'api', { editor: 'cInline' });
        }
    }

    handleCInlineClear() {
        const el = this.template.querySelector('.custom-editor-content');
        if (el) {
            el.innerHTML = '<p><br></p>';
            this.updateCustomCounts();
            this.logInternalEvent('content-cleared', 'api', { editor: 'cInline' });
        }
    }

    handleCInlineCopy() {
        const el = this.template.querySelector('.custom-editor-content');
        if (el) {
            this.copyToClipboard(el.innerHTML, 'CInline');
        }
    }

    // ==================== cCOMPONENT TAB ACTIONS ====================

    handleCComponentLoad() {
        const editor = this.template.querySelector('c-editor-custom');
        if (editor && this._recordContent) {
            editor.setContent(this._recordContent);
            this.logInternalEvent('content-loaded', 'api', { editor: 'cComponent', contentLength: this._recordContent.length });
            this.showToastMessage('Content loaded', 'success');
        } else if (!this._recordContent) {
            this.showToastMessage('No saved content to load', 'error');
        }
    }

    handleCComponentInject() {
        const editor = this.template.querySelector('c-editor-custom');
        if (editor) {
            editor.insertContent(SAMPLE_CONTENT, 'end');
            this.logInternalEvent('sample-injected', 'api', { editor: 'cComponent' });
        }
    }

    handleCComponentClear() {
        const editor = this.template.querySelector('c-editor-custom');
        if (editor) {
            editor.setContent('');
            this.logInternalEvent('content-cleared', 'api', { editor: 'cComponent' });
        }
    }

    handleCComponentCopy() {
        const editor = this.template.querySelector('c-editor-custom');
        if (editor) {
            this.copyToClipboard(editor.getContent(), 'CComponent');
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

    // ==================== CINLINE CUSTOM EDITOR HANDLERS ====================

    getCustomEditorElement() {
        return this.template.querySelector('.custom-editor-content');
    }

    handleCustomCommand(event) {
        const cmd = event.currentTarget.dataset.cmd;
        const value = event.currentTarget.dataset.value || null;
        if (!cmd) return;

        const editor = this.getCustomEditorElement();
        if (editor) editor.focus();

        const success = document.execCommand(cmd, false, value);
        this.logCustomEvent('command', 'interaction', { command: cmd, value, success });
        this.updateCustomCounts();
    }

    handleCustomHeading(event) {
        const value = event.target.value;
        const editor = this.getCustomEditorElement();
        if (editor) editor.focus();

        document.execCommand('formatBlock', false, value || 'p');
        event.target.value = '';
        this.logCustomEvent('heading-change', 'content', { heading: value || 'p' });
    }

    handleCustomInsertLink() {
        const url = prompt('Enter URL:');
        if (url) {
            const editor = this.getCustomEditorElement();
            if (editor) editor.focus();
            document.execCommand('createLink', false, url);
            this.logCustomEvent('link-inserted', 'content', { url });
        }
    }

    handleCustomKeyDown(event) {
        this.logCustomEvent('keydown', 'interaction', {
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey
        });

        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'b':
                    event.preventDefault();
                    document.execCommand('bold', false, null);
                    this.logCustomEvent('shortcut', 'interaction', { shortcut: 'Ctrl+B' });
                    break;
                case 'i':
                    event.preventDefault();
                    document.execCommand('italic', false, null);
                    this.logCustomEvent('shortcut', 'interaction', { shortcut: 'Ctrl+I' });
                    break;
                case 'u':
                    event.preventDefault();
                    document.execCommand('underline', false, null);
                    this.logCustomEvent('shortcut', 'interaction', { shortcut: 'Ctrl+U' });
                    break;
            }
        }
    }

    handleCustomKeyUp() {
        this.updateCustomSelectionInfo();
        this.updateToolbarState();
    }

    handleCustomInput(event) {
        this.updateCustomCounts();
        this.notifyCustomContentChange();
        this.logCustomEvent('input', 'content', { inputType: event.inputType, data: event.data });
    }

    handleCustomClick(event) {
        const editor = this.getCustomEditorElement();
        if (!editor) return;

        const rect = editor.getBoundingClientRect();
        this.logCustomEvent('click', 'interaction', {
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
            target: event.target.tagName
        });
        this.updateCustomSelectionInfo();
        this.updateToolbarState();
    }

    handleCustomFocus() {
        this.logCustomEvent('focus', 'interaction', { source: 'user' });
    }

    handleCustomBlur() {
        this.logCustomEvent('blur', 'interaction', { source: 'user' });
    }

    handleCustomPaste(event) {
        const types = event.clipboardData ? Array.from(event.clipboardData.types) : [];
        this.logCustomEvent('paste', 'content', { types });

        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.updateCustomCounts();
            this.notifyCustomContentChange();
        }, 0);
    }

    handleCustomMouseUp() {
        this.updateCustomSelectionInfo();
        this.updateToolbarState();
        const sel = window.getSelection();
        const text = sel ? sel.toString() : '';
        if (text) {
            this.logCustomEvent('text-selected', 'selection', { length: text.length, preview: text.substring(0, 50) });
        }
    }

    handleCustomContextMenu(event) {
        const editor = this.getCustomEditorElement();
        if (!editor) return;

        const rect = editor.getBoundingClientRect();
        this.logCustomEvent('contextmenu', 'interaction', {
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
            clientX: event.clientX,
            clientY: event.clientY
        });
    }

    updateCustomCounts() {
        const editor = this.getCustomEditorElement();
        if (!editor) return;

        const text = editor.innerText || '';
        this.customCharCount = text.length;
        this.customWordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    }

    updateCustomSelectionInfo() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            this.customSelectionInfo = '';
            return;
        }

        const text = sel.toString();
        if (text.length > 0) {
            this.customSelectionInfo = `Selected: ${text.length} chars`;
            this.logCustomEvent('selection-change', 'selection', { hasSelection: true, length: text.length });
        } else {
            this.customSelectionInfo = '';
        }
    }

    notifyCustomContentChange() {
        const editor = this.getCustomEditorElement();
        if (!editor) return;

        const content = editor.innerHTML;
        if (content !== this._customLastContent) {
            this._customLastContent = content;
            this._recordContent = content;
            this.logCustomEvent('content-change', 'content', {
                contentLength: content.length,
                charCount: this.customCharCount,
                wordCount: this.customWordCount
            });
        }
    }

    // Update toolbar button states based on current formatting
    updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'];

        commands.forEach(cmd => {
            const buttons = this.template.querySelectorAll(`.custom-toolbar-btn[data-cmd="${cmd}"]`);
            buttons.forEach(btn => {
                try {
                    const isActive = document.queryCommandState(cmd);
                    if (isActive) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                } catch (e) {
                    // queryCommandState can throw for some commands
                }
            });
        });

        // Update heading select
        const headingSelect = this.template.querySelector('.custom-toolbar-select');
        if (headingSelect) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                let node = sel.anchorNode;
                // Walk up to find block element
                while (node && node.nodeType !== 1) {
                    node = node.parentNode;
                }
                if (node) {
                    const blockParent = node.closest('h1, h2, h3, p, div');
                    if (blockParent) {
                        const tagName = blockParent.tagName.toLowerCase();
                        if (['h1', 'h2', 'h3'].includes(tagName)) {
                            headingSelect.value = tagName;
                        } else {
                            headingSelect.value = '';
                        }
                    }
                }
            }
        }
    }

    logCustomEvent(eventType, category, details) {
        const eventLog = this.getEventLogPanel();
        if (eventLog) {
            eventLog.logEvent({ editor: 'cInline', eventType, category, details });
        }
    }
}
