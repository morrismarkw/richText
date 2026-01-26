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

        // Register color/background formats to preserve inline styles when loading content
        // eslint-disable-next-line no-undef
        const Quill = window.Quill;
        const ColorStyle = Quill.import('attributors/style/color');
        const BackgroundStyle = Quill.import('attributors/style/background');
        Quill.register(ColorStyle, true);
        Quill.register(BackgroundStyle, true);

        // Initialize Quill with all available toolbar options (no formats whitelist = all allowed)
        this.quillInstance = new Quill(editorDiv, {
            theme: 'snow',
            placeholder: 'Enter content here...',
            modules: {
                toolbar: [
                    // Text style
                    [{ font: [] }],
                    [{ size: ['small', false, 'large', 'huge'] }],
                    [{ header: [1, 2, 3, 4, 5, 6, false] }],

                    // Formatting
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ script: 'sub' }, { script: 'super' }],

                    // Color
                    [{ color: [] }, { background: [] }],

                    // Blocks
                    ['blockquote', 'code-block'],

                    // Lists & indent
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ indent: '-1' }, { indent: '+1' }],

                    // Alignment & direction
                    [{ align: [] }],
                    [{ direction: 'rtl' }],

                    // Embeds
                    ['link', 'image', 'video'],

                    // Clear
                    ['clean']
                ],
                history: {
                    delay: 1000,
                    maxStack: 100,
                    userOnly: true
                }
            }
        });

        this.setupEventListeners();
        this.isLoaded = true;

        // Apply pending content if any
        if (this._pendingContent !== null) {
            this.quillInstance.clipboard.dangerouslyPasteHTML(0, this._pendingContent);
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

        // Text change events - only dispatch for user-initiated changes
        quill.on('text-change', (delta, oldDelta, source) => {
            this.fireEvent('content-change', 'content', {
                delta: this.sanitizeDelta(delta),
                source,
                contentLength: quill.getLength()
            });

            // Only dispatch contentchange for actual user edits, not API/focus changes
            if (source === 'user') {
                const rawHtml = quill.root.innerHTML;
                let convertedHtml = rawHtml;
                try {
                    convertedHtml = this.convertToStandardHtml(rawHtml);
                } catch (e) {
                    console.error('Quill HTML conversion error:', e);
                }
                this.dispatchEvent(new CustomEvent('contentchange', {
                    detail: {
                        editor: EDITOR_NAME,
                        content: rawHtml,
                        convertedContent: convertedHtml
                    }
                }));
            }
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

    // ==================== HTML CONVERSION ====================

    /**
     * Convert Quill's HTML output to standard HTML
     * - Converts ql-align-* to text-align styles
     * - Converts ql-font-* to font-family styles
     * - Converts ql-size-* to font-size styles
     * - Converts ql-direction-rtl to dir attribute
     * - Converts ql-indent-N classes to nested lists
     * - Removes remaining Quill-specific classes
     */
    convertToStandardHtml(html) {
        if (!html) return '';

        // Create a temporary container to manipulate the DOM
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Convert Quill classes to inline styles BEFORE removing them
        this.convertAlignmentClasses(temp);
        this.convertFontClasses(temp);
        this.convertSizeClasses(temp);
        this.convertDirectionClasses(temp);
        this.convertCodeBlocks(temp);

        // Convert indented lists to nested structure
        this.convertIndentedLists(temp);

        // Remove remaining Quill-specific classes
        this.removeQuillClasses(temp);

        return temp.innerHTML;
    }

    /**
     * Convert ql-align-* classes to text-align styles
     */
    convertAlignmentClasses(container) {
        const alignmentMap = {
            'ql-align-center': 'center',
            'ql-align-right': 'right',
            'ql-align-justify': 'justify'
            // 'left' is default, no class needed
        };

        Object.entries(alignmentMap).forEach(([className, alignValue]) => {
            const elements = container.querySelectorAll(`.${className}`);
            elements.forEach(el => {
                el.style.textAlign = alignValue;
                el.classList.remove(className);
            });
        });
    }

    /**
     * Convert ql-font-* classes to font-family styles
     */
    convertFontClasses(container) {
        const fontMap = {
            'ql-font-serif': 'Georgia, Times New Roman, serif',
            'ql-font-monospace': 'Monaco, Courier New, monospace'
            // sans-serif is default
        };

        Object.entries(fontMap).forEach(([className, fontValue]) => {
            const elements = container.querySelectorAll(`.${className}`);
            elements.forEach(el => {
                el.style.fontFamily = fontValue;
                el.classList.remove(className);
            });
        });
    }

    /**
     * Convert ql-size-* classes to font-size styles
     */
    convertSizeClasses(container) {
        const sizeMap = {
            'ql-size-small': '0.75em',
            'ql-size-large': '1.5em',
            'ql-size-huge': '2.5em'
            // 'normal' is default (false in Quill config)
        };

        Object.entries(sizeMap).forEach(([className, sizeValue]) => {
            const elements = container.querySelectorAll(`.${className}`);
            elements.forEach(el => {
                el.style.fontSize = sizeValue;
                el.classList.remove(className);
            });
        });
    }

    /**
     * Convert ql-direction-rtl class to dir attribute
     */
    convertDirectionClasses(container) {
        const rtlElements = container.querySelectorAll('.ql-direction-rtl');
        rtlElements.forEach(el => {
            el.setAttribute('dir', 'rtl');
            el.classList.remove('ql-direction-rtl');
        });
    }

    /**
     * Convert ql-syntax code blocks to inline styled pre elements
     */
    convertCodeBlocks(container) {
        const codeBlocks = container.querySelectorAll('pre.ql-syntax');
        codeBlocks.forEach(el => {
            el.style.backgroundColor = '#23241f';
            el.style.color = '#f8f8f2';
            el.style.padding = '12px';
            el.style.borderRadius = '4px';
            el.style.fontFamily = 'Monaco, Consolas, "Courier New", monospace';
            el.style.fontSize = '13px';
            el.style.overflow = 'auto';
            el.style.whiteSpace = 'pre';
            el.classList.remove('ql-syntax');
        });
    }

    convertIndentedLists(container) {
        // Process both ul and ol lists
        const lists = container.querySelectorAll('ul, ol');

        lists.forEach(list => {
            const items = Array.from(list.children).filter(el => el.tagName === 'LI');
            if (items.length === 0) return;

            // Build nested structure
            let currentLevel = 0;
            let currentParent = list;
            const parentStack = [{ element: list, level: 0 }];

            items.forEach(item => {
                // Get indent level from class (safely handle missing className)
                const className = item.className || '';
                const indentMatch = className.match(/ql-indent-(\d+)/);
                const itemLevel = indentMatch ? parseInt(indentMatch[1], 10) : 0;

                // Remove the indent class if present
                if (itemLevel > 0) {
                    item.classList.remove(`ql-indent-${itemLevel}`);
                }
                if (item.classList && item.classList.length === 0) {
                    item.removeAttribute('class');
                }

                if (itemLevel > currentLevel) {
                    // Need to nest deeper - create new sublists
                    for (let i = currentLevel; i < itemLevel; i++) {
                        const newList = document.createElement(list.tagName.toLowerCase());
                        const lastItem = currentParent.lastElementChild;
                        if (lastItem && lastItem.tagName === 'LI') {
                            lastItem.appendChild(newList);
                            parentStack.push({ element: newList, level: i + 1 });
                            currentParent = newList;
                        }
                    }
                } else if (itemLevel < currentLevel) {
                    // Go back up the tree
                    while (parentStack.length > 1 && parentStack[parentStack.length - 1].level > itemLevel) {
                        parentStack.pop();
                    }
                    currentParent = parentStack[parentStack.length - 1].element;
                }

                currentLevel = itemLevel;

                // Move item to current parent if needed
                if (item.parentElement !== currentParent) {
                    currentParent.appendChild(item);
                }
            });
        });
    }

    removeQuillClasses(container) {
        // Remove ql-* classes from all elements
        const elements = container.querySelectorAll('[class*="ql-"]');
        elements.forEach(el => {
            const classes = Array.from(el.classList);
            classes.forEach(cls => {
                if (cls.startsWith('ql-')) {
                    el.classList.remove(cls);
                }
            });
            if (el.classList.length === 0) {
                el.removeAttribute('class');
            }
        });
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
    getConvertedContent() {
        if (!this.quillInstance) return '';
        const rawContent = this.quillInstance.root.innerHTML;
        const converted = this.convertToStandardHtml(rawContent);
        this.fireEvent('content-get-converted', 'api', {
            rawLength: rawContent.length,
            convertedLength: converted.length
        });
        return converted;
    }

    @api
    setContent(html) {
        if (!this.quillInstance) {
            this._pendingContent = html;
            return;
        }

        const previousLength = this.quillInstance.root.innerHTML.length;

        // Clear existing content and use clipboard to properly parse HTML
        this.quillInstance.setContents([]);
        if (html) {
            this.quillInstance.clipboard.dangerouslyPasteHTML(0, html);
        }

        this.fireEvent('content-set', 'api', {
            previousLength,
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
