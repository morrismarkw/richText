import { createElement } from 'lwc';
import EditorQuill from 'c/editorQuill';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';

jest.mock('lightning/platformResourceLoader', () => ({
    loadScript: jest.fn(),
    loadStyle: jest.fn()
}), { virtual: true });

const mockQuillInstance = {
    root: {
        innerHTML: '',
        addEventListener: jest.fn(),
        getBoundingClientRect: jest.fn().mockReturnValue({ left: 0, top: 0 })
    },
    on: jest.fn(),
    getSelection: jest.fn().mockReturnValue({ index: 0, length: 0 }),
    getLength: jest.fn().mockReturnValue(1),
    setContents: jest.fn(),
    clipboard: {
        dangerouslyPasteHTML: jest.fn()
    },
    format: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn()
};

const mockQuillClass = jest.fn().mockImplementation(() => mockQuillInstance);
mockQuillClass.import = jest.fn().mockReturnValue(class {});
mockQuillClass.register = jest.fn();

describe('c-editor-quill', () => {
    beforeEach(() => {
        loadScript.mockResolvedValue();
        loadStyle.mockResolvedValue();
        window.Quill = mockQuillClass;
        mockQuillInstance.root.innerHTML = '';
        mockQuillInstance.on.mockClear();
        mockQuillClass.mockClear();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete window.Quill;
    });

    function createComponent() {
        const element = createElement('c-editor-quill', {
            is: EditorQuill
        });
        document.body.appendChild(element);
        return element;
    }

    describe('initialization', () => {
        it('loads Quill scripts on connected', async () => {
            createComponent();
            await Promise.resolve();

            expect(loadScript).toHaveBeenCalled();
            expect(loadStyle).toHaveBeenCalled();
        });

        it('initializes Quill after scripts load', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            expect(element.getIsLoaded()).toBe(true);
        });

        it('fires editor-ready event after initialization', async () => {
            const handler = jest.fn();
            const element = createElement('c-editor-quill', {
                is: EditorQuill
            });
            element.addEventListener('editorevent', handler);
            document.body.appendChild(element);

            await Promise.resolve();
            await Promise.resolve();

            const readyEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'editor-ready'
            );
            expect(readyEvents.length).toBeGreaterThan(0);
        });

        it('handles script load error', async () => {
            loadScript.mockRejectedValueOnce(new Error('Failed to load'));
            const handler = jest.fn();
            const element = createElement('c-editor-quill', {
                is: EditorQuill
            });
            element.addEventListener('editorevent', handler);
            document.body.appendChild(element);

            await Promise.resolve();
            await Promise.resolve();

            const errorEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'load-error'
            );
            expect(errorEvents.length).toBeGreaterThan(0);
        });
    });

    describe('public API', () => {
        it('returns correct editor name', async () => {
            const element = createComponent();
            await Promise.resolve();

            expect(element.getEditorName()).toBe('Quill');
        });

        it('reports correct capabilities', async () => {
            const element = createComponent();
            await Promise.resolve();

            const capabilities = element.getCapabilities();
            expect(capabilities.name).toBe('Quill');
            expect(capabilities.customToolbar).toBe(true);
            expect(capabilities.programmaticInsert).toBe(true);
            expect(capabilities.selectionEvents).toBe(true);
        });

        it('returns isLoaded state', async () => {
            const element = createComponent();

            expect(element.getIsLoaded()).toBe(false);

            await Promise.resolve();
            await Promise.resolve();

            expect(element.getIsLoaded()).toBe(true);
        });
    });

    describe('content operations', () => {
        it('returns empty string when quill not initialized', () => {
            loadScript.mockReturnValue(new Promise(() => {}));
            const element = createComponent();
            expect(element.getContent()).toBe('');
        });

        it('gets content from quill instance', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p>Test content</p>';
            const content = element.getContent();

            expect(content).toBe('<p>Test content</p>');
        });

        it('sets content using clipboard API', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.setContent('<p>New content</p>');

            expect(mockQuillInstance.setContents).toHaveBeenCalledWith([]);
            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(0, '<p>New content</p>');
        });

        it('stores pending content if quill not ready', async () => {
            loadScript.mockReturnValue(new Promise(() => {}));
            const element = createComponent();

            element.setContent('<p>Pending</p>');
        });

        it('inserts content at cursor position', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.getSelection.mockReturnValue({ index: 5, length: 0 });

            element.insertContent('<p>Inserted</p>', 'cursor');

            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(5, '<p>Inserted</p>');
        });

        it('inserts content at start', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.insertContent('<p>Start</p>', 'start');

            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(0, '<p>Start</p>');
        });

        it('inserts content at end', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.getLength.mockReturnValue(100);

            element.insertContent('<p>End</p>', 'end');

            expect(mockQuillInstance.clipboard.dangerouslyPasteHTML).toHaveBeenCalledWith(100, '<p>End</p>');
        });
    });

    describe('focus and blur', () => {
        it('calls quill focus', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.focus();

            expect(mockQuillInstance.focus).toHaveBeenCalled();
        });

        it('calls quill blur', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            element.blur();

            expect(mockQuillInstance.blur).toHaveBeenCalled();
        });
    });

    describe('executeCommand', () => {
        it('executes format command', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            const result = element.executeCommand('bold', true);

            expect(mockQuillInstance.format).toHaveBeenCalledWith('bold', true);
            expect(result).toBe(true);
        });

        it('returns false when quill not initialized', () => {
            loadScript.mockReturnValue(new Promise(() => {}));
            const element = createComponent();

            const result = element.executeCommand('bold', true);

            expect(result).toBe(false);
        });

        it('handles command errors', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.format.mockImplementationOnce(() => {
                throw new Error('Command failed');
            });

            const result = element.executeCommand('invalid', null);

            expect(result).toBe(false);
        });
    });

    describe('HTML conversion', () => {
        it('gets converted content with standard HTML', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p class="ql-align-center">Centered</p>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('text-align');
        });

        it('converts alignment classes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p class="ql-align-right">Right aligned</p>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('text-align: right');
            expect(converted).not.toContain('ql-align-right');
        });

        it('converts font classes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<span class="ql-font-monospace">Code</span>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('font-family');
            expect(converted).not.toContain('ql-font-monospace');
        });

        it('converts size classes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<span class="ql-size-large">Large text</span>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('font-size');
            expect(converted).not.toContain('ql-size-large');
        });

        it('converts direction classes', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '<p class="ql-direction-rtl">RTL text</p>';

            const converted = element.getConvertedContent();

            expect(converted).toContain('dir="rtl"');
            expect(converted).not.toContain('ql-direction-rtl');
        });

        it('handles empty content', async () => {
            const element = createComponent();
            await Promise.resolve();
            await Promise.resolve();

            mockQuillInstance.root.innerHTML = '';

            const converted = element.getConvertedContent();

            expect(converted).toBe('');
        });
    });
});
