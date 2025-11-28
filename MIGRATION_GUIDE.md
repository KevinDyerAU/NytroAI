# Migration Guide: v1.0 → v2.0 (n8n Integration)

**Date**: November 26, 2025  
**Estimated Time**: 1-2 hours  
**Difficulty**: Intermediate

---

## Overview

This guide walks you through migrating from **NytroAI v1.0** (edge function orchestration) to **v2.0** (n8n workflow integration).

### What's Changing

**Before (v1.0)**:
- 24 edge functions
- Complex orchestration logic in edge functions
- Manual polling for indexing status
- No citation extraction
- No quality metrics

**After (v2.0)**:
- 16 edge functions (33% reduction)
- Simple edge functions + n8n workflow
- Automatic validation triggering
- Full citation extraction with page numbers
- Quality metrics and confidence scores

---

## Prerequisites

Before starting, ensure you have:

- [ ] **Supabase project** with admin access
- [ ] **n8n instance** (self-hosted or cloud)
- [ ] **Google AI API key** for Gemini
- [ ] **Database backup** (just in case!)
- [ ] **30 minutes of downtime** (for migration)

---

## Migration Steps

### Step 1: Backup Current System

```bash
# Backup database
supabase db dump -f backup_pre_n8n_$(date +%Y%m%d).sql

# Backup edge functions
mkdir backup_edge_functions
cp -r supabase/functions/* backup_edge_functions/

# Backup frontend
git commit -am "Backup before n8n migration"
git tag v1.0-backup
```

---

### Step 2: Update Repository

```bash
# Pull latest changes
git fetch origin
git checkout refactor/n8n-integration

# Or merge if you're on main
git merge refactor/n8n-integration
```

---

### Step 3: Install Dependencies

```bash
# Frontend dependencies (if any new ones)
npm install

# Supabase CLI (if not already installed)
npm install -g supabase
```

---

### Step 4: Setup n8n Workflow

#### Option A: Use Hosted n8n (Recommended)

The workflow is already hosted at:
```
https://n8n-gtoa.onrender.com/webhook/validate-document
```

**No setup needed!** Skip to Step 5.

#### Option B: Self-Host n8n

1. **Install n8n**:
   ```bash
   npm install -g n8n
   ```

2. **Start n8n**:
   ```bash
   n8n start
   ```

3. **Import workflow**:
   - Open http://localhost:5678
   - Click "Workflows" → "Import from File"
   - Select `n8n-workflow-with-unitLink.json`
   - Click "Import"

4. **Configure credentials**:

   **Supabase PostgreSQL**:
   - Type: PostgreSQL
   - Host: `db.xxx.supabase.co` (from Supabase dashboard)
   - Database: `postgres`
   - User: `postgres`
   - Password: Your database password
   - Port: `5432`
   - SSL: Enabled

   **Google AI API Key**:
   - Type: HTTP Query Auth
   - Name: `key`
   - Value: Your Gemini API key

   **Supabase Storage Auth**:
   - Type: HTTP Header Auth
   - Name: `Authorization`
   - Value: `Bearer YOUR_SUPABASE_ANON_KEY`

5. **Activate workflow**:
   - Click "Active" toggle in top-right
   - Copy webhook URL (e.g., `http://localhost:5678/webhook/validate-document`)

6. **Expose webhook** (if self-hosting locally):
   ```bash
   # Use ngrok or similar
   ngrok http 5678
   # Copy the https URL (e.g., https://abc123.ngrok.io)
   ```

---

### Step 5: Run Database Migration

```bash
# Link to your Supabase project (if not already)
supabase link --project-ref your_project_ref

# Run migration
supabase db push
```

**Or manually** (if you prefer):

```bash
# Connect to database
psql -h db.xxx.supabase.co -U postgres -d postgres

# Run migration SQL
\i supabase/migrations/20251126_n8n_integration.sql

# Verify
SELECT * FROM app_config WHERE key = 'n8n_webhook_url';
```

