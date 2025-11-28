# NytroAI Architecture (N8n Integration)

**Version**: 2.0  
**Date**: November 26, 2025  
**Status**: Refactored with n8n workflow integration

---

## Overview

NytroAI is a **validation platform** for Australian VET (Vocational Education and Training) assessment documents. The platform validates assessments against official training package requirements using **AI-powered document analysis** with **grounding citations**.

### Key Features

- ✅ **Instant Upload**: Documents uploaded in <1 second
- ✅ **Background Processing**: Fire-and-forget indexing and validation
- ✅ **RAG-based Validation**: Retrieval-Augmented Generation with Gemini File Search
- ✅ **Citation Extraction**: Every validation includes page numbers and evidence
- ✅ **Quality Metrics**: Automatic quality assessment with confidence scores
- ✅ **n8n Orchestration**: Complex validation workflow managed externally
- ✅ **Simplified Backend**: 8 fewer edge functions (33% reduction)

---

## Architecture Diagram

![Architecture Diagram](./docs/architecture-n8n.png)

---

## Technology Stack

### Frontend
- **React** 18.x with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **Supabase Client** for auth and data

### Backend
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- **n8n** (Workflow automation - hosted externally)
- **Google Gemini API** (AI and File Search)
- **pg_net** (HTTP requests from database triggers)

### External Services
- **n8n Workflow**: `https://n8n-gtoa.onrender.com/webhook/validate-document`
- **Gemini File Search**: Document indexing and RAG queries
- **training.gov.au**: Source of truth for VET requirements

---

## Data Flow

### 1. Document Upload Flow

```
User uploads document
  ↓
Frontend: create-document-fast edge function
  ↓
Database: Insert into documents table
  ↓
Storage: Save file to Supabase Storage
  ↓
Database: Insert into validation_detail table
  ↓
Response: Returns immediately (<1 second)
```

**Key Point**: Upload completes instantly. Indexing happens in background.

---

### 2. Indexing Flow (Background)

```
Database Trigger: auto_trigger_validation_n8n
  ↓
Edge Function: trigger-validation-n8n
  ↓
N8n Webhook: POST /webhook/validate-document
  ↓
N8n Workflow:
  1. Fetch validation context from DB
  2. Get file from Supabase Storage
  3. Upload to Gemini File Search (with metadata)
  4. Poll for indexing completion (max 60 seconds)
  5. Update DB: indexing complete
```

**Key Point**: Indexing runs asynchronously. User doesn't wait.

---

### 3. Validation Flow (Background)

```
N8n Workflow (continued):
  6. Fetch requirements from DB (by unitLink)
  7. Build validation prompt
  8. Call Gemini API with File Search
  9. Extract citations from grounding chunks
  10. Validate citation quality
  11. Store results in validation_results table
  12. Update validation_detail status to 'validated'
  ↓
Frontend: Polls get-validation-status
  ↓
Dashboard: Shows validation results with citations
```

**Key Point**: Entire validation happens in n8n. No edge function orchestration.

---

## Database Schema

### Core Tables

#### `documents`
Stores uploaded assessment documents.

