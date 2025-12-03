# Amazon Bedrock Parallel Operation Strategy

**Date:** December 2, 2025  
**Version:** 1.0  
**Status:** Implementation Ready

## Overview

This document outlines the strategy for running Gemini and Amazon Bedrock (Claude 3.5 Sonnet) in parallel, allowing gradual migration with zero downtime and easy rollback.

---

## Architecture: Parallel Operation

### Current State (Gemini Only)
```
User Request
    ↓
n8n Webhook
    ↓
Fetch Documents (Supabase Storage)
    ↓
Upload to Gemini → Get fileUri
    ↓
Gemini API (with fileUri)
    ↓
Parse Response
    ↓
Save to validation_results (Supabase)
```

### Target State (Parallel Operation)
```
User Request
    ↓
n8n Webhook
    ↓
Check AI Provider Flag (validation_detail.ai_provider)
    ↓
    ├─ "gemini" → Gemini Flow (existing)
    │       ↓
    │   Upload to Gemini → Get fileUri
    │       ↓
    │   Gemini API
    │
    └─ "bedrock" → Bedrock Flow (new)
            ↓
        Fetch Document from Supabase Storage
            ↓
        Extract Text & Chunk (pgvector)
            ↓
        Retrieve Relevant Chunks
            ↓
        Bedrock API (Claude 3.5 Sonnet)
    ↓
Parse Response (unified format)
    ↓
Save to validation_results (Supabase)
```

---

## Database Changes

### 1. Add AI Provider Column to validation_detail

```sql
-- Add ai_provider column with default 'gemini'
ALTER TABLE validation_detail 
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini' 
  CHECK (ai_provider IN ('gemini', 'bedrock'));

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_validation_detail_ai_provider 
  ON validation_detail(ai_provider);

-- Add metadata column for provider-specific data
ALTER TABLE validation_detail 
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;
```

### 2. Create pgvector Extension and Document Chunks Table

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  validation_detail_id BIGINT NOT NULL REFERENCES validation_detail(id) ON DELETE CASCADE,
  
  -- Chunk content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Vector embedding (1536 dimensions for text-embedding-3-small)
  embedding vector(1536),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  CONSTRAINT unique_document_chunk UNIQUE (document_id, chunk_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
  ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_validation_detail_id 
  ON document_chunks(validation_detail_id);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

### 3. Create RPC Function for Vector Similarity Search

```sql
-- Function to search for similar chunks
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_validation_detail_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  document_id bigint,
  chunk_text text,
  chunk_index integer,
  chunk_metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_text,
    document_chunks.chunk_index,
    document_chunks.chunk_metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  FROM document_chunks
  WHERE 
    (filter_validation_detail_id IS NULL OR document_chunks.validation_detail_id = filter_validation_detail_id)
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## n8n Workflow Changes

### 1. Add AI Provider Router Node

**Node Name:** "Route by AI Provider"  
**Type:** Switch  
**Position:** After "Fetch Validation Context"

**Configuration:**
```json
{
  "mode": "rules",
  "rules": {
    "rules": [
      {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.ai_provider }}",
              "operation": "equals",
              "value2": "bedrock"
            }
          ]
        },
        "output": 0
      },
      {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.ai_provider }}",
              "operation": "equals",
              "value2": "gemini"
            }
          ]
        },
        "output": 1
      }
    ]
  },
  "fallbackOutput": 1
}
```

**Outputs:**
- Output 0: Bedrock Flow
- Output 1: Gemini Flow (existing)
- Fallback: Gemini Flow (default)

### 2. Bedrock Flow Nodes

#### Node 2.1: Fetch Documents from Supabase Storage

**Node Name:** "Fetch Documents (Bedrock)"  
**Type:** Supabase  
**Operation:** Get Many

**Configuration:**
```json
{
  "operation": "getMany",
  "tableId": "documents",
  "returnAll": true,
  "filters": {
    "conditions": [
      {
        "keyName": "validation_detail_id",
        "condition": "equals",
        "keyValue": "={{ $json.validation_detail_id }}"
      }
    ]
  }
}
```

#### Node 2.2: Check if Documents are Chunked

**Node Name:** "Check if Chunked"  
**Type:** Code (JavaScript)

**Code:**
```javascript
// Check if documents already have chunks in pgvector
const validationDetailId = $input.first().json.validation_detail_id;

