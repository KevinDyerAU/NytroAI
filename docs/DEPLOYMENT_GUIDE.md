# NytroAI Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the simplified NytroAI validation system using **Supabase Storage**, **Gemini File API**, and **n8n workflows**.

**Deployment Time**: 30-60 minutes  
**Difficulty**: Intermediate  
**Prerequisites**: Basic command line knowledge, Supabase account, Gemini API key  

---

## Architecture Overview

```
┌─────────────┐
│   Netlify   │ Frontend (React/Next.js)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Storage    │  │  PostgreSQL  │  │ Edge Function│  │
│  │  (documents) │  │   Database   │  │(requirements)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                        ┌─────────────┐
│     n8n     │ Workflows              │   Gemini    │ AI Validation
│ (self-host) │                        │  File API   │
└─────────────┘                        └─────────────┘
```

---

## Prerequisites

### Required Accounts

1. **Supabase Account** (Free or Pro)
   - Sign up: https://supabase.com
   - Create new project
   - Note: Project URL, anon key, service role key

2. **Google Gemini API Key**
   - Get key: https://aistudio.google.com/app/apikey
   - Note: API key

3. **Netlify Account** (Free or Pro)
   - Sign up: https://netlify.com
   - Connect GitHub repository

4. **Server for n8n** (optional if using n8n Cloud)
   - DigitalOcean, Linode, or AWS EC2
   - Minimum: 2 GB RAM, 1 vCPU
   - Recommended: 4 GB RAM, 2 vCPU

### Required Software

- Node.js 18+ (for local development)
- Git
- Supabase CLI (for edge functions)
- n8n (self-hosted or cloud)

---

## Phase 1: Supabase Setup

### Step 1.1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Fill in details:
   - **Name**: nytroai-prod
   - **Database Password**: (generate strong password)
   - **Region**: Australia Southeast (Sydney) or closest region
   - **Pricing Plan**: Pro ($25/mo recommended for production)
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning

### Step 1.2: Note Credentials

1. Go to Settings → API
2. Copy and save:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (keep secret!)

### Step 1.3: Run Database Migrations

```bash
# Clone repository
git clone https://github.com/KevinDyerAU/NytroAI.git
cd NytroAI

# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Verify tables created
supabase db diff
```

**Expected Tables**:
- `RTO`
- `validation_summary`
- `validation_detail`
- `documents`
- `validation_results`
- `knowledge_evidence`
- `performance_evidence`
- `foundation_skills`
- `elements_performance_criteria`
- `assessment_conditions`
- `prompt`

### Step 1.4: Create Storage Bucket

**Via Dashboard**:
1. Go to Storage → Buckets
2. Click "New bucket"
3. Name: `documents`
4. Public: **No** (keep private)
5. File size limit: 50 MB (Free) or 5 GB (Pro)
6. Allowed MIME types: `application/pdf,text/plain,image/*`
7. Click "Create bucket"

**Via SQL** (alternative):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf', 'text/plain', 'image/png', 'image/jpeg']
);
```

### Step 1.5: Configure Storage Policies

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow service role full access
CREATE POLICY "Service role has full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'documents');
```

### Step 1.6: Deploy Edge Function

```bash
# Deploy get-requirements edge function
supabase functions deploy get-requirements

# Set secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Test edge function
curl -X POST 'https://your-project.supabase.co/functions/v1/get-requirements' \
  -H "Authorization: Bearer your_anon_key" \
  -H "Content-Type: application/json" \
  -d '{"unitLink": "https://training.gov.au/Training/Details/BSBWHS211"}'
```

**Expected Response**:
```json
{
  "success": true,
  "requirements": {
    "knowledge_evidence": [...],
    "performance_evidence": [...],
    ...
  }
}
```

---

## Phase 2: n8n Setup

### Option A: Self-Hosted n8n ⭐ **Recommended**

#### Step 2.1: Provision Server

**DigitalOcean Example**:
1. Go to https://www.digitalocean.com
2. Create → Droplets
3. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($20/mo - 4 GB RAM, 2 vCPU)
   - **Datacenter**: Sydney or closest region
   - **Authentication**: SSH key
4. Click "Create Droplet"
5. Note IP address

#### Step 2.2: Install n8n

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install n8n globally
npm install -g n8n

# Install PM2 for process management
npm install -g pm2

# Create n8n user
useradd -m -s /bin/bash n8n

