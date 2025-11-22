# Auto-Trigger Validation - Implementation Checklist

**Date:** November 22, 2025  
**Status:** 🔄 READY TO IMPLEMENT  
**Project:** NytroAI - Automatic Validation Triggering

---

## Overview

This checklist guides you through implementing the **database trigger system** for automatic validation triggering. This eliminates client-side polling and makes validation triggering fully automatic and server-side.

**Reference:** `docs/guides/DATABASE_TRIGGER_SETUP.md`

---

## Prerequisites

- [ ] Supabase project access (Project ID: `dfqxmjmggokneiuljkta`)
- [ ] Database admin permissions
- [ ] Access to Supabase SQL Editor
- [ ] Supabase anon key (from Project Settings > API)

---

## Phase 1: Database Migration

### Step 1.1: Apply Migration

**File:** `supabase/migrations/20250122_auto_trigger_validation.sql`

**Option A: Via Supabase Dashboard (Recommended)**

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Click "New Query"
4. Copy the entire contents of `20250122_auto_trigger_validation.sql`
5. Paste into SQL Editor
6. Click "Run"
7. Verify success message appears

**Option B: Via Supabase CLI**

```bash
# From project root
supabase db push
```

**Expected Output:**
```
✅ Auto-trigger validation migration complete!

⚠️  IMPORTANT: Set Supabase credentials in database secrets:
   ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
   ALTER DATABASE postgres SET app.supabase_anon_key = 'your_anon_key';

📊 Monitor triggers with: SELECT * FROM validation_trigger_monitor;
🧪 Test manually with: SELECT * FROM manually_trigger_validation(validation_detail_id);
```

- [ ] Migration applied successfully
- [ ] Success message displayed
- [ ] No errors in output

---

### Step 1.2: Verify Migration

Run this SQL to verify installation:

```sql
-- Check trigger exists
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_indexing_complete';
```

**Expected:** 1 row showing trigger on `gemini_operations`

```sql
-- Check validation_trigger_log table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'validation_trigger_log';
```

**Expected:** 1 row

```sql
-- Check helper functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'trigger_validation_on_indexing_complete',
  'get_validation_trigger_status',
  'manually_trigger_validation'
);
```

**Expected:** 3 rows

- [ ] Trigger exists
- [ ] Log table exists
- [ ] Helper functions exist

---

## Phase 2: Configure Credentials

### Step 2.1: Get Supabase Credentials

1. Go to Supabase Dashboard
2. Navigate to **Project Settings** > **API**
3. Copy:
   - **Project URL:** `https://dfqxmjmggokneiuljkta.supabase.co`
   - **anon public key:** (long string starting with `eyJ...`)

- [ ] Project URL copied
- [ ] Anon key copied

---

### Step 2.2: Set Database Secrets

**Option A: Via Supabase Dashboard**

1. Go to **Project Settings** > **Database** > **Configuration**
2. Scroll to **Database Settings**
3. Look for **Custom postgres settings** or run SQL directly

**Option B: Via SQL (Recommended)**

Run this SQL, replacing values:

```sql
-- Set Supabase URL
ALTER DATABASE postgres 
SET app.supabase_url = 'https://dfqxmjmggokneiuljkta.supabase.co';

-- Set Supabase anon key
ALTER DATABASE postgres 
SET app.supabase_anon_key = 'eyJ...YOUR_ANON_KEY_HERE...';
```

**⚠️ IMPORTANT:** Replace `eyJ...YOUR_ANON_KEY_HERE...` with your actual anon key!

- [ ] URL configured
- [ ] Anon key configured

---

### Step 2.3: Verify Credentials

Run this SQL:

```sql
SELECT 
  CASE 
    WHEN current_setting('app.supabase_url', true) IS NOT NULL 
    THEN '✅ app.supabase_url is set'
    ELSE '❌ app.supabase_url is NOT set'
  END AS url_status,
  CASE 
    WHEN current_setting('app.supabase_anon_key', true) IS NOT NULL 
    THEN '✅ app.supabase_anon_key is set'
    ELSE '❌ app.supabase_anon_key is NOT set'
  END AS key_status;
```

