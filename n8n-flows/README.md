# NytroAI n8n Workflows

## Overview

This directory contains **n8n workflows** that power the NytroAI validation system using **Gemini File API** for simple, reliable document processing and validation.

**Key Benefits**:
✅ **No embeddings** - Direct validation with 1M token context  
✅ **No Pinecone** - Eliminates data sovereignty issues  
✅ **No Unstructured.io** - Gemini handles PDFs natively  
✅ **Supabase Storage** - No AWS dependency  
✅ **Simple architecture** - 2 core workflows + 4 results workflows  

---

## Workflows

### Core Validation Workflows

#### 1. DocumentProcessingFlow_Gemini.json ⭐ **Recommended**

**Purpose**: Upload documents from Supabase Storage to Gemini File API

**Trigger**: Webhook POST `/webhook/document-processing-gemini`

**Input**:
```json
{
  "validation_detail_id": 123,
  "storage_paths": [
    "7148/TLIF0025/validation123/assessment_task.pdf",
    "7148/TLIF0025/validation123/marking_guide.pdf"
  ]
}
```

**Process**:
1. Update status → "AI Learning" (`extractStatus = 'Processing'`)
2. Loop over storage paths
3. Download file from Supabase Storage (`documents` bucket)
4. Upload to Gemini File API (simple multipart upload)
5. Get immediate file URI (no waiting!)
6. Update `documents` table with URI and expiry
7. Aggregate results
8. Update status → "Under Review" (`extractStatus = 'Completed'`)
9. Trigger AIValidationFlow webhook

**Output**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "processed_files": [
    {
      "storage_path": "7148/TLIF0025/validation123/assessment_task.pdf",
      "gemini_file_uri": "files/abc123",
      "gemini_file_name": "assessment_task.pdf",
      "expiry": "2025-01-30T10:30:00Z",
      "success": true
    }
  ]
}
```

**Status Updates**:
- Start: `extractStatus = 'Processing'`
- Success: `extractStatus = 'Completed'`, `docExtracted = true`
- Error: `extractStatus = 'Error'`

---

#### 2. AIValidationFlow_Gemini.json ⭐ **Recommended**

**Purpose**: Validate requirements using Gemini with file references

**Trigger**: Webhook POST `/webhook/validation-processing-gemini`

**Input**:
```json
{
  "validation_detail_id": 123
}
```

**Process**:
1. Fetch validation context (unit_code, RTO, session timestamp)
2. Fetch Gemini file URIs from `documents` table
3. Fetch system prompt from `prompt` table (where `current = true`)
4. **Call `get-requirements` edge function** (database query)
5. Group requirements by type (KE, PE, FS, EPC, AC)
6. For each type:
   - Build prompt with session context
   - Add file URIs as references
   - Call Gemini 2.0 Flash Exp
   - Parse JSON response
   - Store results in `validation_results` table
7. Update status → "Finalised"

**Output**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "total_results": 45,
  "message": "Validation completed successfully"
}
```

**Status Updates**:
- Start: `validationStatus = 'Under Review'`
- Success: `status = 'completed'`, `validationStatus = 'Finalised'`
- Error: `validationStatus = 'Error'`

**Session Context** (included in every Gemini call):
```
**VALIDATION SESSION CONTEXT**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session ID: 123
Session Created: 2025-01-28 10:30:00
Unit Code: BSBWHS211
RTO Code: 7148
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DOCUMENTS FOR THIS SESSION** (3 files):
1. assessment_task.pdf (Uploaded: 2025-01-28 10:30:00)
2. marking_guide.pdf (Uploaded: 2025-01-28 10:30:00)
3. instructions.pdf (Uploaded: 2025-01-28 10:30:00)

IMPORTANT: This is an ISOLATED validation session.
Only consider documents uploaded for THIS session.
```

---

### Results Explorer Workflows

#### 3. ReportGenerationFlow.json

**Purpose**: Generate Markdown report from validation results

**Trigger**: Webhook POST `/webhook/generate-report`

**Input**:
```json
{
  "validation_detail_id": 123
}
```

**Flow**:
1. Fetch validation detail and results
2. Organize results by requirement type
3. Calculate statistics (met, partial, not_met)
4. Generate formatted Markdown report

