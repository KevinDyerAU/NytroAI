# Migration Guide: Legacy to Individual Validation

## Overview

This guide helps you migrate from the legacy Pinecone-based batch validation system to the new individual validation system with Gemini File API.

**Migration Benefits**:
- ✅ 83% cost reduction ($150-210 → $35-50/month)
- ✅ 60% faster processing (5-10 min → 2-3 min)
- ✅ 75% more reliable (2 vs 8 failure points)
- ✅ Better accuracy (individual vs batch validation)
- ✅ No data sovereignty issues (no Pinecone)
- ✅ Simpler architecture (3 vs 5 platforms)

---

## Migration Strategy

### Phase 1: Parallel Running (Recommended)

Run both systems in parallel to verify accuracy:

1. **Week 1-2**: Deploy new system alongside legacy
2. **Week 3-4**: Run validations through both systems
3. **Week 5-6**: Compare results, tune prompts
4. **Week 7**: Switch to new system as primary
5. **Week 8**: Deprecate legacy system

### Phase 2: Direct Migration (Faster)

Replace legacy system immediately:

1. **Day 1**: Deploy new system
2. **Day 2-3**: Test with sample validations
3. **Day 4-5**: Migrate all active validations
4. **Day 6-7**: Monitor and fix issues
5. **Day 8+**: Deprecate legacy system

---

## Pre-Migration Checklist

### Infrastructure

- [ ] Supabase Pro account (or higher)
- [ ] Gemini API key (Google AI Studio)
- [ ] n8n instance (self-hosted or cloud)
- [ ] Netlify account for frontend hosting

### Database

- [ ] Backup current database
- [ ] Verify `validation_results` table exists
- [ ] Check `validation_detail` table structure
- [ ] Confirm `documents` table has required columns

### Requirements Data

- [ ] Requirements exist in database tables:
  - `knowledge_evidence`
  - `performance_evidence`
  - `foundation_skills`
  - `elements_performance_criteria`
  - `assessment_conditions`
- [ ] Sample unit data available (e.g., TLIF0006)
- [ ] `get-requirements` edge function deployed

### n8n

- [ ] n8n installed and accessible
- [ ] Supabase credentials configured
- [ ] Gemini API key set in environment

---

## Step-by-Step Migration

### Step 1: Database Migration

**Run Migrations**:

```bash
# Connect to Supabase
cd /path/to/NytroAI

# Run prompts table migration
supabase db push supabase/migrations/20250129_prompts_table.sql

# Seed prompts
supabase db push supabase/migrations/20250129_seed_prompts.sql

# Verify
supabase db query "SELECT COUNT(*) FROM prompts WHERE is_active = true;"
```

**Expected Output**:
```
Total active prompts: 11
- knowledge_evidence (unit): 1
- knowledge_evidence (learner_guide): 1
- performance_evidence (unit): 1
- performance_evidence (learner_guide): 1
- foundation_skills (unit): 1
- foundation_skills (learner_guide): 1
- elements_performance_criteria (unit): 1
- elements_performance_criteria (learner_guide): 1
- assessment_conditions (unit): 1
```

**Add Gemini File Columns** (if not exists):

```sql
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS gemini_file_uri TEXT,
ADD COLUMN IF NOT EXISTS gemini_file_name TEXT,
ADD COLUMN IF NOT EXISTS gemini_upload_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gemini_expiry_timestamp TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_documents_gemini_uri 
  ON documents(gemini_file_uri) 
  WHERE gemini_file_uri IS NOT NULL;
```

---

### Step 2: Deploy Edge Functions

**upload-to-gemini**:

```bash
cd /path/to/NytroAI

# Deploy edge function
supabase functions deploy upload-to-gemini

# Set Gemini API key secret
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# Test
curl -X POST https://your-project.supabase.co/functions/v1/upload-to-gemini \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "storage_path": "test/sample.pdf",
    "validation_detail_id": 123
  }'
```

