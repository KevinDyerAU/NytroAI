# Server-Side Indexing Processor Setup

## Overview

The indexing processor has been moved from client-side polling to server-side scheduled execution for better reliability and reduced client load.

## Implementation Options

### Option 1: Supabase Cron Jobs (Recommended)

Supabase Pro and above tiers support cron jobs via the dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Cron Jobs**
3. Click **Create a new cron job**
4. Configure:
   - **Name**: `process-pending-indexing`
   - **Schedule**: `* * * * *` (every minute)
   - **SQL Command**:
   ```sql
   SELECT
     net.http_post(
       url := current_setting('app.settings.supabase_url') || '/functions/v1/process-pending-indexing',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb
     );
   ```

### Option 2: External Cron Service

Use an external service like:
- **Cron-job.org**
- **EasyCron**
- **GitHub Actions**

Configure to call:
```
POST https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/process-pending-indexing
Authorization: Bearer [SERVICE_ROLE_KEY]
```

### Option 3: pg_cron Extension (If Available)

If pg_cron is enabled on your Supabase instance, run the migration:

```bash
npx supabase migration up --file 20250124_create_indexing_cron.sql
```

## Benefits

✅ **No client dependency** - Processes even when no users are logged in  
✅ **Consistent execution** - Runs every minute regardless of browser state  
✅ **Reduced client load** - No JavaScript polling in the browser  
✅ **Better scaling** - Single server-side process vs. multiple client processes  

## Dashboard Changes

The dashboard now includes:
- **Refresh button** - Manually refresh active validations list
- **Check Status button** - View detailed processing status for last 6 hours

## Migration Steps

1. ✅ Remove client-side `useIndexingProcessor()` hook (completed)
2. ⏳ Set up server-side cron job (see options above)
3. ✅ Add status check and refresh buttons to dashboard (completed)
4. ✅ Deploy `get-validation-status` edge function (completed)

## Testing

After setup, verify the cron job is working:

1. Upload a document
2. Wait 1-2 minutes
3. Click **Check Status** on dashboard
4. Verify documents appear with processing status

## Monitoring

Check cron job execution:
- Supabase Dashboard → Database → Cron Jobs → View logs
- Monitor edge function logs for `process-pending-indexing`

## Rollback

If needed, re-enable client-side processing by uncommenting in `src/pages/dashboard.tsx`:
```typescript
useIndexingProcessor(); // Re-enable client-side polling
```