**Expected:** Both show ✅

```sql
-- Verify actual values (check they're correct)
SELECT 
  current_setting('app.supabase_url', true) AS url,
  LEFT(current_setting('app.supabase_anon_key', true), 20) || '...' AS key_preview;
```

**Expected:** Shows your URL and first 20 chars of key

- [ ] Both credentials show as ✅
- [ ] Values are correct

---

## Phase 3: Testing

### Step 3.1: Run Test Script

**File:** `scripts/test-auto-trigger.sql`

1. Open Supabase SQL Editor
2. Copy entire contents of `test-auto-trigger.sql`
3. Paste into editor
4. Click "Run"
5. Review results

**Expected Output:**
- Trigger information displayed
- Credential status shows ✅
- Recent validations listed (if any)
- Success message at end

- [ ] Test script run successfully
- [ ] All checks pass

---

### Step 3.2: Test Manual Trigger (Optional)

Find a recent validation ID:

```sql
SELECT id, unit_code, extract_status
FROM validation_detail
ORDER BY created_at DESC
LIMIT 5;
```

Test manual trigger with one of the IDs:

```sql
-- Replace 123 with actual validation_detail_id
SELECT * FROM manually_trigger_validation(123);
```

**Expected Success:**
```json
{
  "success": true,
  "request_id": 456,
  "message": "Validation triggered successfully"
}
```

**Expected Not Ready:**
```json
{
  "success": false,
  "error": "Not all operations complete",
  "status": {...}
}
```

- [ ] Manual trigger tested
- [ ] Response is correct

---

### Step 3.3: Verify Trigger Log

```sql
SELECT * FROM validation_trigger_log
ORDER BY triggered_at DESC
LIMIT 10;
```

**Expected:** Shows recent trigger attempts (if any)

- [ ] Trigger log accessible
- [ ] Shows expected data

---

## Phase 4: Monitor Setup

### Step 4.1: Check Monitoring View

```sql
SELECT 
  validation_detail_id,
  extract_status,
  rtoCode,
  unitCode,
  total_operations,
  completed_operations,
  all_complete,
  trigger_attempted,
  trigger_succeeded,
  last_trigger_at
FROM validation_trigger_monitor
ORDER BY validation_created_at DESC
LIMIT 10;
```

**Expected:** Shows recent validations with trigger status

- [ ] Monitoring view works
- [ ] Shows expected data

---

### Step 4.2: Check Operation Status

```sql
-- Replace 123 with actual validation_detail_id
SELECT * FROM get_validation_trigger_status(123);
```

**Expected:** Returns detailed status information

- [ ] Status function works
- [ ] Returns complete data

---

## Phase 5: Integration Testing

### Step 5.1: Test Full Workflow

**Test Case:** Upload document and verify automatic trigger

1. **Upload Document:**
   - Go to your app
   - Select RTO and Unit
   - Upload a test document (e.g., small PDF)

2. **Monitor Indexing:**
   ```sql
   -- Replace with your validation_detail_id
   SELECT 
     go.id,
     go.status,
     go.progress,
     go.updated_at
   FROM gemini_operations go
   WHERE validation_detail_id = YOUR_ID
   ORDER BY created_at;
   ```

3. **Watch for Trigger:**
   ```sql
   -- Check trigger log every few seconds
   SELECT * FROM validation_trigger_log
   WHERE validation_detail_id = YOUR_ID
   ORDER BY triggered_at DESC;
   ```

4. **Verify Validation Started:**
   ```sql
   SELECT 
     id,
     extract_status,
     validation_status,
     updated_at
   FROM validation_detail
   WHERE id = YOUR_ID;
   ```

**Expected Flow:**
1. Document uploaded
2. `gemini_operations` status changes to 'completed'
3. Trigger fires automatically
4. Entry appears in `validation_trigger_log`
5. `validation_detail.extract_status` changes to 'ProcessingInBackground'
6. Validation completes