**get-requirements** (already exists):

```bash
# Verify it's deployed
supabase functions list | grep get-requirements

# Test
curl -X POST https://your-project.supabase.co/functions/v1/get-requirements \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "unit_code": "TLIF0006"
  }'
```

---

### Step 3: Configure n8n

**Set Environment Variables**:

```bash
# In n8n settings or .env file
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TIER=free  # or 'paid'
```

**Configure Credentials**:

1. **Supabase API**:
   - Name: "Supabase - NytroAI"
   - URL: `https://your-project.supabase.co`
   - Service Role Key: `your_service_role_key`

2. **HTTP Header Auth** (for Gemini):
   - Name: "Gemini API Key"
   - Header Name: `x-goog-api-key`
   - Value: `your_gemini_api_key`

---

### Step 4: Import n8n Workflows

**Document Processing Flow**:

```bash
# In n8n UI:
1. Go to Workflows
2. Click "Import from File"
3. Select: n8n-flows/DocumentProcessingFlow_Gemini.json
4. Update webhook URL if needed
5. Activate workflow
```

**AI Validation Flow** (Individual):

```bash
# In n8n UI:
1. Import: n8n-flows/AIValidationFlow_Individual.json
2. Configure credentials
3. Update Supabase connection details
4. Test with sample validation_detail_id
5. Activate workflow
```

**Get Webhook URLs**:

```bash
# Document Processing
https://your-n8n.com/webhook/document-processing

# AI Validation
https://your-n8n.com/webhook/ai-validation
```

---

### Step 5: Update Frontend

**Environment Variables** (`.env.local`):

```bash
# Remove old variables
# VITE_AWS_S3_BUCKET=...
# VITE_PINECONE_API_KEY=...
# VITE_UNSTRUCTURED_API_KEY=...

# Add new variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# n8n webhook URLs
VITE_N8N_DOCUMENT_PROCESSING_URL=https://your-n8n.com/webhook/document-processing
VITE_N8N_VALIDATION_URL=https://your-n8n.com/webhook/ai-validation
VITE_N8N_REPORT_URL=https://your-n8n.com/webhook/generate-report
```

**Update Upload Service**:

```typescript
// src/services/DocumentUploadService.ts
import { DocumentUploadService_n8n } from './DocumentUploadService_n8n';

// Replace old service with new
export const documentUploadService = new DocumentUploadService_n8n();
```

**Deploy Frontend**:

```bash
# Build
npm run build

# Deploy to Netlify
netlify deploy --prod

# Or use Netlify CLI
netlify env:set VITE_N8N_DOCUMENT_PROCESSING_URL https://your-n8n.com/webhook/document-processing
netlify env:set VITE_N8N_VALIDATION_URL https://your-n8n.com/webhook/ai-validation
```

---

### Step 6: Test End-to-End

**Test Document Upload**:

1. Go to UI → Upload Documents
2. Select unit code (e.g., TLIF0006)
3. Upload sample PDF
4. Verify:
   - File uploaded to Supabase Storage
   - Document record created
   - n8n webhook triggered
   - Gemini file uploaded
   - `gemini_file_uri` saved to database

**Test Validation**:

1. Trigger validation from UI
2. Monitor n8n workflow execution
3. Verify:
   - Requirements fetched (50 total)
   - Each requirement validated individually
   - Progress updates in real-time
   - Results saved to `validation_results`
   - Status updated to "completed"

**Check Results**:

```sql
-- View validation results
SELECT 
  requirement_type,
  requirement_number,
  status,
  LEFT(reasoning, 100) as reasoning_preview
FROM validation_results
WHERE validation_detail_id = 123
ORDER BY requirement_type, requirement_number;

-- Check counts
SELECT 
  requirement_type,
  status,
  COUNT(*) as count
FROM validation_results
WHERE validation_detail_id = 123
GROUP BY requirement_type, status
ORDER BY requirement_type, status;
```

