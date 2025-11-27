# NytroAI n8n Workflows - Simplified Validation Architecture

## Overview

This directory contains **6 n8n workflows** that implement a simplified validation architecture eliminating Pinecone embeddings in favor of direct document processing with Gemini 2.0's 1M token context window.

## Architecture Benefits

✅ **No Pinecone** - Eliminates data sovereignty issues and embedding costs  
✅ **Faster Processing** - No embedding generation delay  
✅ **Simpler Flow** - Clear, maintainable workflows  
✅ **Better Performance** - Direct text aggregation from database  
✅ **Multi-Document Support** - Proper context separation per validation  
✅ **Lower Cost** - No Pinecone subscription (~$70-100/month savings)

---

## Workflows

### 1. DocumentProcessingFlow.json
**Purpose**: Process uploaded documents via Unstructured.io and store in `elements` table

**Trigger**: Webhook POST `/webhook/document-processing`

**Input**:
```json
{
  "validation_detail_id": 123,
  "s3_paths": [
    "s3://smartrtobucket/7148/TLIF0025/assessment_task.pdf",
    "s3://smartrtobucket/7148/TLIF0025/marking_guide.pdf"
  ]
}
```

**Flow**:
1. Update status → "AI Learning" (`extractStatus = 'Processing'`)
2. Loop over S3 paths
3. Call fastunstructapi for each file
4. Verify elements stored in database
5. Update status → "Under Review" (`extractStatus = 'Completed'`)
6. Trigger validation flow

**Output**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "message": "Validation triggered successfully"
}
```

---

### 2. AIValidationFlow.json
**Purpose**: Validate requirements against documents using Gemini 2.0 Flash

**Trigger**: Webhook POST `/webhook/validation-processing`

**Input**:
```json
{
  "validation_detail_id": 123
}
```

**Flow**:
1. Fetch validation context (unit_code, unitLink, rto_code)
2. Fetch document paths from `documents` table
3. **Aggregate document text from `elements` table with clear document separation**
4. Fetch system prompt from `prompt` table (where `current = true`)
5. Fetch all requirements by unitLink
6. Group requirements by type
7. Loop: Call Gemini 2.0 Flash for each requirement type
8. Parse AI response (JSON)
9. Store results in `validation_results` table
10. Update status → "Finalised"

**Key Feature**: Multi-document aggregation with document markers:
```
═══════════════════════════════════════════════════════════════
DOCUMENT: Assessment_Task_BSBWHS211.pdf
Type: Assessment Task
Source File: assessment_task.pdf
═══════════════════════════════════════════════════════════════

[PAGE 1]
{content}

[PAGE 2]
{content}

═══════════════════════════════════════════════════════════════
DOCUMENT: Marking_Guide_BSBWHS211.pdf
Type: Marking Guide
Source File: marking_guide.pdf
═══════════════════════════════════════════════════════════════

[PAGE 1]
{content}
```

**Output**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "total_results": 45,
  "message": "Validation completed successfully"
}
```

---

### 3. ReportGenerationFlow.json
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
  "filename": "validation_report_TLIF0025_1738000000000.md"
}
```

**Report Sections**:
- Overall Summary (statistics, scores)
- Knowledge Evidence
- Performance Evidence
- Foundation Skills
- Elements & Performance Criteria
- Assessment Conditions

Each requirement includes:
- Status emoji (✅ met, ⚠️ partial, ❌ not met)
- Requirement text
- Reasoning
- Evidence found (with citations)
- Smart questions (if gaps exist)

---

### 4. SingleRequirementRevalidationFlow.json
**Purpose**: Revalidate a single requirement with updated AI analysis

**Trigger**: Webhook POST `/webhook/revalidate-requirement`

**Input**:
```json
{
  "validation_result_id": 456
}
```

**Flow**:
1. Fetch validation result by ID
2. Fetch validation context
3. Fetch all documents for this validation
4. Aggregate document text (multi-document)
5. Build focused prompt for single requirement
6. Call Gemini 2.0 Flash
7. Parse response
8. Update `validation_results` table

**Use Case**: User clicks "Revalidate" button in Results Explorer after modifying documents or disagreeing with initial assessment

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

### 5. SmartQuestionRegenerationFlow.json
**Purpose**: Regenerate smart questions for a specific requirement

**Trigger**: Webhook POST `/webhook/regenerate-questions`

**Input**:
```json
{
  "validation_result_id": 456,
  "user_guidance": "Focus on practical scenarios" // optional
}
```

**Flow**:
1. Fetch validation result
2. Fetch validation context
3. Extract gaps from metadata
4. Build question generation prompt
5. Call Gemini 2.0 Flash (temperature: 0.7 for creativity)
6. Parse generated questions
7. Update `smart_questions` field

**Use Case**: User clicks "Regenerate Questions" in Results Explorer to get alternative suggestions

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
  ],
  "message": "Smart questions regenerated successfully"
}
```

---

### 6. AIChatFlow.json
**Purpose**: Interactive AI chat about validation results