# Create n8n directory
mkdir -p /home/n8n/.n8n
chown -R n8n:n8n /home/n8n
```

#### Step 2.3: Configure n8n

```bash
# Create environment file
cat > /home/n8n/.n8n/.env << EOF
N8N_HOST=your-domain.com
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-domain.com
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_secure_password

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini
GEMINI_API_KEY=your_gemini_api_key
EOF

# Set permissions
chown n8n:n8n /home/n8n/.n8n/.env
chmod 600 /home/n8n/.n8n/.env
```

#### Step 2.4: Start n8n with PM2

```bash
# Start n8n as n8n user
su - n8n -c "pm2 start n8n -- start"

# Save PM2 configuration
su - n8n -c "pm2 save"

# Setup PM2 startup script
pm2 startup systemd -u n8n --hp /home/n8n

# Verify n8n is running
pm2 list
```

#### Step 2.5: Configure Nginx Reverse Proxy

```bash
# Install Nginx
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration
cat > /etc/nginx/sites-available/n8n << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

#### Step 2.6: Access n8n

1. Go to https://your-domain.com
2. Login with credentials from `.env`
3. You should see n8n dashboard

---

### Option B: n8n Cloud

1. Go to https://n8n.io
2. Sign up for Starter plan ($20/mo)
3. Create new instance
4. Note instance URL: `https://your-instance.app.n8n.cloud`

---

### Step 2.7: Configure Credentials in n8n

#### Supabase API Credential

1. n8n → Credentials → Add Credential
2. Type: **Supabase**
3. Name: `Supabase account`
4. Configuration:
   - **Host**: `https://your-project.supabase.co`
   - **Service Role Key**: `your_service_role_key`
5. Click "Save"

#### Google Gemini API Credential

1. n8n → Credentials → Add Credential
2. Type: **Google PaLM API**
3. Name: `Google Gemini API`
4. Configuration:
   - **API Key**: `your_gemini_api_key`
5. Click "Save"

#### Supabase Authorization Header

1. n8n → Credentials → Add Credential
2. Type: **Header Auth**
3. Name: `Supabase Authorization Header`
4. Configuration:
   - **Name**: `Authorization`
   - **Value**: `Bearer your_supabase_anon_key`
5. Click "Save"

---

### Step 2.8: Import Workflows

1. Download workflow files from `n8n-flows/` directory
2. n8n → Workflows → Import from File
3. Import in order:
   - `DocumentProcessingFlow_Gemini.json`
   - `AIValidationFlow_Gemini.json`
   - `ReportGenerationFlow.json`
   - `SingleRequirementRevalidationFlow.json`
   - `SmartQuestionRegenerationFlow.json`
   - `AIChatFlow.json`

### Step 2.9: Update Credential IDs

For each imported workflow:

1. Open workflow
2. Click on nodes with credentials
3. Select appropriate credential from dropdown:
   - Supabase nodes → `Supabase account`
   - Gemini nodes → `Google Gemini API`
   - HTTP nodes (edge function) → `Supabase Authorization Header`
4. Save workflow

### Step 2.10: Activate Workflows

1. Open each workflow
2. Click "Active" toggle in top right
3. Note webhook URLs:
   - Document Processing: `https://your-n8n.com/webhook/document-processing-gemini`
   - AI Validation: `https://your-n8n.com/webhook/validation-processing-gemini`
   - Report Generation: `https://your-n8n.com/webhook/generate-report`
   - Revalidate Requirement: `https://your-n8n.com/webhook/revalidate-requirement`
   - Regenerate Questions: `https://your-n8n.com/webhook/regenerate-questions`
   - AI Chat: `https://your-n8n.com/webhook/ai-chat`

---

## Phase 3: Frontend Deployment

### Step 3.1: Configure Environment Variables

Create `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# n8n Webhooks
NEXT_PUBLIC_N8N_DOCUMENT_PROCESSING_URL=https://your-n8n.com/webhook/document-processing-gemini
NEXT_PUBLIC_N8N_VALIDATION_URL=https://your-n8n.com/webhook/validation-processing-gemini
NEXT_PUBLIC_N8N_REPORT_URL=https://your-n8n.com/webhook/generate-report
NEXT_PUBLIC_N8N_REVALIDATE_URL=https://your-n8n.com/webhook/revalidate-requirement
NEXT_PUBLIC_N8N_REGENERATE_QUESTIONS_URL=https://your-n8n.com/webhook/regenerate-questions
NEXT_PUBLIC_N8N_AI_CHAT_URL=https://your-n8n.com/webhook/ai-chat
```

