import { LightningElement, api, track } from 'lwc';

const CATEGORIES = {
    interaction: { label: 'Interaction', color: '#0070d2' },
    content: { label: 'Content', color: '#04844b' },
    selection: { label: 'Selection', color: '#ff9a3c' },
    api: { label: 'API', color: '#9050e9' },
    lifecycle: { label: 'Lifecycle', color: '#747474' },
    debug: { label: 'Debug', color: '#333333' }
};

export default class EventLogPanel extends LightningElement {
    @api componentVersion = 'unknown';

    @track events = [];
    @track filterText = '';
    @track editorFilter = '';
    @track expandedEventIds = new Set();
    @track activeCategories = new Set(Object.keys(CATEGORIES));
    @track copyStatus = '';

    maxEvents = 500;
    eventIdCounter = 0;

    get categoryFilters() {
        return Object.entries(CATEGORIES).map(([name, config]) => ({
            name,
            label: config.label,
            active: this.activeCategories.has(name),
            buttonClass: this.activeCategories.has(name)
                ? `category-btn category-btn-active category-${name}`
                : `category-btn category-${name}`
        }));
    }

    get filteredEvents() {
        let filtered = this.events;

        // Filter by category
        filtered = filtered.filter(e => this.activeCategories.has(e.category));

        // Filter by editor
        if (this.editorFilter) {
            filtered = filtered.filter(e => e.editor === this.editorFilter);
        }

        // Filter by text
        if (this.filterText) {
            const searchText = this.filterText.toLowerCase();
            filtered = filtered.filter(e =>
                e.editor.toLowerCase().includes(searchText) ||
                e.eventType.toLowerCase().includes(searchText) ||
                e.category.toLowerCase().includes(searchText) ||
                JSON.stringify(e.details).toLowerCase().includes(searchText)
            );
        }

        return filtered.map(e => ({
            ...e,
            showDetails: this.expandedEventIds.has(e.id),
            toggleLabel: this.expandedEventIds.has(e.id) ? '[-]' : '[+]',
            detailsJson: JSON.stringify(e.details, null, 2),
            rowClass: `event-row category-${e.category}`,
            editorClass: `event-editor editor-${e.editor.toLowerCase()}`,
            categoryClass: `event-category category-${e.category}`
        }));
    }

    get hasEvents() {
        return this.events.length > 0;
    }

    get filteredEventCount() {
        return this.filteredEvents.length;
    }

    get totalEventCount() {
        return this.events.length;
    }

    @api
    logEvent(eventData) {
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0] + '.' +
                         String(now.getMilliseconds()).padStart(3, '0');

        const event = {
            id: `evt-${++this.eventIdCounter}`,
            timestamp,
            editor: eventData.editor || 'Unknown',
            eventType: eventData.eventType || 'unknown',
            category: eventData.category || 'interaction',
            details: eventData.details || {}
        };

        // Add to front of array
        this.events = [event, ...this.events];

        // Trim if exceeds max
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(0, this.maxEvents);
        }

        // Scroll to top
        this.scrollToTop();
    }

    @api
    clearLog() {
        this.events = [];
        this.expandedEventIds = new Set();
    }

    @api
    exportLog() {
        const exportData = {
            exportedAt: new Date().toISOString(),
            totalEvents: this.events.length,
            events: this.events
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rich-text-events-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    @api
    getEvents() {
        return [...this.events];
    }

    handleFilterChange(event) {
        this.filterText = event.target.value;
    }

    handleEditorFilterChange(event) {
        this.editorFilter = event.target.value;
    }

    handleClear() {
        this.clearLog();
    }

    handleExport() {
        this.exportLog();
    }

    handleCopyToClipboard() {
        const filtered = this.filteredEvents;
        const exportData = {
            componentVersion: this.componentVersion,
            copiedAt: new Date().toISOString(),
            filters: {
                text: this.filterText || '(none)',
                editor: this.editorFilter || '(all)',
                categories: Array.from(this.activeCategories)
            },
            eventCount: filtered.length,
            events: filtered.map(e => ({
                timestamp: e.timestamp,
                editor: e.editor,
                category: e.category,
                eventType: e.eventType,
                details: e.details
            }))
        };

        const text = JSON.stringify(exportData, null, 2);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    this.copyStatus = `Copied ${filtered.length} events!`;
                    // eslint-disable-next-line @lwc/lwc/no-async-operation
                    setTimeout(() => { this.copyStatus = ''; }, 2000);
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    this.copyStatus = 'Copy failed';
                });
        }
    }

    handleToggleDetails(event) {
        const eventId = event.target.dataset.id;
        const newExpanded = new Set(this.expandedEventIds);

        if (newExpanded.has(eventId)) {
            newExpanded.delete(eventId);
        } else {
            newExpanded.add(eventId);
        }

        this.expandedEventIds = newExpanded;
    }

    handleCategoryToggle(event) {
        const category = event.currentTarget.dataset.category;
        const newCategories = new Set(this.activeCategories);

        if (newCategories.has(category)) {
            // Don't allow removing all categories
            if (newCategories.size > 1) {
                newCategories.delete(category);
            }
        } else {
            newCategories.add(category);
        }

        this.activeCategories = newCategories;
    }

    scrollToTop() {
        const container = this.refs.logContainer;
        if (container) {
            container.scrollTop = 0;
        }
    }
}