- [ ] Document uploaded
- [ ] Indexing completed
- [ ] Trigger fired automatically
- [ ] Trigger log entry created
- [ ] Validation started
- [ ] No errors

---

### Step 5.2: Test Multiple Documents

**Test Case:** Upload 3 documents, verify trigger fires once when all complete

1. Upload 3 documents
2. Monitor operations
3. Verify trigger fires only after ALL complete
4. Verify single trigger log entry

- [ ] Multiple documents uploaded
- [ ] All indexed successfully
- [ ] Trigger fired once (not 3 times)
- [ ] Validation started with all documents

---

### Step 5.3: Test Failed Indexing

**Test Case:** Verify trigger doesn't fire if indexing fails

1. If possible, trigger a failed indexing
2. Verify trigger does NOT fire
3. Verify `extract_status` = 'IndexingFailed'

- [ ] Failed indexing handled correctly
- [ ] Trigger did not fire
- [ ] Status marked as failed

---

## Phase 6: Production Readiness

### Step 6.1: Review Configuration

```sql
-- Final verification of all components
SELECT 
  'Trigger' AS component,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_indexing_complete'
  ) THEN '✅ Installed' ELSE '❌ Missing' END AS status
UNION ALL
SELECT 
  'Credentials',
  CASE WHEN current_setting('app.supabase_url', true) IS NOT NULL 
       AND current_setting('app.supabase_anon_key', true) IS NOT NULL
  THEN '✅ Configured' ELSE '❌ Missing' END
UNION ALL
SELECT 
  'pg_net Extension',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN '✅ Enabled' ELSE '❌ Disabled' END
UNION ALL
SELECT 
  'Log Table',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'validation_trigger_log'
  ) THEN '✅ Created' ELSE '❌ Missing' END;
```

**Expected:** All show ✅

- [ ] All components installed
- [ ] All checks pass

---

### Step 6.2: Document Credentials

**⚠️ SECURITY:** Document where credentials are stored

- [ ] Credentials stored in database settings
- [ ] No credentials in code
- [ ] No credentials in public docs
- [ ] Team knows how to rotate keys

---

### Step 6.3: Set Up Monitoring

**Daily Monitoring:**

```sql
-- Check for trigger errors
SELECT COUNT(*) AS failed_triggers
FROM validation_trigger_log
WHERE error_message IS NOT NULL
  AND triggered_at > NOW() - INTERVAL '24 hours';
```

**Weekly Review:**

```sql
-- Trigger success rate
SELECT 
  COUNT(*) AS total_triggers,
  COUNT(*) FILTER (WHERE error_message IS NULL) AS successful,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE error_message IS NULL) / COUNT(*), 2) AS success_rate
FROM validation_trigger_log
WHERE triggered_at > NOW() - INTERVAL '7 days';
```

- [ ] Monitoring queries documented
- [ ] Team knows how to check trigger health

---

## Phase 7: Migration from Polling (Optional)

### Step 7.1: Evaluate Polling Code

Current polling code (user added in `DocumentUploadAdapter.tsx`):

```typescript
await validationWorkflowService.pollIndexingAndTriggerValidation(
  validationDetailId,
  (status: IndexingStatus) => {
    // Show progress
  }
);
```

**Options:**

**A. Keep Both (Hybrid - Recommended)**
- ✅ Trigger provides automatic triggering
- ✅ Polling acts as fallback
- ✅ User sees progress
- ❌ More code to maintain

**B. Remove Polling (Full Migration)**
- ✅ Simpler code
- ✅ No client-side overhead
- ❌ No progress feedback to user
- ❌ No fallback if trigger fails

**Recommendation:** Keep hybrid approach for 2-4 weeks, then evaluate

- [ ] Decision made on polling approach
- [ ] Team aligned on strategy

---

### Step 7.2: Update Documentation

Files to update:
- [ ] `README.md` - Mention automatic triggering
- [ ] `MIGRATION_README.md` - Add Phase 3.6 (Auto-Trigger)
- [ ] Update any developer documentation

---

## Phase 8: Post-Implementation

### Step 8.1: Monitor First Week

**Daily checks for first week:**

