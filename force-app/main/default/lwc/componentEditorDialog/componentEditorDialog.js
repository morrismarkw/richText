import { LightningElement, api, track } from 'lwc';

const ICONS = {
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

export default class ComponentEditorDialog extends LightningElement {
    @track isOpen = false;
    @track htmlContent = '';
    @track componentId = '';
    @track componentType = '';

    _pendingContent = null;

    get componentIcon() {
        return ICONS[this.componentType] || '📦';
    }

    renderedCallback() {
        // Set textarea value after DOM renders (textarea value binding is unreliable)
        if (this._pendingContent !== null && this.isOpen) {
            const textarea = this.template.querySelector('.html-editor');
            if (textarea) {
                textarea.value = this._pendingContent;
                this._pendingContent = null;
            }
        }
    }

    @api
    open(componentData) {
        this.componentId = componentData.id;
        this.componentType = componentData.type;
        this.htmlContent = componentData.html || '';
        this._pendingContent = componentData.html || '';
        this.isOpen = true;
    }

    @api
    close() {
        this.isOpen = false;
        this.htmlContent = '';
        this.componentId = '';
        this.componentType = '';
    }

    handleHtmlChange(event) {
        this.htmlContent = event.target.value;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
        this.close();
    }

    handleSave() {
        this.dispatchEvent(new CustomEvent('save', {
            detail: {
                id: this.componentId,
                type: this.componentType,
                html: this.htmlContent
            }
        }));
        this.close();
    }

    handleDelete() {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: {
                id: this.componentId
            }
        }));
        this.close();
    }
}