```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_search_store TEXT,  -- Gemini File Search store ID
  embedding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `validation_detail`
Tracks individual validation sessions.

```sql
CREATE TABLE validation_detail (
  id BIGSERIAL PRIMARY KEY,
  summary_id BIGINT REFERENCES validation_summary(id),
  namespace_code TEXT NOT NULL,  -- Unique per validation session
  validation_type_id INT REFERENCES validation_type(id),
  status TEXT DEFAULT 'pending',  -- pending, indexing, validating, validated, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `validation_summary`
Groups validations by RTO and unit.

```sql
CREATE TABLE validation_summary (
  id BIGSERIAL PRIMARY KEY,
  rtoCode TEXT NOT NULL,
  unitCode TEXT NOT NULL,
  unitLink TEXT,  -- URL to training.gov.au unit page
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `validation_results`
Stores validation outcomes with citations.

```sql
CREATE TABLE validation_results (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES documents(id),
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  unit_code TEXT NOT NULL,
  unit_link TEXT,  -- NEW: Full URL for traceability
  validation_type TEXT NOT NULL,
  validation_data JSONB NOT NULL,  -- {validations: [...], overallStatus, summary}
  grounding_metadata JSONB,  -- {allCitations: [...], groundingSupports: [...]}
  citation_count INT DEFAULT 0,
  average_confidence NUMERIC(3,2),
  citation_coverage NUMERIC(5,2),
  quality_flags JSONB,  -- {noCitations, lowCoverage, lowConfidence, goodQuality}
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `UnitOfCompetency`
Training package units of competency.

```sql
CREATE TABLE "UnitOfCompetency" (
  id BIGSERIAL PRIMARY KEY,
  unitCode TEXT UNIQUE NOT NULL,
  Title TEXT NOT NULL,
  Link TEXT UNIQUE NOT NULL,  -- URL to training.gov.au
  ac TEXT,  -- Assessment Conditions
  epc TEXT,  -- Elements & Performance Criteria
  ke TEXT,  -- Knowledge Evidence
  pe TEXT,  -- Performance Evidence
  fs TEXT,  -- Foundation Skills
  UOCpage JSONB,  -- Full unit data from training.gov.au
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Requirements Tables

Requirements are stored in separate tables by type:

- `knowledge_evidence_requirements`
- `performance_evidence_requirements`
- `foundation_skills_requirements`
- `elements_performance_criteria_requirements`

**Schema** (example for `knowledge_evidence_requirements`):

```sql
CREATE TABLE knowledge_evidence_requirements (
  id SERIAL PRIMARY KEY,
  unit_code TEXT,  -- Fallback identifier
  unit_url TEXT,  -- Primary identifier (matches UnitOfCompetency.Link)
  knowledge_point TEXT,
  requirement_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ke_requirements_unit_url ON knowledge_evidence_requirements(unit_url);
CREATE INDEX idx_ke_requirements_unit_code ON knowledge_evidence_requirements(unit_code);
```

**Key Point**: Requirements are fetched by `unit_url` (preferred) or `unit_code` (fallback).

---

## Edge Functions (Simplified)

### Removed Functions (8 total)

These functions were **deleted** as their logic moved to n8n:

1. ✂️ `validate-assessment` - Core validation logic
2. ✂️ `upload-document` - File upload to Gemini (if validation-only)
3. ✂️ `check-operation-status` - Polling for indexing
4. ✂️ `process-pending-indexing` - Indexing orchestration
5. ✂️ `reindex-document` - Reindexing logic
6. ✂️ `reindex-validation` - Revalidation logic
7. ✂️ `retrigger-validation` - Validation retry logic

### Simplified Functions (1 total)

1. 🔧 `trigger-validation-n8n` - Now just calls n8n webhook (was `trigger-validation`)

### Kept Functions (15 total)

**Data Management**:
- ✅ `create-document-fast` - Fast document creation
- ✅ `create-validation-record` - Validation record creation
- ✅ `fetch-units-of-competency` - Get units for UI
- ✅ `scrape-training-gov-au` - Scrape training.gov.au

**Status & Retrieval**:
- ✅ `get-validation-status` - Check validation progress
- ✅ `get-validation-detail-status` - Detailed status
- ✅ `get-validation-details` - Get validation details
- ✅ `get-dashboard-metrics` - Dashboard analytics

**Reports & Features**:
- ✅ `generate-validation-report` - PDF/Word reports
- ✅ `generate-smart-questions-v2` - Smart question generation
- ✅ `query-document` - Document querying

**Credits**:
- ✅ `consume-ai-credit` - Deduct AI credits
- ✅ `consume-validation-credit` - Deduct validation credits
- ✅ `get-ai-credits` - Get remaining AI credits
- ✅ `get-validation-credits` - Get remaining validation credits

---

## N8n Workflow

### Webhook URL

```
https://n8n-gtoa.onrender.com/webhook/validate-document
```

### Input Payload

```json
{
  "validationDetailId": 123,
  "documentId": 456,
  "fileName": "assessment.pdf",
  "storagePath": "rto-12345/assessment.pdf",
  "validationType": "knowledge_evidence",
  "fileSearchStore": "fileSearchStores/abc123"
}
```

### Workflow Nodes (18 total)

1. **Webhook Trigger** - Receives validation request
2. **Fetch Validation Context** - Gets unitLink, unitCode, namespace from DB
3. **Get File from Storage** - Downloads file from Supabase Storage
4. **Upload to Gemini** - Uploads to Gemini File Search with metadata
5. **Check Max Attempts** - Limits polling to 12 attempts (60 seconds)
6. **Check Operation Status** - Polls Gemini for indexing completion
7. **Check if Done** - Evaluates if indexing complete
8. **Wait 5 Seconds** - Delay between polling attempts
9. **Update Indexing Complete** - Marks document as indexed
10. **Fetch Requirements** - Gets requirements from DB by unitLink
11. **Build Validation Prompt** - Constructs Gemini prompt with requirements
12. **Call Gemini Validation** - Sends RAG query with File Search
13. **Extract Citations** - Parses grounding chunks and citations
14. **Validate Citation Quality** - Calculates quality metrics
15. **Store Validation Results** - Saves to validation_results table
16. **Update Validation Complete** - Marks validation as done
17. **Respond Success** - Returns success response
18. **Respond Indexing Failed** - Returns error if indexing times out

### Metadata Structure

Files uploaded to Gemini File Search include metadata:

```json
[
  {"key": "rto-code", "stringValue": "12345"},
  {"key": "unit-code", "stringValue": "BSBWHS332X"},
  {"key": "unit-link", "stringValue": "https://training.gov.au/Training/Details/BSBWHS332X"},
  {"key": "document-type", "stringValue": "assessment"},
  {"key": "namespace", "stringValue": "ns-1732435200-abc"}
]
```

**Metadata Filter** (used in Gemini query):

```
namespace="ns-1732435200-abc" AND unit-link="https://training.gov.au/Training/Details/BSBWHS332X"
```

**Key Point**: Metadata ensures Gemini only searches relevant documents for this specific unit and validation session.

---

## Requirements Fetching Logic

### Data Flow

```
validationDetailId (webhook input)
  ↓
validation_detail.summary_id
  ↓
validation_summary.unitLink
  ↓
UnitOfCompetency.Link
  ↓
requirements tables (unit_url column)
```

### SQL Query (in n8n)

```sql
WITH validation_context AS (
  SELECT 
    vd.id as validation_detail_id,
    vs.unitLink,
    vs.unitCode,
    uoc.Link as unit_link
  FROM validation_detail vd
  INNER JOIN validation_summary vs ON vd.summary_id = vs.id
  LEFT JOIN "UnitOfCompetency" uoc ON vs.unitLink = uoc.Link
  WHERE vd.id = {{ validationDetailId }}
)
SELECT * FROM knowledge_evidence_requirements
WHERE unit_url = (SELECT unit_link FROM validation_context)
   OR unit_code = (SELECT unitCode FROM validation_context)
```

**Logic**:
1. Try `unit_url` first (matches `UnitOfCompetency.Link`)
2. Fallback to `unit_code` if no match
3. Union all requirement types

**Special Cases**:
- **Assessment Conditions**: Fetched from `UnitOfCompetency.ac`
- **Assessment Instructions**: Fetched from `UnitOfCompetency.ac + epc`

---

## Citation Extraction

### Gemini Response Structure

```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "{\"validations\": [...], \"overallStatus\": \"compliant\"}"
      }]
    },
    "groundingMetadata": {
      "groundingChunks": [
        {
          "fileSearchChunk": {
            "documentName": "files/abc123",
            "displayName": "assessment.pdf",
            "pageNumbers": [3, 4],
            "chunkText": "The learner must demonstrate...",
            "customMetadata": [
              {"key": "unit-link", "stringValue": "https://..."}
            ]
          }
        }
      ],
      "groundingSupports": [
        {
          "segment": {"text": "Evidence found on page 3", "startIndex": 0, "endIndex": 25},
          "groundingChunkIndices": [0],
          "confidenceScores": [0.87]
        }
      ]
    }
  }]
}
```

### Extracted Citation

```json
{
  "citationId": 1,
  "documentName": "assessment.pdf",
  "pageNumbers": [3, 4],
  "excerpt": "The learner must demonstrate...",
  "unitLink": "https://training.gov.au/Training/Details/BSBWHS332X",
  "confidence": 0.87
}
```

### Quality Metrics

```json
{
  "citationCount": 18,
  "citationCoverage": 86.7,  // % of validations with citations
  "averageConfidence": 0.87,
  "flags": {
    "noCitations": false,
    "lowCoverage": false,  // < 50%
    "lowConfidence": false,  // < 0.6
    "goodQuality": true  // count > 0 && coverage >= 80 && confidence >= 0.8
  }
}
```

---

## Database Triggers

### Auto-Trigger Validation (n8n)

**Trigger**: `auto_trigger_validation_n8n`  
**Table**: `gemini_operations`  
**Event**: `AFTER UPDATE`  
**Function**: `trigger_validation_on_indexing_complete_n8n()`

**Logic**:

```sql
-- When gemini_operations.status changes to 'completed'
-- Check if ALL operations for this validation_detail are complete
-- If yes, call n8n webhook via pg_net.http_post()
```

**HTTP Request**:

```sql
SELECT net.http_post(
  url := 'https://n8n-gtoa.onrender.com/webhook/validate-document',
  headers := jsonb_build_object('Content-Type', 'application/json'),
  body := jsonb_build_object('validationDetailId', v_validation_detail_id)
);
```

**Key Point**: Validation triggers automatically when indexing completes. No client-side polling needed.

---

## Frontend Integration

### New Service: `N8nValidationService.ts`

```typescript
export async function triggerN8nValidation(
  request: N8nValidationRequest
): Promise<N8nValidationResponse> {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return await response.json();
}
```

### Usage in Components

```typescript
import { triggerValidationByDetailId } from '@/services/N8nValidationService';

