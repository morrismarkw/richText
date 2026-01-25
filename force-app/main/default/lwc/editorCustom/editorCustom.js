import { LightningElement, api, track } from 'lwc';

const EDITOR_NAME = 'Component';
const DEBUG = true; // Toggle debugging - set to true to see verbose logs

export default class EditorCustom extends LightningElement {
    @track characterCount = 0;
    @track wordCount = 0;
    @track selectionInfo = '';

    _isReady = false;
    _lastContent = '';
    _pendingContent = null;
    _hasRendered = false;
    _renderCount = 0;

    // ==================== DEBUG ====================

    debug(method, message, data = {}) {
        if (!DEBUG) return;

        const logData = {
            method,
            message,
            ...data,
            state: {
                _isReady: this._isReady,
                _hasRendered: this._hasRendered,
                _renderCount: this._renderCount,
                _pendingContent: this._pendingContent !== null ? `${String(this._pendingContent).length} chars` : null,
                editorExists: !!this.template.querySelector('.editor-content')
            }
        };

        // Console log
        console.log(`[EditorCustom.${method}]`, message, logData);

        // Also fire as event for the event log panel
        this.fireEvent('debug', 'debug', logData);
    }

    // ==================== LIFECYCLE ====================

    connectedCallback() {
        this.debug('connectedCallback', 'Component connected to DOM');
        this._isReady = true;
    }

    disconnectedCallback() {
        this.debug('disconnectedCallback', 'Component disconnected from DOM');
    }

    renderedCallback() {
        this._renderCount++;
        const editor = this.getEditorElement();

        this.debug('renderedCallback', `Render #${this._renderCount}`, {
            editorFound: !!editor,
            editorHTML: editor ? editor.innerHTML.substring(0, 100) : 'N/A'
        });

        if (!editor) {
            this.debug('renderedCallback', 'ERROR: Editor element not found!');
            return;
        }

        // Fire ready event on first render
        if (!this._hasRendered) {
            this._hasRendered = true;
            this.debug('renderedCallback', 'First render - firing editor-ready');

            this.fireEvent('editor-ready', 'lifecycle', {
                editor: EDITOR_NAME,
                capabilities: {
                    customToolbar: true,
                    contextMenu: true,
                    programmaticInsert: true,
                    selectionEvents: true,
                    clickEvents: true,
                    nativeExecCommand: true
                }
            });

            // Apply any pending content
            if (this._pendingContent !== null) {
                this.debug('renderedCallback', 'Applying pending content', {
                    contentLength: this._pendingContent?.length || 0
                });
                editor.innerHTML = this._pendingContent || '<p><br></p>';
                this._lastContent = editor.innerHTML;
                this._pendingContent = null;
                this.updateCounts();
            }
        }

        // Initialize placeholder if empty
        if (!editor.innerHTML) {
            this.debug('renderedCallback', 'Editor empty, adding placeholder');
            editor.innerHTML = '<p><br></p>';
        }
    }

    // Get editor element reliably
    getEditorElement() {
        const el = this.template.querySelector('.editor-content');
        if (!el && DEBUG) {
            console.warn('[EditorCustom.getEditorElement] Element not found!');
        }
        return el;
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        this.debug('getContent', 'Called');
        const editor = this.getEditorElement();
        const content = editor ? editor.innerHTML : '';
        this.debug('getContent', 'Returning content', { contentLength: content.length });
        this.fireEvent('content-get', 'api', { contentLength: content.length });
        return content;
    }

    @api
    setContent(html) {
        this.debug('setContent', 'Called', {
            htmlLength: html?.length || 0,
            htmlPreview: html ? html.substring(0, 100) : 'null/empty'
        });

        const editor = this.getEditorElement();

        // If editor not ready yet, queue the content
        if (!editor) {
            this.debug('setContent', 'Editor not ready, queueing content');
            this._pendingContent = html;
            return;
        }

        const previousLength = editor.innerHTML.length;
        editor.innerHTML = html || '<p><br></p>';
        this._lastContent = editor.innerHTML;
        this.updateCounts();

        this.debug('setContent', 'Content set successfully', {
            previousLength,
            newLength: editor.innerHTML.length
        });

        this.fireEvent('content-set', 'api', {
            previousLength,
            newLength: editor.innerHTML.length
        });
    }

