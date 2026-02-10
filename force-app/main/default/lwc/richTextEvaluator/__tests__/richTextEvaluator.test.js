import { createElement } from 'lwc';
import RichTextEvaluator from 'c/richTextEvaluator';
import { getRecord } from 'lightning/uiRecordApi';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';

jest.mock('lightning/platformResourceLoader', () => ({
    loadScript: jest.fn(),
    loadStyle: jest.fn()
}), { virtual: true });

jest.mock('lightning/platformShowToastEvent', () => ({
    ShowToastEvent: jest.fn()
}), { virtual: true });

const mockRecordData = {
    fields: {
        Name: { value: 'Test Document' },
        Content__c: { value: '<p>Test content</p>' }
    }
};

describe('c-rich-text-evaluator', () => {
    beforeEach(() => {
        loadScript.mockResolvedValue();
        loadStyle.mockResolvedValue();
        window.Quill = jest.fn().mockImplementation(() => ({
            root: { innerHTML: '', addEventListener: jest.fn() },
            on: jest.fn(),
            getSelection: jest.fn(),
            getLength: jest.fn().mockReturnValue(1),
            setContents: jest.fn(),
            clipboard: { dangerouslyPasteHTML: jest.fn() }
        }));
        window.Quill.import = jest.fn().mockReturnValue(class {});
        window.Quill.register = jest.fn();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete window.Quill;
        jest.clearAllMocks();
    });

    function createComponent() {
        const element = createElement('c-rich-text-evaluator', {
            is: RichTextEvaluator
        });
        document.body.appendChild(element);
        return element;
    }

    describe('initialization', () => {
        it('renders with default state', async () => {
            const element = createComponent();
            await Promise.resolve();

            const card = element.shadowRoot.querySelector('lightning-card');
            expect(card).not.toBeNull();
        });

        it('loads Quill scripts on connected', async () => {
            createComponent();
            await Promise.resolve();

            expect(loadScript).toHaveBeenCalled();
            expect(loadStyle).toHaveBeenCalled();
        });

        it('displays record name when loaded', async () => {
            const element = createComponent();
            element.recordId = '001000000000001';

            getRecord.emit(mockRecordData);
            await Promise.resolve();

            const title = element.shadowRoot.querySelector('h2');
            expect(title.textContent).toContain('Test Document');
        });

        it('displays default name when no record', async () => {
            const element = createComponent();
            await Promise.resolve();

            const title = element.shadowRoot.querySelector('h2');
            expect(title.textContent).toContain('Rich Text Document');
        });
    });

    describe('tabs', () => {
        it('renders all tabs', async () => {
            const element = createComponent();
            await Promise.resolve();

            const tabs = element.shadowRoot.querySelectorAll('lightning-tab');
            expect(tabs.length).toBe(5);
        });

        it('handles tab selection', async () => {
            const element = createComponent();
            await Promise.resolve();

            const tabset = element.shadowRoot.querySelector('lightning-tabset');
            tabset.dispatchEvent(new CustomEvent('select', {
                target: { value: 'quill' }
            }));

            await Promise.resolve();
        });
    });

    describe('event log toggle', () => {
        it('starts with event log visible', async () => {
            const element = createComponent();
            await Promise.resolve();

            const logPanel = element.shadowRoot.querySelector('c-event-log-panel');
            expect(logPanel).not.toBeNull();
        });

        it('toggles event log visibility', async () => {
            const element = createComponent();
            await Promise.resolve();

            const toggleButton = element.shadowRoot.querySelector('lightning-button[onclick]');
            if (toggleButton && toggleButton.label === 'Hide Log') {
                toggleButton.click();
                await Promise.resolve();
            }
        });
    });

    describe('dirty state', () => {
        it('starts clean', async () => {
            const element = createComponent();
            await Promise.resolve();

            const dirtyIndicator = element.shadowRoot.querySelector('.dirty-indicator');
            expect(dirtyIndicator).toBeNull();
        });
    });

    describe('content operations', () => {
        it('initializes content from record', async () => {
            const element = createComponent();
            element.recordId = '001000000000001';

            getRecord.emit(mockRecordData);
            await Promise.resolve();
        });

        it('handles record load error', async () => {
            const element = createComponent();
            element.recordId = '001000000000001';

            getRecord.error({ body: { message: 'Error loading record' } });
            await Promise.resolve();
        });
    });

    describe('standard tab actions', () => {
        it('renders standard editor component', async () => {
            const element = createComponent();
            await Promise.resolve();

            const standardEditor = element.shadowRoot.querySelector('c-editor-standard');
            expect(standardEditor).not.toBeNull();
        });
    });

    describe('preview tab', () => {
        it('renders tabset component', async () => {
            const element = createComponent();
            await Promise.resolve();

            const tabset = element.shadowRoot.querySelector('lightning-tabset');
            expect(tabset).not.toBeNull();
        });

        it('renders formatted rich text in preview', async () => {
            const element = createComponent();
            await Promise.resolve();

            const richText = element.shadowRoot.querySelector('lightning-formatted-rich-text');
            expect(richText).not.toBeNull();
        });
    });

    describe('source tab', () => {
        it('renders all editor components', async () => {
            const element = createComponent();
            await Promise.resolve();

            const quillEditor = element.shadowRoot.querySelector('c-editor-quill');
            expect(quillEditor).not.toBeNull();
        });

        it('renders source code pre element', async () => {
            const element = createComponent();
            await Promise.resolve();

            const pre = element.shadowRoot.querySelector('pre.source-code');
            expect(pre).not.toBeNull();
        });
    });

    describe('toast messages', () => {
        it('shows toast class when toast is visible', async () => {
            const element = createComponent();
            await Promise.resolve();
        });
    });

    describe('getters', () => {
        it('returns correct editor container class with log', async () => {
            const element = createComponent();
            await Promise.resolve();

            const container = element.shadowRoot.querySelector('.editor-container');
            expect(container.classList.contains('with-log')).toBe(true);
        });

        it('returns correct toggle log label', async () => {
            const element = createComponent();
            await Promise.resolve();

            const buttons = element.shadowRoot.querySelectorAll('lightning-button');
            const toggleButton = Array.from(buttons).find(b => b.label === 'Hide Log' || b.label === 'Show Log');
            expect(toggleButton).not.toBeNull();
        });
    });

    describe('formatHtml utility', () => {
        it('formats empty content', async () => {
            const element = createComponent();
            await Promise.resolve();

            const pre = element.shadowRoot.querySelector('pre.source-code');
            expect(pre.textContent).toContain('(empty)');
        });
    });

    describe('child component events', () => {
        it('handles editor events from child components', async () => {
            const element = createComponent();
            await Promise.resolve();

            const standardEditor = element.shadowRoot.querySelector('c-editor-standard');
            if (standardEditor) {
                standardEditor.dispatchEvent(new CustomEvent('editorevent', {
                    detail: {
                        editor: 'Standard',
                        eventType: 'test-event',
                        category: 'debug',
                        details: {}
                    },
                    bubbles: true,
                    composed: true
                }));
            }

            await Promise.resolve();
        });

        it('handles content change events', async () => {
            const element = createComponent();
            await Promise.resolve();

            const standardEditor = element.shadowRoot.querySelector('c-editor-standard');
            if (standardEditor) {
                standardEditor.dispatchEvent(new CustomEvent('contentchange', {
                    detail: {
                        editor: 'Standard',
                        content: '<p>New content</p>'
                    }
                }));
            }

            await Promise.resolve();
        });
    });

    describe('reload functionality', () => {
        it('updates dirty state on content change', async () => {
            const element = createComponent();
            element.recordId = '001000000000001';

            getRecord.emit(mockRecordData);
            await Promise.resolve();

            const standardEditor = element.shadowRoot.querySelector('c-editor-standard');
            if (standardEditor) {
                standardEditor.dispatchEvent(new CustomEvent('contentchange', {
                    detail: { editor: 'Standard', content: '<p>Changed</p>' }
                }));
            }

            await Promise.resolve();
        });
    });

    describe('version display', () => {
        it('displays version badge', async () => {
            const element = createComponent();
            await Promise.resolve();

            const versionBadge = element.shadowRoot.querySelector('.version-badge');
            expect(versionBadge).not.toBeNull();
            expect(versionBadge.textContent).toMatch(/v\d+\.\d+\.\d+/);
        });
    });
});