// Query to check if chunks exist
const query = `
  SELECT COUNT(*) as chunk_count 
  FROM document_chunks 
  WHERE validation_detail_id = ${validationDetailId}
`;

// Execute query via Supabase
// This will be handled by a Postgres node in the actual workflow

return { 
  validation_detail_id: validationDetailId,
  needs_chunking: true  // Will be set based on query result
};
```

#### Node 2.3: Extract Text and Chunk Documents (If Needed)

**Node Name:** "Extract & Chunk Documents"  
**Type:** Code (JavaScript)  
**Condition:** Only if needs_chunking = true

**Code:**
```javascript
// This node will:
// 1. Download PDF from Supabase Storage
// 2. Extract text using pdf-parse or similar
// 3. Split into chunks (500-1000 tokens each)
// 4. Generate embeddings using AWS Bedrock Titan Embeddings
// 5. Store in document_chunks table

// Pseudocode (actual implementation will be more detailed)
const documents = $input.all();
const chunks = [];

for (const doc of documents) {
  // Download PDF
  const pdfBuffer = await downloadFromSupabase(doc.json.storage_path);
  
  // Extract text
  const text = await extractTextFromPDF(pdfBuffer);
  
  // Split into chunks
  const documentChunks = splitIntoChunks(text, 800); // ~800 tokens per chunk
  
  // Store chunks (embeddings will be generated in next node)
  chunks.push(...documentChunks.map((chunk, index) => ({
    document_id: doc.json.id,
    validation_detail_id: doc.json.validation_detail_id,
    chunk_text: chunk,
    chunk_index: index,
    chunk_metadata: {
      page_range: calculatePageRange(index),
      document_name: doc.json.file_name
    }
  })));
}

return chunks;
```

#### Node 2.4: Generate Embeddings

**Node Name:** "Generate Embeddings (Bedrock)"  
**Type:** HTTP Request  
**Method:** POST  
**URL:** `https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/amazon.titan-embed-text-v1/invoke`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "AWS4-HMAC-SHA256 Credential=..."
}
```

**Body:**
```json
{
  "inputText": "={{ $json.chunk_text }}"
}
```

**Note:** AWS Signature V4 authentication will be handled by n8n's AWS credentials.

#### Node 2.5: Store Chunks in pgvector

**Node Name:** "Store Chunks"  
**Type:** Postgres  
**Operation:** Insert

**Query:**
```sql
INSERT INTO document_chunks (
  document_id,
  validation_detail_id,
  chunk_text,
  chunk_index,
  chunk_metadata,
  embedding
) VALUES (
  {{ $json.document_id }},
  {{ $json.validation_detail_id }},
  '{{ $json.chunk_text }}',
  {{ $json.chunk_index }},
  '{{ $json.chunk_metadata }}'::jsonb,
  '{{ $json.embedding }}'::vector
)
ON CONFLICT (document_id, chunk_index) DO NOTHING;
```

#### Node 2.6: Fetch Requirements

**Node Name:** "Fetch Requirements (Bedrock)"  
**Type:** HTTP Request  
**Method:** POST  
**URL:** `={{ $env.SUPABASE_URL }}/functions/v1/get-requirements`

**Body:**
```json
{
  "validation_detail_id": "={{ $json.validation_detail_id }}"
}
```

#### Node 2.7: Loop Through Requirements

**Node Name:** "Loop Requirements"  
**Type:** Loop Over Items

#### Node 2.8: Generate Query Embedding

**Node Name:** "Generate Query Embedding"  
**Type:** HTTP Request  
**Method:** POST  
**URL:** `https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/amazon.titan-embed-text-v1/invoke`

**Body:**
```json
{
  "inputText": "={{ $json.requirement_text }}"
}
```

#### Node 2.9: Retrieve Relevant Chunks

**Node Name:** "Retrieve Chunks (pgvector)"  
**Type:** Postgres  
**Operation:** Execute Query

**Query:**
```sql
SELECT * FROM match_document_chunks(
  '{{ $json.query_embedding }}'::vector,
  0.7,  -- similarity threshold
  5,    -- top 5 chunks
  {{ $json.validation_detail_id }}
);
```

#### Node 2.10: Call Bedrock API

