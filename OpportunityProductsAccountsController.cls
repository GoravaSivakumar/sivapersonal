public with sharing class OpportunityProductsAccountsController {
    
    // Method to fetch accounts
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account];
    }
    @AuraEnabled(cacheable=true)
    public static List<Product2> getProducts() {
        // List to hold product details
        List<Product2> productList = new List<Product2>();

        // SOQL query to fetch quotes and their line items (products)
        List<Quote> quotesWithProducts = [SELECT Id, Name, 
                                                 (SELECT 
                                                     PricebookEntry.Product2.Id, 
                                                     PricebookEntry.Product2.Name 
                                                  FROM 
                                                     QuoteLineItems
                                                 )
                                              FROM 
                                                 Quote
                                              WHERE 
                                                 AccountId != NULL];

        // Iterate through quotes and their line items to populate productList
        for (Quote q : quotesWithProducts) {
            for (QuoteLineItem qli : q.QuoteLineItems) {
                Product2 product = qli.PricebookEntry.Product2;
                if (product != null && !productList.contains(product)) {
                    productList.add(product);
                }
            }
        }
        return productList;
    }
    @AuraEnabled
    public static void saveProductAccounts(Map<Id, List<Id>> productAccounts) {
        List<Opportunity_Products_and_Accounts__c> recordsToInsert = new List<Opportunity_Products_and_Accounts__c>();

        for (Id productId : productAccounts.keySet()) {
            List<Id> accountIds = productAccounts.get(productId);
            
            // Fetch Quote Line Items related to the product
            List<QuoteLineItem> quoteLineItems = [
                SELECT Id, QuoteId, Quote.OpportunityId, PricebookEntry.Product2.Id, PricebookEntry.Product2.Name
                FROM QuoteLineItem
                WHERE PricebookEntry.Product2.Id = :productId
            ];
            
            // Fetch related Quotes and Opportunities
            Set<Id> quoteIds = new Set<Id>();
            Set<Id> opportunityIds = new Set<Id>();
            for (QuoteLineItem qli : quoteLineItems) {
                quoteIds.add(qli.QuoteId);
                opportunityIds.add(qli.Quote.OpportunityId);
            }
            
            // Create Opportunity_Products_and_Accounts__c records
            for (Id accountId : accountIds) {
                for (QuoteLineItem qli : quoteLineItems) {
                    Opportunity_Products_and_Accounts__c record = new Opportunity_Products_and_Accounts__c();
                    record.Account__c = accountId;
                    record.Quote__c = qli.QuoteId;
                    record.Quote_Line_Item__c = qli.Id;
                    record.Opportunity__c = qli.Quote.OpportunityId;
                    recordsToInsert.add(record);
                }
            }
        }
        
        try {
            insert recordsToInsert;
            System.debug('Opportunity Products and Accounts records created successfully.');
        } catch (DmlException e) {
            System.debug('Error creating Opportunity Products and Accounts records: ' + e.getMessage());
            throw new AuraHandledException('Error creating Opportunity Products and Accounts records: ' + e.getMessage());
        }
    }
    @AuraEnabled
    public static void deleteProductAccount(Id productId, Id accountId) {
        System.debug('Inside apex ');
        List<Opportunity_Products_and_Accounts__c> recordsToDelete = [SELECT Id FROM Opportunity_Products_and_Accounts__c WHERE Account__c = :accountId AND Quote_Line_Item__r.PricebookEntry.Product2.Id = :productId];
        System.debug('recordsToDelete '+recordsToDelete);
        if (!recordsToDelete.isEmpty()) {
            try {
                delete recordsToDelete;
                System.debug('Opportunity Products and Accounts records deleted successfully.');
            } catch (DmlException e) {
                System.debug('Error deleting Opportunity Products and Accounts records: ' + e.getMessage());
                throw new AuraHandledException('Failed to delete Opportunity Products and Accounts records.');
            }
        }
    }
}
