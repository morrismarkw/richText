import { LightningElement, api, track } from 'lwc';

const EDITOR_NAME = 'QuillBlot';

// Regex pattern for tables - they don't typically nest so regex is safe
const TABLE_PATTERN = /<table[\s\S]*?<\/table>/gi;

// Pattern for horizontal rules with styling (self-closing, no nesting issues)
const HR_PATTERN = /<hr\s+[^>]*style="[^"]*"[^>]*\/?>/gi;

// Pattern for styled blockquotes (Quill strips inline styles from blockquotes)
const BLOCKQUOTE_PATTERN = /<blockquote\s+[^>]*style="[^"]*"[^>]*>[\s\S]*?<\/blockquote>/gi;

// Pattern for styled pre/code blocks (Quill converts to ql-syntax, losing styles)
const STYLED_PRE_PATTERN = /<pre\s+[^>]*style="[^"]*"[^>]*>[\s\S]*?<\/pre>/gi;

// Pattern to identify styled divs that Quill won't preserve
// Matches divs with: display:flex, background color (#hex or rgb), border-radius
const STYLED_DIV_START_PATTERN = /<div\s+[^>]*style="[^"]*(?:display:\s*flex|background(?:-color)?:\s*(?:#[0-9a-f]|rgb)|border-radius:)[^"]*"[^>]*>/i;

export default class EditorQuillBlot extends LightningElement {
    @track isLoaded = false;

    quillInstance = null;
    _componentRegistry = {};
    _blotRegistered = false;
    _defaultDisplayMode = 'preview'; // 'badge', 'render', or 'preview'

    renderedCallback() {
        if (this.isLoaded || !window.Quill) return;
        this.initializeQuill();
    }

    initializeQuill() {
        const container = this.refs.quillContainer;
        if (!container || this.quillInstance) return;

        // Register custom Blot before creating Quill instance
        this.registerComponentBlot();

        // Register color/background formats to preserve inline styles when loading content
        const Quill = window.Quill;
        const ColorStyle = Quill.import('attributors/style/color');
        const BackgroundStyle = Quill.import('attributors/style/background');
        Quill.register(ColorStyle, true);
        Quill.register(BackgroundStyle, true);

        // Create editor div inside container (same pattern as editorQuill for proper event handling)
        const editorDiv = document.createElement('div');
        editorDiv.className = 'quill-editor';
        container.appendChild(editorDiv);

        // Create Quill instance with all available toolbar options (no formats whitelist = all allowed)
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

        // Listen for changes
        this.quillInstance.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') {
                this.fireEvent('content-change', 'content', {
                    source: 'user',
                    hasComponents: Object.keys(this._componentRegistry).length > 0
                });

                // Dispatch content change for parent
                this.dispatchEvent(new CustomEvent('contentchange', {
                    detail: {
                        editor: EDITOR_NAME,
                        content: this.getContent(),  // Raw with blots restored
                        convertedContent: this.getConvertedContent(),  // For preview
                        registry: this._componentRegistry
                    }
                }));
            }
        });

        this.quillInstance.on('selection-change', (range) => {
            if (range) {
                this.fireEvent('selection-change', 'interaction', {
                    index: range.index,
                    length: range.length
                });
            }
        });

        // Listen for clicks on component placeholders
        this.quillInstance.root.addEventListener('click', (event) => {
            this.handleEditorClick(event);
        });

        this.isLoaded = true;
        this.fireEvent('editor-ready', 'lifecycle', {
            editor: EDITOR_NAME,
            blotRegistered: this._blotRegistered,
            capabilities: {
                componentPlaceholder: true,
                preservesTables: true,
                preservesStyledDivs: true
            }
        });
    }

    registerComponentBlot() {
        if (this._blotRegistered) return;

        const Quill = window.Quill;
        const BlockEmbed = Quill.import('blots/block/embed');
        const self = this;

        class ComponentPlaceholder extends BlockEmbed {
            static blotName = 'component-placeholder';
            static tagName = 'div';
            static className = 'ql-component-placeholder';

            static create(value) {
                const node = super.create();
                node.setAttribute('data-component-id', value.id);
                node.setAttribute('data-component-type', value.type);
                node.setAttribute('data-display-mode', value.displayMode || 'badge');
                node.setAttribute('contenteditable', 'false');

                // Determine what to display based on displayMode
                // 'preview' = custom preview HTML
                // 'render' = render actual HTML
                // 'badge' = show icon/type badge (default)
                const displayMode = value.displayMode || 'badge';

                if (displayMode === 'preview' && value.preview) {
                    // Custom preview HTML
                    node.innerHTML = `<div class="component-preview">${value.preview}</div>`;
                } else if (displayMode === 'render' && value.html) {
                    // Render actual HTML (scaled down, non-interactive)
                    node.innerHTML = `<div class="component-render">${value.html}</div>`;
                } else {
                    // Default badge display
                    const icon = ComponentPlaceholder.getIcon(value.type);
                    node.innerHTML = `
                        <span class="component-badge">
                            <span class="component-icon">${icon}</span>
                            <span class="component-type">${value.type}</span>
                            <span class="component-id">${value.id.substring(0, 8)}...</span>
                        </span>
                    `;
                }
                return node;
            }

            static value(node) {
                return {
                    id: node.getAttribute('data-component-id'),
                    type: node.getAttribute('data-component-type'),
                    displayMode: node.getAttribute('data-display-mode') || 'badge'
                };
            }

            static getIcon(type) {
                const icons = {
                    'TABLE': '📊',
                    'STYLED_DIV': '📦',
                    'BLOCKQUOTE': '💬',
                    'CODE_BLOCK': '💻',
                    'HR': '➖',
                    'SIGNATURE': '✍️',
                    'CHOICE_FIELD': '☑️',
                    'ENTRY_FIELD': '📝',
                    'CHART': '📈',
                    'CODE': '💻',
                    'RAW_HTML': '🔧'
                };
                return icons[type] || '📦';
            }
        }

        Quill.register(ComponentPlaceholder);
        this._blotRegistered = true;
    }

    // ==================== PUBLIC API ====================

    @api
    getContent() {
        if (!this.quillInstance) return '';

        // Get raw HTML from Quill with blots restored to original HTML
        let html = this.quillInstance.root.innerHTML;
        html = this.restoreComponents(html);

        this.fireEvent('content-get', 'api', {
            contentLength: html.length,
            componentsRestored: Object.keys(this._componentRegistry).length
        });

        return html;
    }

    @api
    getConvertedContent() {
        if (!this.quillInstance) return '';

        // Get HTML, restore blots, then convert Quill classes to standard HTML
        let html = this.quillInstance.root.innerHTML;
        html = this.restoreComponents(html);
        html = this.convertToStandardHtml(html);

        this.fireEvent('content-get-converted', 'api', {
            contentLength: html.length,
            componentsRestored: Object.keys(this._componentRegistry).length
        });

        return html;
    }

    @api
    setContent(html) {
        if (!this.quillInstance) return;

        const previousLength = this.quillInstance.root.innerHTML?.length || 0;

        // Clear existing registry
        this._componentRegistry = {};

        // Extract components and get processed HTML
        const processed = this.extractComponents(html || '');

        // Clear and set content using clipboard for proper parsing
        this.quillInstance.setContents([]);
        if (processed.html) {
            this.quillInstance.clipboard.dangerouslyPasteHTML(0, processed.html);
        }

        // Refresh blot displays based on registry settings (applies displayMode)
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.refreshAllBlotDisplays();
        }, 0);

        this.fireEvent('content-set', 'api', {
            previousLength,
            newLength: html?.length || 0,
            componentsExtracted: Object.keys(this._componentRegistry).length
        });
    }

    @api
    insertContent(html, position = 'end') {
        if (!this.quillInstance) return;

        // Extract components from new content
        const processed = this.extractComponents(html);

        const length = this.quillInstance.getLength();
        const index = position === 'start' ? 0 : length - 1;

        this.quillInstance.clipboard.dangerouslyPasteHTML(index, processed.html);

        this.fireEvent('content-insert', 'api', {
            position,
            componentsExtracted: Object.keys(processed.newComponents).length
        });
    }

    @api
    getIsLoaded() {
        return this.isLoaded;
    }

    @api
    getRegistry() {
        return { ...this._componentRegistry };
    }

    @api
    getRegistryCount() {
        return Object.keys(this._componentRegistry).length;
    }

    @api
    setDefaultDisplayMode(mode) {
        // Set default display mode: 'badge', 'render', or 'preview'
        this._defaultDisplayMode = mode;
    }

    @api
    insertComponent(componentData) {
        // Insert a custom component at cursor position
        // componentData: { type, html, preview?, displayMode? }
        if (!this.quillInstance) return null;

        const id = this.generateUUID();
        const htmlContent = componentData.html || '';
        const component = {
            type: componentData.type || 'CUSTOM',
            html: htmlContent,
            preview: componentData.preview || htmlContent,  // Default preview to source HTML
            displayMode: componentData.displayMode || this._defaultDisplayMode,
            created: new Date().toISOString()
        };

        this._componentRegistry[id] = component;

        // Get current selection or end of document
        const range = this.quillInstance.getSelection();
        const index = range ? range.index : this.quillInstance.getLength() - 1;

        // Insert the blot
        this.quillInstance.insertEmbed(index, 'component-placeholder', {
            id: id,
            type: component.type,
            displayMode: component.displayMode,
            preview: component.preview,
            html: component.html
        });

        this.fireEvent('component-inserted', 'api', {
            componentId: id,
            componentType: component.type,
            displayMode: component.displayMode
        });

        return id;
    }

    @api
    updateComponentDisplay(componentId, displayMode, preview = null) {
        // Update how a component is displayed in the editor
        const component = this._componentRegistry[componentId];
        if (!component) return false;

        component.displayMode = displayMode;
        if (preview !== null) {
            component.preview = preview;
        }

        // Find and update the blot element
        this.refreshBlotDisplay(componentId);
        return true;
    }

    refreshBlotDisplay(componentId) {
        if (!this.quillInstance) return;

        const placeholder = this.quillInstance.root.querySelector(
            `.ql-component-placeholder[data-component-id="${componentId}"]`
        );

        if (placeholder) {
            const component = this._componentRegistry[componentId];
            const displayMode = component.displayMode || this._defaultDisplayMode;

            placeholder.setAttribute('data-display-mode', displayMode);

            if (displayMode === 'preview' && component.preview) {
                placeholder.innerHTML = `<div class="component-preview">${component.preview}</div>`;
            } else if (displayMode === 'render' && component.html) {
                placeholder.innerHTML = `<div class="component-render">${component.html}</div>`;
            } else {
                // Badge mode
                const icons = {
                    'TABLE': '📊', 'STYLED_DIV': '📦', 'BLOCKQUOTE': '💬', 'CODE_BLOCK': '💻',
                    'HR': '➖', 'SIGNATURE': '✍️', 'CHOICE_FIELD': '☑️', 'ENTRY_FIELD': '📝',
                    'CHART': '📈', 'CODE': '💻', 'RAW_HTML': '🔧'
                };
                const icon = icons[component.type] || '📦';
                placeholder.innerHTML = `
                    <span class="component-badge">
                        <span class="component-icon">${icon}</span>
                        <span class="component-type">${component.type}</span>
                        <span class="component-id">${componentId.substring(0, 8)}...</span>
                    </span>
                `;
            }
        }
    }

    refreshAllBlotDisplays() {
        // Refresh display of all blots based on registry settings
        Object.keys(this._componentRegistry).forEach(id => {
            this.refreshBlotDisplay(id);
        });
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
        const lists = container.querySelectorAll('ul, ol');

        lists.forEach(list => {
            const items = Array.from(list.children).filter(el => el.tagName === 'LI');
            if (items.length === 0) return;

            let currentLevel = 0;
            let currentParent = list;
            const parentStack = [{ element: list, level: 0 }];

            items.forEach(item => {
                // Safely handle missing className
                const className = item.className || '';
                const indentMatch = className.match(/ql-indent-(\d+)/);
                const itemLevel = indentMatch ? parseInt(indentMatch[1], 10) : 0;

                if (itemLevel > 0) {
                    item.classList.remove(`ql-indent-${itemLevel}`);
                }
                if (item.classList && item.classList.length === 0) {
                    item.removeAttribute('class');
                }

                if (itemLevel > currentLevel) {
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
                    while (parentStack.length > 1 && parentStack[parentStack.length - 1].level > itemLevel) {
                        parentStack.pop();
                    }
                    currentParent = parentStack[parentStack.length - 1].element;
                }

                currentLevel = itemLevel;

                if (item.parentElement !== currentParent) {
                    currentParent.appendChild(item);
                }
            });
        });
    }

    removeQuillClasses(container) {
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

    // ==================== COMPONENT EXTRACTION ====================

    /**
     * Extract tables and styled divs that Quill can't preserve
     * - Tables: use regex (they rarely nest)
     * - Styled divs: use depth-counting to handle nesting correctly
     */
    extractComponents(html) {
        if (!html) return { html: '', newComponents: {} };

        let processedHtml = html;
        const newComponents = {};

        // Extract styled divs first (they may contain other elements)
        processedHtml = this.extractStyledDivs(processedHtml, newComponents);

        // Extract styled pre/code blocks - Quill converts these to ql-syntax, losing styles
        processedHtml = processedHtml.replace(STYLED_PRE_PATTERN, (match) => {
            const id = this.generateUUID();
            const component = {
                type: 'CODE_BLOCK',
                html: match,
                preview: match,  // Use source HTML as preview
                displayMode: this._defaultDisplayMode,
                created: new Date().toISOString()
            };

            this._componentRegistry[id] = component;
            newComponents[id] = component;

            return `<div class="ql-component-placeholder" data-component-id="${id}" data-component-type="CODE_BLOCK" data-display-mode="${this._defaultDisplayMode}"></div>`;
        });

        // Extract styled blockquotes - Quill strips their inline styles
        processedHtml = processedHtml.replace(BLOCKQUOTE_PATTERN, (match) => {
            const id = this.generateUUID();
            const component = {
                type: 'BLOCKQUOTE',
                html: match,
                preview: match,  // Use source HTML as preview
                displayMode: this._defaultDisplayMode,
                created: new Date().toISOString()
            };

            this._componentRegistry[id] = component;
            newComponents[id] = component;

            return `<div class="ql-component-placeholder" data-component-id="${id}" data-component-type="BLOCKQUOTE" data-display-mode="${this._defaultDisplayMode}"></div>`;
        });

        // Extract tables using regex - tables rarely nest so this is safe
        processedHtml = processedHtml.replace(TABLE_PATTERN, (match) => {
            const id = this.generateUUID();
            const component = {
                type: 'TABLE',
                html: match,
                preview: match,  // Use source HTML as preview
                displayMode: this._defaultDisplayMode,
                created: new Date().toISOString()
            };

            this._componentRegistry[id] = component;
            newComponents[id] = component;

            // Return placeholder that Quill will convert to our Blot
            return `<div class="ql-component-placeholder" data-component-id="${id}" data-component-type="TABLE" data-display-mode="${this._defaultDisplayMode}"></div>`;
        });

        // Extract styled horizontal rules - self-closing so regex is safe
        processedHtml = processedHtml.replace(HR_PATTERN, (match) => {
            const id = this.generateUUID();
            const component = {
                type: 'HR',
                html: match,
                preview: match,  // Use source HTML as preview
                displayMode: this._defaultDisplayMode,
                created: new Date().toISOString()
            };

            this._componentRegistry[id] = component;
            newComponents[id] = component;

            return `<div class="ql-component-placeholder" data-component-id="${id}" data-component-type="HR" data-display-mode="${this._defaultDisplayMode}"></div>`;
        });

        return { html: processedHtml, newComponents };
    }

    /**
     * Extract styled divs with proper nested div handling
     * Uses depth counting to find the correct closing </div>
     */
    extractStyledDivs(html, newComponents) {
        let result = html;
        let changed = true;

        // Keep extracting until no more styled divs found
        while (changed) {
            changed = false;

            // Find a div with styling that Quill won't preserve
            const match = STYLED_DIV_START_PATTERN.exec(result);

            if (match) {
                const startIndex = match.index;
                const openTag = match[0];

                // Find matching closing </div> by counting depth
                let depth = 1;
                let pos = startIndex + openTag.length;

                while (depth > 0 && pos < result.length) {
                    const remaining = result.substring(pos);
                    const openMatch = /<div[\s>]/i.exec(remaining);
                    const closeMatch = /<\/div>/i.exec(remaining);

                    if (!closeMatch) break;

                    const openIdx = openMatch ? openMatch.index : Infinity;
                    const closeIdx = closeMatch.index;

                    if (openIdx < closeIdx) {
                        // Found another opening div first
                        depth++;
                        pos += openIdx + 1;
                    } else {
                        // Found a closing div
                        depth--;
                        if (depth === 0) {
                            // This is our matching closing tag
                            const endPos = pos + closeIdx + 6; // '</div>'.length = 6
                            const fullDiv = result.substring(startIndex, endPos);

                            const id = this.generateUUID();
                            const component = {
                                type: 'STYLED_DIV',
                                html: fullDiv,
                                preview: fullDiv,  // Use source HTML as preview
                                displayMode: this._defaultDisplayMode,
                                created: new Date().toISOString()
                            };
                            this._componentRegistry[id] = component;
                            newComponents[id] = component;

                            const placeholder = `<div class="ql-component-placeholder" data-component-id="${id}" data-component-type="STYLED_DIV" data-display-mode="${this._defaultDisplayMode}"></div>`;
                            result = result.substring(0, startIndex) + placeholder + result.substring(endPos);
                            changed = true;
                            break;
                        }
                        pos += closeIdx + 6;
                    }
                }
            }
        }

        return result;
    }

    restoreComponents(html) {
        if (!html) return '';

        // Match the Blot's rendered HTML structure
        const blotPattern = /<div[^>]*class="ql-component-placeholder"[^>]*data-component-id="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi;

        return html.replace(blotPattern, (match, id) => {
            const component = this._componentRegistry[id];
            if (component) {
                return component.html;
            }
            return `<!-- Missing component: ${id} -->`;
        });
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ==================== COMPONENT EDITOR ====================

    handleEditorClick(event) {
        // Check if click was on a component placeholder
        const placeholder = event.target.closest('.ql-component-placeholder');
        if (placeholder) {
            const componentId = placeholder.getAttribute('data-component-id');
            const componentType = placeholder.getAttribute('data-component-type');

            if (componentId && this._componentRegistry[componentId]) {
                this.openComponentEditor(componentId, componentType);
            }
        }
    }

    openComponentEditor(componentId, componentType) {
        const component = this._componentRegistry[componentId];
        if (!component) return;

        const dialog = this.refs.editorDialog;
        if (dialog) {
            dialog.open({
                id: componentId,
                type: componentType,
                html: component.html
            });

            this.fireEvent('component-edit-opened', 'interaction', {
                componentId,
                componentType
            });
        }
    }

    handleComponentSave(event) {
        const { id, type, html } = event.detail;

        // Update the registry
        if (this._componentRegistry[id]) {
            this._componentRegistry[id].html = html;
            this._componentRegistry[id].modified = new Date().toISOString();

            this.fireEvent('component-saved', 'content', {
                componentId: id,
                componentType: type,
                htmlLength: html.length
            });

            // Dispatch content change to parent
            this.dispatchEvent(new CustomEvent('contentchange', {
                detail: {
                    editor: EDITOR_NAME,
                    content: this.getContent(),
                    convertedContent: this.getConvertedContent(),
                    registry: this._componentRegistry
                }
            }));
        }
    }

    handleComponentDelete(event) {
        const { id } = event.detail;

        if (this._componentRegistry[id]) {
            const componentType = this._componentRegistry[id].type;

            // Remove from registry
            delete this._componentRegistry[id];

            // Find and remove the blot from the editor
            const placeholder = this.quillInstance.root.querySelector(
                `.ql-component-placeholder[data-component-id="${id}"]`
            );
            if (placeholder) {
                placeholder.remove();
            }

            this.fireEvent('component-deleted', 'content', {
                componentId: id,
                componentType
            });

            // Dispatch content change to parent
            this.dispatchEvent(new CustomEvent('contentchange', {
                detail: {
                    editor: EDITOR_NAME,
                    content: this.getContent(),
                    convertedContent: this.getConvertedContent(),
                    registry: this._componentRegistry
                }
            }));
        }
    }

    handleComponentCancel() {
        this.fireEvent('component-edit-cancelled', 'interaction', {});
    }

    // ==================== UTILITY ====================

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
