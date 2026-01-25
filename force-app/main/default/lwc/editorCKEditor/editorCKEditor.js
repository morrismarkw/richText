import { LightningElement, api, track } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import CKEDITOR_URL from '@salesforce/resourceUrl/ckeditor5';

const EDITOR_NAME = 'CKEditor';

export default class EditorCKEditor extends LightningElement {
    @track isLoaded = false;
    @track loadError = null;

    @api
    getIsLoaded() {
        return this.isLoaded;
    }

    editorInstance = null;
    _pendingContent = null;

    get editorContainerClass() {
        return this.isLoaded ? 'ckeditor-container visible' : 'ckeditor-container hidden';
    }

    async connectedCallback() {
        try {
            await loadStyle(this, CKEDITOR_URL + '/ckeditor5.css');
            await loadScript(this, CKEDITOR_URL + '/ckeditor5.umd.js');

            this.initializeCKEditor();
        } catch (error) {
            this.loadError = error.message || 'Unknown error loading CKEditor';
            this.fireEvent('load-error', 'lifecycle', { error: this.loadError });
        }
    }

    disconnectedCallback() {
        if (this.editorInstance) {
            this.editorInstance.destroy()
                .catch(error => console.error('CKEditor cleanup error:', error));
            this.editorInstance = null;
        }
    }

    async initializeCKEditor() {
        const container = this.refs.editorContainer;
        if (!container) {
            this.loadError = 'Editor container not found';
            return;
        }

        try {
            const {
                ClassicEditor,
                Essentials,
                Bold,
                Italic,
                Underline,
                Strikethrough,
                Font,
                Paragraph,
                Heading,
                Link,
                List,
                Image,
                ImageUpload,
                Table,
                TableToolbar,
                Indent,
                BlockQuote,
                Undo
            // eslint-disable-next-line no-undef
            } = CKEDITOR;

            this.editorInstance = await ClassicEditor.create(container, {
                plugins: [
                    Essentials,
                    Bold,
                    Italic,
                    Underline,
                    Strikethrough,
                    Font,
                    Paragraph,
                    Heading,
                    Link,
                    List,
                    Image,
                    ImageUpload,
                    Table,
                    TableToolbar,
                    Indent,
                    BlockQuote,
                    Undo
                ],
                toolbar: {
                    items: [
                        'heading',
                        '|',
                        'bold',
                        'italic',
                        'underline',
                        'strikethrough',
                        '|',
                        'fontSize',
                        'fontColor',
                        'fontBackgroundColor',
                        '|',
                        'bulletedList',
                        'numberedList',
                        '|',
                        'outdent',
                        'indent',
                        '|',
                        'link',
                        'insertTable',
                        'blockQuote',
                        '|',
                        'undo',
                        'redo'
                    ]
                },
                table: {
                    contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
                },
                placeholder: 'Enter content here...'
            });

            this.setupEventListeners();
            this.isLoaded = true;

            // Apply pending content if any
            if (this._pendingContent !== null) {
                this.editorInstance.setData(this._pendingContent);
                this._pendingContent = null;
            }

            this.fireEvent('editor-ready', 'lifecycle', {
                editor: EDITOR_NAME,
                version: '43.x',
                capabilities: {
                    customToolbar: true,
                    contextMenu: true,
                    programmaticInsert: true,
                    selectionEvents: true,
                    clickEvents: true
                }
            });
        } catch (error) {
            this.loadError = error.message;
            this.fireEvent('init-error', 'lifecycle', { error: error.message });
        }
    }

