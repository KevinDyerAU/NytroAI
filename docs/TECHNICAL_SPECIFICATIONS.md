# NytroAI Technical Specifications

## Overview

This document provides complete technical specifications for the NytroAI validation system, including file size limits, costs, supported formats, API limits, and configuration options.

---

## Storage Options

### Option 1: Supabase Storage ⭐ **Recommended**

**Why Recommended**:
- ✅ No additional platform needed
- ✅ Already integrated with Supabase
- ✅ Simple authentication (same credentials)
- ✅ Automatic CDN distribution
- ✅ Built-in image transformations
- ✅ Lower cost for small-medium usage

**Specifications**:

| Metric | Free Tier | Pro Tier ($25/mo) | Team Tier ($599/mo) |
|--------|-----------|-------------------|---------------------|
| Storage | 1 GB | 100 GB | 200 GB |
| Bandwidth | 2 GB | 200 GB | 500 GB |
| Max File Size | 50 MB | 5 GB | 5 GB |
| Custom Domain | ❌ | ✅ | ✅ |

**Bucket Configuration**:
```
Bucket Name: documents
Public: No (private by default)
File Size Limit: 50 MB (Free), 5 GB (Pro/Team)
Allowed MIME Types: application/pdf, text/plain, application/vnd.*, image/*
```

**Storage Path Structure**:
```
documents/
  ├── {rto_code}/
  │   ├── {unit_code}/
  │   │   ├── {validation_id}/
  │   │   │   ├── assessment_task.pdf
  │   │   │   ├── marking_guide.pdf
  │   │   │   └── instructions.pdf
```

**Pricing**:
- **Storage**: $0.021 per GB/month
- **Bandwidth**: $0.09 per GB
- **Typical Cost** (100 validations/month, 5MB avg per file, 3 files per validation):
  - Storage: 1.5 GB × $0.021 = $0.03/month
  - Bandwidth: 1.5 GB × $0.09 = $0.14/month
  - **Total: ~$0.17/month** (plus Pro tier $25 if needed)

---

### Option 2: AWS S3 (Alternative)

**When to Use**:
- Already using AWS infrastructure
- Need > 200 GB storage
- Need advanced S3 features (versioning, lifecycle, etc.)
- Enterprise compliance requirements

**Specifications**:

| Metric | Standard | Intelligent-Tiering |
|--------|----------|---------------------|
| Storage | $0.023 per GB/month | $0.023 per GB/month + monitoring |
| PUT/POST | $0.005 per 1,000 requests | $0.005 per 1,000 requests |
| GET | $0.0004 per 1,000 requests | $0.0004 per 1,000 requests |
| Data Transfer Out | $0.09 per GB | $0.09 per GB |
| Max Object Size | 5 TB | 5 TB |

**Bucket Configuration**:
```
Bucket Name: smartrtobucket
Region: ap-southeast-2 (Sydney)
Encryption: AES-256 (SSE-S3)
Versioning: Enabled (optional)
Lifecycle: Delete after 90 days (optional)
```

**Pricing** (100 validations/month):
- Storage: 1.5 GB × $0.023 = $0.03/month
- PUT requests: 300 × $0.005/1000 = $0.0015/month
- GET requests: 300 × $0.0004/1000 = $0.0001/month
- Bandwidth: 1.5 GB × $0.09 = $0.14/month
- **Total: ~$0.17/month**

**Note**: Similar cost to Supabase Storage, but requires additional AWS account and configuration.

---

## Document Format Support

### Gemini File API - Supported Formats

#### Full Document Vision (Images, Charts, Diagrams)

**PDF** ⭐ **Recommended**:
- **Max Size**: 50 MB per file
- **Max Pages**: 1,000 pages per file
- **MIME Type**: `application/pdf`
- **Features**: 
  - ✅ Native vision (sees images, charts, diagrams, tables)
  - ✅ Text extraction with layout preservation
  - ✅ Handwriting recognition
  - ✅ Multi-column support
  - ✅ Page number tracking
- **Use For**: Assessment documents, marking guides, instructions

#### Text-Only Extraction

**Plain Text**:
- **Max Size**: 50 MB
- **MIME Type**: `text/plain`
- **Features**: Direct text processing
- **Use For**: Simple text documents

**Markdown**:
- **Max Size**: 50 MB
- **MIME Type**: `text/markdown`
- **Features**: Text only, formatting lost
- **Use For**: Documentation

