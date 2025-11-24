# RPC Functions vs Edge Functions

## Overview

NytroAI uses two types of backend functions: **RPC Functions** (PostgreSQL stored procedures) and **Edge Functions** (Deno TypeScript functions). Understanding when to use each is crucial for maintainability and performance.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│                                                                     │
│  • Dashboard Components                                            │
│  • Upload Components                                               │
│  • Credit Management UI                                            │
└────────────┬─────────────────────────────────────┬────────────────┘
             │                                     │
             │                                     │
             ▼                                     ▼
┌────────────────────────────┐      ┌────────────────────────────────┐
│   Supabase Edge Functions  │      │    Direct Database Access      │
│      (Deno Runtime)        │      │   (via Supabase Client)        │
│                            │      │                                │
│  • Complex business logic  │      │  • Simple CRUD operations      │
│  • External API calls      │      │  • Read-only queries           │
│  • File processing         │      │  • Real-time subscriptions     │
│  • AI integrations         │      │                                │
│  • Validation workflows    │      └────────────┬───────────────────┘
│  • Credit operations       │                   │
│                            │                   │
└────────────┬───────────────┘                   │
             │                                   │
             │  Can call RPC ──────────┐         │
             │                         │         │
             ▼                         ▼         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              RPC Functions (Stored Procedures)               │  │
│  │                                                              │  │
│  │  • add_ai_credits(rto_code, amount, reason)                │  │
│  │  • add_validation_credits(rto_code, amount, reason)        │  │
│  │  • Direct database operations                              │  │
│  │  • Atomic transactions                                     │  │
│  │  • Fast execution (no network overhead)                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Tables                                  │  │
│  │                                                              │  │
│  │  • RTO                    • validation_credits              │  │
│  │  • ai_credits             • credit_transactions             │  │
│  │  • validation_details     • gemini_operations               │  │
│  │  • documents              • validation_results              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## When to Use Each

### Use Edge Functions When:

✅ **Complex Business Logic**
- Multi-step workflows (validation, document processing)
- Decision trees and conditional logic
- Orchestrating multiple operations

✅ **External API Calls**
- Google Gemini AI API
- Stripe payment processing
- Web scraping (training.gov.au)

✅ **File Handling**
- Document uploads and storage
- PDF processing
- File conversions

✅ **Security & Authentication**
- Requires service role permissions (bypass RLS)
- API key management
- Token verification

✅ **Error Handling & Logging**
- Detailed error responses
- Request logging
- Debug information

✅ **Cross-Table Operations**
- Reading from multiple tables
- Complex joins
- Data aggregation

**Example Edge Functions:**
- `upload-document` - Handles file upload to storage + Gemini indexing
- `trigger-validation` - Orchestrates entire validation workflow
- `validate-assessment` - Calls Gemini API and stores results
- `get-validation-credits` - Fetches credits with default creation logic
- `generate-smart-questions-v2` - Calls Gemini API for AI generation

### Use RPC Functions When:

✅ **Direct Database Operations**
- Simple CRUD operations
- Atomic transactions
- Database-level constraints

✅ **Credit Management**
- Adding/subtracting credits
- Ensuring transaction integrity
- Logging credit history

✅ **Performance Critical**
- No network overhead (runs in DB)
- Fast execution
- Transactional guarantees

✅ **Database Triggers**
- Automatic operations on insert/update
- Maintaining referential integrity
- Audit logging

**Example RPC Functions:**
- `add_ai_credits(rto_code, amount, reason)` - Atomic credit addition
- `add_validation_credits(rto_code, amount, reason)` - Atomic credit addition

## Typical Data Flow

### Scenario: User Adds AI Credits via Maintenance Page

```
Frontend (Maintenance Page)
    │
    │ 1. User enters: Amount = 1000, Reason = "AI Credits"
    │
    ▼
RTO Service (rto.ts)
    │
    │ 2. addAICredits(rtoCode, 1000, reason)
    │
    ▼
Supabase Client
    │
    │ 3. supabase.rpc('add_ai_credits', { ... })
    │
    ▼
PostgreSQL RPC Function
    │
    │ 4. BEGIN TRANSACTION
    │    - Get RTO ID from code
    │    - Update ai_credits table (atomic)
    │    - Insert into ai_credit_transactions
    │    - Return new balance
    │    COMMIT
    │
    ▼
Response to Frontend
    │
    │ 5. { current_credits: 1095, total_credits: 1100 }
    │
    ▼
UI Updates
    - Display new credit balance
    - Show success message
```

### Scenario: Dashboard Displays Credit Balance

```
Frontend (Dashboard)
    │
    │ 1. useEffect on component mount
    │
    ▼
useDashboardMetrics Hook
    │
    │ 2. Fetch credits via edge function
    │
    ▼
Supabase Edge Function
    │
    │ 3. POST /functions/v1/get-ai-credits
    │    Body: { rtoId: "57" }
    │
    ▼
get-ai-credits Function
    │
    │ 4. Query database:
    │    - Convert rtoId to integer
    │    - SELECT from ai_credits WHERE rto_id = 57
    │    - If not found, INSERT default (100 credits)
    │    - Return { current, total, subscription }
    │
    ▼
Response to Frontend
    │
    │ 5. { current: 95, total: 100, subscription: 100 }
    │
    ▼
Dashboard UI
    - Calculate percentage: 95%
    - Display: "95 / 100 AI Credits"
    - Show usage bar
```

## Edge Functions Calling RPCs

Edge Functions can call RPC functions for database operations:

```typescript
// Inside an edge function (consume-ai-credit/index.ts)

// Call RPC function to consume a credit
const { data, error } = await supabase.rpc('add_ai_credits', {
  rto_code: rtoCode,
  amount: -1, // Subtract 1 credit
  reason: 'AI credit consumed for smart question generation',
});

if (error) {
  return createErrorResponse('Failed to consume credit', 402);
}

return createSuccessResponse({
  success: true,
  remainingCredits: data.current_credits,
});
```

**Why this pattern?**
- Edge function handles authentication, validation, error responses
- RPC ensures atomic database transaction
- Best of both worlds: flexibility + data integrity

## Common Patterns

### Pattern 1: Edge Function → RPC → Database

**Use for:** Credit consumption, transactional operations

```
Edge Function (TypeScript)
    ↓ Validates request
    ↓ Checks authentication
    ↓
RPC Function (SQL)
    ↓ Atomic transaction
    ↓ Updates credits
    ↓ Logs transaction
    ↓
Database Tables
```

### Pattern 2: Edge Function → Direct Database Access

**Use for:** Read operations, complex queries

```
Edge Function (TypeScript)
    ↓ Service role client
    ↓ Complex SELECT query
    ↓ Join multiple tables
    ↓ Transform results
    ↓
Return formatted response
```

### Pattern 3: Frontend → Direct Database Access

**Use for:** Simple CRUD, real-time subscriptions

```
Frontend (React)
    ↓ Supabase client (anon key)
    ↓ Simple SELECT query
    ↓ RLS policies enforced
    ↓
User-specific data only
```

## Security Considerations

### Edge Functions (Service Role)
- **Bypass RLS** - Full database access
- **API Keys** - Manage sensitive credentials
- **Custom Logic** - Implement business rules
- **Logging** - Track all operations

### RPC Functions (Database Level)
- **Transactional** - ACID guarantees
- **Fast** - No network overhead
- **Isolated** - Cannot make external calls
- **Permissions** - Granted per role (anon, authenticated, service_role)

### Direct Database Access (Anon/Authenticated)
- **RLS Enforced** - Row Level Security policies
- **User Context** - Only access user's data
- **Limited** - Cannot bypass security
- **Real-time** - Subscriptions to changes

## Migration from RPC to Edge Functions

We migrated several operations from direct RPC calls to Edge Functions:

**Before:**
```typescript
// Direct RPC call from frontend (security risk)
const { data } = await supabase.rpc('get_validation_credits', {
  rto_code: '7148'
});
```

**After:**
```typescript
// Edge function with service role (secure)
const { data } = await supabase.functions.invoke('get-validation-credits', {
  body: { rtoId: '57' }
});
```

**Benefits:**
- ✅ Better error handling
- ✅ Logging and debugging
- ✅ Flexible parameter handling (rtoId OR rtoCode)
- ✅ Can create default records if missing
- ✅ Service role bypasses RLS issues
- ✅ TypeScript type safety

## Best Practices

### For Edge Functions:

1. **Use TypeScript** - Type safety for request/response
2. **Service Role Client** - Bypass RLS when needed
3. **CORS Handling** - Use shared CORS utility
4. **Error Responses** - Consistent error format
5. **Logging** - Console.log for debugging
6. **Call RPCs** - For transactional operations

### For RPC Functions:

1. **Prefix Parameters** - Use `p_` to avoid ambiguity (e.g., `p_amount`)
2. **Prefix Variables** - Use `v_` for clarity (e.g., `v_rto_id`)
3. **Atomic Operations** - Keep transactions short
4. **Error Handling** - Use `RAISE EXCEPTION` for errors
5. **Return Values** - Always return useful data
6. **Grant Permissions** - Explicitly grant to roles

### For Direct Database Access:

1. **RLS Policies** - Always enable RLS on tables
2. **Anon Key** - Use for unauthenticated operations
3. **Auth Key** - Use for user-specific data
4. **Never Service Role** - Don't expose service role key in frontend
5. **Real-time** - Use subscriptions for live updates

## Current Implementation

### Edge Functions (13 total)
- `check-operation-status`
- `consume-ai-credit`
- `consume-validation-credit`
- `create-validation-record`
- `fetch-units-of-competency`
- `generate-smart-questions-v2`
- `generate-validation-report`
- `get-ai-credits`
- `get-dashboard-metrics`
- `get-validation-credits`
- `scrape-training-gov-au`
- `trigger-validation`
- `upload-document`
- `validate-assessment`

### RPC Functions (2 total)
- `add_ai_credits(TEXT, INTEGER, TEXT)`
- `add_validation_credits(TEXT, INTEGER, TEXT)`

### Decision Matrix

| Operation | Type | Reason |
|-----------|------|--------|
| Upload document | Edge Function | File handling + Gemini API |
| Trigger validation | Edge Function | Multi-step workflow |
| Validate assessment | Edge Function | External API call |
| Get credits | Edge Function | Complex logic + defaults |
| Consume credit | Edge Function | Validation + RPC call |
| Add credits (transaction) | RPC Function | Atomic database operation |
| Fetch units | Edge Function | Service role access |
| Generate questions | Edge Function | AI API call |
| Dashboard metrics | Edge Function | Aggregation + joins |

## Summary

**Edge Functions** = Business logic, external APIs, complex workflows
**RPC Functions** = Atomic database operations, transactions
**Direct DB Access** = Simple CRUD, real-time subscriptions

Use Edge Functions as the **primary interface** for client requests, and let them call RPC functions when atomic database operations are needed. This provides the best balance of flexibility, security, and performance.