---

### Step 7: Compare with Legacy

**Run Parallel Validation**:

1. Run same validation through legacy system
2. Run through new system
3. Export both results
4. Compare:
   - Status matches (Met/Partially Met/Not Met)
   - Reasoning quality
   - Citation accuracy
   - Smart questions relevance

**Comparison Query**:

```sql
-- Legacy results (from old table)
SELECT * FROM legacy_validation_results WHERE validation_id = 'old_123';

-- New results
SELECT * FROM validation_results WHERE validation_detail_id = 123;

-- Side-by-side comparison
SELECT 
  l.requirement_number,
  l.status as legacy_status,
  n.status as new_status,
  CASE 
    WHEN l.status = n.status THEN 'MATCH'
    ELSE 'DIFF'
  END as comparison
FROM legacy_validation_results l
FULL OUTER JOIN validation_results n 
  ON l.requirement_number = n.requirement_number
WHERE l.validation_id = 'old_123'
  AND n.validation_detail_id = 123;
```

**Accuracy Metrics**:

```sql
-- Calculate agreement rate
SELECT 
  COUNT(CASE WHEN legacy_status = new_status THEN 1 END)::FLOAT / COUNT(*) * 100 as agreement_percentage
FROM (
  SELECT l.status as legacy_status, n.status as new_status
  FROM legacy_validation_results l
  JOIN validation_results n ON l.requirement_number = n.requirement_number
  WHERE l.validation_id = 'old_123' AND n.validation_detail_id = 123
) comparison;
```

**Target**: >90% agreement on status

---

### Step 8: Tune Prompts (if needed)

If accuracy is lower than expected:

**Analyze Discrepancies**:

```sql
-- Find disagreements
SELECT 
  n.requirement_number,
  n.requirement_text,
  l.status as legacy_status,
  n.status as new_status,
  n.reasoning
FROM legacy_validation_results l
JOIN validation_results n ON l.requirement_number = n.requirement_number
WHERE l.validation_id = 'old_123'
  AND n.validation_detail_id = 123
  AND l.status != n.status;
```

**Update Prompts**:

```sql
-- Create improved prompt version
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  prompt_text,
  system_instruction,
  version,
  is_active,
  is_default
) VALUES (
  'validation',
  'knowledge_evidence',
  'unit',
  'KE Unit Validation v1.1',
  '... improved prompt with more specific criteria ...',
  '... updated system instruction ...',
  'v1.1',
  true,
  true
);

-- Deactivate old version
UPDATE prompts
SET is_active = false, is_default = false
WHERE prompt_type = 'validation'
  AND requirement_type = 'knowledge_evidence'
  AND document_type = 'unit'
  AND version = 'v1.0';
```

**Re-test**:

1. Trigger new validation with updated prompts
2. Compare results again
3. Iterate until accuracy is acceptable

---

### Step 9: Deprecate Legacy System

**Once confident in new system**:

1. **Stop new validations** in legacy system
2. **Archive legacy data**:

```sql
-- Create archive table
CREATE TABLE legacy_validation_results_archive AS
SELECT * FROM legacy_validation_results;

-- Verify
SELECT COUNT(*) FROM legacy_validation_results_archive;
```

3. **Remove legacy infrastructure**:
   - Cancel Pinecone subscription
   - Remove Unstructured.io API key
   - Delete AWS S3 bucket (after backup)
   - Remove legacy n8n workflows
   - Remove legacy edge functions

4. **Update documentation**:
   - Mark legacy docs as archived
   - Update README with new system only
   - Remove legacy references from code

---

## Data Migration

### Migrate Existing Validations

**Option 1: Re-run Validations**

Recommended for best accuracy:

```sql
-- Get all validation_detail records that need re-validation
SELECT id, unit_code, rto_code
FROM validation_detail
WHERE validation_status = 'completed'
  AND created_at < '2025-01-29'  -- Before new system deployed
ORDER BY created_at DESC;

-- For each, trigger new validation via n8n webhook
```