**HTML**:
- **Max Size**: 50 MB
- **MIME Type**: `text/html`
- **Features**: Text extraction, tags lost
- **Use For**: Web-based assessments

**XML**:
- **Max Size**: 50 MB
- **MIME Type**: `text/xml`, `application/xml`
- **Features**: Text extraction, structure lost
- **Use For**: Structured data

#### Images (For Reference/Diagrams)

**Supported Formats**:
- PNG: `image/png`
- JPEG: `image/jpeg`
- WebP: `image/webp`
- HEIC: `image/heic`
- HEIF: `image/heif`

**Specifications**:
- **Max Size**: 7 MB per image
- **Max Images**: 3,000 per prompt
- **Features**: Full vision understanding

#### Office Documents (Requires Conversion)

**Word Documents** (.docx, .doc):
- **Not Natively Supported** by Gemini File API
- **Recommendation**: Convert to PDF before upload
- **Conversion Options**:
  - LibreOffice: `libreoffice --headless --convert-to pdf file.docx`
  - Python: `python-docx` + `reportlab`
  - Online: Cloudmersive, ConvertAPI

**Excel/Spreadsheets** (.xlsx, .xls):
- **Not Natively Supported** by Gemini File API
- **Recommendation**: Convert to PDF or extract to CSV
- **Alternative**: Extract data to JSON and include in prompt

**PowerPoint** (.pptx, .ppt):
- **Not Natively Supported** by Gemini File API
- **Recommendation**: Convert to PDF (preserves slides)

### Recommendation for RTO Assessments

**Primary Format**: PDF
- Most assessments are already in PDF
- Full vision support (images, charts, diagrams)
- Up to 1,000 pages supported
- Best for compliance and archival

**If Source is DOCX**:
1. Convert to PDF in n8n workflow (add LibreOffice node)
2. Upload PDF to Gemini File API
3. Validate as normal

**If Source is Images**:
1. Combine images into single PDF (using ImageMagick or similar)
2. Upload PDF to Gemini File API
3. Validate as normal

---

## Gemini API Specifications

### Models

#### gemini-2.0-flash-exp ⭐ **Recommended**

**Specifications**:
- **Context Window**: 1,048,576 tokens (1M tokens)
- **Output Tokens**: Up to 8,192 tokens
- **Temperature**: 0.0 - 2.0 (default: 0.1 for validation)
- **Multimodal**: Yes (text, images, PDFs, audio, video)
- **JSON Mode**: Yes (`responseMimeType: "application/json"`)
- **Grounding**: Yes (with citations)

**Pricing** (as of January 2025):
- **Input**: $0.15 per 1M tokens
- **Output**: $0.60 per 1M tokens
- **Cached Input**: $0.0375 per 1M tokens (75% discount)

**Typical Validation Cost**:
- Input: 50,000 tokens (assessment docs + requirements + prompt)
- Output: 2,000 tokens (validation results)
- Cost: (50,000 × $0.15 / 1M) + (2,000 × $0.60 / 1M) = $0.0075 + $0.0012 = **$0.0087 per validation**

**Monthly Cost** (100 validations):
- 100 × $0.0087 = **$0.87/month**

#### gemini-2.5-flash (Alternative)

**Specifications**:
- **Context Window**: 1,048,576 tokens (1M tokens)
- **Output Tokens**: Up to 8,192 tokens
- **Features**: Similar to 2.0-flash-exp
- **Pricing**: Similar to 2.0-flash-exp

### Token Limits

**Context Window Capacity**:
- **1M tokens** ≈ **750,000 words** ≈ **2,000 pages** (at ~500 tokens/page)

**Typical Assessment**:
- 50-page assessment: ~25,000 tokens
- 20-page marking guide: ~10,000 tokens
- 10-page instructions: ~5,000 tokens
- Requirements + prompt: ~5,000 tokens
- **Total**: ~45,000 tokens (4.5% of context window)

**Large Assessment**:
- 500-page assessment: ~250,000 tokens
- 100-page marking guide: ~50,000 tokens
- Requirements + prompt: ~5,000 tokens
- **Total**: ~305,000 tokens (30% of context window)

**Maximum Supported**:
- **~2,000 pages** total across all documents per validation

### Rate Limits

