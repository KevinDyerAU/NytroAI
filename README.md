<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/16sxgqilGVYjVnHeBSrweLo7P3P22lTmD

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Error Handling & Troubleshooting

### Common Errors & Solutions

#### ⏱️ "Request timed out after 30/45 seconds"
**Cause:** Edge function not deployed or not responding
**Solution:**
1. Check if edge functions are deployed:
   ```bash
   supabase functions list
   ```
2. Deploy missing functions:
   ```bash
   supabase functions deploy create-validation-record
   supabase functions deploy trigger-validation
   ```
3. Verify in Supabase Dashboard: https://supabase.com/dashboard/project/dfqxmjmggokneiuljkta/functions

See [FIX_VALIDATION_TIMEOUT.md](FIX_VALIDATION_TIMEOUT.md) for detailed instructions.

#### 🌐 "Network error: Unable to reach Supabase"
**Cause:** Internet connection or Supabase outage
**Solution:**
1. Check your internet connection
2. Verify Supabase status: https://status.supabase.com
3. Try again in a few moments

#### ❌ "Edge function not found"
**Cause:** Function not deployed to Supabase
**Solution:**
1. Link your project:
   ```bash
   supabase link --project-ref dfqxmjmggokneiuljkta
   ```
2. Deploy the function:
   ```bash
   supabase functions deploy [function-name]
   ```

#### 🗃️ "Database error: Unable to create validation"
**Cause:** Database schema issues or permissions
**Solution:**
1. Apply pending migrations:
   ```bash
   supabase db push
   ```
2. Check Phase 3.2 migration status in Supabase SQL Editor
3. See [APPLY_MIGRATION_GUIDE.md](APPLY_MIGRATION_GUIDE.md)

#### 📄 "Could not choose the best candidate function"
**Cause:** PostgreSQL function signature ambiguity (bigint vs integer)
**Solution:**
1. Apply Phase 3.2 database migration
2. Run SQL from `supabase/migrations/20250122_fix_validation_results_function.sql`
3. See [PHASE3.2_COMPLETION_SUMMARY.md](PHASE3.2_COMPLETION_SUMMARY.md)

### Error Message Features

All errors now include:
- 🎯 **Emoji icons** for quick visual scanning
- 📝 **Clear descriptions** of what went wrong
- 💡 **Actionable solutions** to fix the issue
- 🔄 **Retry buttons** in the UI
- 🔗 **Direct links** to relevant dashboards/docs

### Interactive Error Handling

When errors occur, you'll see:
```
┌─────────────────────────────────────┐
│ 🔴 Failed to Start Validation       │
│                                     │
│ ⏱️ Request timed out. The edge     │
│ function may not be deployed.       │
│                                     │
│ [Retry] [Check Functions]          │
└─────────────────────────────────────┘
```

**Actions:**
- **Retry** - Immediately retry the operation
- **Check Functions** - Opens Supabase dashboard to verify deployment

For complete error handling documentation, see:
- [ERROR_HANDLING_IMPROVEMENTS.md](ERROR_HANDLING_IMPROVEMENTS.md)
- [FIX_VALIDATION_TIMEOUT.md](FIX_VALIDATION_TIMEOUT.md)
- [PHASE3.2_COMPLETION_SUMMARY.md](PHASE3.2_COMPLETION_SUMMARY.md)

## Documentation

### Setup & Configuration
- [README.md](README.md) - This file
- [MIGRATION_README.md](MIGRATION_README.md) - Migration status
- [APPLY_MIGRATION_GUIDE.md](APPLY_MIGRATION_GUIDE.md) - Database migrations
- [DEPLOY_EDGE_FUNCTIONS.md](DEPLOY_EDGE_FUNCTIONS.md) - Function deployment

### Error Handling
- [ERROR_HANDLING_IMPROVEMENTS.md](ERROR_HANDLING_IMPROVEMENTS.md) - Comprehensive error handling guide
- [FIX_VALIDATION_TIMEOUT.md](FIX_VALIDATION_TIMEOUT.md) - Timeout troubleshooting

### Phase Completion
- [PHASE1_COMPLETE.md](PHASE1_COMPLETE.md)
- [PHASE2_COMPLETION_SUMMARY.md](PHASE2_COMPLETION_SUMMARY.md)
- [PHASE3_COMPLETION_SUMMARY.md](PHASE3_COMPLETION_SUMMARY.md)
- [PHASE3.2_COMPLETION_SUMMARY.md](PHASE3.2_COMPLETION_SUMMARY.md)
- [PHASE3.2_IMPLEMENTATION_STATUS.md](PHASE3.2_IMPLEMENTATION_STATUS.md)