// Trigger validation
const result = await triggerValidationByDetailId(validationDetailId, supabase);

console.log('Validation result:', {
  status: result.status,
  validationsCount: result.validationsCount,
  citationCount: result.citations.count,
  citationQuality: result.citations.quality
});
```

---

## Deployment

### Prerequisites

1. **Supabase Project** with:
   - PostgreSQL database
   - Storage bucket: `documents`
   - `pg_net` extension enabled
   - Edge functions deployed

2. **n8n Instance** with:
   - Workflow imported from `n8n-workflow-with-unitLink.json`
   - Credentials configured (Supabase + Google AI)
   - Webhook URL: `https://n8n-gtoa.onrender.com/webhook/validate-document`

3. **Google AI API Key** for Gemini File Search

### Deployment Steps

#### 1. Database Migration

```bash
# Run migration to add n8n integration
psql -h db.xxx.supabase.co -U postgres -d postgres -f supabase/migrations/20251126_n8n_integration.sql
```

#### 2. Deploy Edge Functions

```bash
cd /path/to/NytroAI
supabase login
supabase functions deploy
```

#### 3. Configure n8n Webhook URL

```sql
INSERT INTO app_config (key, value, description)
VALUES (
  'n8n_webhook_url',
  'https://n8n-gtoa.onrender.com/webhook/validate-document',
  'N8n workflow webhook URL for validation'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

#### 4. Deploy Frontend

```bash
npm run build
# Deploy dist/ to your hosting (Netlify, Vercel, etc.)
```

#### 5. Test

```bash
# Upload a test document
curl -X POST https://your-app.com/api/upload \
  -F "file=@test-assessment.pdf" \
  -F "rtoCode=12345" \
  -F "unitCode=BSBWHS332X"