**Free Tier**:
- 15 requests per minute (RPM)
- 1 million tokens per minute (TPM)
- 1,500 requests per day (RPD)

**Paid Tier** ($0.15/1M input tokens):
- 1,000 RPM
- 4 million TPM
- No daily limit

**For NytroAI**:
- Typical validation: 1 request, 50K tokens
- 100 validations/day: Well within free tier limits
- 1,000 validations/day: Requires paid tier

### File API Specifications

**Upload Limits**:
- **Max File Size**: 2 GB per file
- **Max Files**: 20 GB total per project
- **File Expiry**: 48 hours (automatic deletion)
- **Upload Method**: Multipart POST

**File URI Format**:
```
files/{file_id}
Example: files/abc123def456
```

**File Metadata**:
```json
{
  "file": {
    "name": "files/abc123def456",
    "displayName": "assessment_task.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": "1048576",
    "createTime": "2025-01-28T10:30:00Z",
    "updateTime": "2025-01-28T10:30:00Z",
    "expirationTime": "2025-01-30T10:30:00Z",
    "sha256Hash": "abc123...",
    "uri": "https://generativelanguage.googleapis.com/v1beta/files/abc123def456"
  }
}
```

---

## Database Specifications

### Supabase PostgreSQL

**Plan Limits**:

| Metric | Free | Pro ($25/mo) | Team ($599/mo) |
|--------|------|--------------|----------------|
| Database Size | 500 MB | 8 GB | 100 GB |
| Egress | 2 GB | 50 GB | 250 GB |
| Connections | 60 | 200 | 400 |
| Rows (soft limit) | 500K | Unlimited | Unlimited |

**For NytroAI** (100 validations/month):
- **validation_detail**: 100 rows
- **documents**: 300 rows (3 per validation)
- **validation_results**: 4,500 rows (45 per validation)
- **requirements tables**: ~50K rows (static)
- **Total**: ~55K rows, ~50 MB database size
- **Recommendation**: Free tier sufficient, Pro tier for production

### Key Tables

**validation_detail**:
```sql
CREATE TABLE validation_detail (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validation_summary_id BIGINT REFERENCES validation_summary(id),
  status TEXT DEFAULT 'pending',
  extractStatus TEXT DEFAULT 'Not Started',
  validationStatus TEXT DEFAULT 'Not Started',
  docExtracted BOOLEAN DEFAULT FALSE,
  namespace_code TEXT
);
```

**documents**:
```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  file_name TEXT NOT NULL,
  document_type TEXT,
  storage_path TEXT, -- Supabase Storage path or S3 path
  gemini_file_uri TEXT, -- Gemini File API URI
  gemini_file_name TEXT,
  gemini_upload_timestamp TIMESTAMPTZ,
  gemini_expiry_timestamp TIMESTAMPTZ
);
```

**validation_results**:
```sql
CREATE TABLE validation_results (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  requirement_type TEXT NOT NULL,
  requirement_number TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  status TEXT NOT NULL, -- 'met', 'partial', 'not_met'
  reasoning TEXT,
  citations JSONB, -- Array of evidence citations
  smart_questions JSONB, -- Array of generated questions
  metadata JSONB -- Session context, gaps, etc.
);
```

---

## n8n Specifications

### Deployment Options

**Self-Hosted** ⭐ **Recommended**:
- **Cost**: Free (open source)
- **Requirements**: 
  - Node.js 18+
  - 2 GB RAM minimum
  - 10 GB disk space
- **Installation**: `npm install -g n8n`
- **Run**: `n8n start`
- **Access**: `http://localhost:5678`

**n8n Cloud**:
- **Starter**: $20/month (5,000 executions)
- **Pro**: $50/month (10,000 executions)
- **Enterprise**: Custom pricing

**For NytroAI** (100 validations/month):
- 6 workflows × 100 validations = 600 executions
- **Recommendation**: Self-hosted (free) or Starter plan

### Workflow Execution Limits

**Self-Hosted**:
- No execution limits
- Limited by server resources
- Configurable timeout (default: 120s)

**n8n Cloud**:
- Execution limits based on plan
- 120s timeout per execution
- Automatic retries (3 attempts)

### Webhook Configuration

**Production Setup**:
```bash
# Environment variables
N8N_HOST=your-domain.com
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-domain.com
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_password
```