**Node Name:** "Call Bedrock (Claude 3.5)"  
**Type:** HTTP Request  
**Method:** POST  
**URL:** `https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/anthropic.claude-3-5-sonnet-20250219-v1:0/invoke`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "AWS4-HMAC-SHA256 Credential=..."
}
```

**Body:**
```json
{
  "anthropic_version": "bedrock-2023-05-31",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "{{ $json.prompt }}"
    }
  ],
  "temperature": 0.3
}
```

**Prompt Template:**
```
You are validating RTO assessment materials against training package requirements.

**Requirement:**
Type: {{ $json.requirement_type }}
Number: {{ $json.requirement_number }}
Text: {{ $json.requirement_text }}

**Relevant Document Content:**
{{ $json.retrieved_chunks }}

**Task:**
Validate whether the document content meets the requirement. Provide your response in JSON format:

{
  "status": "Met | Partially Met | Not Met",
  "reasoning": "Detailed explanation with specific evidence",
  "mapped_content": "Specific sections with inline page numbers (e.g., Section 2.1 (Page 14))",
  "citations": ["Document v2.1, Page 14, Section 2.1: Title"],
  "smart_question": "One simple, relevant question",
  "benchmark_answer": "Concise correct answer"
}
```

#### Node 2.11: Parse Bedrock Response

**Node Name:** "Parse Bedrock Response"  
**Type:** Code (JavaScript)

**Code:**
```javascript
const response = $input.first().json;

// Extract the content from Bedrock response
const content = response.content[0].text;

// Parse JSON from content
const validation = JSON.parse(content);

// Return in unified format
return {
  validation_detail_id: $('Loop Requirements').item.json.validation_detail_id,
  requirement_type: $('Loop Requirements').item.json.requirement_type,
  requirement_number: $('Loop Requirements').item.json.requirement_number,
  requirement_text: $('Loop Requirements').item.json.requirement_text,
  status: validation.status.toLowerCase().replace(' ', '_'),
  reasoning: validation.reasoning,
  mapped_content: validation.mapped_content,
  citations: validation.citations,
  smart_question: validation.smart_question,
  benchmark_answer: validation.benchmark_answer,
  ai_provider: 'bedrock'
};
```

### 3. Unified Save Node

**Node Name:** "Save Validation Results"  
**Type:** Postgres  
**Position:** After both Gemini and Bedrock flows merge

**Query:**
```sql
INSERT INTO validation_results (
  validation_detail_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  citations,
  smart_questions,
  metadata
) VALUES (
  {{ $json.validation_detail_id }},
  '{{ $json.requirement_type }}',
  '{{ $json.requirement_number }}',
  '{{ $json.requirement_text }}',
  '{{ $json.status }}',
  '{{ $json.reasoning }}',
  '{{ $json.citations }}'::jsonb,
  '[{"question": "{{ $json.smart_question }}", "answer": "{{ $json.benchmark_answer }}"}]'::jsonb,
  '{"ai_provider": "{{ $json.ai_provider }}"}'::jsonb
)
ON CONFLICT (validation_detail_id, requirement_type, requirement_number, COALESCE(document_namespace, ''))
DO UPDATE SET
  status = EXCLUDED.status,
  reasoning = EXCLUDED.reasoning,
  citations = EXCLUDED.citations,
  smart_questions = EXCLUDED.smart_questions,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
```

---

## Environment Variables

Add these to your n8n environment:

```bash
# AWS Credentials for Bedrock
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-southeast-2

# Bedrock Model IDs
BEDROCK_CLAUDE_MODEL_ID=anthropic.claude-3-5-sonnet-20250219-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v1

