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
                clickEvents: 'limited'
            }
        });
    }

    renderedCallback() {
        // Add click listener to capture clicks within the editor
        const wrapper = this.template.querySelector('.editor-wrapper');
        if (wrapper && !wrapper._clickHandlerAdded) {
            wrapper.addEventListener('click', this.handleEditorClick.bind(this), true);
            wrapper._clickHandlerAdded = true;
        }
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        this.fireEvent('content-get', 'api', { content: this.content });
        return this.content;
    }

    @api
    setContent(html) {
        const previousContent = this.content;
        this.content = html || '';
        this.fireEvent('content-set', 'api', {
            previousContent,
            newContent: this.content
        });
    }

    @api
    insertContent(html, position = 'end') {
        // Standard editor doesn't support cursor position insertion
        // So we append or prepend based on position
        const previousContent = this.content;

        if (position === 'start') {
            this.content = html + this.content;
        } else {
            this.content = this.content + html;
        }

        this.fireEvent('content-insert', 'api', {
            insertedHtml: html,
            position,
            previousContent,
            newContent: this.content,
            note: 'Standard editor does not support cursor position insertion'
        });
    }

    @api
    focus() {
        const editor = this.refs.editor;
        if (editor) {
            editor.focus();
        }
        this.fireEvent('focus-programmatic', 'api', {});
    }

    @api
    blur() {
        const editor = this.refs.editor;
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
            programmaticInsert: 'limited', // Can't insert at cursor
            selectionEvents: false,
            clickEvents: 'container-only',
            formatCommands: false,
            imageUpload: true,
            tableSupport: false,
            mentionSupport: false
        };
    }

    // ==================== EVENT HANDLERS ====================

    handleChange(event) {
        const previousContent = this.content;
        this.content = event.target.value;

        this.fireEvent('content-change', 'content', {
            previousContent,
            newContent: this.content,
            changeSource: 'user'
        });

        // Dispatch custom event for parent component
        this.dispatchEvent(new CustomEvent('contentchange', {
            detail: {
                editor: EDITOR_NAME,
                content: this.content
            }
        }));
    }

    handleFocus(event) {
        this.fireEvent('focus', 'interaction', {
            source: 'user'
        });
    }

    handleBlur(event) {
        this.fireEvent('blur', 'interaction', {
            source: 'user'
        });
    }

    handleContainerClick(event) {
        // Capture click coordinates relative to the container
        const rect = event.currentTarget.getBoundingClientRect();
        this.fireEvent('click', 'interaction', {
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
            clientX: event.clientX,
            clientY: event.clientY,
            target: event.target.tagName,
            targetClass: event.target.className
        });
    }

    handleEditorClick(event) {
        // More detailed click tracking within the editor
        const target = event.target;
        let targetInfo = {
            tagName: target.tagName,
            className: target.className
        };

        // Try to identify toolbar buttons
        if (target.closest('button')) {
            const button = target.closest('button');
            targetInfo.button = {
                title: button.title || button.getAttribute('aria-label'),
                name: button.name
            };
        }

        this.fireEvent('editor-click', 'interaction', {
            x: event.clientX,
            y: event.clientY,
            target: targetInfo
        });
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