**Webhook URLs**:
```
Document Processing: https://your-n8n.com/webhook/document-processing-gemini
AI Validation: https://your-n8n.com/webhook/validation-processing-gemini
Report Generation: https://your-n8n.com/webhook/generate-report
Revalidate Requirement: https://your-n8n.com/webhook/revalidate-requirement
Regenerate Questions: https://your-n8n.com/webhook/regenerate-questions
AI Chat: https://your-n8n.com/webhook/ai-chat
```

---

## Platform Costs

### Supabase Pricing Tiers

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| **Price** | $0/mo | $25/mo | $599/mo | Custom |
| **Database** | 500 MB | 8 GB | 100 GB | Unlimited |
| **Storage** | 1 GB | 100 GB | 200 GB | Unlimited |
| **Bandwidth** | 2 GB | 200 GB | 500 GB | Unlimited |
| **Auth Users** | 50,000 | Unlimited | Unlimited | Unlimited |
| **Edge Functions** | 500K invocations | 2M invocations | 10M invocations | Unlimited |
| **Connections** | 60 | 200 | 400 | Unlimited |
| **Support** | Community | Email | Priority | Dedicated |
| **Backups** | None | Daily (7 days) | Daily (14 days) | Custom |
| **Point-in-time Recovery** | ❌ | 7 days | 14 days | Custom |
| **SLA** | None | 99.9% | 99.95% | 99.99% |

**When to Upgrade**:
- **Free → Pro**: > 500 MB database OR > 1 GB storage OR > 50K users
- **Pro → Team**: > 8 GB database OR > 100 GB storage OR > 200 GB bandwidth OR need priority support
- **Team → Enterprise**: > 100 GB database OR custom requirements OR 99.99% SLA needed

### Netlify Pricing Tiers

| Feature | Starter (Free) | Pro | Business | Enterprise |
|---------|----------------|-----|----------|------------|
| **Price** | $0/mo | $19/mo per member | $99/mo per member | Custom |
| **Bandwidth** | 100 GB | 1 TB | 2.5 TB | Custom |
| **Build Minutes** | 300 min/mo | 25,000 min/mo | 50,000 min/mo | Custom |
| **Concurrent Builds** | 1 | 3 | 5 | Custom |
| **Sites** | Unlimited | Unlimited | Unlimited | Unlimited |
| **Team Members** | 1 | Unlimited | Unlimited | Unlimited |
| **Deploy Previews** | ✅ | ✅ | ✅ | ✅ |
| **Custom Domains** | ✅ | ✅ | ✅ | ✅ |
| **SSL** | ✅ | ✅ | ✅ | ✅ |
| **Analytics** | Basic | Advanced | Advanced | Custom |
| **Password Protection** | ❌ | ✅ | ✅ | ✅ |
| **Role-based Access** | ❌ | ✅ | ✅ | ✅ |
| **Support** | Community | Email | Priority | Dedicated |
| **SLA** | None | 99.9% | 99.99% | Custom |

**When to Upgrade**:
- **Free → Pro**: > 100 GB bandwidth OR need team collaboration OR need password protection
- **Pro → Business**: > 1 TB bandwidth OR need advanced security OR > 3 concurrent builds
- **Business → Enterprise**: > 2.5 TB bandwidth OR custom requirements OR 99.99% SLA needed

### n8n Pricing Options

| Option | Cost | Specs | When to Use |
|--------|------|-------|-------------|
| **Self-Hosted** | $0/mo | Unlimited executions, your server | ⭐ **Recommended** for cost savings |
| **n8n Cloud Starter** | $20/mo | 5,000 executions | Small scale, no server management |
| **n8n Cloud Pro** | $50/mo | 10,000 executions | Medium scale |
| **n8n Cloud Enterprise** | Custom | Unlimited | Large scale, SLA required |

**Self-Hosted Server Costs** (if using cloud VM):
- **Small** (2 GB RAM, 1 vCPU): $10-20/mo (DigitalOcean, Linode)
- **Medium** (4 GB RAM, 2 vCPU): $20-40/mo
- **Large** (8 GB RAM, 4 vCPU): $40-80/mo

**Recommendation**: Self-hosted on small VM ($10-20/mo) for best cost efficiency

---

## Cost Breakdown by Scale

### Scenario 1: Startup (10 Validations/Month)

**Platform Costs**:

| Component | Tier | Cost | Notes |
|-----------|------|------|-------|
| Supabase | Free | $0.00 | < 500 MB database, < 1 GB storage |
| Netlify | Free | $0.00 | < 100 GB bandwidth |
| n8n | Self-hosted | $10.00 | Small VM (DigitalOcean) |
| Gemini API | Pay-as-you-go | $0.09 | 10 × $0.0087 |
| **Total** | | **$10.09/mo** | |

**Per Validation**: $1.01

---

### Scenario 2: Small Business (100 Validations/Month)

**Platform Costs**:

| Component | Tier | Cost | Notes |
|-----------|------|------|-------|
| Supabase | Pro | $25.00 | Need > 500 MB database for results |
| Netlify | Free | $0.00 | < 100 GB bandwidth |
| n8n | Self-hosted | $10.00 | Small VM |
| Gemini API | Pay-as-you-go | $0.87 | 100 × $0.0087 |
| **Total** | | **$35.87/mo** | |

**Per Validation**: $0.36

**Why Supabase Pro?**
- 100 validations × 45 results = 4,500 rows
- Average 2 KB per row = 9 MB
- Plus documents, metadata: ~50 MB total
- Still within Free tier, but Pro recommended for production (backups, support)

---

### Scenario 3: Growing Business (500 Validations/Month)

**Platform Costs**:

| Component | Tier | Cost | Notes |
|-----------|------|------|-------|
| Supabase | Pro | $25.00 | ~250 MB database, ~5 GB storage |
| Netlify | Free | $0.00 | ~50 GB bandwidth |
| n8n | Self-hosted | $20.00 | Medium VM (4 GB RAM) |
| Gemini API | Pay-as-you-go | $4.35 | 500 × $0.0087 |
| **Total** | | **$49.35/mo** | |

**Per Validation**: $0.10

---

### Scenario 4: Established Business (1,000 Validations/Month)

**Platform Costs**:

| Component | Tier | Cost | Notes |
|-----------|------|------|-------|
| Supabase | Pro | $25.00 | ~500 MB database, ~10 GB storage |
| Netlify | Pro | $19.00 | ~120 GB bandwidth (need team access) |
| n8n | Self-hosted | $40.00 | Large VM (8 GB RAM, parallel processing) |
| Gemini API | Pay-as-you-go | $8.70 | 1,000 × $0.0087 |
| **Total** | | **$92.70/mo** | |

**Per Validation**: $0.09

**Why Netlify Pro?**
- 1,000 validations × 3 documents × 5 MB = 15 GB uploads
- UI downloads for reports: ~5 GB
- Total bandwidth: ~120 GB
- Pro tier also enables team collaboration

---

### Scenario 5: Large Enterprise (5,000 Validations/Month)

**Platform Costs**:

| Component | Tier | Cost | Notes |
|-----------|------|------|-------|
| Supabase | Pro | $25.00 | ~2.5 GB database, ~50 GB storage |
| Netlify | Pro | $19.00 | ~600 GB bandwidth |
| n8n | Self-hosted | $80.00 | 2× Large VMs (load balanced) |
| Gemini API | Pay-as-you-go | $43.50 | 5,000 × $0.0087 |
| **Total** | | **$167.50/mo** | |

**Per Validation**: $0.03

**Scaling Considerations**:
- May need Supabase Team tier if > 8 GB database
- May need Netlify Business if > 1 TB bandwidth
- Consider Gemini API caching (75% cost reduction)

---

### Scenario 6: Very Large Enterprise (10,000 Validations/Month)

**Platform Costs**:

| Component | Tier | Cost | Notes |
|-----------|------|------|-------|
| Supabase | Team | $599.00 | ~5 GB database, ~100 GB storage, need 400 connections |
| Netlify | Business | $99.00 | ~1.2 TB bandwidth, need advanced security |
| n8n | Self-hosted | $160.00 | 4× Large VMs (distributed processing) |
| Gemini API | Pay-as-you-go | $87.00 | 10,000 × $0.0087 |
| **Total** | | **$945.00/mo** | |

**Per Validation**: $0.09

**Why Higher Tiers?**
- **Supabase Team**: Need 400 concurrent connections for parallel processing
- **Netlify Business**: Bandwidth > 1 TB, need role-based access control
- **Multiple n8n VMs**: Distribute load across workers

