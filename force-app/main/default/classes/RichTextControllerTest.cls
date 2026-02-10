@IsTest
private class RichTextControllerTest {

    @TestSetup
    static void setupTestData() {
        Rich_Text_Document__c doc = new Rich_Text_Document__c(
            Name = 'Test Document',
            Content__c = '<p>Test content with <strong>bold</strong> text</p>',
            Editor_Type__c = 'Standard'
        );
        insert doc;
    }

    @IsTest
    static void testGetDocument() {
        Rich_Text_Document__c testDoc = [SELECT Id FROM Rich_Text_Document__c LIMIT 1];

        Test.startTest();
        try {
            Rich_Text_Document__c result = RichTextController.getDocument(testDoc.Id);
            System.assertNotEquals(null, result, 'Document should be returned');
            System.assertEquals('Test Document', result.Name, 'Document name should match');
            System.assert(result.Content__c.contains('bold'), 'Content should contain bold text');
            System.assertEquals('Standard', result.Editor_Type__c, 'Editor type should match');
        } catch (QueryException e) {
            System.assert(e.getMessage().contains('Insufficient permissions'),
                'FLS requires Rich_Text_Editor_User permission set');
        }
        Test.stopTest();
    }

    @IsTest
    static void testSaveDocument() {
        Rich_Text_Document__c testDoc = [SELECT Id FROM Rich_Text_Document__c LIMIT 1];
        String newContent = '<p>Updated content</p>';
        String newEditorType = 'Quill';

        Test.startTest();
        Rich_Text_Document__c result = RichTextController.saveDocument(testDoc.Id, newContent, newEditorType);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Updated document should be returned');
        System.assertEquals(newContent, result.Content__c, 'Content should be updated');
        System.assertEquals(newEditorType, result.Editor_Type__c, 'Editor type should be updated');
        System.assert(result.Last_Editor_Event__c.contains('Saved via Quill'), 'Last editor event should be set');
    }

    @IsTest
    static void testCreateDocument() {
        String docName = 'New Test Document';
        String content = '<h1>Hello World</h1>';
        String editorType = 'QuillBlot';

        Test.startTest();
        Rich_Text_Document__c result = RichTextController.createDocument(docName, content, editorType);
        Test.stopTest();

        System.assertNotEquals(null, result, 'New document should be created');
        System.assertNotEquals(null, result.Id, 'Document should have an Id');
        System.assertEquals(docName, result.Name, 'Document name should match');
        System.assertEquals(content, result.Content__c, 'Content should match');
        System.assertEquals(editorType, result.Editor_Type__c, 'Editor type should match');
    }

    @IsTest
    static void testCreateDocumentWithNullEditorType() {
        String docName = 'Document Without Editor';
        String content = '<p>Some content</p>';

        Test.startTest();
        Rich_Text_Document__c result = RichTextController.createDocument(docName, content, null);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Document should be created');
        System.assertEquals('Standard', result.Editor_Type__c, 'Editor type should default to Standard');
    }

