import { createElement } from 'lwc';
import EditorQuillBlot from 'c/editorQuillBlot';

const mockQuillInstance = {
    root: {
        innerHTML: '',
        addEventListener: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn().mockReturnValue([])
    },
    on: jest.fn(),
    getSelection: jest.fn().mockReturnValue({ index: 0, length: 0 }),
    getLength: jest.fn().mockReturnValue(1),
    setContents: jest.fn(),
    insertEmbed: jest.fn(),
    clipboard: {
        dangerouslyPasteHTML: jest.fn()
    }
};

const mockQuillClass = jest.fn().mockImplementation(() => mockQuillInstance);
mockQuillClass.import = jest.fn().mockReturnValue(class {});
mockQuillClass.register = jest.fn();

describe('c-editor-quill-blot', () => {
    beforeEach(() => {
        window.Quill = mockQuillClass;
        mockQuillInstance.root.innerHTML = '';
        mockQuillInstance.on.mockClear();
        mockQuillClass.mockClear();
        mockQuillInstance.root.querySelector.mockReturnValue(null);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete window.Quill;
    });

    function createComponent() {
        const element = createElement('c-editor-quill-blot', {
            is: EditorQuillBlot
        });
        document.body.appendChild(element);
        return element;
    }

    describe('initialization', () => {
        it('initializes when Quill is available', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            expect(element.getIsLoaded()).toBe(true);
        });

        it('registers custom blot with Quill', async () => {
            createComponent();
            await Promise.resolve();
            await Promise.resolve();

            expect(mockQuillClass.register).toHaveBeenCalled();
        });

        it('fires editor-ready event', async () => {
            const handler = jest.fn();
            const element = createElement('c-editor-quill-blot', {
                is: EditorQuillBlot
            });
            element.addEventListener('editorevent', handler);
            document.body.appendChild(element);

            await Promise.resolve();
            await Promise.resolve();

            const readyEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'editor-ready'
            );
            expect(readyEvents.length).toBeGreaterThan(0);
            expect(readyEvents[0][0].detail.editor).toBe('QuillBlot');
        });

        it('does not initialize without Quill', async () => {
            delete window.Quill;
            const element = createComponent();
            await Promise.resolve();

            expect(element.getIsLoaded()).toBe(false);
        });
    });

    describe('public API', () => {
        it('returns isLoaded state', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            expect(element.getIsLoaded()).toBe(true);
        });

        it('returns empty registry initially', async () => {
            const element = createComponent();
            await Promise.resolve();

            expect(element.getRegistry()).toEqual({});
            expect(element.getRegistryCount()).toBe(0);
        });

        it('sets default display mode', async () => {
            const element = createComponent();
            await Promise.resolve();

            element.setDefaultDisplayMode('render');
        });
    });

    describe('content operations', () => {
        it('gets content with components restored', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p>Test</p>';

            const content = element.getContent();
            expect(content).toBe('<p>Test</p>');
        });

        it('gets converted content', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p class="ql-align-center">Centered</p>';

            const converted = element.getConvertedContent();
            expect(converted).toContain('text-align');
        });

        it('sets content and extracts components', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.setContent('<p>Text</p><table><tr><td>Cell</td></tr></table>');

            expect(mockQuillInstance.setContents).toHaveBeenCalled();
            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalled();
        });

        it('handles null content in setContent', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.setContent(null);

            expect(mockQuillInstance.setContents).toHaveBeenCalled();
        });

        it('inserts content at end', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.getLength.mockReturnValue(50);

            element.insertContent('<p>New</p>', 'end');

            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(49, expect.any(String));
        });

        it('inserts content at start', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.insertContent('<p>New</p>', 'start');

            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(0, expect.any(String));
        });
    });

    describe('component extraction', () => {
        it('extracts tables from content', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const tableHtml = '<table><tr><td>Test</td></tr></table>';
            element.setContent(`<p>Before</p>${tableHtml}<p>After</p>`);

            expect(element.getRegistryCount()).toBeGreaterThan(0);
        });

        it('extracts styled divs', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const styledDiv = '<div style="display: flex; background-color: #f00;">Content</div>';
            element.setContent(styledDiv);

            expect(element.getRegistryCount()).toBeGreaterThan(0);
        });

        it('extracts styled horizontal rules', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const styledHr = '<hr style="border: 2px solid red;" />';
            element.setContent(`<p>Before</p>${styledHr}<p>After</p>`);

            expect(element.getRegistryCount()).toBeGreaterThan(0);
        });

        it('extracts styled blockquotes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const blockquote = '<blockquote style="border-left: 3px solid blue;">Quote</blockquote>';
            element.setContent(blockquote);

            expect(element.getRegistryCount()).toBeGreaterThan(0);
        });

        it('extracts styled pre blocks', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const pre = '<pre style="background: #333; color: #fff;">code</pre>';
            element.setContent(pre);

            expect(element.getRegistryCount()).toBeGreaterThan(0);
        });

        it('clears registry on new content', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.setContent('<table><tr><td>1</td></tr></table>');
            const firstCount = element.getRegistryCount();

            element.setContent('<p>Plain text</p>');

            expect(element.getRegistryCount()).toBe(0);
            expect(firstCount).toBeGreaterThan(0);
        });
    });

    describe('insertComponent', () => {
        it('inserts custom component at cursor', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.getSelection.mockReturnValue({ index: 10, length: 0 });

            const id = element.insertComponent({
                type: 'CUSTOM',
                html: '<div>Custom content</div>'
            });

            expect(id).toBeDefined();
            expect(mockQuillInstance.insertEmbed).toHaveBeenCalled();
            expect(element.getRegistryCount()).toBe(1);
        });

        it('returns null when quill not initialized', async () => {
            delete window.Quill;
            const element = createComponent();
            await Promise.resolve();

            const id = element.insertComponent({
                type: 'CUSTOM',
                html: '<div>Content</div>'
            });

            expect(id).toBeNull();
        });

        it('uses default display mode', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.setDefaultDisplayMode('render');

            mockQuillInstance.getSelection.mockReturnValue({ index: 0, length: 0 });

            element.insertComponent({
                type: 'TEST',
                html: '<div>Test</div>'
            });

            expect(mockQuillInstance.insertEmbed).toHaveBeenCalledWith(
                expect.any(Number),
                'component-placeholder',
                expect.objectContaining({ displayMode: 'render' })
            );
        });
    });

    describe('updateComponentDisplay', () => {
        it('updates component display mode', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.getSelection.mockReturnValue({ index: 0, length: 0 });

            const id = element.insertComponent({
                type: 'TEST',
                html: '<div>Test</div>'
            });

            const result = element.updateComponentDisplay(id, 'badge');

            expect(result).toBe(true);
        });

        it('returns false for non-existent component', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const result = element.updateComponentDisplay('fake-id', 'badge');

            expect(result).toBe(false);
        });

        it('updates preview content', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.getSelection.mockReturnValue({ index: 0, length: 0 });

            const id = element.insertComponent({
                type: 'TEST',
                html: '<div>Original</div>'
            });

            element.updateComponentDisplay(id, 'preview', '<div>New Preview</div>');

            const registry = element.getRegistry();
            expect(registry[id].preview).toBe('<div>New Preview</div>');
        });
    });

    describe('HTML conversion', () => {
        it('converts alignment classes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p class="ql-align-justify">Justified</p>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('text-align: justify');
        });

        it('converts size classes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<span class="ql-size-huge">Huge</span>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('font-size: 2.5em');
        });

        it('converts code blocks', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<pre class="ql-syntax">code</pre>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('background-color');
            expect(converted).not.toContain('ql-syntax');
        });
    });

    describe('events', () => {
        it('fires content-get event', async () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);
            await Promise.resolve();
            await Promise.resolve();

            handler.mockClear();
            element.getContent();

            const getEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'content-get'
            );
            expect(getEvents.length).toBeGreaterThan(0);
        });

        it('fires content-set event', async () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);
            await Promise.resolve();
            await Promise.resolve();

            handler.mockClear();
            element.setContent('<p>Test</p>');

            const setEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'content-set'
            );
            expect(setEvents.length).toBeGreaterThan(0);
        });

        it('fires component-inserted event', async () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);
            await Promise.resolve();
            await Promise.resolve();

            handler.mockClear();
            mockQuillInstance.getSelection.mockReturnValue({ index: 0, length: 0 });

            element.insertComponent({
                type: 'CUSTOM',
                html: '<div>Custom</div>'
            });

            const insertEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'component-inserted'
            );
            expect(insertEvents.length).toBeGreaterThan(0);
        });
    });
});