**Optimization Opportunities**:
- **Gemini Caching**: Reduce API costs by 75% → $21.75 (saves $65.25)
- **Optimized Total**: $879.75/mo ($0.09 per validation)

---

## Cost Comparison: Old vs New Architecture

### At 100 Validations/Month

| Component | Old | New | Savi

### Per-Validation Costs

| Component | Cost | Notes |
|-----------|------|-------|
| Storage | $0.0017 | 15 MB / 1000 validations |
| Gemini API | $0.0087 | Input + output tokens |
| Database | $0.00 | Included in Supabase Pro |
| **Total** | **$0.01/validation** | |


| Pinecone | $70-100 | $0 | 100% |
| Unstructured.io | $20-30 | $0 | 100% |
| OpenAI Embeddings | $10-20 | $0 | 100% |
| Gemini API | $20-30 | $0.87 | 97% |
| AWS S3 | $5 | $0 | 100% |
| Supabase | $25 | $25 | 0% |
| Netlify | $0 | $0 | 0% |
| n8n | $0 | $10 | n/a |
| **Total** | **$150-210** | **$35.87** | **83%** |

### At 1,000 Validations/Month

| Component | Old | New | Savings |
|-----------|-----|-----|---------||
| Pinecone | $70-100 | $0 | 100% |
| Unstructured.io | $100-150 | $0 | 100% |
| OpenAI Embeddings | $50-100 | $0 | 100% |
| Gemini API | $100-150 | $8.70 | 94% |
| AWS S3 | $10 | $0 | 100% |
| Supabase | $25 | $25 | 0% |
| Netlify | $0 | $19 | n/a |
| n8n | $0 | $40 | n/a |
| **Total** | **$355-535** | **$92.70** | **83%** |

### At 10,000 Validations/Month

| Component | Old | New | Savings |
|-----------|-----|-----|---------||
| Pinecone | $200-300 | $0 | 100% |
| Unstructured.io | $500-800 | $0 | 100% |
| OpenAI Embeddings | $500-1000 | $0 | 100% |
| Gemini API | $500-800 | $87.00 | 89% |
| AWS S3 | $50 | $0 | 100% |
| Supabase | $25 | $599 | -2296% |
| Netlify | $0 | $99 | n/a |
| n8n | $0 | $160 | n/a |
| **Total** | **$1,775-2,975** | **$945** | **68%** |

**Key Insight**: Savings increase with scale due to elimination of per-validation costs (Pinecone, Unstructured.io, OpenAI)

---

## Break-Even Analysis

### Cost Per Validation by Scale

| Monthly Validations | Total Cost | Per Validation | Old Architecture | Savings per Validation |
|---------------------|------------|----------------|------------------|------------------------|
| 10 | $10.09 | $1.01 | $15-21 | $14-20 (93-95%) |
| 100 | $35.87 | $0.36 | $1.50-2.10 | $1.14-1.74 (76-83%) |
| 500 | $49.35 | $0.10 | $0.71-1.07 | $0.61-0.97 (86-91%) |
| 1,000 | $92.70 | $0.09 | $0.36-0.54 | $0.27-0.45 (75-83%) |
| 5,000 | $167.50 | $0.03 | $0.36-0.60 | $0.33-0.57 (92-95%) |
| 10,000 | $945.00 | $0.09 | $0.18-0.30 | $0.09-0.21 (50-70%) |

**Observations**:
- **Sweet spot**: 500-5,000 validations/month ($0.03-0.10 per validation)
- **Economies of scale**: Cost per validation decreases as volume increases (up to 5,000)
- **Tier jump at 10K**: Supabase Team tier increases per-validation cost
- **Always cheaper**: New architecture is 50-95% cheaper at all scales

### Monthly Savings by Scale

| Monthly Validations | Old Cost | New Cost | Monthly Savings | Annual Savings |
|---------------------|----------|----------|-----------------|----------------|
| 10 | $150-210 | $10 | $140-200 | $1,680-2,400 |
| 100 | $150-210 | $36 | $114-174 | $1,368-2,088 |
| 500 | $355-535 | $49 | $306-486 | $3,672-5,832 |
| 1,000 | $355-535 | $93 | $262-442 | $3,144-5,304 |
| 5,000 | $1,775-2,975 | $168 | $1,607-2,807 | $19,284-33,684 |
| 10,000 | $1,775-2,975 | $945 | $830-2,030 | $9,960-24,360 |