**Trigger**: Webhook POST `/webhook/ai-chat`

**Input**:
```json
{
  "validation_detail_id": 123,
  "message": "Why was requirement KE-1 marked as partial?",
  "conversation_history": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ]
}
```

**Flow**:
1. Fetch validation context
2. Fetch all validation results
3. Fetch all documents
4. Aggregate document text (multi-document)
5. Build chat context with:
   - Validation summary
   - All results grouped by type
   - Full document text (truncated if > 50K tokens)
6. Call Gemini 2.0 Flash with conversation history
7. Return AI response

**Use Case**: Results Explorer chat interface for users to ask questions about validation

**Output**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "message": "Requirement KE-1 was marked as partial because...",
  "role": "assistant"
}
```

---

## Multi-Document Context Handling

### Database Query Pattern

All flows use this pattern to maintain document context isolation:

```sql
SELECT 
  e.text,
  e.filename,
  e.page_number,
  e.type as element_type,
  d.file_name as document_name,
  d.document_type,
  d.storage_path,
  d.id as document_id
FROM documents d
JOIN elements e ON e.url = d.storage_path
WHERE d.validation_detail_id = :validation_detail_id
ORDER BY d.created_at, d.file_name, e.page_number;
```

**Key Points**:
- ✅ Each validation has its own documents via `validation_detail_id`
- ✅ Documents linked to elements via `storage_path = url`
- ✅ Clear ordering: creation time → file name → page number
- ✅ No cross-contamination between validations

### Document Aggregation Strategy

```javascript
const documentSeparator = '═'.repeat(63);
let aggregatedText = '';
let currentDocumentId = null;

for (const element of elements) {
  // New document section
  if (element.document_id !== currentDocumentId) {
    aggregatedText += documentSeparator + '\n';
    aggregatedText += `DOCUMENT: ${element.document_name}\n`;
    aggregatedText += `Type: ${element.document_type}\n`;
    aggregatedText += documentSeparator + '\n\n';
    currentDocumentId = element.document_id;
  }
  
  // Page marker
  if (element.page_number) {
    aggregatedText += `[PAGE ${element.page_number}]\n`;
  }
  
  // Content
  aggregatedText += element.text + '\n\n';
}
```

**Benefits**:
- Clear visual separation between documents
- AI can reference specific documents in citations
- Page numbers are document-relative
- Maintains context across multiple files

---

## Setup Instructions

### Prerequisites

1. **n8n Instance** - Self-hosted or cloud
2. **Supabase Project** - With NytroAI database schema
3. **Google Gemini API Key** - For AI validation
4. **fastunstructapi** - Running at `https://fastunstructpostgres.onrender.com`

### Installation Steps

1. **Import Workflows**
   ```bash
   # In n8n UI: Settings → Import from File
   # Import each JSON file from this directory
   ```

2. **Configure Credentials**
   
   Each workflow needs:
   - **Supabase API**: Your Supabase URL and anon key
   - **Google Gemini API**: Your Gemini API key
   
   Update credential IDs in each workflow:
   ```json
   "credentials": {
     "supabaseApi": {
       "id": "YOUR_SUPABASE_CREDENTIALS_ID",
       "name": "Supabase account"
     },
     "googlePalmApi": {
       "id": "YOUR_GOOGLE_GEMINI_CREDENTIALS_ID",
       "name": "Google Gemini API"
     }
   }
   ```

3. **Activate Workflows**
   - Enable all 6 workflows in n8n
   - Note webhook URLs for frontend integration

4. **Update Frontend**
   
   Replace existing API calls with new webhook URLs:
   
   ```typescript
   // After S3 upload
   const response = await fetch('https://your-n8n.com/webhook/document-processing', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       validation_detail_id: detailId,
       s3_paths: uploadedPaths
     })
   });
   
   // Generate report
   const report = await fetch('https://your-n8n.com/webhook/generate-report', {
     method: 'POST',
     body: JSON.stringify({ validation_detail_id: detailId })
   });
   
   // Revalidate requirement
   const revalidate = await fetch('https://your-n8n.com/webhook/revalidate-requirement', {
     method: 'POST',
     body: JSON.stringify({ validation_result_id: resultId })
   });
   
   // Regenerate questions
   const questions = await fetch('https://your-n8n.com/webhook/regenerate-questions', {
     method: 'POST',
     body: JSON.stringify({ 
       validation_result_id: resultId,
       user_guidance: 'Focus on practical scenarios'
     })
   });
   
   // AI Chat
   const chat = await fetch('https://your-n8n.com/webhook/ai-chat', {
     method: 'POST',
     body: JSON.stringify({
       validation_detail_id: detailId,
       message: userMessage,
       conversation_history: chatHistory
     })
   });
   ```

---

## Testing

### Test Workflow 1: Document Processing

```bash
curl -X POST https://your-n8n.com/webhook/document-processing \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 123,
    "s3_paths": [
      "s3://smartrtobucket/7148/TLIF0025/test.pdf"
    ]
  }'
```