```sql
-- Trigger activity summary
SELECT 
  DATE(triggered_at) AS date,
  trigger_source,
  COUNT(*) AS attempts,
  COUNT(*) FILTER (WHERE error_message IS NULL) AS succeeded,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) AS failed
FROM validation_trigger_log
WHERE triggered_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(triggered_at), trigger_source
ORDER BY date DESC, trigger_source;
```

- [ ] Day 1 monitoring complete
- [ ] Day 2 monitoring complete
- [ ] Day 3 monitoring complete
- [ ] Day 7 monitoring complete
- [ ] No critical issues found

---

### Step 8.2: Cleanup (After 30 Days)

```sql
-- Archive old trigger logs
DELETE FROM validation_trigger_log
WHERE triggered_at < NOW() - INTERVAL '30 days';
```

- [ ] Log cleanup schedule established

---

## Troubleshooting

### Issue: Trigger Not Firing

**Check:**

```sql
-- Verify trigger enabled
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_indexing_complete';

-- Check credentials
SELECT current_setting('app.supabase_url', true);

-- Check recent operations
SELECT * FROM gemini_operations 
WHERE validation_detail_id = YOUR_ID
ORDER BY created_at;

-- Check PostgreSQL logs in Supabase Dashboard
```

**Common Causes:**
- Credentials not set
- pg_net not enabled
- Edge function not deployed
- Wrong validation_detail_id

---

### Issue: Trigger Fires But Validation Fails

**Check:**

```sql
-- Check HTTP responses
SELECT * FROM net._http_response
WHERE url LIKE '%trigger-validation%'
ORDER BY created DESC
LIMIT 5;

-- Check edge function logs in Supabase Dashboard
```

**Common Causes:**
- Edge function error
- Missing documents
- Invalid namespace

---

## Success Criteria

### Minimum Requirements (Must Have)

- [x] Migration applied successfully
- [x] Credentials configured
- [x] Test script passes
- [x] Manual trigger works
- [ ] Automatic trigger fires on operation completion
- [ ] Validation starts successfully
- [ ] No errors in production

### Recommended (Should Have)

- [ ] Full workflow tested with real documents
- [ ] Multiple document test passed
- [ ] Failed indexing test passed
- [ ] Monitoring queries documented
- [ ] Team trained on troubleshooting

### Optional (Nice to Have)

- [ ] Hybrid polling approach implemented
- [ ] Alert system for trigger failures
- [ ] Dashboard showing trigger metrics
- [ ] Automated cleanup job

---

## Final Checklist

Before marking as complete:

- [ ] All Phase 1-5 steps completed
- [ ] Full workflow tested successfully
- [ ] Team trained on monitoring
- [ ] Documentation updated
- [ ] No outstanding issues
- [ ] Production ready sign-off

---

## Status Updates

| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| 2025-11-22 | Preparation | ✅ Complete | Files reviewed |
| | Phase 1 | ⏳ Pending | Ready to apply migration |
| | Phase 2 | ⏳ Pending | Credentials needed |
| | Phase 3 | ⏳ Pending | Awaiting Phase 1-2 |
| | Phase 4 | ⏳ Pending | Awaiting Phase 1-3 |
| | Phase 5 | ⏳ Pending | Awaiting Phase 1-4 |
| | Phase 6 | ⏳ Pending | Final checks |
| | Phase 7 | ⏳ Optional | To be decided |
| | Phase 8 | ⏳ Pending | Post-implementation |

---

## Next Actions

**IMMEDIATE (Do Now):**
1. ✅ Review this checklist
2. ⏳ Apply database migration (Phase 1)
3. ⏳ Configure credentials (Phase 2)
4. ⏳ Run test script (Phase 3)

**SOON (Within 24h):**
5. ⏳ Test full workflow (Phase 5)
6. ⏳ Verify production readiness (Phase 6)

**LATER (Within 1 week):**
7. ⏳ Monitor first week (Phase 8.1)
8. ⏳ Update documentation (Phase 7.2)

---

**Ready to implement!** 🚀

Start with Phase 1, Step 1.1 above.