**Expected output**:
```
 key              | value                                                      | description
------------------+------------------------------------------------------------+-------------
 n8n_webhook_url  | https://n8n-gtoa.onrender.com/webhook/validate-document   | N8n workflow webhook URL for validation
```

---

### Step 6: Update n8n Webhook URL (if self-hosting)

If you're self-hosting n8n, update the webhook URL:

```sql
UPDATE app_config 
SET value = 'YOUR_N8N_WEBHOOK_URL'
WHERE key = 'n8n_webhook_url';
```

Example:
```sql
UPDATE app_config 
SET value = 'https://abc123.ngrok.io/webhook/validate-document'
WHERE key = 'n8n_webhook_url';
```

---

### Step 7: Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Deploy all functions
supabase functions deploy

# Or deploy specific functions
supabase functions deploy trigger-validation-n8n
supabase functions deploy create-document-fast
supabase functions deploy get-validation-status
```

**Verify deployment**:
```bash
supabase functions list
```

**Expected**: You should see 16 functions (down from 24).

---

### Step 8: Update Frontend Environment Variables

Update `.env.local` (or your hosting platform's environment variables):

```env
# Add n8n webhook URL (optional - for debugging)
VITE_N8N_WEBHOOK_URL=https://n8n-gtoa.onrender.com/webhook/validate-document
```

**Note**: The webhook URL is stored in the database (`app_config` table), so this is optional for production.

---

### Step 9: Build and Deploy Frontend

```bash
# Build frontend
npm run build

# Deploy to your hosting platform
# Example: Netlify
netlify deploy --prod --dir=dist

# Example: Vercel
vercel --prod

# Example: Manual
# Upload dist/ folder to your hosting
```

---

### Step 10: Test End-to-End

#### 10.1 Test Document Upload

1. **Open your app** in browser
2. **Upload a test document**
3. **Check database**:
   ```sql
   SELECT id, file_name, embedding_status 
   FROM documents 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   **Expected**: `embedding_status = 'pending'`

#### 10.2 Test Auto-Trigger

Wait 10-30 seconds for indexing to complete, then:

```sql
-- Check gemini_operations
SELECT validation_detail_id, status, COUNT(*)
FROM gemini_operations
WHERE validation_detail_id = (
  SELECT id FROM validation_detail ORDER BY created_at DESC LIMIT 1
)
GROUP BY validation_detail_id, status;
```

**Expected**: All operations should have `status = 'completed'`

```sql
-- Check validation_detail status
SELECT id, status, error_message
FROM validation_detail
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**: `status = 'validating'` or `'validated'`

#### 10.3 Check n8n Execution

1. **Open n8n dashboard** (http://localhost:5678 or your cloud URL)
2. **Click "Executions"**
3. **Find latest execution**
4. **Check each node** for success/failure

**Expected**: All nodes should be green (success).

#### 10.4 Check Validation Results

```sql
SELECT 
  id,
  unit_code,
  unit_link,
  citation_count,
  citation_coverage,
  average_confidence,
  quality_flags
FROM validation_results
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- `citation_count > 0`
- `citation_coverage` between 0-100
- `average_confidence` between 0-1
- `quality_flags` contains JSON with quality assessment

#### 10.5 Check Frontend Dashboard

1. **Open dashboard** in browser
2. **Find your test validation**
3. **Click to view details**

**Expected**:
- Validation results displayed
- Citations with page numbers
- Quality metrics shown
- No errors

---

### Step 11: Monitor for Issues

Monitor for the next 24 hours:

```bash
# Watch edge function logs
supabase functions logs trigger-validation-n8n --tail

# Watch database logs
supabase logs db --tail

# Check n8n executions
# Open n8n dashboard → Executions → Filter by "Error"
```