**Option 2: Migrate Results**

If re-running is not feasible:

```sql
-- Map legacy results to new schema
INSERT INTO validation_results (
  validation_detail_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  citations,
  smart_questions,
  metadata,
  created_at
)
SELECT 
  vd.id as validation_detail_id,
  lr.requirement_type,
  lr.requirement_number,
  lr.requirement_text,
  lr.status,
  lr.reasoning,
  lr.citations::jsonb,
  CASE 
    WHEN lr.smart_question IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'question_text', lr.smart_question,
          'benchmark_answer', lr.benchmark_answer
        )
      )
    ELSE '[]'::jsonb
  END as smart_questions,
  jsonb_build_object(
    'migrated_from_legacy', true,
    'legacy_id', lr.id,
    'migration_date', NOW()
  ) as metadata,
  lr.created_at
FROM legacy_validation_results lr
JOIN validation_detail vd ON lr.validation_id = vd.legacy_validation_id
WHERE NOT EXISTS (
  SELECT 1 FROM validation_results vr
  WHERE vr.validation_detail_id = vd.id
);
```

---

## Rollback Plan

### If Issues Arise

**Immediate Rollback** (< 1 hour):

1. **Reactivate legacy n8n workflows**
2. **Update frontend** to use legacy service
3. **Notify users** of temporary reversion
4. **Investigate issues**
5. **Fix and re-deploy**

**Rollback Steps**:

```bash
# 1. Reactivate legacy workflows in n8n
# (Manual in n8n UI)

# 2. Update frontend environment
netlify env:set VITE_USE_LEGACY_VALIDATION true

# 3. Redeploy frontend
netlify deploy --prod

# 4. Verify legacy system working
curl -X POST https://your-n8n.com/webhook/legacy-validation \
  -H "Content-Type: application/json" \
  -d '{"validation_detail_id": 123}'
```

**Partial Rollback**:

Keep new document processing, rollback only validation:

```typescript
// src/services/ValidationService.ts
const USE_LEGACY_VALIDATION = import.meta.env.VITE_USE_LEGACY_VALIDATION === 'true';

if (USE_LEGACY_VALIDATION) {
  // Use legacy validation
  await triggerLegacyValidation(validationDetailId);
} else {
  // Use new validation
  await triggerNewValidation(validationDetailId);
}
```

---

## Monitoring

### Key Metrics

**Track during migration**:

1. **Success Rate**:
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as total_validations,
     COUNT(CASE WHEN validation_status = 'completed' THEN 1 END) as successful,
     COUNT(CASE WHEN validation_status = 'failed' THEN 1 END) as failed,
     ROUND(COUNT(CASE WHEN validation_status = 'completed' THEN 1 END)::NUMERIC / COUNT(*) * 100, 2) as success_rate
   FROM validation_detail
   WHERE created_at >= '2025-01-29'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

2. **Processing Time**:
   ```sql
   SELECT 
     AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds,
     MIN(EXTRACT(EPOCH FROM (updated_at - created_at))) as min_seconds,
     MAX(EXTRACT(EPOCH FROM (updated_at - created_at))) as max_seconds
   FROM validation_detail
   WHERE validation_status = 'completed'
     AND created_at >= '2025-01-29';
   ```

3. **Cost per Validation**:
   ```sql
   SELECT 
     COUNT(DISTINCT validation_detail_id) as total_validations,
     COUNT(*) as total_requirements,
     COUNT(*) * 0.01 as estimated_cost_usd
   FROM validation_results
   WHERE created_at >= '2025-01-29';
   ```

4. **Error Rate**:
   ```sql
   SELECT 
     COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
     COUNT(*) as total,
     ROUND(COUNT(CASE WHEN status = 'error' THEN 1 END)::NUMERIC / COUNT(*) * 100, 2) as error_rate
   FROM validation_results
   WHERE created_at >= '2025-01-29';
   ```

