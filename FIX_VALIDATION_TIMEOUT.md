# Fix Validation Timeout Error

## Problem
```
Request timed out after 30 seconds
```

Edge function `create-validation-record` is not responding.

## Root Cause
The edge function is likely **not deployed** to Supabase.

---

## ✅ Solution 1: Deploy Edge Function (Recommended)

### Step 1: Link Project (If Not Already Linked)
```powershell
supabase link --project-ref dfqxmjmggokneiuljkta
```

### Step 2: Deploy the Function
```powershell
# Deploy just this function
supabase functions deploy create-validation-record

# OR deploy all functions
supabase functions deploy
```

### Step 3: Verify Deployment
```powershell
supabase functions list
```

You should see `create-validation-record` in the list.

### Step 4: Test Again
Try creating a validation in the UI.

---

## ✅ Solution 2: Use Supabase Dashboard (Alternative)

If CLI isn't working:

### 1. Go to Supabase Dashboard
- https://supabase.com/dashboard/project/dfqxmjmggokneiuljkta/functions

### 2. Create New Edge Function
- Click **"New Function"**
- Name: `create-validation-record`
- Copy contents from: `supabase/functions/create-validation-record/index.ts`
- Click **"Deploy"**

### 3. Test in UI
Try validation again.

---

## ✅ Solution 3: Increase Timeout (Temporary Workaround)

While deploying, you can temporarily increase the timeout:

### File: `src/services/ValidationWorkflowService.ts`

Change line 52:
```typescript
// FROM:
setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000);

// TO:
setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
```

This gives more time, but **doesn't fix the root cause**.

---

## Verification Checklist

After deploying:

- [ ] Function appears in `supabase functions list`
- [ ] Function shows in Supabase Dashboard
- [ ] Validation creates records without timeout
- [ ] Console shows edge function logs
- [ ] No more 30-second timeout errors

---

## Why This Happens

**Edge functions must be explicitly deployed:**
1. Local code ≠ Deployed code
2. Changes to `supabase/functions/*` don't auto-deploy
3. Must run `supabase functions deploy` after changes
4. Function won't exist until first deployment

---

## Quick Deploy Command

```powershell
# One command to fix
supabase functions deploy create-validation-record
```

---

## Monitor Deployment

Watch logs in real-time:
```powershell
supabase functions logs create-validation-record --follow
```

Then trigger a validation and watch the logs.

---

## If Still Timing Out After Deploy

### Check Function Status
```powershell
supabase functions list
```

### Check Function Logs
```powershell
supabase functions logs create-validation-record
```

### Test Function Directly
```powershell
curl -i --location --request POST \
  'https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/create-validation-record' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"rtoCode":"TEST","unitCode":"TEST","validationType":"UnitOfCompetency"}'
```

---

## Related Functions to Deploy

If deploying all functions, these are important:
```powershell
supabase functions deploy create-validation-record
supabase functions deploy trigger-validation
supabase functions deploy validate-assessment
supabase functions deploy validate-assessment-v2
```

---

## Next Steps

1. **Deploy the function** (most important)
2. **Test validation** in UI
3. **Monitor logs** for errors
4. **Apply database migration** (from Phase 3.2)
5. **Test complete workflow**

---

**Status:** Edge function needs deployment 🚀