**Common Issues**: See [Troubleshooting](#troubleshooting) section below.

---

## Rollback Plan

If something goes wrong, you can rollback:

### Rollback Step 1: Restore Database

```bash
# Restore from backup
psql -h db.xxx.supabase.co -U postgres -d postgres < backup_pre_n8n_YYYYMMDD.sql
```

### Rollback Step 2: Restore Edge Functions

```bash
# Restore old edge functions
rm -rf supabase/functions/*
cp -r backup_edge_functions/* supabase/functions/

# Redeploy
supabase functions deploy
```

### Rollback Step 3: Restore Frontend

```bash
# Checkout old version
git checkout v1.0-backup

# Rebuild and redeploy
npm run build
netlify deploy --prod --dir=dist
```

---

## Troubleshooting

### Issue: Migration SQL fails

**Error**: `relation "app_config" already exists`

**Solution**: Table already exists, safe to ignore. Or:
```sql
DROP TABLE IF EXISTS app_config CASCADE;
-- Then re-run migration
```

---

### Issue: n8n webhook not triggering

**Check**:
1. Is `pg_net` extension enabled?
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

2. Is webhook URL correct?
   ```sql
   SELECT * FROM app_config WHERE key = 'n8n_webhook_url';
   ```

3. Is trigger function created?
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'trigger_validation_on_indexing_complete_n8n';
   ```

4. Is trigger active?
   ```sql
   SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'auto_trigger_validation_n8n';
   ```

**Debug**:
```sql
-- Manually trigger n8n
SELECT net.http_post(
  url := 'https://n8n-gtoa.onrender.com/webhook/validate-document',
  headers := jsonb_build_object('Content-Type', 'application/json'),
  body := jsonb_build_object('validationDetailId', 123)
);
```

---

### Issue: No grounding chunks found

**Check**:
1. Is metadata set during upload?
   ```sql
   SELECT file_search_store FROM documents WHERE id = 456;
   ```

2. Is namespace unique?
   ```sql
   SELECT namespace_code FROM validation_detail WHERE id = 123;
   ```

3. Does metadata filter match?
   - Check n8n execution logs
   - Look for "Metadata filter" in logs

**Debug** (in n8n):
```javascript
console.log('Metadata:', {
  namespace: $node['Fetch Validation Context'].json.namespace_code,
  unitLink: $json.unitLink,
  filter: 'namespace="' + namespace + '" AND unit-link="' + unitLink + '"'
});
```

---

### Issue: Requirements not found

**Check**:
1. Does `validation_summary.unitLink` exist?
   ```sql
   SELECT unitLink FROM validation_summary WHERE id = 45;
   ```

2. Does `UnitOfCompetency.Link` match?
   ```sql
   SELECT Link FROM "UnitOfCompetency" WHERE unitCode = 'BSBWHS332X';
   ```

3. Do requirements tables have `unit_url` column?
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'knowledge_evidence_requirements' 
   AND column_name = 'unit_url';
   ```

**Fix**:
```sql
-- Add unit_url column if missing
ALTER TABLE knowledge_evidence_requirements ADD COLUMN IF NOT EXISTS unit_url TEXT;
ALTER TABLE performance_evidence_requirements ADD COLUMN IF NOT EXISTS unit_url TEXT;
ALTER TABLE foundation_skills_requirements ADD COLUMN IF NOT EXISTS unit_url TEXT;
ALTER TABLE elements_performance_criteria_requirements ADD COLUMN IF NOT EXISTS unit_url TEXT;

-- Populate from unit_code
UPDATE knowledge_evidence_requirements kr
SET unit_url = uoc.Link
FROM "UnitOfCompetency" uoc
WHERE kr.unit_code = uoc.unitCode AND kr.unit_url IS NULL;
```

---

### Issue: Edge function not found

**Error**: `Function trigger-validation-n8n not found`

**Solution**:
```bash
# Deploy specific function
supabase functions deploy trigger-validation-n8n

# Or deploy all
supabase functions deploy
```

---

### Issue: n8n execution fails

**Check n8n logs**:
1. Open n8n dashboard
2. Click "Executions"
3. Find failed execution
4. Click to view details
5. Check which node failed

**Common failures**:
- **Fetch Validation Context**: Database connection issue
- **Upload to Gemini**: API key invalid or quota exceeded
- **Call Gemini Validation**: Timeout or API error
- **Store Validation Results**: Database schema mismatch

**Debug**:
- Check node input/output
- Verify credentials
- Test API calls manually

---

## Post-Migration Checklist

After migration is complete:

- [ ] All validations working end-to-end
- [ ] Citations extracted with page numbers
- [ ] Quality metrics calculated correctly
- [ ] Dashboard displays results properly
- [ ] n8n executions succeeding (>95% success rate)
- [ ] Edge function logs show no errors
- [ ] Database triggers firing correctly
- [ ] No performance degradation
- [ ] Backup of old system archived
- [ ] Documentation updated
- [ ] Team trained on new architecture

---

## Performance Comparison

### Before (v1.0)

- **Upload**: 1-2 seconds
- **Indexing**: 30-60 seconds (manual polling)
- **Validation**: 60-120 seconds (edge function orchestration)
- **Total**: 90-180 seconds
- **Edge Functions**: 24
- **Citations**: None
- **Quality Metrics**: None

### After (v2.0)

- **Upload**: <1 second
- **Indexing**: 10-30 seconds (auto-triggered)
- **Validation**: 30-60 seconds (n8n workflow)
- **Total**: 40-90 seconds (50% faster!)
- **Edge Functions**: 16 (33% reduction)
- **Citations**: Yes (with page numbers)
- **Quality Metrics**: Yes (coverage + confidence)

---

## Cost Comparison

### Before (v1.0)

- **Supabase Edge Functions**: ~$0.50/1000 invocations × 24 functions
- **Gemini API**: ~$0.10/1000 requests
- **Total**: ~$12/month (for 1000 validations)

### After (v2.0)

- **Supabase Edge Functions**: ~$0.50/1000 invocations × 16 functions
- **n8n**: $0 (self-hosted) or $20/month (cloud)
- **Gemini API**: ~$0.10/1000 requests (same)
- **Total**: ~$8/month (self-hosted) or ~$28/month (cloud)

**Note**: Cloud n8n adds cost but saves maintenance time.

---

## FAQ

### Q: Can I run both v1.0 and v2.0 simultaneously?

**A**: Yes, during migration. Keep old edge functions deployed while testing n8n. Once confident, remove old functions.

---

### Q: What happens to existing validations?

**A**: Existing validations remain unchanged. New validations use n8n workflow. You can re-run old validations to get citations.

---

### Q: Can I migrate back to v1.0?

**A**: Yes, use the rollback plan above. Keep backups for at least 30 days.

---

### Q: Do I need to update requirements data?

**A**: If your requirements tables don't have `unit_url` column, you need to add it. See migration SQL.

---

### Q: Can I customize the n8n workflow?

**A**: Yes! That's the beauty of n8n. Edit the workflow in n8n dashboard, test, and save.

---

### Q: What if n8n goes down?

**A**: Validations will fail to trigger. Monitor n8n uptime. Consider using n8n cloud for 99.9% uptime.

---

### Q: How do I update the n8n workflow?

**A**: Edit in n8n dashboard, test with sample data, then activate. No code deployment needed!

---

## Support

If you encounter issues during migration:

1. **Check logs**: Edge functions + n8n + database
2. **Review troubleshooting**: See section above
3. **Check documentation**: ARCHITECTURE_N8N.md
4. **Create issue**: GitHub Issues with logs and error messages
5. **Email support**: support@nytroai.com

---

## Summary

**Migration Steps**:
1. ✅ Backup current system
2. ✅ Update repository
3. ✅ Setup n8n workflow
4. ✅ Run database migration
5. ✅ Deploy edge functions
6. ✅ Deploy frontend
7. ✅ Test end-to-end
8. ✅ Monitor for 24 hours

**Benefits**:
- 33% fewer edge functions
- 50% faster validations
- Citations with page numbers
- Quality metrics
- Easier to maintain and extend

**Time Investment**: 1-2 hours  
**Payoff**: Ongoing time savings + better validation quality

---

**Good luck with your migration! 🚀**

---

**End of Migration Guide**