### Alerts

Set up alerts for:

- Success rate < 95%
- Average processing time > 10 minutes
- Error rate > 5%
- Gemini API errors > 10/hour

---

## Troubleshooting

### Common Migration Issues

**Issue**: Prompts not found

**Solution**:
```sql
-- Verify prompts exist
SELECT * FROM prompts WHERE is_active = true;

-- Re-run seed if needed
\i supabase/migrations/20250129_seed_prompts.sql
```

---

**Issue**: Gemini file upload fails

**Solution**:
```bash
# Check Gemini API key
supabase secrets list | grep GEMINI

# Test upload manually
curl -X POST https://generativelanguage.googleapis.com/upload/v1beta/files \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Api-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file": {"displayName": "test.pdf"}}'
```

---

**Issue**: Requirements not found

**Solution**:
```sql
-- Check requirements exist
SELECT COUNT(*) FROM knowledge_evidence WHERE unit_code = 'TLIF0006';
SELECT COUNT(*) FROM performance_evidence WHERE unit_code = 'TLIF0006';

-- If missing, import requirements data
-- (See IMPLEMENTATION_GUIDE.md for data import)
```

---

**Issue**: Validation stuck in "processing"

**Solution**:
```sql
-- Check validation_detail status
SELECT * FROM validation_detail WHERE id = 123;

-- Check validation_results count
SELECT COUNT(*) FROM validation_results WHERE validation_detail_id = 123;

-- Check n8n workflow execution
-- (Check n8n UI for errors)

-- Reset if needed
UPDATE validation_detail
SET validation_status = 'pending',
    validation_count = 0,
    validation_progress = 0
WHERE id = 123;

-- Delete partial results
DELETE FROM validation_results WHERE validation_detail_id = 123;

-- Re-trigger
```

---

**Issue**: Rate limit errors

**Solution**:
```bash
# Check Gemini tier
echo $GEMINI_TIER

# Increase delay in n8n workflow
# (Edit "Rate Limit Delay" node)

# Or upgrade to paid tier
# (Google AI Studio → Billing)
```

---

## Success Criteria

Migration is successful when:

- ✅ All validations complete successfully (>95% success rate)
- ✅ Processing time is acceptable (<5 min for 50 requirements)
- ✅ Accuracy matches or exceeds legacy (>90% agreement)
- ✅ No critical errors or failures
- ✅ Cost is within budget ($0.50 per validation)
- ✅ Users are satisfied with results
- ✅ Legacy system can be safely deprecated

---

## Post-Migration

### Week 1

- Monitor all validations closely
- Respond quickly to any issues
- Gather user feedback
- Document any problems and solutions

### Week 2-4

- Analyze validation quality
- Tune prompts if needed
- Optimize performance
- Update documentation

### Month 2+

- Deprecate legacy system completely
- Cancel unused subscriptions (Pinecone, etc.)
- Archive legacy code and data
- Celebrate cost savings! 🎉

---

## Support

If you encounter issues during migration:

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
3. Check n8n workflow execution logs
4. Check Supabase logs
5. Submit issue on GitHub

---

## Summary

**Migration Timeline**:
- **Preparation**: 1-2 days
- **Deployment**: 1 day
- **Testing**: 2-3 days
- **Parallel running**: 1-2 weeks (optional)
- **Full migration**: 1-2 weeks total

**Effort Required**:
- Database migrations: 1 hour
- Edge function deployment: 1 hour
- n8n configuration: 2-3 hours
- Frontend updates: 2-3 hours
- Testing: 1-2 days
- Monitoring: Ongoing

**Risk Level**: Low (with parallel running), Medium (direct migration)

**Recommendation**: Use parallel running approach for first migration, direct for subsequent deployments.

Good luck with your migration! 🚀
