# Troubleshooting Guide

This guide helps you fix common issues with NytroAI.

---

## Setup Issues

### "Command not found: npm"

**Problem:** Node.js is not installed.

**Solution:**
1. Install Node.js from [nodejs.org](https://nodejs.org)
2. Choose the LTS (Long Term Support) version
3. Restart your terminal
4. Try again

---

### "Command not found: supabase"

**Problem:** Supabase CLI is not installed.

**Solution:**
```bash
# Install Supabase CLI
npm install -g supabase

# Verify installation
supabase --version
```

---

### "Failed to link project"

**Problem:** Incorrect Supabase project reference.

**Solution:**
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project
3. Go to Settings → General
4. Copy your "Reference ID"
5. Run: `supabase link --project-ref YOUR_REFERENCE_ID`

---

## API Key Issues

### "Invalid API key"

**Problem:** API key is incorrect or not set.

**Solution:**
1. Check your `.env.local` file exists in the project root
2. Verify the API keys are correct (no extra spaces)
3. For Gemini: Get a new key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. For Supabase: Get keys from Project Settings → API
5. Restart the development server: `npm run dev`

---

### "API key not found"

**Problem:** Environment variables not loaded.

**Solution:**
1. Make sure the file is named `.env.local` (not `.env` or `env.local`)
2. Place it in the project root directory (same folder as `package.json`)
3. Restart the development server
4. Clear browser cache and reload

---

## Upload Issues

### "Upload failed"

**Problem:** File upload to Supabase storage failed.

**Solution:**
1. Check file size (must be under 50MB)
2. Check file format (must be PDF)
3. Verify Supabase storage bucket is created
4. Check storage permissions in Supabase dashboard

---

### "File processing stuck"

**Problem:** Document indexing is taking too long.

**Solution:**
1. Wait 2-3 minutes (large files take longer)
2. Check Supabase Edge Functions logs for errors
3. Verify Gemini API quota hasn't been exceeded
4. Try uploading a smaller file to test

---

## Validation Issues

### "Validation not starting"

**Problem:** Validation doesn't trigger after upload.

**Solution:**
1. **Check database trigger is set up:**
   ```bash
   supabase db push
   ```

2. **Verify edge functions are deployed:**
   ```bash
   supabase functions list
   ```

3. **Deploy missing functions:**
   ```bash
   supabase functions deploy trigger-validation
   supabase functions deploy validate-assessment
   ```

4. **Check edge function logs:**
   - Go to Supabase Dashboard
   - Navigate to Edge Functions
   - Check logs for errors

---

### "Validation stuck at 'Processing'"

**Problem:** Validation started but never completes.

**Solution:**
1. **Check edge function logs** in Supabase dashboard
2. **Verify API quota** - You may have hit rate limits
3. **Wait 5 minutes** - Sometimes it's just slow
4. **Try again** - Click the validation to retry

---

### "Request timeout"

**Problem:** Edge function took too long to respond.

**Solution:**
1. **Check edge functions are deployed:**
   ```bash
   supabase functions list
   ```

2. **Redeploy functions:**
   ```bash
   supabase functions deploy validate-assessment
   ```

3. **Check Gemini API status** - Service may be down
4. **Try a smaller assessment** - Large files take longer

---

## Results Issues

### "No results found"

**Problem:** Validation completed but results don't display.

**Solution:**
1. **Refresh the page** - Results may not have loaded
2. **Check validation status** - It may still be processing
3. **Check database** - Results may not have been saved
4. **Check browser console** for errors (F12 → Console tab)

---

### "Smart questions not generating"

**Problem:** No smart questions appear for gaps.

**Solution:**
1. **Check if requirement is "Met"** - No questions needed
2. **Try regenerating** - Click the regenerate button
3. **Add context** - Provide additional context when regenerating
4. **Check API quota** - You may have hit rate limits

---

## Dashboard Issues

### "Dashboard shows no validations"

**Problem:** Dashboard is empty even after validations.

**Solution:**
1. **Check you're logged in** to the correct account
2. **Refresh the page** - Data may not have loaded
3. **Check database** - Validations may not have been saved
4. **Clear browser cache** - Old data may be cached

---

### "Dashboard not updating"

**Problem:** New validations don't appear in dashboard.

**Solution:**
1. **Click the refresh button** in the dashboard
2. **Check real-time subscriptions** - May be disconnected
3. **Reload the page** - Force a full refresh
4. **Check Supabase status** - Service may be down

---

## Database Issues

### "Could not choose the best candidate function"

**Problem:** Database function signature mismatch.

**Solution:**
```bash
# Apply latest migrations
supabase db push

# Verify in SQL Editor (Supabase Dashboard)
```

---

### "Column does not exist"

**Problem:** Database schema is outdated.

**Solution:**
```bash
# Pull latest code
git pull origin main

# Apply migrations
supabase db push

# Restart application
npm run dev
```

---

## Performance Issues

### "Application is slow"

**Problem:** UI is laggy or unresponsive.

**Solution:**
1. **Clear browser cache** - Old data may be slowing things down
2. **Close unused tabs** - Free up browser memory
3. **Check network connection** - Slow internet affects performance
4. **Restart browser** - Fresh start often helps

---

### "Validation takes too long"

**Problem:** Validation is taking 5+ minutes.

**Solution:**
1. **Check file size** - Larger files take longer
2. **Check number of requirements** - More requirements = longer time
3. **Check API rate limits** - You may be throttled
4. **Try during off-peak hours** - API may be busy

---

## Browser Issues

### "Page not loading"

**Problem:** Blank page or loading forever.

**Solution:**
1. **Check console for errors** (F12 → Console tab)
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Try incognito/private mode** - Rules out extensions
4. **Try different browser** - May be browser-specific issue

---

### "Login not working"

**Problem:** Can't log in to the application.

**Solution:**
1. **Check Supabase authentication** is enabled
2. **Verify email/password** are correct
3. **Check email for verification link**
4. **Try password reset** if forgotten
5. **Check Supabase Auth logs** for errors

---

## Still Having Issues?

If none of these solutions work:

1. **Check the logs:**
   - Browser console (F12 → Console)
   - Supabase Edge Functions logs
   - Supabase Database logs

2. **Search existing issues:**
   - [GitHub Issues](https://github.com/KevinDyerAU/NytroAI/issues)

3. **Create a new issue:**
   - Include error messages
   - Include steps to reproduce
   - Include browser/OS information
   - Include screenshots if helpful

4. **Ask for help:**
   - [GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)

---

## Getting Help

When asking for help, please include:

1. **What you were trying to do**
2. **What happened instead**
3. **Error messages** (exact text or screenshots)
4. **Steps to reproduce** the issue
5. **Your environment:**
   - Operating System (Windows/Mac/Linux)
   - Browser (Chrome/Firefox/Safari/Edge)
   - Node.js version (`node --version`)
   - NytroAI version (from `package.json`)

This helps us help you faster! 🚀