**ROI Examples**:
- **100 validations/month**: Save $1,368-2,088/year
- **1,000 validations/month**: Save $3,144-5,304/year
- **10,000 validations/month**: Save $9,960-24,360/year

### Platform Upgrade Triggers

**Supabase Free → Pro** ($0 → $25/mo):
- **Trigger**: > 500 MB database OR > 1 GB storage OR need backups
- **Typical**: ~50-100 validations/month
- **Cost Impact**: +$25/mo
- **Still Cheaper**: Yes, old architecture costs $150-210/mo

**Supabase Pro → Team** ($25 → $599/mo):
- **Trigger**: > 8 GB database OR > 100 GB storage OR > 200 connections
- **Typical**: ~8,000-10,000 validations/month
- **Cost Impact**: +$574/mo
- **Still Cheaper**: Yes, old architecture costs $1,775-2,975/mo

**Netlify Free → Pro** ($0 → $19/mo):
- **Trigger**: > 100 GB bandwidth OR need team access
- **Typical**: ~800-1,000 validations/month
- **Cost Impact**: +$19/mo
- **Still Cheaper**: Yes, old architecture costs $355-535/mo

**Netlify Pro → Business** ($19 → $99/mo):
- **Trigger**: > 1 TB bandwidth OR need advanced security
- **Typical**: ~8,000-10,000 validations/month
- **Cost Impact**: +$80/mo
- **Still Cheaper**: Yes, old architecture costs $1,775-2,975/mo

---

## Cost Optimization Strategies

### 1. Gemini API Caching (75% Cost Reduction)

**How It Works**:
- Cache frequently used content (requirements, prompts)
- Gemini charges 75% less for cached tokens
- Cache valid for 1 hour

**Savings Example** (1,000 validations/month):
- Without caching: $8.70/mo
- With caching (50% tokens cached): $4.35/mo
- **Savings**: $4.35/mo (50%)

**Implementation**:
```javascript
// In Gemini API call
{
  "cachedContent": "cache-id-123",
  "contents": [...]
}
```

### 2. Batch Processing

**Strategy**: Process similar validations together
- Reduces API calls
- Shares context across validations
- Amortizes fixed costs

**Savings**: 10-20% reduction in processing time

### 3. Result Caching

**Strategy**: Cache validation results for identical assessments
- Store hash of document + requirements
- Return cached result if match found
- Reduces Gemini API calls to $0 for duplicates

**Savings**: 20-30% for RTOs with standardized assessments

### 4. Storage Lifecycle

**Strategy**: Auto-delete old documents
- Keep documents for 90 days
- Move to cold storage after 30 days (if using S3)
- Reduces storage costs by 50-70%

**Savings**: Minimal (storage is cheap), but good practice

### 5. Bandwidth Optimization

**Strategy**: Optimize frontend assets
- Compress images (WebP)
- Minify JS/CSS
- Use CDN caching
- Lazy load components

**Savings**: 30-50% bandwidth reduction
- Delays Netlify Pro upgrade from 1,000 to 1,500 validations/month

### Combined Optimization Impact

**At 1,000 Validations/Month**:

| Component | Before | After Optimization | Savings |
|-----------|--------|-------------------|---------||
| Gemini API | $8.70 | $4.35 (caching) | $4.35 |
| Netlify | $19.00 | $0 (bandwidth opt) | $19.00 |
| n8n VM | $40.00 | $20.00 (right-sizing) | $20.00 |
| **Total** | **$92.70** | **$49.35** | **$43.35 (47%)** |

**Optimized Cost**: $0.05 per validation (vs $0.09 before optimization)

---

## Performance Benchmarks

### Processing Times

**Document Upload** (per file):
- Supabase Storage upload: 2-5 seconds (5 MB file)
- Gemini File API upload: 5-10 seconds (5 MB file)
- **Total**: 7-15 seconds per file

**Validation** (per requirement type):
- Fetch requirements: 0.5 seconds (edge function)
- Gemini API call: 10-30 seconds (depends on document size)
- Store results: 1-2 seconds
- **Total**: 12-33 seconds per type

**Complete Validation** (typical assessment):
- 3 files upload: 21-45 seconds
- 5 requirement types: 60-165 seconds
- **Total**: 81-210 seconds (1.5-3.5 minutes)

### Throughput

