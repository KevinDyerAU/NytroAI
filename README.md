<div align="center">

<img width="1200" height="475" alt="NytroAI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# NytroAI

**Validate Training Assessments with AI in Minutes**

[![Built with Figma](https://img.shields.io/badge/Designed%20in-Figma-F24E1E?logo=figma)](https://figma.com)
[![Built with Builder.io](https://img.shields.io/badge/Built%20with-Builder.io-6B4FBB?logo=builder.io)](https://builder.io)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.0-8E75B2)](https://deepmind.google/technologies/gemini/)

[Get Started](#-quick-start) • [Documentation](./docs) • [Report Issue](https://github.com/KevinDyerAU/NytroAI/issues)

</div>

---

## What is NytroAI?

NytroAI helps Australian RTOs (Registered Training Organisations) validate their training assessments against unit requirements using AI. Upload your assessment documents, and get instant feedback on compliance, gaps, and recommendations.

### Why Use NytroAI?

**Save Time** - What takes hours manually now takes minutes with AI

**Ensure Compliance** - Automatically check against all unit requirements

**Improve Quality** - Get smart questions to fill assessment gaps

**Stay Organized** - Track all validations in one dashboard

---

## ✨ Key Features

- **AI Validation** - Automatically checks assessments against unit requirements
- **Smart Questions** - Generates questions to address gaps (with regeneration)
- **Instant Results** - Real-time validation with detailed reports
- **Easy Upload** - Drag and drop PDF assessments
- **Dashboard** - Track all validations in one place

---

## 🚀 Quick Start

### 1. Get Your API Keys

You'll need two free accounts:

- **Supabase** (database) - [Sign up here](https://supabase.com)
- **Google AI Studio** (AI) - [Get API key here](https://aistudio.google.com/app/apikey)

### 2. Install

```bash
# Clone the repository
git clone https://github.com/KevinDyerAU/NytroAI.git
cd NytroAI

# Install dependencies
npm install
```

### 3. Configure

Create a `.env.local` file with your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Setup Database

```bash
# Link to your Supabase project
supabase link --project-ref your_project_ref

# Setup database (one command!)
supabase db push
```

### 5. Run

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. Done! 🎉

---

## 📖 How It Works

### Instant Upload Process

```
Upload (Instant) → Background Processing → Get Results
```

1. **Upload** - Drag and drop your assessment PDF → **Completes in <1 second!**
2. **Continue Working** - Close browser, upload more files, or check Dashboard
3. **Automatic Processing** - AI indexes and validates in the background
4. **Review Results** - Dashboard shows real-time progress and results

### What Happens Behind the Scenes

![Simplified Upload Flow](docs/simplified-upload-flow.png)

*Complete upload and validation flow showing DB trigger automation*

**Upload Phase (<1 Second)**
- Files upload to secure storage
- ✅ **Upload complete!** You can continue working immediately
- No waiting for processing
- Can close browser right away

**Background Processing (Automatic - Fire-and-Forget)**
- Edge function creates document records (async)
- AI indexes documents with Gemini File Search
- Database trigger automatically starts validation
- Requirements fetched as structured JSON
- Each requirement validated individually
- Results stored in database
- **All happens in background - no user waiting required**

**Results (Real-time)**
- Dashboard polls for status updates
- See progress as validation completes
- Check anytime - processing continues even if browser closed
- Export detailed compliance report when ready

---

## 🔧 Document Upload & Validation Pipeline

### Architecture Overview

NytroAI uses a sophisticated multi-stage pipeline for document processing and validation. The system is designed for **instant uploads** with **background processing**, ensuring users never have to wait.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          UPLOAD PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────┘

1. User Selects Files & Unit
   ↓
2. Create Validation Record
   │  Edge Function: create-validation-record
   │  Creates: validation_summary → validation_detail
   │  Stores: unitLink for requirements matching
   ↓
3. Upload to Storage (<1 second)
   │  Files uploaded to Supabase Storage
   │  Path: documents/{rto_code}/{unit_code}/{filename}
   ↓
4. Create Document Record (Fast Path)
   │  Edge Function: create-document-fast
   │  Creates: documents table entry
   │  Links: validation_detail_id
   │  Stores: metadata (unit_code, rto_code, document_type)
   ↓
5. Create Gemini Operation
   │  Table: gemini_operations
   │  Status: pending
   │  Fields: operation_name, document_id, metadata
   ↓
   ✅ UPLOAD COMPLETE - User can continue working
   
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND PROCESSING                               │
└─────────────────────────────────────────────────────────────────────────┘

6. Indexing Processor (Every 15 seconds)
   │  Hook: useIndexingProcessor
   │  Edge Function: process-pending-indexing
   │  Fetches: pending gemini_operations
   ↓
7. Download from Storage
   │  Downloads file from Supabase Storage
   │  Converts to ArrayBuffer for Gemini
   ↓
8. Upload to Gemini File Search
   │  API: Gemini File Search API
   │  Store: fileSearchStores/rto{rto_code}assessments-{hash}
   │  Operation: Creates background operation
   ↓
9. Poll Gemini Operation Status
   │  Polls every 2 seconds
   │  Timeout: 60 seconds (configurable)
   │  Updates: gemini_operations.progress_percentage
   ↓
10. Mark Operation Complete
    │  Updates: gemini_operations.status = 'completed'
    │  Updates: documents.embedding_status = 'completed'
    ↓
11. Trigger Validation
    │  Edge Function: validate-assessment
    │  Fetches: unitLink from validation_summary
    │  Queries: Requirements by unit_url
    ↓
12. Fetch Requirements
    │  Queries requirement tables by unit_url
    │  Tables: knowledge_evidence_requirements,
    │          performance_evidence_requirements,
    │          foundation_skills_requirements,
    │          elements_performance_criteria_requirements,
    │          assessment_conditions_requirements
    ↓
13. AI Validation
    │  API: Gemini generateContent with File Search
    │  Validates each requirement individually
    │  Generates: status, reasoning, evidence, smart questions
    ↓
14. Store Results
    │  Table: validation_results
    │  Updates: validation_detail.extractStatus = 'Completed'
    ↓
    ✅ VALIDATION COMPLETE - Results visible in Dashboard
```

### Edge Functions Reference

#### 1. `create-validation-record`

**Purpose:** Creates validation_summary and validation_detail records before upload

**Request:**
```typescript
{
  rtoCode: string;        // e.g., "7148"
  unitCode: string;       // e.g., "TLIF0025"
  unitLink: string;       // Unit URL from UnitOfCompetency.Link
  validationType: string; // e.g., "assessment"
  pineconeNamespace: string; // Namespace for vector storage
}
```

**Response:**
```typescript
{
  detailId: number;       // validation_detail.id
  summaryId: number;      // validation_summary.id
}
```

**Key Logic:**
- Creates `validation_summary` with `unitLink` stored for later requirements matching
- Creates `validation_detail` linked to summary
- Sets initial `extractStatus: 'Uploading'`

#### 2. `create-document-fast`

**Purpose:** Fast, non-blocking document record creation with background indexing

**Request:**
```typescript
{
  rtoCode: string;
  unitCode: string;
  documentType: string;
  fileName: string;
  storagePath: string;
  validationDetailId?: number; // Links document to validation
}
```

**Response:**
```typescript
{
  documentId: number;
  storageUrl: string;
  validationDetailId?: number;
}
```

**Key Logic:**
- Creates document record with `embedding_status: 'pending'`
- Stores `validation_detail_id` for linking
- Creates `gemini_operations` record with:
  - `operation_name`: Unique identifier for Gemini tracking
  - `document_id`: Links operation to document
  - `status: 'pending'`: Triggers background processor
  - `metadata`: Stores rto_code, unit_code, file_name for context

**Critical Fix (Nov 24, 2025):**
- Added `operation_name` field (was causing NULL constraint violations)
- Format: `operations/{timestamp}-{document_id}`

#### 3. `process-pending-indexing`

**Purpose:** Background processor that indexes documents to Gemini and triggers validation

**Invoked by:** `useIndexingProcessor` hook (every 15 seconds)

**Flow:**
1. Fetch pending `gemini_operations` (status = 'pending')
2. For each operation:
   - Download file from storage
   - Upload to Gemini File Search store
   - Poll operation status (every 2s, max 60s)
   - Update progress in database
   - Mark operation as 'completed'
3. Trigger validation if `validation_detail_id` exists

**Key Logic:**
```typescript
// Fetch unitCode from document metadata
const unitCode = document.metadata?.unit_code;

// Call validate-assessment
await supabase.functions.invoke('validate-assessment', {
  body: {
    validationDetailId: document.validation_detail_id,
    documentId: document.id,
    unitCode: unitCode,
    validationType: 'full_validation'
  }
});
```

**Timeouts & Error Handling:**
- Client-side timeout: 30 seconds (prevents hung processor)
- Gemini upload timeout: 120 seconds (for large files)
- Gemini poll timeout: 10 seconds per request
- Max wait time: 60 seconds (configurable via `max_wait_time_ms`)

**Critical Fixes (Nov 24, 2025):**
- Added timeout to prevent processor getting stuck
- Added `unitCode` and `validationType` to validation trigger
- Added comprehensive error logging

#### 4. `validate-assessment`

**Purpose:** AI-powered validation against unit requirements

**Request:**
```typescript
{
  documentId: number;
  unitCode: string;
  validationType: 'full_validation' | 'knowledge_evidence' | ...;
  validationDetailId?: number;
}
```

**Flow:**
1. Fetch `unitLink` from `validation_detail → validation_summary`
2. Fetch requirements using `unit_url = unitLink`
3. Query Gemini File Search with requirements
4. Parse and store validation results

**Key Logic:**
```typescript
// Fetch unitLink from validation chain
const { data: validationDetail } = await supabase
  .from('validation_detail')
  .select('namespace_code, validation_summary(unitLink)')
  .eq('id', validationDetailId)
  .single();

const unitLink = validationDetail?.validation_summary?.unitLink;

// Fetch requirements by unit_url (not unitCode!)
const requirements = await fetchRequirements(
  supabase,
  unitCode,
  validationType,
  unitLink // ← Critical: Links to actual requirement records
);
```

**Critical Fix (Nov 24, 2025):**
- Changed from querying by `unitCode` to `unit_url`
- Fetches `unitLink` from `validation_summary`
- Passes `unitLink` to requirements fetcher

#### 5. `requirements-fetcher` (Shared Utility)

**Purpose:** Fetches requirements from database tables with correct linking

**Key Tables:**
- `knowledge_evidence_requirements`
- `performance_evidence_requirements`
- `foundation_skills_requirements`
- `elements_performance_criteria_requirements`
- `assessment_conditions_requirements`

**Schema Linking:**
```sql
-- Each requirement table has:
unit_url VARCHAR  -- Links to UnitOfCompetency.Link
unitCode VARCHAR  -- Fallback for legacy queries

-- validation_summary stores:
unitLink VARCHAR  -- Matches requirement.unit_url
unitCode VARCHAR  -- Matches requirement.unitCode
```

**Query Logic:**
```typescript
// Prefer unit_url when unitLink is available
const { data } = unitLink
  ? await supabase
      .from(requirementTable)
      .select('*')
      .eq('unit_url', unitLink)  // ← Primary method
  : await supabase
      .from(requirementTable)
      .select('*')
      .eq('unitCode', unitCode); // ← Fallback
```

**Critical Fix (Nov 24, 2025):**
- Added `unitLink` parameter to fetch functions
- Query by `unit_url` instead of `unitCode`
- Fixes PostgreSQL column case-sensitivity errors

### Client-Side Components

#### `DocumentUploadAdapterSimplified`

**Purpose:** Orchestrates the upload flow

**Key Responsibilities:**
1. Unit selection from dropdown
2. Creates validation record when files selected
3. Passes `unitLink` from selected unit
4. Manages upload state

**State Management:**
```typescript
const [validationDetailId, setValidationDetailId] = useState<number>();
const [isCreatingValidation, setIsCreatingValidation] = useState(false);

// When files selected, create validation first
const handleFilesSelected = async (files: File[]) => {
  const { data } = await supabase.functions.invoke('create-validation-record', {
    body: {
      rtoCode: selectedRTO.code,
      unitCode: selectedUnit.code,
      unitLink: selectedUnit.Link, // ← From dropdown selection
      validationType: 'assessment',
      pineconeNamespace: selectedRTO.code
    }
  });
  
  setValidationDetailId(data.detailId);
};
```

#### `DocumentUploadSimplified`

**Purpose:** Handles file selection and upload UI

**Flow:**
1. User selects files
2. Calls `onFilesSelected` callback (triggers validation creation)
3. Uploads each file to storage
4. Calls `DocumentUploadService.uploadDocument`

#### `DocumentUploadService`

**Purpose:** Service layer for document operations

**Key Method:**
```typescript
async uploadDocument(
  file: File,
  rtoCode: string,
  unitCode: string,
  documentType: string,
  validationDetailId?: number // ← Passed from adapter
): Promise<UploadResult>
```

**Calls:**
- `uploadToStorage()` - Uploads to Supabase Storage
- `triggerIndexingBackground()` - Calls `create-document-fast`

#### `useIndexingProcessor`

**Purpose:** Client-side hook that triggers background indexing

**Behavior:**
- Runs every 15 seconds when dashboard is active
- Calls `process-pending-indexing` edge function
- 30-second timeout to prevent hanging
- Singleton pattern (only one instance processes at a time)

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    if (isProcessingRef.current) {
      console.log('Already processing, skipping...');
      return;
    }

    isProcessingRef.current = true;
    
    try {
      // Invoke with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );
      
      const result = await Promise.race([
        supabase.functions.invoke('process-pending-indexing'),
        timeoutPromise
      ]);
      
      // Process result...
    } finally {
      isProcessingRef.current = false;
    }
  }, 15000);
  
  return () => clearInterval(interval);
}, []);
```

### Database Schema

#### Key Tables

**`validation_summary`**
```sql
CREATE TABLE validation_summary (
  id SERIAL PRIMARY KEY,
  rtoCode VARCHAR,
  unitCode VARCHAR,
  unitLink VARCHAR,  -- ← Links to requirements.unit_url
  qualificationCode VARCHAR,
  reqExtracted BOOLEAN DEFAULT false
);
```

**`validation_detail`**
```sql
CREATE TABLE validation_detail (
  id SERIAL PRIMARY KEY,
  summary_id INTEGER REFERENCES validation_summary(id),
  validationType_id INTEGER,
  namespace_code VARCHAR,
  extractStatus VARCHAR DEFAULT 'Uploading',
  docExtracted BOOLEAN DEFAULT false,
  numOfReq INTEGER DEFAULT 0
);
```

**`documents`**
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR,
  storage_path VARCHAR,
  file_search_store_id VARCHAR,
  embedding_status VARCHAR DEFAULT 'pending',
  validation_detail_id INTEGER REFERENCES validation_detail(id),
  metadata JSONB  -- Stores: unit_code, rto_code, document_type
);
```

**`gemini_operations`**
```sql
CREATE TABLE gemini_operations (
  id SERIAL PRIMARY KEY,
  operation_name VARCHAR NOT NULL,  -- Unique Gemini operation ID
  document_id INTEGER REFERENCES documents(id),
  operation_type VARCHAR,
  status VARCHAR DEFAULT 'pending',  -- pending → processing → completed/failed
  progress_percentage INTEGER DEFAULT 0,
  max_wait_time_ms INTEGER DEFAULT 60000,
  metadata JSONB
);
```

**Requirements Tables** (5 tables with same schema)
```sql
CREATE TABLE knowledge_evidence_requirements (
  id SERIAL PRIMARY KEY,
  unit_url VARCHAR,    -- Links to UnitOfCompetency.Link
  unitCode VARCHAR,    -- Fallback for legacy queries
  knowledge_point TEXT,
  requirement_number VARCHAR
);
-- Same schema for:
-- - performance_evidence_requirements
-- - foundation_skills_requirements  
-- - elements_performance_criteria_requirements
-- - assessment_conditions_requirements
```

### Error Handling & Recovery

#### Common Issues & Solutions

**1. "column unitCode does not exist"**
- **Cause:** PostgreSQL case-sensitivity - column is `unit_code` not `unitCode`
- **Fix:** Use snake_case in queries, or query by `unit_url` instead

**2. "null value in column operation_name violates not-null constraint"**
- **Cause:** `create-document-fast` wasn't setting `operation_name`
- **Fix:** Generate unique operation_name: `operations/{timestamp}-{document_id}`

**3. "Indexing processor stuck - Already processing, skipping..."**
- **Cause:** `process-pending-indexing` hung without resetting flag
- **Fix:** Added 30-second client-side timeout with Promise.race()

**4. "Validation trigger failed: 400 Bad Request"**
- **Cause:** Missing `unitCode` and `validationType` parameters
- **Fix:** Extract from `document.metadata` and pass to `validate-assessment`

**5. "Validation trigger failed: 500 Internal Server Error"**
- **Cause:** Requirements fetch failed with unitCode mismatch
- **Fix:** Query by `unit_url` using `unitLink` from `validation_summary`

#### Debugging Tools

**Check operation status:**
```sql
SELECT 
  go.id,
  go.operation_name,
  go.status,
  go.progress_percentage,
  d.file_name,
  d.embedding_status
FROM gemini_operations go
JOIN documents d ON d.id = go.document_id
WHERE go.created_at > NOW() - INTERVAL '1 hour'
ORDER BY go.created_at DESC;
```

**Check validation flow:**
```sql
SELECT 
  vs.id as summary_id,
  vs.unitCode,
  vs.unitLink,
  vd.id as detail_id,
  vd.extractStatus,
  COUNT(d.id) as document_count,
  COUNT(CASE WHEN d.embedding_status = 'completed' THEN 1 END) as indexed_count
FROM validation_summary vs
JOIN validation_detail vd ON vd.summary_id = vs.id
LEFT JOIN documents d ON d.validation_detail_id = vd.id
WHERE vs.created_at > NOW() - INTERVAL '1 hour'
GROUP BY vs.id, vs.unitCode, vs.unitLink, vd.id, vd.extractStatus
ORDER BY vs.created_at DESC;
```

**Check requirements linking:**
```sql
SELECT 
  vs.unitCode,
  vs.unitLink,
  COUNT(ker.id) as knowledge_reqs,
  COUNT(per.id) as performance_reqs
FROM validation_summary vs
LEFT JOIN knowledge_evidence_requirements ker ON ker.unit_url = vs.unitLink
LEFT JOIN performance_evidence_requirements per ON per.unit_url = vs.unitLink
WHERE vs.id = 123  -- Your validation_summary.id
GROUP BY vs.unitCode, vs.unitLink;
```

### Performance Optimizations

**1. Background Processing**
- Upload completes in <1 second
- Indexing happens asynchronously
- No frontend blocking or polling during upload

**2. Singleton Processor**
- Only one `useIndexingProcessor` instance runs at a time
- Prevents duplicate processing
- Conserves API quota

**3. Batch Operations**
- Processes multiple pending operations in single function call
- Reduces edge function invocations

**4. Efficient Polling**
- 2-second intervals for Gemini status
- 15-second intervals for client processor
- Timeouts prevent infinite loops

### Monitoring & Observability

**Supabase Logs:**
```
Filter by function: process-pending-indexing
Look for:
- "Processing document: {filename}"
- "Indexing completed for: {filename}"
- "Triggering validation for detail: {id}"
- "Validation triggered successfully"
```

**Client Console:**
```
Filter: [IndexingProcessor]
Look for:
- "Starting background indexing processor..."
- "Processed X operations"
- "Already processing, skipping..."
- "Timeout after 30 seconds - resetting"
```

**Database Monitoring:**
```sql
-- Active operations
SELECT COUNT(*) FROM gemini_operations WHERE status = 'processing';

-- Failed operations
SELECT * FROM gemini_operations 
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '1 day';

-- Average completion time
SELECT 
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM gemini_operations 
WHERE status = 'completed';
```

---

## 💳 Credit System

NytroAI uses a dual-credit system to manage usage for different AI operations:

### Credit Types

#### 1. Validation Credits
- **Used for:** Running AI validation on assessments (1 credit per validation)
- **Default allocation:** Based on subscription tier
- **Base credits per tier:**
  - **Starter:** 10 validations/month
  - **Professional:** 50 validations/month  
  - **Enterprise:** 200 validations/month
  - **Unlimited:** 1000 validations/month

#### 2. AI Credits
- **Used for:** AI-powered features like smart question generation (1 credit per operation)
- **Default allocation:** Based on subscription tier
- **Base credits per tier:**
  - **Starter:** 100 AI operations/month
  - **Professional:** 500 AI operations/month
  - **Enterprise:** 2000 AI operations/month
  - **Unlimited:** 10000 AI operations/month

### How Credits Work

```
Subscription Credits (Base) + Additional Credits (Purchased) = Total Available Credits
```

**Example:**
- Professional subscription: **50 validation credits** (base)
- Purchase additional: **+ 25 validation credits**
- **Total available: 75 validation credits**

### Credit Consumption

**Validation Credits:**
- ✅ Consumed when starting a new validation (1 credit)
- ✅ Deducted immediately when you click "Start Validation"
- ✅ Not refunded if validation fails (to prevent abuse)
- ✅ Dashboard shows: `Current / Total` (e.g., "8 / 10 credits")

**AI Credits:**
- ✅ Consumed when generating smart questions (1 credit per question)
- ✅ Consumed when using AI-enhanced features (1 credit per operation)
- ✅ Deducted only on successful operation
- ✅ Dashboard shows: `Current / Total` (e.g., "95 / 100 credits")

### Credit Management

#### Viewing Credits
Your current credit balance is displayed on the **Dashboard**:

```
┌─────────────────────────────┐
│ VALIDATION CREDITS          │
│ 8 / 10                      │
│ 80% Remaining               │
└─────────────────────────────┘

┌─────────────────────────────┐
│ AI CREDITS                  │
│ 95 / 100                    │
│ 95% Remaining               │
└─────────────────────────────┘
```

#### Purchasing Additional Credits
You can purchase additional credits at any time:
1. Go to **Settings → Credits**
2. Choose credit pack (Starter, Professional, Enterprise, Unlimited)
3. Complete payment via Stripe
4. Credits added instantly to your account

**Additional credit packs:**
- **Starter Pack:** 100 credits for $9.99
- **Professional Pack:** 500 credits for $39.99
- **Enterprise Pack:** 2000 credits for $129.99
- **Unlimited Pack:** 10000 credits for $499.99

### Credit Tracking

#### Edge Functions for Credit Management

```typescript
// Get validation credits
POST /functions/v1/get-validation-credits
Body: { rtoCode: "7148" }
Response: { 
  current: 8, 
  total: 10, 
  subscription: 10 
}

// Get AI credits
POST /functions/v1/get-ai-credits
Body: { rtoCode: "7148" }
Response: { 
  current: 95, 
  total: 100, 
  subscription: 100 
}

// Consume validation credit (auto-called during validation)
POST /functions/v1/consume-validation-credit
Body: { rtoCode: "7148", reason: "Validation started" }
Response: { 
  success: true, 
  remainingCredits: 7 
}

// Consume AI credit (auto-called during AI operations)
POST /functions/v1/consume-ai-credit
Body: { rtoCode: "7148", reason: "Smart question generated" }
Response: { 
  success: true, 
  remainingCredits: 94 
}
```

### Credit Renewal

- **Subscription credits reset monthly** on your billing date
- **Additional purchased credits never expire** and carry over
- **Total credits** = Subscription credits + Additional credits

**Example:**
- Month 1: 50 (subscription) + 25 (purchased) = 75 total
- You use 60 credits
- Month 2: 50 (subscription resets) + 15 (remaining purchased) = 65 total

### Low Credit Notifications

- **80% used:** Yellow warning badge
- **90% used:** Orange warning message
- **100% used:** Red error, validation/AI features blocked

### Credit Transaction History

View all credit transactions in **Settings → Credits → Transaction History**:
- Date and time
- Transaction type (subscription renewal, purchase, consumption)
- Amount (positive for additions, negative for usage)
- Reason (e.g., "Validation credit consumed for Unit BSBWHS332X")
- Balance after transaction

### Technical Implementation

Credits are managed via:
- **Database tables:** `validation_credits`, `ai_credits`
- **Transaction tables:** `credit_transactions`, `ai_credit_transactions`
- **RPC functions:** `add_validation_credits`, `add_ai_credits`
- **Edge functions:** All credit operations use edge functions for security

See [EDGE_FUNCTION_REFACTOR.md](./EDGE_FUNCTION_REFACTOR.md) for technical details.

---

## 🏗️ Backend Architecture: RPC vs Edge Functions

NytroAI uses a hybrid backend architecture combining **PostgreSQL RPC Functions** and **Supabase Edge Functions**:

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
└────────────┬─────────────────────────┬──────────────────────┘
             │                         │
             │                         │
             ▼                         ▼
   ┌─────────────────────┐   ┌──────────────────┐
   │  Edge Functions     │   │  Direct DB       │
   │  (Deno/TypeScript)  │   │  Access          │
   │                     │   │                  │
   │  • Business logic   │   │  • Simple CRUD   │
   │  • External APIs    │   │  • Real-time     │
   │  • File handling    │   │  • RLS enforced  │
   │  • AI integration   │   │                  │
   └──────────┬──────────┘   └────────┬─────────┘
              │                       │
              │ Can call RPC          │
              ▼                       ▼
   ┌──────────────────────────────────────────┐
   │         PostgreSQL Database              │
   │                                          │
   │  ┌────────────────────────────────────┐  │
   │  │  RPC Functions (Stored Procedures)│  │
   │  │  • add_ai_credits                 │  │
   │  │  • add_validation_credits         │  │
   │  │  • Atomic transactions            │  │
   │  └────────────────────────────────────┘  │
   │                                          │
   │  ┌────────────────────────────────────┐  │
   │  │  Tables                            │  │
   │  │  • RTO, ai_credits, documents...  │  │
   │  └────────────────────────────────────┘  │
   └──────────────────────────────────────────┘
```

### When to Use Each

**Edge Functions** (13 deployed)
- ✅ Complex workflows (validation, document processing)
- ✅ External API calls (Gemini AI, Stripe, web scraping)
- ✅ File handling and storage operations
- ✅ Service role access (bypass RLS)
- ✅ Examples: `upload-document`, `validate-assessment`, `get-validation-credits`

**RPC Functions** (2 deployed)
- ✅ Atomic database transactions
- ✅ Credit operations (add/subtract with transaction logging)
- ✅ Fast execution (no network overhead)
- ✅ Examples: `add_ai_credits`, `add_validation_credits`

**Direct Database Access**
- ✅ Simple CRUD operations
- ✅ Real-time subscriptions
- ✅ User-specific queries (RLS enforced)

### Typical Flow: Adding Credits

```
1. Frontend → Edge Function (validate request, check auth)
2. Edge Function → RPC Function (atomic transaction)
3. RPC Function → Database (update credits + log transaction)
4. Response → Frontend (new balance displayed)
```

**Read more:** [RPC vs Edge Functions Guide](./docs/RPC_VS_EDGE_FUNCTIONS.md)

---

## 🎯 What Gets Validated?

NytroAI checks your assessment against:

- ✅ Knowledge Evidence
- ✅ Performance Evidence
- ✅ Foundation Skills
- ✅ Elements & Performance Criteria
- ✅ Assessment Conditions

For each requirement, you get:
- **Status** - Met, Partial, or Not Met
- **Reasoning** - Why the AI made this decision
- **Evidence** - Which questions in your assessment address this
- **Smart Question** - A question you can add to fill gaps

---

## 📚 Documentation

- **[Quick Start Guide](./docs/QUICK_START.md)** - Get up and running in 5 minutes
- **[User Guide](./docs/USER_GUIDE.md)** - How to use NytroAI
- **[FAQ](./docs/FAQ.md)** - Common questions answered
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Fix common issues

**For Developers:**
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Technical documentation
- **[RPC vs Edge Functions](./docs/RPC_VS_EDGE_FUNCTIONS.md)** - Backend architecture guide
- **[AI Credit Consumption](./docs/AI_CREDIT_CONSUMPTION.md)** - AI credit usage policy
- **[Edge Function Refactor](./EDGE_FUNCTION_REFACTOR.md)** - Migration documentation
- **[Contributing](./CONTRIBUTING.md)** - How to contribute
- **[Changelog](./CHANGELOG.md)** - What's new

---

## 🐛 Common Issues

![NytroAI Architecture](docs/architecture.png)

*Complete system architecture showing frontend, backend, AI services, and database relationships.*

### Technology Stack

### "Validation not starting"
**Solution:** Make sure you ran `supabase db push` to setup the database triggers.

### "No API key found"
**Solution:** Check your `.env.local` file has the correct keys.

**Infrastructure:**
- Supabase cloud database
- Supabase Edge Functions (Deno runtime)
- Google Gemini 2.0 API

### Validation Flow

![Validation Flow](docs/validation-flow.png)

*Detailed sequence diagram showing the complete validation process from upload to results.*

For detailed architecture documentation, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | ✅ Yes |
| `SUPABASE_URL` | Supabase project URL | ✅ Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ Yes |

### Supabase Configuration

1. **Database Setup**
   - Run migrations in `supabase/migrations/`
   - Verify tables created correctly
   - Check RLS policies are enabled

2. **Edge Functions**
   - Deploy all functions in `supabase/functions/`
   - Verify function logs for errors
   - Test with sample data

3. **Storage**
   - Configure document storage bucket
   - Set up CORS policies
   - Enable public access if needed

4. **Automatic Validation Trigger** (Built-in)
   - Validation starts automatically after document indexing
   - No manual triggering or polling required
   - Works even if browser is closed
   
   **How It Works:**
   
   ![DB Trigger Mechanism](docs/db-trigger-mechanism.png)
   
   *Database trigger system that automates validation workflow*
   
   ```sql
   -- Trigger automatically fires when indexing completes
   CREATE TRIGGER auto_trigger_validation
     AFTER UPDATE ON gemini_operations
     FOR EACH ROW
     EXECUTE FUNCTION trigger_validation_on_indexing_complete();
   ```
   
   **Benefits:**
   - ⚡ **Instant upload** - Completes in <1 second, no waiting
   - 🚀 **Fire-and-forget** - Processing happens in background
   - 📉 **Zero polling** - No frontend API calls during upload
   - 🔒 **100% reliable** - Database triggers are atomic and guaranteed
   - 🎯 **Zero overhead** - Minimal database impact
   - 🔄 **Automatic retry** - Failed validations can be retried easily
   - 🚪 **Close browser** - Processing continues even if browser closed
   
   **Technical Details:**
   - Trigger monitors `gemini_operations` table
   - When all operations complete for a validation
   - Automatically calls `trigger-validation` edge function
   - Fetches requirements as JSON from database
   - Validates each requirement individually
   - Stores results in `validation_results` table
   
   See [SIMPLIFIED_UPLOAD_FLOW.md](./SIMPLIFIED_UPLOAD_FLOW.md) for complete documentation.

---

## 🐛 Troubleshooting

### Common Issues

#### ⏱️ Request Timeout Errors

**Symptom:** "Request timed out after 30/45 seconds"

**Solution:**
1. Check edge functions are deployed:
   ```bash
   supabase functions list
   ```
2. Deploy missing functions:
   ```bash
   supabase functions deploy [function-name]
   ```
3. Verify in [Supabase Dashboard](https://supabase.com/dashboard)

See [docs/guides/ERROR_HANDLING.md](./docs/guides/ERROR_HANDLING.md) for more details.

#### 🗃️ Database Errors

**Symptom:** "Could not choose the best candidate function"

**Solution:**
1. Apply Phase 3.2 migration:
   ```bash
   supabase db push
   ```
2. Verify migration in SQL Editor
3. Check [Migration Guide](./docs/migration/MIGRATION_GUIDE.md)

#### 📄 Validation Not Triggering

**Symptom:** Status stuck at "DocumentProcessing"

**Solution:**
1. Check database column names (should be snake_case)
2. Verify `doc_extracted` and `extract_status` fields
3. See [Phase 3.3 Fixes](./docs/phases/PHASE3.3_SUMMARY.md)

### Getting Help

- **Documentation:** Check [docs/guides/ERROR_HANDLING.md](./docs/guides/ERROR_HANDLING.md)
- **Issues:** [Create an issue](https://github.com/KevinDyerAU/NytroAI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)

---

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Test Coverage

```bash
npm run test:coverage
```

---

## 📦 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Deploy to Google AI Studio

1. Build the application
2. Upload to AI Studio
3. Configure environment variables
4. Deploy edge functions to Supabase

See [docs/guides/DEPLOYMENT.md](./docs/guides/DEPLOYMENT.md) for detailed instructions.

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Built With

- **Figma** - Design
- **Builder.io** - Development
- **Windsurf** - Development environment
- **Google Gemini 2.0** - AI validation
- **Supabase** - Database and backend
- **React** - Frontend framework

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/KevinDyerAU/NytroAI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)
- **Email:** [Contact Kevin Dyer](https://github.com/KevinDyerAU)

---

<div align="center">

**Made with ❤️ for Australian RTOs**

[⭐ Star us on GitHub](https://github.com/KevinDyerAU/NytroAI) if you find this useful!

</div>