**Expected**: 
- Status updated to "Processing"
- Unstructured.io called
- Elements stored in database
- Status updated to "Completed"
- Validation flow triggered

### Test Workflow 2: AI Validation

```bash
curl -X POST https://your-n8n.com/webhook/validation-processing \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 123
  }'
```

**Expected**:
- Documents aggregated with separators
- Requirements fetched
- AI validation completed
- Results stored in `validation_results`
- Status updated to "Finalised"

### Test Workflow 3: Report Generation

```bash
curl -X POST https://your-n8n.com/webhook/generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 123
  }'
```

**Expected**: Markdown report with all validation results

### Test Workflow 4: Single Requirement Revalidation

```bash
curl -X POST https://your-n8n.com/webhook/revalidate-requirement \
  -H "Content-Type: application/json" \
  -d '{
    "validation_result_id": 456
  }'
```

**Expected**: Updated validation result with new status and reasoning

### Test Workflow 5: Smart Question Regeneration

```bash
curl -X POST https://your-n8n.com/webhook/regenerate-questions \
  -H "Content-Type: application/json" \
  -d '{
    "validation_result_id": 456,
    "user_guidance": "Focus on workplace scenarios"
  }'
```

**Expected**: New set of smart questions

### Test Workflow 6: AI Chat

```bash
curl -X POST https://your-n8n.com/webhook/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": 123,
    "message": "Why was requirement KE-1 marked as partial?"
  }'
```

**Expected**: Contextual AI response about the validation

---

## Error Handling

All workflows include:

1. **Retry Logic**: Gemini API calls retry 3 times with exponential backoff
2. **Status Updates**: Database status updated on success/failure
3. **Error Responses**: Clear error messages returned to frontend
4. **Logging**: Console logs for debugging

### Common Issues

**Issue**: "No requirements found"  
**Solution**: Ensure `validation_summary.reqExtracted = true` and requirements exist in requirement tables

**Issue**: "Elements not found"  
**Solution**: Verify Unstructured.io processed files and stored in `elements` table with correct `url` field

**Issue**: "Gemini API timeout"  
**Solution**: Check document size (should be < 500K tokens), increase timeout, or split into chunks

**Issue**: "Document context mixing"  
**Solution**: Verify `validation_detail_id` filtering in SQL queries

---

## Performance Considerations

### Token Limits

- **Gemini 2.0 Flash**: 1,048,576 tokens (1M)
- **Average document**: 50 pages = ~25K tokens
- **Safe limit**: 20 documents × 50 pages = 500K tokens
- **Buffer**: 500K tokens for requirements, prompts, responses

### Optimization Tips

1. **Batch Requirements**: Group by type to reduce API calls
2. **Cache Results**: Store validation results for reuse
3. **Parallel Processing**: Validate requirement types in parallel (future enhancement)
4. **Selective Aggregation**: For very large documents, aggregate only relevant sections

---

## Migration from Old System

### Removed Components

- ❌ `useIndexingProcessor` hook
- ❌ `gemini_operations` table polling
- ❌ Gemini File Search API calls
- ❌ Pinecone vector storage
- ❌ OpenAI embedding generation
- ❌ Complex database triggers

### Simplified Flow

**Old**:
```
Upload → S3 → Edge Function → Gemini File Search → gemini_operations → 
Polling → Database Trigger → HTTP Call → validate-assessment
```

**New**:
```
Upload → S3 → n8n DocumentProcessing → elements table → 
n8n AIValidation → validation_results
```

**Reduction**: 8 steps → 4 steps (50% simpler)

---

## Future Enhancements

### Phase 2: Move to Supabase Edge Functions

If n8n proves unreliable, migrate workflows to Supabase Edge Functions:

```typescript
// supabase/functions/document-processing/index.ts
serve(async (req) => {
  const { validation_detail_id, s3_paths } = await req.json();
  
  // Same logic as n8n workflow
  for (const s3Path of s3_paths) {
    await processWithUnstructured(s3Path);
  }
  
  // Trigger validation
  await triggerValidation(validation_detail_id);
});
```

**Benefits**:
- Better Supabase integration
- Easier deployment
- Version control with Git
- TypeScript type safety

### Phase 3: Parallel Processing

Validate requirement types in parallel:

```typescript
const validationPromises = requirementTypes.map(type => 
  validateRequirementType(type, documents, requirements)
);

const results = await Promise.all(validationPromises);
```

**Benefit**: 5x faster validation (5 types in parallel)

### Phase 4: Intelligent Chunking

For 1000+ page documents, chunk by section:

```typescript
const chunks = intelligentChunk(documents, maxTokens: 400000);

for (const chunk of chunks) {
  await validateChunk(chunk, requirements);
}

const mergedResults = mergeChunkResults(results);
```

---

## Support

For issues or questions:
1. Check n8n execution logs
2. Review Supabase database status
3. Verify Gemini API quota
4. Check fastunstructapi health

## License

MIT License - See main NytroAI repository

---

**Last Updated**: January 28, 2025  
**Version**: 1.0.0  
**Author**: NytroAI Team