    @api
    insertContent(html, position = 'cursor') {
        const editor = this.getEditorElement();
        if (!editor) return;

        editor.focus();

        if (position === 'start') {
            editor.innerHTML = html + editor.innerHTML;
        } else if (position === 'end') {
            editor.innerHTML = editor.innerHTML + html;
        } else {
            // Insert at cursor using execCommand or selection API
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();

                const fragment = range.createContextualFragment(html);
                range.insertNode(fragment);

                // Move cursor after inserted content
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                // No selection, append at end
                editor.innerHTML += html;
            }
        }

        this.updateCounts();
        this.fireEvent('content-insert', 'api', {
            htmlLength: html.length,
            position
        });

        this.notifyContentChange();
    }

    @api
    focus() {
        const editor = this.getEditorElement();
        if (editor) {
            editor.focus();
            this.fireEvent('focus-programmatic', 'api', {});
        }
    }

    @api
    blur() {
        const editor = this.getEditorElement();
        if (editor) {
            editor.blur();
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
            imageUpload: false,
            tableSupport: false,
            mentionSupport: false,
            nativeExecCommand: true
        };
    }

    @api
    executeCommand(command, value = null) {
        try {
            document.execCommand(command, false, value);
            this.fireEvent('command-executed', 'api', { command, value, source: 'api' });
            this.updateCounts();
            return true;
        } catch (error) {
            this.fireEvent('command-error', 'api', { command, error: error.message });
            return false;
        }
    }

    @api
    getSelectedText() {
        const selection = window.getSelection();
        return selection ? selection.toString() : '';
    }

    @api
    getSelectedHtml() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return '';

        const range = selection.getRangeAt(0);
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        return div.innerHTML;
    }

    // ==================== TOOLBAR HANDLERS ====================

    handleToolbarClick(event) {
        this.debug('handleToolbarClick', 'Toolbar button clicked');

        const button = event.currentTarget;
        const command = button.dataset.command;
        const value = button.dataset.value || null;

        this.debug('handleToolbarClick', `Command: ${command}`, { value });

        if (!command) {
            this.debug('handleToolbarClick', 'No command found on button');
            return;
        }

        // Focus editor first
        const editor = this.getEditorElement();
        if (editor) {
            this.debug('handleToolbarClick', 'Focusing editor');
            editor.focus();
        }

        // Execute command
        this.debug('handleToolbarClick', `Executing execCommand: ${command}`);
        const success = document.execCommand(command, false, value);
        this.debug('handleToolbarClick', `execCommand result: ${success}`);

        this.fireEvent('toolbar-click', 'interaction', {
            command,
            value,
            success
        });

        this.fireEvent('command-executed', 'api', {
            command,
            value,
            success,
            source: 'toolbar'
        });

        this.updateCounts();
    }

    handleHeadingChange(event) {
        const value = event.target.value;
        const editor = this.getEditorElement();

        if (editor) editor.focus();

        if (value) {
            document.execCommand('formatBlock', false, value);
        } else {
            document.execCommand('formatBlock', false, 'p');
        }

        // Reset select
        event.target.value = '';

        this.fireEvent('format-change', 'content', {
            format: 'heading',
            value: value || 'p'
        });
    }

    handleInsertLink() {
        const url = prompt('Enter URL:');
        if (url) {
            const editor = this.getEditorElement();
            if (editor) editor.focus();

            document.execCommand('createLink', false, url);

            this.fireEvent('link-inserted', 'content', { url });
        }
    }

    // ==================== EDITOR EVENT HANDLERS ====================

    handleInput(event) {
        this.debug('handleInput', 'Input event received', {
            inputType: event.inputType,
            data: event.data
        });

        this.updateCounts();
        this.notifyContentChange();

        this.fireEvent('input', 'content', {
            inputType: event.inputType,
            data: event.data
        });
    }

    handleKeyDown(event) {
        this.debug('handleKeyDown', `Key: ${event.key}`);
        this.fireEvent('keydown', 'interaction', {
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey
        });

        // Handle keyboard shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'b':
                    event.preventDefault();
                    document.execCommand('bold', false, null);
                    this.fireEvent('shortcut-executed', 'interaction', { shortcut: 'Ctrl+B', command: 'bold' });
                    break;
                case 'i':
                    event.preventDefault();
                    document.execCommand('italic', false, null);
                    this.fireEvent('shortcut-executed', 'interaction', { shortcut: 'Ctrl+I', command: 'italic' });
                    break;
                case 'u':
                    event.preventDefault();
                    document.execCommand('underline', false, null);
                    this.fireEvent('shortcut-executed', 'interaction', { shortcut: 'Ctrl+U', command: 'underline' });
                    break;
            }
        }
    }

    handleKeyUp(event) {
        this.updateSelectionInfo();
        this.updateToolbarState();

        this.fireEvent('keyup', 'interaction', {
            key: event.key,
            code: event.code
        });
    }

    handleClick(event) {
        this.debug('handleClick', 'Click event received');
        const editor = this.getEditorElement();
        const rect = editor.getBoundingClientRect();

        this.fireEvent('click', 'interaction', {
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
            clientX: event.clientX,
            clientY: event.clientY,
            target: event.target.tagName,
            targetClass: event.target.className
        });

        this.updateSelectionInfo();
        this.updateToolbarState();
    }

    handleMouseUp(event) {
        this.updateSelectionInfo();
        this.updateToolbarState();

        const selectedText = this.getSelectedText();
        if (selectedText) {
            this.fireEvent('text-selected', 'selection', {
                text: selectedText.substring(0, 100),
                length: selectedText.length
            });
        }
    }

    handleFocus(event) {
        this.debug('handleFocus', 'Focus event received');
        this.fireEvent('focus', 'interaction', { source: 'user' });
    }

    handleBlur(event) {
        this.debug('handleBlur', 'Blur event received');
        this.fireEvent('blur', 'interaction', { source: 'user' });
    }

    handlePaste(event) {
        const clipboardData = event.clipboardData;

        this.fireEvent('paste', 'content', {
            hasText: clipboardData?.types.includes('text/plain'),
            hasHtml: clipboardData?.types.includes('text/html'),
            types: Array.from(clipboardData?.types || [])
        });

        // Let default paste happen, then update counts
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.updateCounts();
            this.notifyContentChange();
        }, 0);
    }

    handleContextMenu(event) {
        const editor = this.getEditorElement();
        const rect = editor.getBoundingClientRect();

        this.fireEvent('contextmenu', 'interaction', {
            x: Math.round(event.clientX - rect.left),
            y: Math.round(event.clientY - rect.top),
            clientX: event.clientX,
            clientY: event.clientY
        });

        // You could prevent default and show custom menu here
        // event.preventDefault();
    }

    // ==================== UTILITY METHODS ====================

    updateCounts() {
        const editor = this.getEditorElement();
        if (!editor) return;

        const text = editor.innerText || '';
        this.characterCount = text.length;
        this.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    }

    updateSelectionInfo() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            this.selectionInfo = '';
            return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();

        if (selectedText.length > 0) {
            this.selectionInfo = `Selected: ${selectedText.length} chars`;
            this.fireEvent('selection-change', 'selection', {
                hasSelection: true,
                length: selectedText.length,
                text: selectedText.substring(0, 50)
            });
        } else {
            this.selectionInfo = '';
            this.fireEvent('selection-change', 'selection', {
                hasSelection: false,
                collapsed: range.collapsed
            });
        }
    }

    updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'];

        commands.forEach(cmd => {
            const buttons = this.template.querySelectorAll(`.toolbar-btn[data-command="${cmd}"]`);
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
        const headingSelect = this.template.querySelector('.toolbar-select');
        if (headingSelect) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                let node = sel.anchorNode;
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

    notifyContentChange() {
        const editor = this.getEditorElement();
        if (!editor) return;

        const currentContent = editor.innerHTML;
        if (currentContent !== this._lastContent) {
            this._lastContent = currentContent;

            this.fireEvent('content-change', 'content', {
                contentLength: currentContent.length,
                characterCount: this.characterCount,
                wordCount: this.wordCount
            });

            this.dispatchEvent(new CustomEvent('contentchange', {
                detail: {
                    editor: EDITOR_NAME,
                    content: currentContent
                }
            }));
        }
    }

    fireEvent(eventType, category, details) {
        // Don't log debug events to avoid infinite loop
        if (DEBUG && category !== 'debug') {
            console.log(`[EditorCustom.fireEvent] Dispatching: ${eventType} (${category})`, details);
        }

        try {
            const event = new CustomEvent('editorevent', {
                detail: {
                    editor: EDITOR_NAME,
                    eventType,
                    category,
                    details
                },
                bubbles: true,
                composed: true
            });

            this.dispatchEvent(event);

            if (DEBUG && category !== 'debug') {
                console.log(`[EditorCustom.fireEvent] Event dispatched successfully`);
            }
        } catch (error) {
            console.error(`[EditorCustom.fireEvent] ERROR dispatching event:`, error);
        }
    }
}
