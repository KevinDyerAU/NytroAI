# Edge Functions Analysis

## Active Functions (Keep)

### Core Validation Flow
1. **upload-document** ✅
   - Creates document record
   - Starts Gemini indexing
   - Used by: DocumentUploadSimplified

2. **trigger-validation** ✅
   - Called by DB trigger
   - Fetches requirements as JSON
   - Calls validate-assessment
   - Used by: DB trigger (auto_trigger_validation)

3. **validate-assessment** ✅
   - AI validation with JSON requirements
   - Stores results in validation_results
   - Used by: trigger-validation

4. **check-operation-status** ✅
   - Polls Gemini operation status
   - Updates gemini_operations table
   - Used by: Dashboard_v3 (status polling)

### Supporting Functions
5. **generate-smart-questions-v2** ✅
   - Generates questions with JSON requirements
   - Stores in validation_results
   - Used by: Validation workflow

## Unused Functions (Remove)

### Deprecated/Superseded
1. **generate-smart-questions** ❌
   - Superseded by generate-smart-questions-v2
   - Old version without JSON requirements

2. **create-validation-record** ❌
   - Old manual validation trigger
   - Replaced by DB trigger system

3. **get-gemini-operation-status** ❌
   - Duplicate of check-operation-status
   - Same functionality

4. **upload-files-to-storage** ❌
   - Superseded by upload-document
   - Old version

### Unused Features
5. **create-checkout-session** ❌
   - Stripe payment integration
   - Not implemented in UI

6. **stripe-webhook** ❌
   - Stripe webhook handler
   - Not implemented

7. **get-ai-credits** ❌
   - Credits system
   - Not implemented in UI

8. **get-validation-credits** ❌
   - Credits system
   - Not implemented in UI

### Utility Functions (Keep if needed)
9. **fetch-units-of-competency** ⚠️
   - Fetches UOC data from training.gov.au
   - Used by: Admin/setup workflows?
   - **Decision: KEEP** (useful for data management)

10. **scrape-training-gov-au** ⚠️
    - Scrapes training package data
    - Used by: Admin/setup workflows?
    - **Decision: KEEP** (useful for data management)

11. **query-document** ⚠️
    - Queries indexed documents
    - Used by: Testing/debugging?
    - **Decision: REMOVE** (not used in production)

12. **generate-validation-report** ⚠️
    - Generates PDF reports
    - Used by: Export functionality?
    - **Decision: KEEP** (useful feature)

13. **get-dashboard-metrics** ⚠️
    - Dashboard statistics
    - Used by: Dashboard_v3?
    - **Decision: KEEP** (dashboard feature)

## Summary

### Keep (10 functions)
1. upload-document
2. trigger-validation
3. validate-assessment
4. check-operation-status
5. generate-smart-questions-v2
6. fetch-units-of-competency
7. scrape-training-gov-au
8. generate-validation-report
9. get-dashboard-metrics

### Remove (8 functions)
1. generate-smart-questions (superseded)
2. create-validation-record (deprecated)
3. get-gemini-operation-status (duplicate)
4. upload-files-to-storage (superseded)
5. create-checkout-session (not implemented)
6. stripe-webhook (not implemented)
7. get-ai-credits (not implemented)
8. get-validation-credits (not implemented)
9. query-document (not used)

## Cleanup Actions

1. Remove 8 unused functions from codebase
2. Delete from Supabase:
   ```bash
   supabase functions delete generate-smart-questions
   supabase functions delete create-validation-record
   supabase functions delete get-gemini-operation-status
   supabase functions delete upload-files-to-storage
   supabase functions delete create-checkout-session
   supabase functions delete stripe-webhook
   supabase functions delete get-ai-credits
   supabase functions delete get-validation-credits
   supabase functions delete query-document
   ```

3. Deploy clean set:
   ```bash
   supabase functions deploy
   ```
