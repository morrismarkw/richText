import { LightningElement, api, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import TINYMCE from '@salesforce/resourceUrl/tinymce';

const EDITOR_NAME = 'TinyMCE';

export default class EditorTinyMCE extends LightningElement {
    @track isLoaded = false;
    @track loadError = null;

    @api
    getIsLoaded() {
        return this.isLoaded;
    }

    editorInstance = null;
    _pendingContent = null;
    _editorId = `tinymce-${Date.now()}`;

    get editorContainerClass() {
        return this.isLoaded ? 'tinymce-container visible' : 'tinymce-container hidden';
    }

    async connectedCallback() {
        try {
            await loadScript(this, TINYMCE + '/tinymce.min.js');
            this.initializeTinyMCE();
        } catch (error) {
            this.loadError = error.message || 'Unknown error loading TinyMCE';
            this.fireEvent('load-error', 'lifecycle', { error: this.loadError });
        }
    }

    disconnectedCallback() {
        // Clean up TinyMCE instance
        if (this.editorInstance) {
            this.editorInstance.destroy();
            this.editorInstance = null;
        }
    }

    initializeTinyMCE() {
        const textarea = this.refs.editorTextarea;
        if (!textarea) {
            this.loadError = 'Editor textarea not found';
            return;
        }

        textarea.id = this._editorId;

        // eslint-disable-next-line no-undef
        tinymce.init({
            target: textarea,
            height: 400,
            menubar: true,
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'preview', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter ' +
                     'alignright alignjustify | bullist numlist outdent indent | ' +
                     'removeformat | table | help',
            content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; }',
            base_url: TINYMCE,
            suffix: '.min',
            promotion: false,
            branding: false,
            setup: (editor) => {
                this.setupEditorEvents(editor);
            },
            init_instance_callback: (editor) => {
                this.editorInstance = editor;
                this.isLoaded = true;

                // Apply pending content if any
                if (this._pendingContent !== null) {
                    editor.setContent(this._pendingContent);
                    this._pendingContent = null;
                }

                this.fireEvent('editor-ready', 'lifecycle', {
                    editor: EDITOR_NAME,
                    version: tinymce.majorVersion + '.' + tinymce.minorVersion,
                    capabilities: {
                        customToolbar: true,
                        contextMenu: true,
                        programmaticInsert: true,
                        selectionEvents: true,
                        clickEvents: true
                    }
                });
            }
        });
    }

    setupEditorEvents(editor) {
        // Content change events
        editor.on('input', () => {
            this.fireEvent('content-change', 'content', {
                contentLength: editor.getContent().length,
                source: 'input'
            });

            this.dispatchEvent(new CustomEvent('contentchange', {
                detail: {
                    editor: EDITOR_NAME,
                    content: editor.getContent()
                }
            }));
        });

        editor.on('change', () => {
            this.fireEvent('content-change', 'content', {
                contentLength: editor.getContent().length,
                source: 'change'
            });
        });

        // Selection change events
        editor.on('NodeChange', (e) => {
            const selection = editor.selection;
            this.fireEvent('selection-change', 'selection', {
                nodeName: e.element?.nodeName,
                hasSelection: !selection.isCollapsed(),
                selectedText: selection.getContent({ format: 'text' }).substring(0, 100)
            });
        });

        // Focus events
        editor.on('focus', () => {
            this.fireEvent('focus', 'interaction', { source: 'user' });
        });

        editor.on('blur', () => {
            this.fireEvent('blur', 'interaction', { source: 'user' });
        });

        // Click events
        editor.on('click', (e) => {
            const rect = editor.getContentAreaContainer().getBoundingClientRect();
            this.fireEvent('click', 'interaction', {
                x: Math.round(e.clientX - rect.left),
                y: Math.round(e.clientY - rect.top),
                clientX: e.clientX,
                clientY: e.clientY,
                target: e.target.tagName,
                targetClass: e.target.className
            });
        });

        // Context menu events
        editor.on('contextmenu', (e) => {
            this.fireEvent('contextmenu', 'interaction', {
                x: e.clientX,
                y: e.clientY,
                target: e.target.tagName
            });
        });

        // Keyboard events
        editor.on('keydown', (e) => {
            this.fireEvent('keydown', 'interaction', {
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey
            });
        });

        // Paste events
        editor.on('paste', (e) => {
            this.fireEvent('paste', 'content', {
                hasText: e.clipboardData?.types?.includes('text/plain'),
                hasHtml: e.clipboardData?.types?.includes('text/html')
            });
        });

        // Undo/Redo events
        editor.on('Undo', () => {
            this.fireEvent('undo', 'content', {
                undoStackSize: editor.undoManager.data.length
            });
        });

        editor.on('Redo', () => {
            this.fireEvent('redo', 'content', {
                undoStackSize: editor.undoManager.data.length
            });
        });

        // Format change events
        editor.on('ExecCommand', (e) => {
            this.fireEvent('command-executed', 'api', {
                command: e.command,
                value: e.value
            });
        });

        // Toolbar button click (approximate)
        editor.on('BeforeExecCommand', (e) => {
            this.fireEvent('toolbar-action', 'interaction', {
                command: e.command
            });
        });
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        if (!this.editorInstance) return '';
        const content = this.editorInstance.getContent();
        this.fireEvent('content-get', 'api', { contentLength: content.length });
        return content;
    }

    @api
    setContent(html) {
        if (!this.editorInstance) {
            this._pendingContent = html;
            return;
        }

        const previousLength = this.editorInstance.getContent().length;
        this.editorInstance.setContent(html || '');

        this.fireEvent('content-set', 'api', {
            previousLength,
            newLength: (html || '').length
        });
    }

    @api
    insertContent(html, position = 'cursor') {
        if (!this.editorInstance) return;

        const editor = this.editorInstance;

        if (position === 'start') {
            editor.selection.setCursorLocation(editor.getBody().firstChild, 0);
        } else if (position === 'end') {
            editor.selection.select(editor.getBody(), true);
            editor.selection.collapse(false);
        }
        // 'cursor' position uses current selection

        editor.insertContent(html);

        this.fireEvent('content-insert', 'api', {
            htmlLength: html.length,
            position
        });
    }

    @api
    focus() {
        if (this.editorInstance) {
            this.editorInstance.focus();
            this.fireEvent('focus-programmatic', 'api', {});
        }
    }

    @api
    blur() {
        if (this.editorInstance) {
            // TinyMCE doesn't have a direct blur method
            this.editorInstance.getBody().blur();
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
    executeCommand(command, ui = false, value = null) {
        if (!this.editorInstance) return false;

        try {
            this.editorInstance.execCommand(command, ui, value);
            this.fireEvent('command-executed', 'api', { command, ui, value });
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