**Output**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "report": "# Validation Report\n\n...",
  "filename": "validation_report_BSBWHS211_1706400000000.md"
}
```

**Report Sections**:
- Overall Summary (statistics, scores)
- Knowledge Evidence
- Performance Evidence
- Foundation Skills
- Elements & Performance Criteria
- Assessment Conditions

---

#### 4. SingleRequirementRevalidationFlow.json

**Purpose**: Revalidate a single requirement

**Trigger**: Webhook POST `/webhook/revalidate-requirement`

**Input**:
```json
{
  "validation_result_id": 456
}
```

**Use Case**: User clicks "Revalidate" in Results Explorer

**Output**:
```json
{
  "success": true,
  "validation_result_id": 456,
  "status": "met",
  "message": "Requirement revalidated successfully"
}
```

---

#### 5. SmartQuestionRegenerationFlow.json

**Purpose**: Regenerate smart questions for a requirement

**Trigger**: Webhook POST `/webhook/regenerate-questions`

**Input**:
```json
{
  "validation_result_id": 456,
  "user_guidance": "Focus on practical scenarios" // optional
}
```

**Use Case**: User clicks "Regenerate Questions" in Results Explorer

**Output**:
```json
{
  "success": true,
  "validation_result_id": 456,
  "questions": [
    {
      "question": "Describe three methods for...",
      "rationale": "This addresses the gap in...",
      "assessmentType": "written",
      "bloomsLevel": "application"
    }
  ]
}
```

---

#### 6. AIChatFlow.json

**Purpose**: Interactive AI chat about validation results

**Trigger**: Webhook POST `/webhook/ai-chat`

**Input**:
```json
{
  "validation_detail_id": 123,
  "message": "Why was requirement KE-1 marked as partial?",
  "conversation_history": [...]
}
```

**Use Case**: Results Explorer chat interface

**Output**:
```json
{
  "success": true,
  "response": "Requirement KE-1 was marked as partial because...",
  "role": "assistant"
}
```

---

## Storage Options

### Option 1: Supabase Storage ⭐ **Recommended**

**Why Recommended**:
- ✅ No AWS account needed
- ✅ Same credentials as database
- ✅ Simpler configuration
- ✅ Built-in CDN
- ✅ Lower cost for small-medium usage

**Bucket Configuration**:
```
Bucket Name: documents
Public: No (private)
Max File Size: 50 MB (Free), 5 GB (Pro)
Allowed MIME Types: application/pdf, text/plain, image/*
```

**Path Structure**:
```
documents/
  ├── {rto_code}/
  │   ├── {unit_code}/
  │   │   ├── {validation_id}/
  │   │   │   ├── assessment_task.pdf
  │   │   │   ├── marking_guide.pdf
  │   │   │   └── instructions.pdf
```

**Pricing** (100 validations/month, 5MB avg, 3 files):
- Storage: 1.5 GB × $0.021/GB = $0.03/mo
- Bandwidth: 1.5 GB × $0.09/GB = $0.14/mo
- **Total: $0.17/mo** (included in Supabase Pro $25/mo)

---

### Option 2: AWS S3 (Alternative)

**When to Use**:
- Already using AWS infrastructure
- Need > 200 GB storage
- Enterprise compliance requirements

**Bucket Configuration**:
```
Bucket Name: smartrtobucket
Region: ap-southeast-2 (Sydney)
Encryption: AES-256
```

**Pricing** (100 validations/month):
- Storage: $0.03/mo
- Requests: $0.002/mo
- Bandwidth: $0.14/mo
- **Total: $0.17/mo**

**Note**: Requires AWS account and additional configuration

---

## Setup Instructions

### Prerequisites

1. **n8n Instance** (self-hosted or cloud)
2. **Supabase Project** with NytroAI database schema
3. **Google Gemini API Key**
4. **Supabase Storage** bucket named `documents`

### Step 1: Install n8n

**Option A: Self-Hosted** ⭐ **Recommended**

```bash
# Install n8n globally
npm install -g n8n

# Start n8n
n8n start

# Access at http://localhost:5678
```

**Option B: n8n Cloud**

Sign up at https://n8n.io (Starter: $20/mo)

---

### Step 2: Configure Credentials

#### 2.1 Supabase API Credential

1. n8n → Credentials → Add Credential
2. Type: **Supabase**
3. Name: `Supabase account`
4. Configuration:
   - **Host**: `https://your-project.supabase.co`
   - **Service Role Key**: `your_service_role_key`

**Where to Find**:
- Supabase Dashboard → Settings → API
- Copy "service_role" key (keep secret!)

---

#### 2.2 Google Gemini API Credential

1. n8n → Credentials → Add Credential
2. Type: **Google PaLM API** (yes, use this for Gemini!)
3. Name: `Google Gemini API`
4. Configuration:
   - **API Key**: `your_gemini_api_key`

**Where to Get**:
- Go to https://aistudio.google.com/app/apikey
- Click "Create API Key"
- Copy key

---

#### 2.3 Supabase Authorization Header (for edge function)

1. n8n → Credentials → Add Credential
2. Type: **Header Auth**
3. Name: `Supabase Authorization Header`
4. Configuration:
   - **Name**: `Authorization`
   - **Value**: `Bearer your_supabase_anon_key`

**Where to Find**:
- Supabase Dashboard → Settings → API
- Copy "anon" key (public key)

---

### Step 3: Set Environment Variables

**For Self-Hosted n8n**:

Create `.env` file:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# n8n
N8N_HOST=your-domain.com
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://your-domain.com
```

**For n8n Cloud**:

Environment variables are set automatically via credentials.

---

### Step 4: Create Supabase Storage Bucket

**Via Supabase Dashboard**:

1. Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `documents`
4. Public: **No** (keep private)
5. File size limit: 50 MB (or 5 GB on Pro)
6. Allowed MIME types: `application/pdf,text/plain,image/*`
7. Click "Create bucket"

**Via SQL** (alternative):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);
```

---

### Step 5: Import Workflows

#### Import Core Workflows

1. n8n → Workflows → Import from File
2. Select `DocumentProcessingFlow_Gemini.json`
3. Click "Import"
4. Repeat for `AIValidationFlow_Gemini.json`

#### Import Results Explorer Workflows

1. Import `ReportGenerationFlow.json`
2. Import `SingleRequirementRevalidationFlow.json`
3. Import `SmartQuestionRegenerationFlow.json`
4. Import `AIChatFlow.json`

---

### Step 6: Update Credential IDs

Each workflow has placeholder credential IDs that need to be updated.

**In DocumentProcessingFlow_Gemini.json**:

1. Open workflow
2. Click on "Download from Supabase Storage" node
3. Select credential: `Supabase account`
4. Click on "Upload to Gemini" node
5. Select credential: `Google Gemini API`
6. Save workflow

**Repeat for all workflows**.

**Credentials to update**:
- `YOUR_SUPABASE_CREDENTIALS_ID` → `Supabase account`
- `YOUR_GOOGLE_GEMINI_CREDENTIALS_ID` → `Google Gemini API`
- `YOUR_SUPABASE_AUTH_CREDENTIALS_ID` → `Supabase Authorization Header`

---

### Step 7: Deploy Edge Function

The `get-requirements` edge function fetches requirements from database.

```bash
# Navigate to project
cd /path/to/NytroAI

# Deploy edge function
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
    "foundation_skills": [...],
    "elements_performance_criteria": [...],
    "assessment_conditions": [...]
  }
}
```

---

### Step 8: Activate Workflows

1. Open each workflow
2. Click "Active" toggle in top right
3. Verify webhook URL appears

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

### Step 9: Test Workflows

#### Test Document Processing

```bash
curl -X POST 'https://your-n8n.com/webhook/document-processing-gemini' \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 123,
    "storage_paths": [
      "7148/TLIF0025/test123/test.pdf"
    ]
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "processed_files": [...]
}
```

**Check**:
1. n8n → Executions → View latest execution
2. Supabase → Table Editor → `documents` → Verify `gemini_file_uri` populated
3. Supabase → Table Editor → `validation_detail` → Verify `extractStatus = 'Completed'`

---

#### Test Validation

```bash
curl -X POST 'https://your-n8n.com/webhook/validation-processing-gemini' \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 123
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "total_results": 45
}
```

**Check**:
1. n8n → Executions → View latest execution
2. Supabase → Table Editor → `validation_results` → Verify results inserted
3. Supabase → Table Editor → `validation_detail` → Verify `validationStatus = 'Finalised'`

---

## Frontend Integration

### Update Frontend Configuration

**Environment Variables** (`.env.local`):
```bash
# n8n Webhook URLs
NEXT_PUBLIC_N8N_DOCUMENT_PROCESSING_URL=https://your-n8n.com/webhook/document-processing-gemini
NEXT_PUBLIC_N8N_VALIDATION_URL=https://your-n8n.com/webhook/validation-processing-gemini
NEXT_PUBLIC_N8N_REPORT_URL=https://your-n8n.com/webhook/generate-report
NEXT_PUBLIC_N8N_REVALIDATE_URL=https://your-n8n.com/webhook/revalidate-requirement
NEXT_PUBLIC_N8N_REGENERATE_QUESTIONS_URL=https://your-n8n.com/webhook/regenerate-questions
NEXT_PUBLIC_N8N_AI_CHAT_URL=https://your-n8n.com/webhook/ai-chat

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

### Upload Flow (Frontend → Supabase Storage → n8n)

```typescript
// 1. Upload files to Supabase Storage
const uploadedPaths: string[] = [];

for (const file of files) {
  const filePath = `${rtoCode}/${unitCode}/${validationId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) throw error;
  uploadedPaths.push(data.path);
}

// 2. Create document records in database
for (const path of uploadedPaths) {
  await supabase
    .from('documents')
    .insert({
      validation_detail_id: validationId,
      file_name: path.split('/').pop(),
      document_type: 'assessment',
      storage_path: path
    });
}

// 3. Trigger document processing workflow
const response = await fetch(process.env.NEXT_PUBLIC_N8N_DOCUMENT_PROCESSING_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    validation_detail_id: validationId,
    storage_paths: uploadedPaths
  })
});

const result = await response.json();
console.log('Processing started:', result);
```

---

### Poll Status

```typescript
// Poll validation status every 5 seconds
const pollStatus = async () => {
  const { data } = await supabase
    .from('validation_detail')
    .select('extractStatus, validationStatus, status')
    .eq('id', validationId)
    .single();
  
  // extractStatus: 'Not Started' → 'Processing' → 'Completed'
  // validationStatus: 'Not Started' → 'Under Review' → 'Finalised'
  // status: 'pending' → 'completed'
  
  return data;
};

// Use in React component
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await pollStatus();
    
    if (status.validationStatus === 'Finalised') {
      clearInterval(interval);
      // Show results
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [validationId]);
```

---

### Generate Report

```typescript
const generateReport = async (validationDetailId: number) => {
  const response = await fetch(process.env.NEXT_PUBLIC_N8N_REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validation_detail_id: validationDetailId })
  });
  
  const { report, filename } = await response.json();
  
  // Download report
  const blob = new Blob([report], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
};
```

---

## Troubleshooting

### Common Issues

#### Issue: "Failed to download from Supabase Storage"

**Cause**: Incorrect storage path or permissions

**Fix**:
1. Check storage path format: `{rto_code}/{unit_code}/{validation_id}/{filename}`
2. Verify bucket name is `documents`
3. Check RLS policies allow service role access:

```sql
-- Allow service role to read all files
CREATE POLICY "Service role can read all files"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'documents');
```

---

#### Issue: "Gemini API failed: 400 Bad Request"

**Cause**: Invalid file format or size

**Fix**:
1. Check file is PDF (< 50 MB)
2. Verify file is not corrupted
3. Check Gemini API key is valid
4. View n8n execution logs for detailed error

---

#### Issue: "No documents with Gemini URIs found"

**Cause**: Document processing not completed

**Fix**:
1. Check `documents` table has `gemini_file_uri` values
2. Verify `extractStatus = 'Completed'`
3. Check DocumentProcessingFlow execution logs
4. Ensure files uploaded successfully to Gemini

---

#### Issue: "Failed to fetch requirements from edge function"

**Cause**: Edge function not deployed or wrong URL

**Fix**:
1. Deploy edge function: `supabase functions deploy get-requirements`
2. Check edge function URL in AIValidationFlow
3. View edge function logs: `supabase functions logs get-requirements`
4. Verify authorization header is correct

---

### Debugging Tips

**View n8n Execution**:
1. n8n → Executions
2. Find failed execution
3. Click to view details
4. Check each node's input/output
5. Look for error messages

**View Edge Function Logs**:
```bash
supabase functions logs get-requirements --tail
```

**View Database Logs**:
- Supabase Dashboard → Logs → Query Logs

**Test Gemini API Directly**:
```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello"}]
    }]
  }'
```

---

## Performance & Costs

### Processing Times

**Per Validation** (typical assessment):
- Upload to Supabase Storage: 5-10 seconds (3 files)
- Upload to Gemini File API: 30-60 seconds (3 files)
- Validation: 60-120 seconds (5 requirement types)
- **Total**: 95-190 seconds (1.5-3 minutes)

### Costs

**Per Validation**:
- Supabase Storage: $0.0017
- Gemini API: $0.0087
- **Total**: $0.01

**Monthly** (100 validations):
- Supabase Pro: $25.00
- Netlify (Free): $0.00
- n8n (self-hosted): $10.00
- Gemini API: $0.87
- **Total**: $35.87

**See [TECHNICAL_SPECIFICATIONS.md](../docs/TECHNICAL_SPECIFICATIONS.md) for detailed cost breakdowns at all scales.**

---

## Summary

The n8n workflows provide a **simple, reliable, and cost-effective** validation system:

✅ **2 core workflows** - Document processing + validation  
✅ **4 results workflows** - Reports, revalidation, questions, chat  
✅ **1 edge function** - Fast database queries  
✅ **Supabase Storage** - No AWS dependency  
✅ **Gemini File API** - Native PDF vision, no embeddings  
✅ **Perfect session isolation** - No cross-contamination  
✅ **83% cheaper** - $36/mo vs $150-210/mo (old architecture)  

**Result**: Production-ready validation in minutes, not weeks! 🚀
