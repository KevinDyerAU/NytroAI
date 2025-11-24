# Edge Function Refactoring Summary

## Objective
Refactor all UI database calls to use Edge Functions instead of direct Supabase client queries.

## Benefits
1. **Security**: Bypasses Row Level Security (RLS) issues
2. **Centralization**: Business logic in one place
3. **Maintainability**: Easier to debug and update
4. **Performance**: Can add caching, rate limiting, etc.
5. **Consistency**: Standardized error handling

## Completed Refactoring

### ✅ DocumentUploadAdapter.tsx
- **Already using edge function**: `fetch-units-of-competency`
- **Implementation**: Fetches all units via edge function, filters locally
- **Status**: ✅ Complete

### ✅ DocumentUploadAdapterSimplified.tsx
- **Refactored**: `handleUnitSelect` now uses `fetch-units-of-competency` edge function
- **Before**: Direct query to `UnitOfCompetency` table
- **After**: Calls edge function, filters result
- **Status**: ✅ Complete

## Edge Functions Available

### 1. fetch-units-of-competency
- **Purpose**: Fetch all units of competency
- **Method**: POST
- **Body**: `{ unitCode?: string }` (optional filter)
- **Response**: `{ success: boolean, data: Unit[] }`
- **Version**: 2 (deployed)

### 2. create-validation-record
- **Purpose**: Create validation record
- **Method**: POST
- **Body**: `{ rtoCode, unitCode, qualificationCode?, validationType, pineconeNamespace }`
- **Response**: `{ success: boolean, summaryId, detailId, validationTypeId, namespace }`
- **Version**: 1 (deployed)

### 3. trigger-validation
- **Purpose**: Trigger validation process
- **Method**: POST
- **Body**: `{ validationDetailId }`
- **Response**: `{ success: boolean }`
- **Version**: 9 (deployed)

### 4. upload-document
- **Purpose**: Upload and index document
- **Method**: POST
- **Body**: `{ rtoCode, unitCode, documentType, fileName, storagePath, displayName?, metadata? }`
- **Response**: `{ success: boolean, document: { id, fileName, ... } }`
- **Version**: 6 (deployed)

### 5. validate-assessment
- **Purpose**: Run AI validation
- **Method**: POST
- **Body**: `{ validationDetailId }`
- **Response**: `{ success: boolean }`
- **Version**: 28 (deployed)

### 6. check-operation-status
- **Purpose**: Check Gemini operation status
- **Method**: POST
- **Body**: `{ operationId }`
- **Response**: `{ success: boolean, status, progressPercentage }`
- **Version**: 7 (deployed)

### 7. get-validation-credits
- **Purpose**: Get validation credit balance for RTO
- **Method**: POST
- **Body**: `{ rtoCode }`
- **Response**: `{ current, total, subscription }`
- **Version**: 6 (deployed)

### 8. get-ai-credits
- **Purpose**: Get AI credit balance for RTO
- **Method**: POST
- **Body**: `{ rtoCode }`
- **Response**: `{ current, total, subscription }`
- **Version**: 6 (deployed)

### 9. consume-validation-credit
- **Purpose**: Consume one validation credit
- **Method**: POST
- **Body**: `{ rtoCode, reason? }`
- **Response**: `{ success, remainingCredits }`
- **Version**: 1 (deployed)

### 10. consume-ai-credit
- **Purpose**: Consume one AI credit
- **Method**: POST
- **Body**: `{ rtoCode, reason? }`
- **Response**: `{ success, remainingCredits }`
- **Version**: 1 (deployed)

## Components Using Edge Functions

### Main Upload Flow
1. **DocumentUploadAdapter** → `fetch-units-of-competency`
2. **DocumentUploadAdapter** → `create-validation-record`
3. **DocumentUploadRefactored** → `upload-document`
4. **ValidationWorkflowService** → `trigger-validation`
5. **ValidationWorkflowService** → `validate-assessment`

### Simplified Upload Flow
1. **DocumentUploadAdapterSimplified** → `fetch-units-of-competency`
2. **DocumentUploadSimplified** → `upload-document` (via service)

## Maintenance Components

**Note**: Maintenance components (`/src/components/maintenance/**`) still use direct database queries. This is intentional as:
- They require admin access
- They need complex queries not suitable for edge functions
- They have their own RLS policies

## Next Steps

### Optional Enhancements:
1. **Add caching** to `fetch-units-of-competency` edge function
2. **Create edge function** for common validation queries
3. **Add rate limiting** to prevent abuse
4. **Implement request logging** for debugging

### Testing Checklist:
- ✅ Unit dropdown loads correctly
- ✅ Unit selection works without RLS errors
- ✅ Validation record creation succeeds
- ✅ Document upload completes
- ✅ Validation triggers successfully

## RLS Considerations

With edge functions using service role key:
- ✅ **No RLS issues** for public data (units, etc.)
- ✅ **Secure**: Business logic validates permissions
- ✅ **Flexible**: Can implement custom authorization

### Credit Management Flow
1. **Dashboard** → `get-validation-credits` (display balance)
2. **Dashboard** → `get-ai-credits` (display balance)
3. **ValidationWorkflowService** → `consume-validation-credit` (before validation)
4. **SmartQuestionGenerator** → `consume-ai-credit` (before AI operation)

## Deployment Status

All edge functions deployed and active:
```bash
✅ check-operation-status (v7)
✅ fetch-units-of-competency (v2)
✅ generate-smart-questions-v2 (v2)
✅ generate-validation-report (v6)
✅ get-dashboard-metrics (v13)
✅ scrape-training-gov-au (v1)
✅ trigger-validation (v9)
✅ upload-document (v6)
✅ validate-assessment (v28)
✅ create-validation-record (v1)
✅ get-validation-credits (v6)
✅ get-ai-credits (v6)
✅ consume-validation-credit (v1)
✅ consume-ai-credit (v1)
```

## Migration Complete! 🎉

All user-facing components now use edge functions for database operations.
No more RLS errors on the upload page!
