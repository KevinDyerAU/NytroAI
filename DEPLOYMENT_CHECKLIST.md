# Deployment Checklist - Requirements Fix

**PR:** https://github.com/KevinDyerAU/NytroAI/pull/17  
**Branch:** `fix/requirements-field-mapping-and-display-types`  
**Priority:** 🔴 **CRITICAL** - Blocks all validation workflows

---

## Pre-Deployment

- [ ] PR reviewed and approved
- [ ] All CI/CD checks passing
- [ ] Documentation reviewed
- [ ] Test environment validated

---

## Deployment Steps

### Step 1: Deploy Edge Function

```bash
cd /home/ubuntu/NytroAI
supabase functions deploy get-requirements
```

**Expected output:**
```
Deploying function get-requirements...
Function deployed successfully!
```

**Verify:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/get-requirements \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"validation_detail_id": "741"}'
```

**Check response includes:**
- ✅ Non-empty `text` fields
- ✅ `display_type` field present
- ✅ `element` and `element_number` for performance criteria

---

### Step 2: Apply Database Migration

**Option A: Using psql**
```bash
psql $DATABASE_URL -f supabase/migrations/20251130_update_prompts.sql
```

**Option B: Using Supabase Dashboard**
1. Navigate to SQL Editor
2. Open `supabase/migrations/20251130_update_prompts.sql`
3. Copy contents
4. Paste into SQL Editor
5. Click "Run"

**Verify:**
```sql
-- Check prompts were updated
SELECT 
  prompt_type, 
  version,
  LENGTH(prompt_template) as template_length,
  LENGTH(output_schema::text) as schema_length
FROM prompts
WHERE version = 'v1.1'
ORDER BY prompt_type;
```

**Expected:** 7 rows with version 'v1.1'

---

### Step 3: Update n8n Workflow (Optional)

If the **Parse Gemini Response** node needs updating, use the code from:
`docs/GEMINI_OUTPUT_MAPPING_GUIDE.md`

**Key changes:**
- Handle `citations` as array
- Handle `smart_question` and `benchmark_answer` as strings
- Remove `unmapped_content` handling

---

### Step 4: Test End-to-End

**Test validation request:**
1. Trigger a validation in n8n
2. Check logs for get-requirements response
3. Verify Gemini receives requirement text
4. Verify validation results are saved correctly

**Sample test:**
```bash
# Trigger validation via n8n webhook
curl -X POST https://your-n8n.com/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": "741",
    "document_type": "learner_guide"
  }'
```

---

### Step 5: Update Frontend (If Needed)

**Update UI to use display_type:**

```javascript
// Before
<span class="badge">{requirement.type}</span>

// After
<span class="badge">{requirement.display_type}</span>
```

**Add element grouping for Performance Criteria:**

```javascript
// Group by element
const byElement = requirements
  .filter(r => r.type === 'elements_performance_criteria')
  .reduce((acc, req) => {
    const key = req.element_number || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        element: req.element,
        element_number: req.element_number,
        criteria: []
      };
    }
    acc[key].criteria.push(req);
    return acc;
  }, {});
```

---

## Post-Deployment Verification

### Edge Function Tests

- [ ] Knowledge Evidence returns with `text` populated
- [ ] Performance Evidence returns with `text` populated
- [ ] Foundation Skills returns with `text` populated
- [ ] Performance Criteria returns with `text`, `element`, `element_number`
- [ ] Assessment Conditions returns with `text` populated
- [ ] All requirements have `display_type` field
- [ ] Display types are user-friendly (e.g., "Knowledge Evidence")

### Validation Workflow Tests

- [ ] Validation request completes successfully
- [ ] Gemini receives requirement text (not empty)
- [ ] Gemini returns valid JSON with new schema
- [ ] Citations include page numbers
- [ ] Mapped content includes inline page numbers
- [ ] Validation results saved to database
- [ ] No parse errors in n8n logs

### Frontend Tests (If Updated)

- [ ] Requirements display with friendly type names
- [ ] Performance criteria show element context
- [ ] Reports use user-friendly labels
- [ ] Filtering and grouping work correctly

---

## Rollback Plan

If issues occur, rollback in reverse order:

### 1. Revert Frontend Changes
```bash
git revert <frontend-commit-hash>
git push
```

### 2. Rollback Database Migration
```sql
-- Restore previous prompts (if backed up)
-- Or manually update prompts table
UPDATE prompts SET version = 'v1.0' WHERE version = 'v1.1';
```

### 3. Redeploy Previous Edge Function
```bash
git checkout main
supabase functions deploy get-requirements
```

---

## Monitoring

**Key Metrics to Watch:**

1. **Edge Function Performance**
   - Response time (should be < 500ms)
   - Error rate (should be < 1%)
   - Non-empty text field rate (should be 100%)

2. **Validation Workflow**
   - Gemini API response time (should be ~5s, down from ~8s)
   - Parse errors (should be < 1%)
   - Validation completion rate

3. **Database**
   - Prompt fetch time
   - Validation results insert rate

**Monitoring Commands:**

```bash
# Check edge function logs
supabase functions logs get-requirements --tail

# Check n8n workflow logs
# (via n8n UI or API)

# Check database performance
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as total_validations,
  COUNT(CASE WHEN status = 'Met' THEN 1 END) as met,
  COUNT(CASE WHEN status = 'Partially Met' THEN 1 END) as partial,
  COUNT(CASE WHEN status = 'Not Met' THEN 1 END) as not_met
FROM validation_results
WHERE created_at > NOW() - INTERVAL '1 hour';
"
```

---

## Success Criteria

✅ **Deployment Successful When:**

1. Edge function returns non-empty text for all requirement types
2. Display types are user-friendly and correct
3. Performance criteria include element context
4. Validation workflow completes end-to-end
5. Gemini receives actual requirement text
6. Validation results are saved correctly
7. No increase in error rates
8. Response times improved (37% faster)

---

## Support

**Documentation:**
- Field Mapping: `docs/REQUIREMENTS_TABLE_FIELD_MAPPING.md`
- Display Types: `docs/DISPLAY_TYPE_MAPPING_GUIDE.md`
- Prompt Updates: `docs/PROMPT_UPDATE_GUIDE.md`
- Page Numbers: `docs/PAGE_NUMBER_FORMAT_GUIDE.md`

**Troubleshooting:**
- Check edge function logs for field mapping errors
- Verify database tables have correct column names
- Check n8n logs for parse errors
- Verify Gemini API responses

---

**Deployed By:** _______________  
**Date:** _______________  
**Time:** _______________  
**Environment:** Production / Staging  
**Verified By:** _______________