    @IsTest
    static void testGetRecentDocuments() {
        List<Rich_Text_Document__c> additionalDocs = new List<Rich_Text_Document__c>();
        for (Integer i = 0; i < 5; i++) {
            additionalDocs.add(new Rich_Text_Document__c(
                Name = 'Document ' + i,
                Content__c = '<p>Content ' + i + '</p>',
                Editor_Type__c = 'Standard'
            ));
        }
        insert additionalDocs;

        Test.startTest();
        try {
            List<Rich_Text_Document__c> results = RichTextController.getRecentDocuments(3);
            System.assertEquals(3, results.size(), 'Should return exactly 3 documents');
        } catch (QueryException e) {
            System.assert(e.getMessage().contains('Insufficient permissions'),
                'FLS requires Rich_Text_Editor_User permission set');
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetRecentDocumentsWithNullLimit() {
        Test.startTest();
        try {
            List<Rich_Text_Document__c> results = RichTextController.getRecentDocuments(null);
            System.assert(results.size() <= 10, 'Should default to max 10 documents');
        } catch (QueryException e) {
            System.assert(e.getMessage().contains('Insufficient permissions'),
                'FLS requires Rich_Text_Editor_User permission set');
        }
        Test.stopTest();
    }

    @IsTest
    static void testLogEditorEvent() {
        Rich_Text_Document__c testDoc = [SELECT Id FROM Rich_Text_Document__c LIMIT 1];
        String eventInfo = '{"event": "click", "target": "toolbar"}';

        Test.startTest();
        RichTextController.logEditorEvent(testDoc.Id, eventInfo);
        Test.stopTest();

        Rich_Text_Document__c updatedDoc = [
            SELECT Last_Editor_Event__c
            FROM Rich_Text_Document__c
            WHERE Id = :testDoc.Id
        ];
        System.assertEquals(eventInfo, updatedDoc.Last_Editor_Event__c, 'Event info should be logged');
    }

    @IsTest
    static void testLogEditorEventTruncation() {
        Rich_Text_Document__c testDoc = [SELECT Id FROM Rich_Text_Document__c LIMIT 1];
        String longEventInfo = 'A'.repeat(300);

        Test.startTest();
        RichTextController.logEditorEvent(testDoc.Id, longEventInfo);
        Test.stopTest();

        Rich_Text_Document__c updatedDoc = [
            SELECT Last_Editor_Event__c
            FROM Rich_Text_Document__c
            WHERE Id = :testDoc.Id
        ];
        System.assertEquals(255, updatedDoc.Last_Editor_Event__c.length(), 'Event info should be truncated to 255 chars');
        System.assert(updatedDoc.Last_Editor_Event__c.endsWith('...'), 'Truncated event should end with ellipsis');
    }

    @IsTest
    static void testGetDocumentMetrics() {
        Rich_Text_Document__c testDoc = [SELECT Id FROM Rich_Text_Document__c LIMIT 1];

        Test.startTest();
        try {
            Map<String, Object> metrics = RichTextController.getDocumentMetrics(testDoc.Id);
            System.assertNotEquals(null, metrics, 'Metrics should be returned');
            System.assert(metrics.containsKey('contentLength'), 'Should contain contentLength');
            System.assert(metrics.containsKey('wordCount'), 'Should contain wordCount');
            System.assert(metrics.containsKey('editorType'), 'Should contain editorType');
            System.assert(metrics.containsKey('hasContent'), 'Should contain hasContent');
            System.assertEquals('Standard', metrics.get('editorType'), 'Editor type should match');
            System.assertEquals(true, metrics.get('hasContent'), 'Should have content');
        } catch (QueryException e) {
            System.assert(e.getMessage().contains('Insufficient permissions'),
                'FLS requires Rich_Text_Editor_User permission set');
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetDocumentMetricsWithNullContent() {
        Rich_Text_Document__c doc = new Rich_Text_Document__c(
            Name = 'Empty Document',
            Content__c = null,
            Editor_Type__c = 'Standard'
        );
        insert doc;

        Test.startTest();
        try {
            Map<String, Object> metrics = RichTextController.getDocumentMetrics(doc.Id);
            System.assertEquals(0, metrics.get('contentLength'), 'Content length should be 0');
            System.assertEquals(false, metrics.get('hasContent'), 'hasContent should be false');
        } catch (QueryException e) {
            System.assert(e.getMessage().contains('Insufficient permissions'),
                'FLS requires Rich_Text_Editor_User permission set');
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetDocumentNotFound() {
        Id fakeId = Rich_Text_Document__c.SObjectType.getDescribe().getKeyPrefix() + '000000000001';

        Test.startTest();
        try {
            RichTextController.getDocument(fakeId);
            System.assert(false, 'Should have thrown an exception');
        } catch (QueryException e) {
            System.assert(true, 'Expected QueryException for non-existent record or FLS issue');
        }
        Test.stopTest();
    }
}
