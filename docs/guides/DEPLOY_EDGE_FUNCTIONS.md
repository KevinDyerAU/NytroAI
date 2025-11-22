# Deploy Edge Functions to Supabase

## Prerequisites

1. **Install Supabase CLI**

### Windows (PowerShell - Run as Administrator)
```powershell
# Using Scoop (recommended)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# OR using npm (alternative)
npm install -g supabase
```

### Verify Installation
```powershell
supabase --version
```

---

## Deployment Steps

### 1. Login to Supabase

```powershell
supabase login
```

This will open a browser window to authenticate with your Supabase account.

### 2. Link Your Project

```powershell
# Link to your existing Supabase project
supabase link --project-ref dfqxmjmggokneiuljkta

# You'll be prompted for your database password
# This is your Supabase project database password
```

### 3. Deploy All Edge Functions

```powershell
# Deploy all edge functions at once
supabase functions deploy

# OR deploy specific functions
supabase functions deploy validate-assessment
supabase functions deploy validate-assessment-v2
```

### 4. Verify Deployment

```powershell
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs validate-assessment
```

---

## Deployment for Updated Functions

If you've updated the edge function code (like we did for Phase 3), deploy with:

```powershell
# Deploy the main validation function
supabase functions deploy validate-assessment

# Deploy the v2 validation function (if exists)
supabase functions deploy validate-assessment-v2

# Deploy all functions
supabase functions deploy
```

---

## What Gets Deployed

When you run `supabase functions deploy`, it uploads:

### Main Files:
- `supabase/functions/validate-assessment/index.ts`
- `supabase/functions/validate-assessment-v2/index.ts`
- All other function folders

### Shared Utilities:
- `supabase/functions/_shared/store-validation-results.ts` ✅ NEW
- `supabase/functions/_shared/validation-results.ts` ✅ NEW
- `supabase/functions/_shared/supabase.ts`
- `supabase/functions/_shared/gemini.ts`
- All other shared files

---

## Verify Deployment Success

### Method 1: Check Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/dfqxmjmggokneiuljkta/functions
2. Click on **Edge Functions** in sidebar
3. Look for `validate-assessment` function
4. Click **"View Details"** or **"Edit"**
5. Check if code contains:
   ```typescript
   import { storeValidationResults as storeValidationResultsNew } from '../_shared/store-validation-results.ts';
   ```

### Method 2: Run Test Validation

```powershell
# Run the deployment check script
node scripts/check-edge-function-status.js

# Then trigger a validation from the UI and check again
```

### Method 3: Check Function Logs

```powershell
supabase functions logs validate-assessment --follow
```

Then trigger a validation and watch the logs in real-time.

---

## Testing After Deployment

### 1. Trigger a Test Validation

- Open your NytroAI application
- Start a validation for any unit
- Monitor the validation progress

### 2. Check Database

```sql
-- Check new table for recent records
SELECT * FROM validation_results 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify validation_method is set
SELECT 
  validation_method,
  COUNT(*) as count
FROM validation_results
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY validation_method;
```

### 3. Verify Data Structure

```sql
-- Check if new schema columns are populated
SELECT 
  requirement_type,
  validation_method,
  jsonb_array_length(smart_questions) as smart_question_count,
  created_at
FROM validation_results
ORDER BY created_at DESC
LIMIT 5;
```

---

## Troubleshooting

### Issue: "supabase: command not found"

**Solution:**
- Verify Supabase CLI is installed: `supabase --version`
- Restart PowerShell after installation
- Check PATH environment variable

### Issue: "Project not linked"

**Solution:**
```powershell
supabase link --project-ref dfqxmjmggokneiuljkta
```

### Issue: "Authentication failed"

**Solution:**
```powershell
# Re-authenticate
supabase logout
supabase login
```

### Issue: "Deployment failed"

**Solution:**
- Check function syntax: `deno check supabase/functions/validate-assessment/index.ts`
- Review error logs: `supabase functions logs validate-assessment`
- Verify all imports are correct

### Issue: "Function still using old code"

**Solution:**
- Wait 30-60 seconds for deployment to propagate
- Clear browser cache
- Check deployment status: `supabase functions list`
- Redeploy: `supabase functions deploy validate-assessment --force`

---

## Rollback (If Needed)

If the new deployment causes issues:

### Option 1: Revert Code Locally

```powershell
# Revert the edge function file
git checkout HEAD^ supabase/functions/validate-assessment/index.ts

# Redeploy
supabase functions deploy validate-assessment
```

### Option 2: Use Old Tables

The old validation tables still exist, so the application can fall back to them if needed.

---

## Environment Variables

If your edge functions use environment variables:

### Set Secrets

```powershell
# Set environment variables for edge functions
supabase secrets set GEMINI_API_KEY=your_key_here
supabase secrets set SUPABASE_URL=https://dfqxmjmggokneiuljkta.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# List all secrets
supabase secrets list

# Remove a secret
supabase secrets unset SECRET_NAME
```

---

## Production Checklist

Before deploying to production:

- [ ] Test edge functions locally (if possible)
- [ ] Review all code changes
- [ ] Backup database (if needed)
- [ ] Deploy during low-traffic period
- [ ] Monitor logs after deployment
- [ ] Run test validations
- [ ] Check error rates
- [ ] Verify performance
- [ ] Have rollback plan ready

---

## Deployment Schedule

**Recommended:**
1. Deploy during off-peak hours
2. Monitor for 30-60 minutes
3. Run several test validations
4. Check error logs
5. Verify data in database

**Timeline:**
- Deployment: ~2-5 minutes
- Verification: ~10-15 minutes
- Monitoring: ~30-60 minutes

---

## Support

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Edge Functions Docs:** https://supabase.com/docs/guides/functions
- **Local Testing:** `supabase functions serve validate-assessment`

---

## Quick Reference

```powershell
# Install CLI
scoop install supabase

# Login
supabase login

# Link project
supabase link --project-ref dfqxmjmggokneiuljkta

# Deploy
supabase functions deploy

# Check status
supabase functions list

# View logs
supabase functions logs validate-assessment --follow

# Test locally
supabase functions serve validate-assessment
```

---

## After Deployment

Once deployed and verified:

1. ✅ Run `node scripts/check-edge-function-status.js` again
2. ✅ Verify new records appear in `validation_results` table
3. ✅ Check that `validation_method` field is populated
4. ✅ Monitor for any errors in Supabase logs
5. ✅ Update `PHASE3_EXECUTION_REPORT.md` with deployment status

---

**Status:** 📋 Instructions ready - Follow steps above to deploy edge functions