### Step 3.2: Deploy to Netlify

#### Via Netlify Dashboard

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub
4. Select repository: `KevinDyerAU/NytroAI`
5. Configure build settings:
   - **Base directory**: (leave empty)
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
6. Add environment variables (from `.env.local`)
7. Click "Deploy site"

#### Via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

### Step 3.3: Configure Custom Domain (Optional)

1. Netlify Dashboard → Domain settings
2. Click "Add custom domain"
3. Enter domain: `nytroai.com`
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (automatic)

---

## Phase 4: Testing & Verification

### Step 4.1: Test Document Upload

```bash
# Create test validation
curl -X POST 'https://your-project.supabase.co/rest/v1/validation_detail' \
  -H "apikey: your_anon_key" \
  -H "Authorization: Bearer your_anon_key" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "validation_summary_id": 1,
    "status": "pending"
  }'

# Note validation_detail_id from response

# Upload test file to Supabase Storage
curl -X POST 'https://your-project.supabase.co/storage/v1/object/documents/test/test.pdf' \
  -H "apikey: your_anon_key" \
  -H "Authorization: Bearer your_anon_key" \
  -H "Content-Type: application/pdf" \
  --data-binary '@test.pdf'

# Trigger document processing
curl -X POST 'https://your-n8n.com/webhook/document-processing-gemini' \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 1,
    "storage_paths": ["test/test.pdf"]
  }'
```

**Expected**:
- n8n execution succeeds
- `documents` table has `gemini_file_uri`
- `validation_detail.extractStatus = 'Completed'`

### Step 4.2: Test Validation

```bash
# Trigger validation
curl -X POST 'https://your-n8n.com/webhook/validation-processing-gemini' \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 1
  }'
```

**Expected**:
- n8n execution succeeds
- `validation_results` table has results
- `validation_detail.validationStatus = 'Finalised'`

### Step 4.3: Test Frontend

1. Go to https://your-netlify-site.netlify.app
2. Login with test account
3. Upload test assessment
4. Verify status updates:
   - "Document Upload" → "AI Learning" → "Under Review" → "Finalised"
5. View validation results
6. Generate report
7. Test revalidation, question regeneration, AI chat

---

## Phase 5: Monitoring & Maintenance

### Step 5.1: Setup Monitoring

**Supabase Monitoring**:
1. Supabase Dashboard → Reports
2. Monitor:
   - Database size
   - Storage usage
   - API requests
   - Edge function invocations

**n8n Monitoring**:
1. n8n → Executions
2. Monitor:
   - Execution success rate
   - Average execution time
   - Failed executions

**Netlify Monitoring**:
1. Netlify Dashboard → Analytics
2. Monitor:
   - Bandwidth usage
   - Build minutes
   - Page views

### Step 5.2: Setup Alerts

**Supabase Alerts**:
- Database > 80% capacity
- Storage > 80% capacity
- High error rate

**n8n Alerts**:
- Failed workflow executions
- Long execution times (> 5 minutes)

**Netlify Alerts**:
- Bandwidth > 80% of limit
- Build failures

### Step 5.3: Backup Strategy

**Database Backups**:
- Supabase Pro: Daily backups (7 days retention)
- Supabase Team: Daily backups (14 days retention)
- Manual backups: `supabase db dump > backup.sql`

**Storage Backups**:
- Optional: Sync to S3 for long-term archival
- Lifecycle: Delete documents after 90 days

**Configuration Backups**:
- n8n workflows: Export JSON files regularly
- Environment variables: Store in password manager

### Step 5.4: Performance Optimization

**Database**:
- Add indexes on frequently queried columns
- Vacuum regularly
- Monitor slow queries

**n8n**:
- Increase server resources if needed
- Enable workflow caching
- Batch similar validations

**Gemini API**:
- Enable context caching (75% cost reduction)
- Monitor token usage
- Optimize prompts

---

## Phase 6: Scaling

### When to Scale

**Supabase Free → Pro** ($0 → $25/mo):
- Trigger: > 500 MB database OR > 50 validations/month
- Benefits: Backups, better support, more storage

**Supabase Pro → Team** ($25 → $599/mo):
- Trigger: > 8 GB database OR > 8,000 validations/month
- Benefits: 400 connections, priority support, 14-day backups

**Netlify Free → Pro** ($0 → $19/mo):
- Trigger: > 100 GB bandwidth OR > 800 validations/month
- Benefits: Team collaboration, password protection

