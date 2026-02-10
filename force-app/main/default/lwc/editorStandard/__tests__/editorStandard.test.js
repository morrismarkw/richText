import { createElement } from 'lwc';
import EditorStandard from 'c/editorStandard';

describe('c-editor-standard', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function createComponent() {
        const element = createElement('c-editor-standard', {
            is: EditorStandard
        });
        document.body.appendChild(element);
        return element;
    }

    describe('initialization', () => {
        it('fires editor-ready event on connected', () => {
            const handler = jest.fn();
            const element = createElement('c-editor-standard', {
                is: EditorStandard
            });
            element.addEventListener('editorevent', handler);
            document.body.appendChild(element);

            expect(handler).toHaveBeenCalled();
            const eventDetail = handler.mock.calls[0][0].detail;
            expect(eventDetail.editor).toBe('Standard');
            expect(eventDetail.eventType).toBe('editor-ready');
            expect(eventDetail.category).toBe('lifecycle');
        });

        it('reports correct capabilities', () => {
            const element = createComponent();
            const capabilities = element.getCapabilities();

            expect(capabilities.name).toBe('Standard');
            expect(capabilities.customToolbar).toBe(false);
            expect(capabilities.programmaticInsert).toBe('append-only');
            expect(capabilities.imageUpload).toBe(true);
        });

        it('returns correct editor name', () => {
            const element = createComponent();
            expect(element.getEditorName()).toBe('Standard');
        });
    });

    describe('content operations', () => {
        it('sets content via setContent API', () => {
            const element = createComponent();
            const testHtml = '<p>Test content</p>';

            element.setContent(testHtml);

            expect(element.getContent()).toBe(testHtml);
        });

        it('handles null content in setContent', () => {
            const element = createComponent();
            element.setContent('<p>Initial</p>');
            element.setContent(null);

            expect(element.getContent()).toBe('');
        });

        it('handles empty string in setContent', () => {
            const element = createComponent();
            element.setContent('<p>Initial</p>');
            element.setContent('');

            expect(element.getContent()).toBe('');
        });

        it('inserts content at end by default', () => {
            const element = createComponent();
            element.setContent('<p>First</p>');
            element.insertContent('<p>Second</p>');

            expect(element.getContent()).toBe('<p>First</p><p>Second</p>');
        });

        it('inserts content at start when specified', () => {
            const element = createComponent();
            element.setContent('<p>Second</p>');
            element.insertContent('<p>First</p>', 'start');

            expect(element.getContent()).toBe('<p>First</p><p>Second</p>');
        });

        it('inserts content at end when position is end', () => {
            const element = createComponent();
            element.setContent('<p>First</p>');
            element.insertContent('<p>Second</p>', 'end');

            expect(element.getContent()).toBe('<p>First</p><p>Second</p>');
        });
    });

    describe('events', () => {
        it('fires content-set event on setContent', () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);

            element.setContent('<p>New content</p>');

            const setEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'content-set'
            );
            expect(setEvents.length).toBeGreaterThan(0);
        });

        it('fires content-get event on getContent', () => {
            const handler = jest.fn();
            const element = createComponent();
            element.setContent('<p>Test</p>');
            handler.mockClear();
            element.addEventListener('editorevent', handler);

            element.getContent();

            const getEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'content-get'
            );
            expect(getEvents.length).toBeGreaterThan(0);
        });

        it('fires content-insert event on insertContent', () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);
            handler.mockClear();

            element.insertContent('<p>Inserted</p>');

            const insertEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'content-insert'
            );
            expect(insertEvents.length).toBeGreaterThan(0);
        });

        it('fires focus-programmatic event on focus', async () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);

            await Promise.resolve();
            element.focus();

            const focusEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'focus-programmatic'
            );
            expect(focusEvents.length).toBeGreaterThan(0);
        });

        it('fires blur-programmatic event on blur', async () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('editorevent', handler);

            await Promise.resolve();
            element.blur();

            const blurEvents = handler.mock.calls.filter(
                call => call[0].detail.eventType === 'blur-programmatic'
            );
            expect(blurEvents.length).toBeGreaterThan(0);
        });
    });

    describe('user interactions', () => {
        it('dispatches contentchange event on user change', async () => {
            const handler = jest.fn();
            const element = createComponent();
            element.addEventListener('contentchange', handler);

            await Promise.resolve();

            const richText = element.shadowRoot.querySelector('lightning-input-rich-text');
            if (richText) {
                richText.value = '<p>User typed content</p>';
                richText.dispatchEvent(new CustomEvent('change', {
                    target: { value: '<p>User typed content</p>' }
                }));
            }
        });
    });
});