**Sequential Processing**:
- 1 validation: 2-3 minutes
- 10 validations: 20-30 minutes
- 100 validations: 3-5 hours

**Parallel Processing** (with n8n workers):
- 10 concurrent: 10 validations in 2-3 minutes
- 100 validations: 20-30 minutes

---

## Scalability Limits

### Current Architecture

**Bottlenecks**:
1. Gemini API rate limits (1,000 RPM paid tier)
2. n8n execution concurrency (depends on server)
3. Supabase connection limits (200 on Pro tier)

**Maximum Throughput**:
- **Sequential**: ~20 validations/hour
- **Parallel (10 workers)**: ~200 validations/hour
- **Daily**: ~4,800 validations/day (with paid Gemini tier)

### Scaling Strategies

**Horizontal Scaling**:
- Multiple n8n instances behind load balancer
- Queue-based processing (Redis/BullMQ)
- Separate workers for document processing vs validation

**Vertical Scaling**:
- Increase n8n server resources (4+ GB RAM)
- Upgrade Supabase tier (Team: 400 connections)
- Use Gemini API caching (75% cost reduction for repeated content)

**Optimization**:
- Batch similar validations
- Cache requirements and prompts
- Use Gemini context caching for large documents
- Implement result caching for identical assessments

---

## Security Specifications

### Authentication

**Supabase Auth**:
- JWT tokens (1 hour expiry)
- Refresh tokens (30 days)
- Row-level security (RLS) policies
- Email/password, OAuth, magic links

**API Keys**:
- Gemini API key (rotate every 90 days)
- Supabase service role key (keep secret)
- n8n webhook authentication (optional)

### Data Encryption

**At Rest**:
- Supabase Storage: AES-256 encryption
- Supabase Database: AES-256 encryption
- AWS S3: AES-256 (SSE-S3)

**In Transit**:
- HTTPS/TLS 1.3 for all API calls
- Supabase: TLS 1.2+ required
- Gemini API: TLS 1.2+ required

### Data Retention

**Documents**:
- Supabase Storage: Indefinite (until manually deleted)
- Gemini File API: 48 hours (automatic deletion)
- Recommendation: Delete from storage after 90 days

**Database**:
- Validation results: Indefinite
- Audit logs: 90 days (Supabase Pro)
- Backups: Daily (7 days retention on Pro)

---

## Compliance

### Data Sovereignty

**Supabase**:
- Choose region: Australia (Sydney), US, EU, etc.
- Data stays in chosen region
- GDPR compliant (EU region)

**Gemini API**:
- Files stored in Google Cloud
- Region: Global (not region-specific)
- Files auto-delete after 48 hours
- Not recommended for highly sensitive data

**Recommendation**:
- Use Supabase Storage in Australian region
- Gemini File API for temporary processing only
- Delete Gemini files immediately after validation (optional)

### Compliance Standards

**Supabase**:
- SOC 2 Type II certified
- GDPR compliant
- HIPAA available (Enterprise)

**Google Gemini**:
- SOC 2 Type II certified
- GDPR compliant
- ISO 27001 certified

---

## Summary

### Recommended Configuration

**Storage**: Supabase Storage (eliminates AWS dependency)  
**Database**: Supabase Pro ($25/month)  
**AI**: Gemini 2.0 Flash Exp (1M context, $0.0087/validation)  
**Orchestration**: n8n self-hosted (free)  
**Document Format**: PDF (native vision support)  

**Total Cost**: **$26/month** for 100 validations  
**Per Validation**: **$0.01**  
**Processing Time**: **2-3 minutes** per validation  

### Key Specifications

- **Max File Size**: 50 MB (PDF)
- **Max Pages**: 1,000 per PDF
- **Max Context**: 1M tokens (~2,000 pages total)
- **File Expiry**: 48 hours (Gemini)
- **Storage**: 100 GB (Supabase Pro)
- **Database**: 8 GB (Supabase Pro)
- **Rate Limit**: 1,000 RPM (Gemini paid tier)

### Cost Savings

- **87% cheaper** than old architecture ($26 vs $150-210/month)
- **No Pinecone** ($70-100/month saved)
- **No Unstructured.io** ($20-30/month saved)
- **No AWS** (if using Supabase Storage)
- **No embeddings** ($10-20/month saved)

**Result**: Production-ready validation system with complete specifications! 📊