# Feature Flags
DEFAULT_AI_PROVIDER=gemini  # Start with gemini as default
ENABLE_BEDROCK=true
```

---

## Gradual Migration Strategy

### Phase 1: Setup (Week 1)
1. Apply database migrations (pgvector, document_chunks, ai_provider column)
2. Create new Bedrock flow in n8n (parallel to Gemini)
3. Add router node to switch between providers
4. Test Bedrock flow with a single validation

**Rollback:** Remove router node, keep Gemini as default

### Phase 2: Pilot Testing (Week 2)
1. Set 10% of new validations to use Bedrock
2. Monitor performance, cost, and quality
3. Compare results side-by-side with Gemini
4. Collect user feedback

**Rollback:** Set ai_provider back to 'gemini' for all validations

### Phase 3: Gradual Rollout (Week 3-4)
1. Increase Bedrock usage to 25%
2. Increase to 50%
3. Increase to 75%
4. Monitor at each step

**Rollback:** Decrease percentage at any step

### Phase 4: Full Migration (Week 5)
1. Set Bedrock as default for all new validations
2. Keep Gemini flow available for fallback
3. Monitor for 1 week

**Rollback:** Set Gemini as default again

### Phase 5: Deprecation (Week 6+)
1. Remove Gemini flow from n8n
2. Remove Gemini-specific code
3. Archive Gemini credentials

---

## Storage: Supabase vs. S3

### Current: Supabase Storage
- ✅ Already integrated
- ✅ Works well with Supabase database
- ✅ Simple authentication
- ✅ No additional cost (included in plan)

### Alternative: AWS S3
- ⚠️ Requires new integration
- ⚠️ Additional complexity (AWS credentials, SDK)
- ⚠️ Minimal cost benefit (S3 is cheap, but so is Supabase)
- ✅ Slightly faster for Bedrock (same AWS region)

**Recommendation:** **Keep Supabase Storage**

**Reasons:**
1. No significant performance benefit (documents are small, ~500KB)
2. Supabase Storage is already working well
3. Avoids additional complexity
4. No additional cost
5. Easier to maintain (one less service to manage)

**Only switch to S3 if:**
- Document sizes grow significantly (>10MB)
- You need advanced S3 features (lifecycle policies, versioning)
- You want to consolidate all AWS services

---

## Testing Plan

### Unit Tests
- [ ] Test AI provider router logic
- [ ] Test document chunking function
- [ ] Test embedding generation
- [ ] Test vector similarity search
- [ ] Test Bedrock API integration
- [ ] Test response parsing

### Integration Tests
- [ ] Test full Bedrock flow end-to-end
- [ ] Test parallel operation (Gemini + Bedrock)
- [ ] Test database migrations
- [ ] Test rollback scenarios

### Performance Tests
- [ ] Measure Bedrock response time vs. Gemini
- [ ] Measure cost per validation
- [ ] Measure chunking and embedding time
- [ ] Measure vector search performance

### Quality Tests
- [ ] Compare validation results (Bedrock vs. Gemini)
- [ ] Test with different document types
- [ ] Test with different requirement types
- [ ] Validate citation accuracy

---

## Success Criteria

### Performance
- ✅ Bedrock validation completes in <5 minutes (same as Gemini)
- ✅ Vector search returns results in <1 second
- ✅ Chunking and embedding completes in <2 minutes

### Cost
- ✅ Cost per validation <$0.05 (vs. $0.37 with Gemini)
- ✅ Total monthly cost <$50 for 1,000 validations

### Quality
- ✅ Validation accuracy ≥ Gemini
- ✅ Citation accuracy ≥ 95%
- ✅ No regressions in user experience

### Reliability
- ✅ Bedrock availability ≥ 99.9%
- ✅ Rollback works in <5 minutes
- ✅ No data loss during migration

---

## Rollback Plan

If issues arise at any phase:

1. **Immediate Rollback (< 5 minutes):**
   ```sql
   UPDATE validation_detail SET ai_provider = 'gemini' WHERE ai_provider = 'bedrock';
   ```

2. **Disable Bedrock in n8n:**
   - Set `ENABLE_BEDROCK=false` in environment
   - Router will default to Gemini flow

3. **Full Rollback (if needed):**
   ```sql
   -- Remove Bedrock-specific data
   DROP TABLE IF EXISTS document_chunks;
   ALTER TABLE validation_detail DROP COLUMN IF EXISTS ai_provider;
   ALTER TABLE validation_detail DROP COLUMN IF EXISTS ai_metadata;
   ```

---

## Monitoring and Alerts

### Metrics to Track
- Validation completion time (by provider)
- Cost per validation (by provider)
- Error rate (by provider)
- User satisfaction (by provider)
- Vector search performance

### Alerts
- Alert if Bedrock error rate > 5%
- Alert if Bedrock response time > 10 minutes
- Alert if cost per validation > $0.10
- Alert if vector search fails

---

## Next Steps

1. Review and approve this strategy
2. Apply database migrations
3. Create Bedrock flow in n8n
4. Start Phase 1 testing

**Estimated Timeline:** 5-6 weeks to full migration
**Estimated Cost:** $40-50/month (vs. $370 currently)
**Risk Level:** Low (parallel operation with easy rollback)
