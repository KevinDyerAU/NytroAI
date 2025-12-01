# Security Cleanup Guide

## ⚠️ Important: Secrets Were Exposed

The `.env` file containing sensitive credentials was previously committed to the repository. This file has now been removed, but **the secrets are still in git history**.

---

## 🔐 What Was Exposed

The following secrets were in the `.env` file:

1. **Supabase URL:** `https://dfqxmjmggokneiuljkta.supabase.co`
2. **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. **Supabase Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (⚠️ CRITICAL)
4. **n8n Webhook URLs:** Multiple webhook endpoints

---

## ✅ What We Did

1. ✅ Removed `.env` from repository
2. ✅ Added `.env` to `.gitignore`
3. ✅ Added comprehensive ignore rules for secrets

---

## 🚨 CRITICAL: Rotate Your Secrets

**The secrets are still in git history!** You MUST rotate them immediately:

### 1. Rotate Supabase Service Role Key

This is the most critical secret. It has full database access.

**Steps:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/dfqxmjmggokneiuljkta
2. Navigate to **Settings** → **API**
3. Click **Reset Service Role Key**
4. Update your local `.env` file with the new key
5. Update any deployed services (n8n, edge functions, etc.)

### 2. Rotate Supabase Anon Key (Optional but Recommended)

**Steps:**
1. Go to Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Click **Reset Anon Key**
4. Update your local `.env` file
5. Redeploy your frontend application

### 3. Update n8n Webhook URLs (If Needed)

If the webhook URLs should be private:
1. Regenerate webhook URLs in n8n
2. Update your local `.env` file
3. Redeploy frontend

---

## 🧹 Optional: Clean Git History

If you want to completely remove secrets from git history:

### Option 1: Using BFG Repo-Cleaner (Recommended)

```bash
# Install BFG
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror https://github.com/KevinDyerAU/NytroAI.git

# Remove .env from history
bfg --delete-files .env NytroAI.git

# Clean up
cd NytroAI.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force
```

### Option 2: Using git filter-branch

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

git push --force --all
git push --force --tags
```

⚠️ **Warning:** Force pushing rewrites history and will affect all collaborators!

---

## 📋 Post-Cleanup Checklist

After rotating secrets:

- [ ] Rotated Supabase Service Role Key
- [ ] Rotated Supabase Anon Key (optional)
- [ ] Updated local `.env` file with new keys
- [ ] Updated n8n workflows with new Supabase keys
- [ ] Redeployed edge functions (if they use service role key)
- [ ] Redeployed frontend application
- [ ] Verified application still works
- [ ] (Optional) Cleaned git history
- [ ] Notified team members to pull latest changes

---

## 🛡️ Prevention: How to Avoid This in the Future

### 1. Never Commit .env Files

The `.gitignore` now includes:
```
.env
.env.local
.env.*.local
*.env
*secret*
*credentials*
```

### 2. Use .env.example Templates

Keep example files with placeholder values:
```bash
# .env.example
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Pre-Commit Hooks

Install a pre-commit hook to prevent committing secrets:

```bash
# .git/hooks/pre-commit
#!/bin/sh
if git diff --cached --name-only | grep -q "\.env$"; then
    echo "Error: Attempting to commit .env file!"
    echo "Please remove it from the commit."
    exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### 4. Use Secret Scanning Tools

Install tools like:
- **git-secrets:** https://github.com/awslabs/git-secrets
- **gitleaks:** https://github.com/gitleaks/gitleaks
- **truffleHog:** https://github.com/trufflesecurity/truffleHog

---

## 📚 Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

## 🔍 Check for Other Exposed Secrets

Search the repository for other potential secrets:

```bash
# Search for common secret patterns
git grep -i "api.key"
git grep -i "password"
git grep -i "secret"
git grep -i "token"
git grep -E "eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*"  # JWT pattern
```

---

## ⚡ Quick Action Items

**RIGHT NOW:**
1. Rotate Supabase Service Role Key (CRITICAL)
2. Update local `.env` with new key
3. Redeploy services that use the key

**SOON:**
1. Rotate Supabase Anon Key
2. Clean git history (optional)
3. Set up pre-commit hooks

---

**Status:** ✅ `.env` removed from repository  
**Next Step:** 🔴 **ROTATE SECRETS IMMEDIATELY**

---

**Last Updated:** 2025-12-01  
**Created By:** Manus AI