# Check validation status
curl https://your-app.com/api/validation-status?validationDetailId=123
```

---

## Monitoring

### Database Queries

**Check validation status**:
```sql
SELECT 
  vd.id,
  vd.status,
  vd.namespace_code,
  vs.unitCode,
  vs.unitLink,
  COUNT(d.id) as document_count,
  COUNT(vr.id) as result_count
FROM validation_detail vd
LEFT JOIN validation_summary vs ON vd.summary_id = vs.id
LEFT JOIN documents d ON d.validation_detail_id = vd.id
LEFT JOIN validation_results vr ON vr.validation_detail_id = vd.id
WHERE vd.created_at > NOW() - INTERVAL '1 day'
GROUP BY vd.id, vs.unitCode, vs.unitLink;
```

**Check citation quality**:
```sql
SELECT 
  unit_code,
  AVG(citation_count) as avg_citations,
  AVG(citation_coverage) as avg_coverage,
  AVG(average_confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE (quality_flags->>'goodQuality')::boolean) as good_quality_count,
  COUNT(*) as total_count
FROM validation_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY unit_code
ORDER BY avg_coverage DESC;
```

### n8n Monitoring

- **Workflow Executions**: Check n8n dashboard for execution history
- **Error Rate**: Monitor failed executions
- **Execution Time**: Average time per validation (should be 60-90 seconds)

### Logs

**Edge Function Logs**:
```bash
supabase functions logs trigger-validation-n8n --tail
```

**Database Logs** (trigger execution):
```sql
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%trigger_validation_on_indexing_complete_n8n%'
ORDER BY calls DESC;
```

---

## Troubleshooting

### Issue: Validation not triggering

**Check**:
1. Is `gemini_operations.status` set to 'completed'?
2. Are ALL operations for this `validation_detail_id` complete?
3. Is `pg_net` extension enabled?
4. Is n8n webhook URL correct in `app_config`?

**Debug**:
```sql
-- Check gemini_operations status
SELECT validation_detail_id, status, COUNT(*)
FROM gemini_operations
WHERE validation_detail_id = 123
GROUP BY validation_detail_id, status;

