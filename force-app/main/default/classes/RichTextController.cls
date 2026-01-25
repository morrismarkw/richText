/**
 * @description Controller for Rich Text Document operations
 * Provides CRUD operations and utility methods for the rich text editor evaluation harness
 */
public with sharing class RichTextController {

    /**
     * @description Retrieves a Rich Text Document record by ID
     * @param recordId The ID of the record to retrieve
     * @return The Rich Text Document record
     */
    @AuraEnabled(cacheable=true)
    public static Rich_Text_Document__c getDocument(Id recordId) {
        return [
            SELECT Id, Name, Content__c, Editor_Type__c, Last_Editor_Event__c,
                   CreatedDate, LastModifiedDate, CreatedById, LastModifiedById
            FROM Rich_Text_Document__c
            WHERE Id = :recordId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];
    }

    /**
     * @description Saves content to a Rich Text Document record
     * @param recordId The ID of the record to update
     * @param content The HTML content to save
     * @param editorType The type of editor used
     * @return The updated record
     */
    @AuraEnabled
    public static Rich_Text_Document__c saveDocument(Id recordId, String content, String editorType) {
        Rich_Text_Document__c doc = new Rich_Text_Document__c(
            Id = recordId,
            Content__c = content,
            Editor_Type__c = editorType,
            Last_Editor_Event__c = 'Saved via ' + editorType + ' at ' + System.now().format()
        );

        update doc;
        return doc;
    }

    /**
     * @description Creates a new Rich Text Document record
     * @param name The name for the new document
     * @param content Optional initial content
     * @param editorType Optional editor type
     * @return The newly created record
     */
    @AuraEnabled
    public static Rich_Text_Document__c createDocument(String name, String content, String editorType) {
        Rich_Text_Document__c doc = new Rich_Text_Document__c(
            Name = name,
            Content__c = content,
            Editor_Type__c = editorType != null ? editorType : 'Standard'
        );

        insert doc;
        return doc;
    }

    /**
     * @description Gets recent Rich Text Documents for selection
     * @param limitCount Maximum number of records to return
     * @return List of recent documents
     */
    @AuraEnabled(cacheable=true)
    public static List<Rich_Text_Document__c> getRecentDocuments(Integer limitCount) {
        Integer recordLimit = limitCount != null ? limitCount : 10;

        return [
            SELECT Id, Name, Editor_Type__c, LastModifiedDate
            FROM Rich_Text_Document__c
            WITH SECURITY_ENFORCED
            ORDER BY LastModifiedDate DESC
            LIMIT :recordLimit
        ];
    }

    /**
     * @description Logs an editor event to the record (for debugging/analytics)
     * @param recordId The ID of the record
     * @param eventInfo JSON string containing event information
     */
    @AuraEnabled
    public static void logEditorEvent(Id recordId, String eventInfo) {
        // Truncate event info if too long
        String truncatedEvent = eventInfo.length() > 255
            ? eventInfo.substring(0, 252) + '...'
            : eventInfo;

        Rich_Text_Document__c doc = new Rich_Text_Document__c(
            Id = recordId,
            Last_Editor_Event__c = truncatedEvent
        );

        update doc;
    }

    /**
     * @description Gets the content length for a document (useful for metrics)
     * @param recordId The ID of the record
     * @return Map containing content metrics
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDocumentMetrics(Id recordId) {
        Rich_Text_Document__c doc = [
            SELECT Content__c, Editor_Type__c
            FROM Rich_Text_Document__c
            WHERE Id = :recordId
            WITH SECURITY_ENFORCED
            LIMIT 1
        ];

        Map<String, Object> metrics = new Map<String, Object>();
        String content = doc.Content__c != null ? doc.Content__c : '';

        metrics.put('contentLength', content.length());
        metrics.put('wordCount', content.split('\\s+').size());
        metrics.put('editorType', doc.Editor_Type__c);
        metrics.put('hasContent', content.length() > 0);

        return metrics;
    }
}