    setupEventListeners() {
        const editor = this.editorInstance;
        const model = editor.model;
        const view = editor.editing.view;

        // Content change events
        model.document.on('change:data', () => {
            const content = editor.getData();
            this.fireEvent('content-change', 'content', {
                contentLength: content.length,
                source: 'model-change'
            });

            this.dispatchEvent(new CustomEvent('contentchange', {
                detail: {
                    editor: EDITOR_NAME,
                    content
                }
            }));
        });

        // Selection change events
        model.document.selection.on('change:range', () => {
            const selection = model.document.selection;
            const range = selection.getFirstRange();

            this.fireEvent('selection-change', 'selection', {
                isCollapsed: selection.isCollapsed,
                hasRange: !!range,
                anchor: range ? { path: range.start.path.toString() } : null
            });
        });

        // Focus events
        view.document.on('focus', () => {
            this.fireEvent('focus', 'interaction', { source: 'user' });
        });

        view.document.on('blur', () => {
            this.fireEvent('blur', 'interaction', { source: 'user' });
        });

        // Click events
        view.document.on('click', (evt, data) => {
            const domEvent = data.domEvent;
            const editorElement = editor.ui.view.editable.element;
            const rect = editorElement.getBoundingClientRect();

            this.fireEvent('click', 'interaction', {
                x: Math.round(domEvent.clientX - rect.left),
                y: Math.round(domEvent.clientY - rect.top),
                clientX: domEvent.clientX,
                clientY: domEvent.clientY,
                target: data.target?.name || 'unknown'
            });
        });

        // Keyboard events
        view.document.on('keydown', (evt, data) => {
            this.fireEvent('keydown', 'interaction', {
                key: data.domEvent.key,
                code: data.domEvent.code,
                ctrlKey: data.domEvent.ctrlKey,
                shiftKey: data.domEvent.shiftKey,
                altKey: data.domEvent.altKey
            });
        });

        // Clipboard events
        view.document.on('clipboardInput', () => {
            this.fireEvent('paste', 'content', {
                source: 'clipboard'
            });
        });

        // Command execution tracking
        editor.commands.on('execute', (evt) => {
            this.fireEvent('command-executed', 'api', {
                command: evt.source.constructor.name
            });
        });
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        if (!this.editorInstance) return '';
        const content = this.editorInstance.getData();
        this.fireEvent('content-get', 'api', { contentLength: content.length });
        return content;
    }

    @api
    setContent(html) {
        if (!this.editorInstance) {
            this._pendingContent = html;
            return;
        }

        const previousLength = this.editorInstance.getData().length;
        this.editorInstance.setData(html || '');

        this.fireEvent('content-set', 'api', {
            previousLength,
            newLength: (html || '').length
        });
    }

    @api
    insertContent(html, position = 'cursor') {
        if (!this.editorInstance) return;

        const editor = this.editorInstance;
        const model = editor.model;

        model.change(writer => {
            // Parse HTML to model fragment
            const viewFragment = editor.data.processor.toView(html);
            const modelFragment = editor.data.toModel(viewFragment);

            if (position === 'start') {
                // Insert at the very beginning
                const root = model.document.getRoot();
                const insertPosition = writer.createPositionAt(root, 0);
                model.insertContent(modelFragment, insertPosition);
            } else if (position === 'end') {
                // Insert at the very end
                const root = model.document.getRoot();
                const insertPosition = writer.createPositionAt(root, 'end');
                model.insertContent(modelFragment, insertPosition);
            } else {
                // Insert at current selection/cursor
                model.insertContent(modelFragment);
            }
        });

        this.fireEvent('content-insert', 'api', {
            htmlLength: html.length,
            position
        });
    }

    @api
    focus() {
        if (this.editorInstance) {
            this.editorInstance.editing.view.focus();
            this.fireEvent('focus-programmatic', 'api', {});
        }
    }

    @api
    blur() {
        if (this.editorInstance) {
            this.editorInstance.editing.view.document.isFocused = false;
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
            contextMenu: true,
            programmaticInsert: true,
            selectionEvents: true,
            clickEvents: true,
            formatCommands: true,
            imageUpload: true,
            tableSupport: true,
            mentionSupport: 'via-plugin'
        };
    }

    @api
    executeCommand(commandName, options = {}) {
        if (!this.editorInstance) return false;

        try {
            this.editorInstance.execute(commandName, options);
            this.fireEvent('command-executed', 'api', { command: commandName, options });
            return true;
        } catch (error) {
            this.fireEvent('command-error', 'api', { command: commandName, error: error.message });
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