**n8n Self-Hosted Scaling**:
- Small → Medium VM: > 500 validations/month
- Medium → Large VM: > 2,000 validations/month
- Multiple VMs: > 5,000 validations/month

### Scaling Checklist

- [ ] Monitor metrics weekly
- [ ] Set up alerts for thresholds
- [ ] Review costs monthly
- [ ] Optimize before scaling
- [ ] Test in staging before production
- [ ] Document changes

---

## Troubleshooting

### Issue: Supabase Storage Upload Fails

**Symptoms**: 403 Forbidden or 401 Unauthorized

**Solutions**:
1. Check RLS policies allow authenticated users to upload
2. Verify anon key is correct
3. Check file size < 50 MB (or 5 GB on Pro)
4. Verify MIME type is allowed

### Issue: n8n Workflow Fails

**Symptoms**: Execution shows error

**Solutions**:
1. Check n8n execution logs for detailed error
2. Verify credentials are configured correctly
3. Test each node individually
4. Check network connectivity to Supabase/Gemini

### Issue: Gemini API Rate Limit

**Symptoms**: 429 Too Many Requests

**Solutions**:
1. Upgrade to paid Gemini tier (1,000 RPM)
2. Add retry logic with exponential backoff
3. Batch validations to reduce requests
4. Enable context caching

### Issue: Frontend Not Loading

**Symptoms**: Blank page or 404

**Solutions**:
1. Check Netlify build logs
2. Verify environment variables are set
3. Check Supabase URL and anon key
4. Clear browser cache

---

## Cost Summary

### Startup (10 validations/month)

| Component | Cost |
|-----------|------|
| Supabase Free | $0 |
| Netlify Free | $0 |
| n8n (small VM) | $10 |
| Gemini API | $0.09 |
| **Total** | **$10.09/mo** |

### Small Business (100 validations/month)

| Component | Cost |
|-----------|------|
| Supabase Pro | $25 |
| Netlify Free | $0 |
| n8n (small VM) | $10 |
| Gemini API | $0.87 |
| **Total** | **$35.87/mo** |

### Growing Business (1,000 validations/month)

| Component | Cost |
|-----------|------|
| Supabase Pro | $25 |
| Netlify Pro | $19 |
| n8n (large VM) | $40 |
| Gemini API | $8.70 |
| **Total** | **$92.70/mo** |

**See [TECHNICAL_SPECIFICATIONS.md](TECHNICAL_SPECIFICATIONS.md) for detailed cost breakdowns.**

---

## Security Checklist

- [ ] Use strong passwords for all accounts
- [ ] Enable 2FA on Supabase, Netlify, n8n
- [ ] Keep service role key secret (never commit to Git)
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS for all services
- [ ] Configure RLS policies on Supabase
- [ ] Restrict n8n access with basic auth
- [ ] Regularly rotate API keys
- [ ] Monitor for suspicious activity
- [ ] Keep all software updated

---

## Next Steps

1. **Test thoroughly** - Run multiple validations to verify system
2. **Monitor costs** - Track usage and optimize as needed
3. **Gather feedback** - Get user feedback and iterate
4. **Optimize performance** - Tune based on real-world usage
5. **Scale gradually** - Upgrade tiers as needed
6. **Document changes** - Keep deployment docs updated

---

## Support

**Documentation**:
- [Architecture](ARCHITECTURE.md)
- [Technical Specifications](TECHNICAL_SPECIFICATIONS.md)
- [n8n Workflows README](../n8n-flows/README.md)

**Community**:
- GitHub Issues: https://github.com/KevinDyerAU/NytroAI/issues
- Supabase Discord: https://discord.supabase.com
- n8n Community: https://community.n8n.io

**Commercial Support**:
- Supabase: support@supabase.io
- n8n: support@n8n.io

---

## Summary

You now have a **production-ready NytroAI validation system** deployed with:

✅ **Supabase** - Database, storage, edge functions  
✅ **n8n** - Workflow orchestration  
✅ **Gemini File API** - AI-powered validation  
✅ **Netlify** - Frontend hosting  
✅ **83% cost savings** - vs old architecture  
✅ **2-3 minute validations** - Fast and reliable  

**Total deployment time**: 30-60 minutes  
**Monthly cost**: $35.87 (100 validations)  
**Per validation**: $0.36  

🎉 **Congratulations! Your simplified validation system is live!**
