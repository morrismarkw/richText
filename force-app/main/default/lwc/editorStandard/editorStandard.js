import { LightningElement, api, track } from 'lwc';

const EDITOR_NAME = 'Standard';

export default class EditorStandard extends LightningElement {
    @track content = '';
    _isReady = false;

    connectedCallback() {
        this._isReady = true;
        this.fireEvent('editor-ready', 'lifecycle', {
            editor: EDITOR_NAME,
            capabilities: {
                customToolbar: false,
                contextMenu: false,
                programmaticInsert: true,
                selectionEvents: false,
                clickEvents: false
            }
        });
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        this.fireEvent('content-get', 'api', { contentLength: this.content?.length || 0 });
        return this.content;
    }

    @api
    setContent(html) {
        const previousLength = this.content?.length || 0;
        this.content = html || '';
        this.fireEvent('content-set', 'api', {
            previousLength,
            newLength: this.content.length
        });
    }

    @api
    insertContent(html, position = 'end') {
        // Standard editor doesn't support cursor position insertion
        // So we append or prepend based on position
        const previousLength = this.content?.length || 0;

        if (position === 'start') {
            this.content = html + this.content;
        } else {
            this.content = this.content + html;
        }

        this.fireEvent('content-insert', 'api', {
            htmlLength: html.length,
            position,
            newLength: this.content.length
        });
    }

    @api
    focus() {
        const editor = this.template.querySelector('lightning-input-rich-text');
        if (editor) {
            editor.focus();
        }
        this.fireEvent('focus-programmatic', 'api', {});
    }

    @api
    blur() {
        const editor = this.template.querySelector('lightning-input-rich-text');
        if (editor) {
            editor.blur();
        }
        this.fireEvent('blur-programmatic', 'api', {});
    }

    @api
    getEditorName() {
        return EDITOR_NAME;
    }

    @api
    getCapabilities() {
        return {
            name: EDITOR_NAME,
            customToolbar: false,
            contextMenu: false,
            programmaticInsert: 'append-only',
            selectionEvents: false,
            clickEvents: false,
            formatCommands: false,
            imageUpload: true,
            tableSupport: false,
            mentionSupport: false
        };
    }

    // ==================== EVENT HANDLERS ====================

    handleChange(event) {
        const previousLength = this.content?.length || 0;
        this.content = event.target.value;

        this.fireEvent('content-change', 'content', {
            previousLength,
            newLength: this.content.length,
            source: 'user'
        });

        // Dispatch custom event for parent component
        this.dispatchEvent(new CustomEvent('contentchange', {
            detail: {
                editor: EDITOR_NAME,
                content: this.content
            }
        }));
    }

    handleFocus() {
        this.fireEvent('focus', 'interaction', { source: 'user' });
    }

    handleBlur() {
        this.fireEvent('blur', 'interaction', { source: 'user' });
    }

    // ==================== UTILITY METHODS ====================

    fireEvent(eventType, category, details) {
        this.dispatchEvent(new CustomEvent('editorevent', {
            detail: {
                editor: EDITOR_NAME,
                eventType,
                category,
                details
            },
            bubbles: true,
            composed: true
        }));
    }
}
