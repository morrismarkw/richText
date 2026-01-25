import { LightningElement, api, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import QUILL from '@salesforce/resourceUrl/quilljs';

const EDITOR_NAME = 'Quill';

export default class EditorQuill extends LightningElement {
    @track isLoaded = false;
    @track loadError = null;

    @api
    getIsLoaded() {
        return this.isLoaded;
    }

    quillInstance = null;
    _pendingContent = null;

    get editorContainerClass() {
        return this.isLoaded ? 'quill-container visible' : 'quill-container hidden';
    }

    _scriptsLoaded = false;
    _initAttempted = false;

    async connectedCallback() {
        try {
            await Promise.all([
                loadStyle(this, QUILL + '/quill.snow.css'),
                loadScript(this, QUILL + '/quill.min.js')
            ]);
            this._scriptsLoaded = true;

            // Try to initialize (may fail if not rendered yet)
            this.initializeQuill();
        } catch (error) {
            this.loadError = error.message || 'Unknown error loading Quill';
            this.fireEvent('load-error', 'lifecycle', { error: this.loadError });
        }
    }

    renderedCallback() {
        // If scripts are loaded but Quill isn't initialized, try now
        if (this._scriptsLoaded && !this._initAttempted) {
            this.initializeQuill();
        }
    }

    initializeQuill() {
        if (this.isLoaded) {
            return;
        }

        this._initAttempted = true;
        // Use querySelector for reliability - refs can be unreliable in certain render states
        const container = this.template.querySelector('.quill-container');

        if (!container) {
            this._initAttempted = false; // Allow retry
            return;
        }

        // Create editor div inside container
        const editorDiv = document.createElement('div');
        editorDiv.className = 'quill-editor';
        container.appendChild(editorDiv);

        // Initialize Quill
        // eslint-disable-next-line no-undef
        this.quillInstance = new Quill(editorDiv, {
            theme: 'snow',
            placeholder: 'Enter content here...',
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ color: [] }, { background: [] }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ indent: '-1' }, { indent: '+1' }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });

        this.setupEventListeners();
        this.isLoaded = true;

        // Apply pending content if any
        if (this._pendingContent !== null) {
            this.quillInstance.root.innerHTML = this._pendingContent;
            this._pendingContent = null;
        }

        this.fireEvent('editor-ready', 'lifecycle', {
            editor: EDITOR_NAME,
            version: '1.3.7',
            capabilities: {
                customToolbar: true,
                contextMenu: false,
                programmaticInsert: true,
                selectionEvents: true,
                clickEvents: true
            }
        });
    }

    setupEventListeners() {
        const quill = this.quillInstance;

        // Text change events
        quill.on('text-change', (delta, oldDelta, source) => {
            this.fireEvent('content-change', 'content', {
                delta: this.sanitizeDelta(delta),
                source,
                contentLength: quill.getLength()
            });

            this.dispatchEvent(new CustomEvent('contentchange', {
                detail: {
                    editor: EDITOR_NAME,
                    content: quill.root.innerHTML
                }
            }));
        });

        // Selection change events
        quill.on('selection-change', (range, oldRange, source) => {
            if (range) {
                this.fireEvent('selection-change', 'selection', {
                    index: range.index,
                    length: range.length,
                    source,
                    hasSelection: range.length > 0
                });
            } else {
                this.fireEvent('blur', 'interaction', { source });
            }
        });

        // Editor focus events
        quill.on('editor-change', (eventName, ...args) => {
            if (eventName === 'selection-change' && args[0] !== null && args[1] === null) {
                this.fireEvent('focus', 'interaction', { source: args[2] });
            }
        });

        // Click events on editor content
        quill.root.addEventListener('click', (event) => {
            this.handleEditorClick(event);
        });

        // Click events on toolbar
        const toolbar = this.template.querySelector('.ql-toolbar');
        if (toolbar) {
            toolbar.addEventListener('click', (event) => {
                this.handleToolbarClick(event);
            });
        }

        // Keyboard events
        quill.root.addEventListener('keydown', (event) => {
            this.fireEvent('keydown', 'interaction', {
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey
            });
        });

        // Paste events
        quill.root.addEventListener('paste', (event) => {
            this.fireEvent('paste', 'content', {
                hasText: event.clipboardData?.types.includes('text/plain'),
                hasHtml: event.clipboardData?.types.includes('text/html'),
                hasFiles: event.clipboardData?.files?.length > 0
            });
        });
    }

    handleEditorClick(event) {
        const selection = this.quillInstance.getSelection();
        const rect = this.quillInstance.root.getBoundingClientRect();

        this.fireEvent('click', 'interaction', {
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
            clientX: event.clientX,
            clientY: event.clientY,
            target: event.target.tagName,
            cursorIndex: selection?.index
        });
    }

    handleToolbarClick(event) {
        const button = event.target.closest('button, .ql-picker-label');
        if (button) {
            const buttonClass = button.className;
            let action = 'unknown';

            // Extract action from class name
            const match = buttonClass.match(/ql-(\w+)/);
            if (match) {
                action = match[1];
            }

            this.fireEvent('toolbar-click', 'interaction', {
                action,
                buttonClass
            });
        }
    }

    sanitizeDelta(delta) {
        // Simplify delta for logging (can be very verbose)
        if (!delta || !delta.ops) return null;
        return {
            opsCount: delta.ops.length,
            ops: delta.ops.slice(0, 5) // Only log first 5 ops
        };
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        if (!this.quillInstance) return '';
        const content = this.quillInstance.root.innerHTML;
        this.fireEvent('content-get', 'api', { contentLength: content.length });
        return content;
    }

    @api
    setContent(html) {
        if (!this.quillInstance) {
            this._pendingContent = html;
            return;
        }

        const previousContent = this.quillInstance.root.innerHTML;
        this.quillInstance.root.innerHTML = html || '';

        this.fireEvent('content-set', 'api', {
            previousLength: previousContent.length,
            newLength: (html || '').length
        });
    }

    @api
    insertContent(html, position = 'cursor') {
        if (!this.quillInstance) return;

        const selection = this.quillInstance.getSelection();
        let insertIndex;

        if (position === 'start') {
            insertIndex = 0;
        } else if (position === 'end') {
            insertIndex = this.quillInstance.getLength();
        } else {
            // Insert at cursor or end if no cursor
            insertIndex = selection ? selection.index : this.quillInstance.getLength();
        }

        // Quill's clipboard module can handle HTML
        this.quillInstance.clipboard.dangerouslyPasteHTML(insertIndex, html);

        this.fireEvent('content-insert', 'api', {
            insertIndex,
            htmlLength: html.length,
            position
        });
    }

    @api
    focus() {
        if (this.quillInstance) {
            this.quillInstance.focus();
            this.fireEvent('focus-programmatic', 'api', {});
        }
    }

    @api
    blur() {
        if (this.quillInstance) {
            this.quillInstance.blur();
            this.fireEvent('blur-programmatic', 'api', {});
        }
    }

    @api
    getEditorName() {
        return EDITOR_NAME;
    }

    @api
    getCapabilities() {
        return {
            name: EDITOR_NAME,
            customToolbar: true,
            contextMenu: false,
            programmaticInsert: true,
            selectionEvents: true,
            clickEvents: true,
            formatCommands: true,
            imageUpload: true,
            tableSupport: false,
            mentionSupport: 'via-plugin'
        };
    }

    @api
    executeCommand(command, value = null) {
        if (!this.quillInstance) return false;

        try {
            this.quillInstance.format(command, value);
            this.fireEvent('command-executed', 'api', { command, value });
            return true;
        } catch (error) {
            this.fireEvent('command-error', 'api', { command, error: error.message });
            return false;
        }
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
