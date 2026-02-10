import { createElement } from 'lwc';
import EventLogPanel from 'c/eventLogPanel';

describe('c-event-log-panel', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function createComponent() {
        const element = createElement('c-event-log-panel', {
            is: EventLogPanel
        });
        document.body.appendChild(element);
        return element;
    }

    describe('initialization', () => {
        it('initializes with empty events', () => {
            const element = createComponent();
            const events = element.getEvents();
            expect(events).toEqual([]);
        });

        it('accepts componentVersion api property', () => {
            const element = createElement('c-event-log-panel', {
                is: EventLogPanel
            });
            element.componentVersion = 'v1.0.0';
            document.body.appendChild(element);

            expect(element.componentVersion).toBe('v1.0.0');
        });
    });

    describe('logEvent', () => {
        it('logs a basic event', () => {
            const element = createComponent();

            element.logEvent({
                editor: 'Standard',
                eventType: 'content-change',
                category: 'content',
                details: { length: 100 }
            });

            const events = element.getEvents();
            expect(events.length).toBe(1);
            expect(events[0].editor).toBe('Standard');
            expect(events[0].eventType).toBe('content-change');
            expect(events[0].category).toBe('content');
        });

        it('adds timestamp to logged events', () => {
            const element = createComponent();

            element.logEvent({
                editor: 'Quill',
                eventType: 'click',
                category: 'interaction'
            });

            const events = element.getEvents();
            expect(events[0].timestamp).toBeDefined();
            expect(events[0].timestamp).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
        });

        it('assigns unique ids to events', () => {
            const element = createComponent();

            element.logEvent({ editor: 'A', eventType: 'test', category: 'debug' });
            element.logEvent({ editor: 'B', eventType: 'test', category: 'debug' });

            const events = element.getEvents();
            expect(events[0].id).not.toBe(events[1].id);
        });

        it('prepends new events to the list', () => {
            const element = createComponent();

            element.logEvent({ editor: 'First', eventType: 'test', category: 'debug' });
            element.logEvent({ editor: 'Second', eventType: 'test', category: 'debug' });

            const events = element.getEvents();
            expect(events[0].editor).toBe('Second');
            expect(events[1].editor).toBe('First');
        });

        it('handles missing event properties with defaults', () => {
            const element = createComponent();

            element.logEvent({});

            const events = element.getEvents();
            expect(events[0].editor).toBe('Unknown');
            expect(events[0].eventType).toBe('unknown');
            expect(events[0].category).toBe('interaction');
            expect(events[0].details).toEqual({});
        });

        it('limits events to maxEvents', () => {
            const element = createComponent();

            for (let i = 0; i < 600; i++) {
                element.logEvent({ editor: `Event${i}`, eventType: 'test', category: 'debug' });
            }

            const events = element.getEvents();
            expect(events.length).toBe(500);
        });
    });

    describe('clearLog', () => {
        it('clears all events', () => {
            const element = createComponent();

            element.logEvent({ editor: 'Test', eventType: 'test', category: 'debug' });
            element.logEvent({ editor: 'Test2', eventType: 'test', category: 'debug' });

            element.clearLog();

            expect(element.getEvents().length).toBe(0);
        });
    });

    describe('filtering', () => {
        it('returns all events when no filter is applied', async () => {
            const element = createComponent();

            element.logEvent({ editor: 'Standard', eventType: 'click', category: 'interaction' });
            element.logEvent({ editor: 'Quill', eventType: 'change', category: 'content' });

            await Promise.resolve();

            const events = element.getEvents();
            expect(events.length).toBe(2);
        });
    });

    describe('getEvents', () => {
        it('returns a copy of events array', () => {
            const element = createComponent();

            element.logEvent({ editor: 'Test', eventType: 'test', category: 'debug' });

            const events1 = element.getEvents();
            const events2 = element.getEvents();

            expect(events1).not.toBe(events2);
            expect(events1).toEqual(events2);
        });
    });

    describe('exportLog', () => {
        it('creates downloadable file', () => {
            const element = createComponent();

            element.logEvent({ editor: 'Test', eventType: 'test', category: 'debug' });

            const mockCreateElement = jest.spyOn(document, 'createElement');
            const mockClick = jest.fn();
            const mockLink = { href: '', download: '', click: mockClick };
            mockCreateElement.mockReturnValue(mockLink);

            const mockCreateObjectURL = jest.fn().mockReturnValue('blob:url');
            const mockRevokeObjectURL = jest.fn();
            global.URL.createObjectURL = mockCreateObjectURL;
            global.URL.revokeObjectURL = mockRevokeObjectURL;

            element.exportLog();

            expect(mockCreateObjectURL).toHaveBeenCalled();
            expect(mockClick).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalled();

            mockCreateElement.mockRestore();
        });
    });
});