-- Check trigger function
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'trigger_validation_on_indexing_complete_n8n';
```

### Issue: No grounding chunks found

**Check**:
1. Is metadata set correctly during upload?
2. Does metadata filter match uploaded metadata?
3. Is namespace unique per validation session?
4. Does `unit-link` match `UnitOfCompetency.Link`?

**Debug** (in n8n):
```javascript
console.log('Metadata filter:', 
  'namespace="' + namespace + '" AND unit-link="' + unitLink + '"'
);
```

### Issue: Requirements not found

**Check**:
1. Does `validation_summary.unitLink` exist?
2. Does `UnitOfCompetency.Link` match `unitLink`?
3. Do requirements tables have `unit_url` column?
4. Does `unit_url` match `UnitOfCompetency.Link`?

**Debug**:
```sql
SELECT 
  vs.unitLink,
  uoc.Link,
  (SELECT COUNT(*) FROM knowledge_evidence_requirements WHERE unit_url = uoc.Link) as ke_count
FROM validation_summary vs
LEFT JOIN "UnitOfCompetency" uoc ON vs.unitLink = uoc.Link
WHERE vs.id = 45;
```

---

## Performance

### Benchmarks

**Upload**:
- Time: <1 second
- Includes: Document creation + storage + DB insert

**Indexing**:
- Time: 10-30 seconds (depends on file size)
- Includes: Upload to Gemini + indexing + metadata

**Validation**:
- Time: 30-60 seconds (depends on requirements count)
- Includes: Requirements fetch + Gemini query + citation extraction + storage

**Total** (upload to validated):
- Time: 40-90 seconds
- All background, user doesn't wait

### Optimization Tips

1. **Reduce polling interval**: Change n8n wait time from 5s to 3s
2. **Batch requirements**: Fetch all requirement types in one query
3. **Cache unit data**: Store `UnitOfCompetency` data in frontend
4. **Parallel uploads**: Upload multiple documents simultaneously
5. **CDN for reports**: Cache generated PDF reports

---

## Security

### Authentication

- **Supabase Auth**: Row-level security (RLS) on all tables
- **API Keys**: Stored in environment variables (never in code)
- **n8n Webhook**: No authentication (webhook URL is secret)

### Data Privacy

- **Documents**: Stored in Supabase Storage (private bucket)
- **Gemini File Search**: Files deleted after validation (optional)
- **Database**: Encrypted at rest (Supabase default)

### Best Practices

1. **Never log API keys** in edge functions or n8n
2. **Use RLS policies** for all user-facing tables
3. **Validate input** in edge functions and n8n nodes
4. **Rate limit** n8n webhook (prevent abuse)
5. **Monitor costs** (Gemini API usage)

---

## Future Enhancements

### Planned Features

1. **Multi-document validation**: Validate multiple documents in one session
2. **Custom prompts**: Allow RTOs to customize validation prompts
3. **Batch processing**: Validate entire qualifications at once
4. **Report templates**: Customizable PDF/Word report templates
5. **API access**: REST API for third-party integrations

### n8n Workflow Improvements

1. **Retry logic**: Automatic retry on Gemini API failures
2. **Parallel processing**: Validate multiple requirement types simultaneously
3. **Smart caching**: Cache Gemini responses for identical queries
4. **Cost tracking**: Log Gemini API token usage per validation
5. **Quality alerts**: Notify when citation quality is low

---

## Contributing

### Code Structure

```
NytroAI/
├── src/
│   ├── services/
│   │   └── N8nValidationService.ts  # n8n integration
│   ├── components/
│   │   └── maintenance/
│   │       └── TriggerValidation.tsx  # Manual trigger UI
│   └── hooks/
│       └── useValidationReport.ts  # Validation data fetching
├── supabase/
│   ├── functions/
│   │   ├── trigger-validation-n8n/  # Simplified trigger function
│   │   ├── create-document-fast/  # Document creation
│   │   └── get-validation-status/  # Status checking
│   └── migrations/
│       └── 20251126_n8n_integration.sql  # n8n migration
├── docs/
│   ├── architecture-n8n.mmd  # Architecture diagram
│   ├── architecture-n8n.png  # Rendered diagram
│   └── N8N_INTEGRATION.md  # n8n setup guide
└── ARCHITECTURE_N8N.md  # This file
```

### Development Workflow

1. **Create feature branch**: `git checkout -b feature/my-feature`
2. **Make changes**: Update code, tests, docs
3. **Test locally**: `npm run dev` + `supabase start`
4. **Test n8n**: Import workflow to test instance
5. **Create PR**: Include tests and documentation
6. **Review**: Wait for code review
7. **Deploy**: Merge to main, deploy to production

---

## License

MIT License - See LICENSE file for details

---

## Support

- **Documentation**: See `docs/` folder
- **Issues**: GitHub Issues
- **Email**: support@nytroai.com

---

**End of Architecture Documentation**
