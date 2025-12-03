# n8n Workflow Template: Bedrock Validation Flow

**Date:** December 2, 2025  
**Version:** 1.0  
**Purpose:** Template for implementing the Bedrock validation workflow in n8n

---

## Workflow Overview

This document provides a detailed template for building the Bedrock validation flow in n8n. The workflow is designed to run in parallel with the existing Gemini flow, using a router node to direct traffic based on the `ai_provider` field.

---

## Workflow Nodes

### 1. Webhook - Start Validation
**Type:** Webhook  
**Method:** POST  
**Path:** `/ai-validation-enhanced`  
**Response Mode:** Response Node

**Purpose:** Receives validation requests from the frontend.

---

### 2. Respond Success
**Type:** Respond to Webhook  
**Response:** JSON

**Body:**
```json
{
  "success": true,
  "validation_detail_id": "={{ $json.body.validation_detail_id }}",
  "message": "Validation started"
}
```

---

### 3. Update Status: Processing
**Type:** Postgres  
**Operation:** Execute Query

**Query:**
```sql
UPDATE validation_detail 
SET validation_status = 'processing', updated_at = NOW() 
WHERE id = {{ $json.body.validation_detail_id }}
```

---

### 4. Fetch Validation Context
**Type:** Postgres  
**Operation:** Execute Query

**Query:**
```sql
SELECT 
  vd.*, 
  vs.id as summary_id, 
  vs.unit_code, 
  vs.unitLink, 
  vs.rto_code, 
  vs.created_at as summary_created_at 
FROM validation_detail vd 
JOIN validation_summary vs ON vd.validation_summary_id = vs.id 
WHERE vd.id = {{ $json.body.validation_detail_id }}
```

---

### 5. Route by AI Provider
**Type:** Switch  
**Mode:** Rules

**Rules:**
```json
{
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
  ],
  "fallbackOutput": 1
}
```

**Outputs:**
- Output 0 → Bedrock Flow
- Output 1 → Gemini Flow (existing)
- Fallback → Gemini Flow

---

## Bedrock Flow Nodes

### 6. Fetch Documents (Bedrock)
**Type:** Supabase  
**Operation:** Get Many  
**Table:** documents

**Filters:**
```json
{
  "conditions": [
    {
      "keyName": "validation_detail_id",
      "condition": "equals",
      "keyValue": "={{ $json.validation_detail_id }}"
    }
  ]
}
```

---

### 7. Check Chunking Status
**Type:** Postgres  
**Operation:** Execute Query

**Query:**
```sql
SELECT * FROM get_validation_chunking_status({{ $json.validation_detail_id }});
```

**Output:** Array of documents with `is_chunked` and `chunk_count` fields.

---

### 8. Filter Unchunked Documents
**Type:** Filter  
**Conditions:**

```json
{
  "conditions": {
    "boolean": [
      {
        "value1": "={{ $json.is_chunked }}",
        "operation": "equal",
        "value2": false
      }
    ]
  }
}
```

---

### 9. Download PDF from Supabase Storage
**Type:** HTTP Request  
**Method:** GET  
**URL:** `={{ $env.SUPABASE_URL }}/storage/v1/object/{{ $json.storage_path }}`

**Headers:**
```json
{
  "Authorization": "Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}"
}
```

**Response Format:** File

---

### 10. Extract Text from PDF
**Type:** Code (JavaScript)

**Code:**
```javascript
const pdf = require('pdf-parse');

// Get the PDF buffer from the previous node
const pdfBuffer = $input.first().binary.data;

// Extract text
const data = await pdf(pdfBuffer);

return {
  document_id: $('Filter Unchunked Documents').item.json.document_id,
  validation_detail_id: $('Filter Unchunked Documents').item.json.validation_detail_id,
  file_name: $('Filter Unchunked Documents').item.json.file_name,
  text: data.text,
  num_pages: data.numpages
};
```

**Note:** You may need to install `pdf-parse` in your n8n environment.

---

### 11. Split into Chunks
**Type:** Code (JavaScript)

**Code:**
```javascript
// Simple chunking strategy: split by paragraphs and combine to ~800 tokens
const text = $json.text;
const document_id = $json.document_id;
const validation_detail_id = $json.validation_detail_id;
const file_name = $json.file_name;

// Split by double newlines (paragraphs)
const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

// Combine paragraphs into chunks of ~800 tokens (roughly 600 words)
const chunks = [];
let currentChunk = '';
let chunkIndex = 0;

for (const paragraph of paragraphs) {
  const words = paragraph.split(/\s+/).length;
  const currentWords = currentChunk.split(/\s+/).length;
  
  if (currentWords + words > 600 && currentChunk.length > 0) {
    // Save current chunk and start a new one
    chunks.push({
      document_id,
      validation_detail_id,
      chunk_text: currentChunk.trim(),
      chunk_index: chunkIndex,
      chunk_metadata: {
        document_name: file_name,
        word_count: currentChunk.split(/\s+/).length
      }
    });
    chunkIndex++;
    currentChunk = paragraph;
  } else {
    // Add to current chunk
    currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
  }
}

// Don't forget the last chunk
if (currentChunk.length > 0) {
  chunks.push({
    document_id,
    validation_detail_id,
    chunk_text: currentChunk.trim(),
    chunk_index: chunkIndex,
    chunk_metadata: {
      document_name: file_name,
      word_count: currentChunk.split(/\s+/).length
    }
  });
}

return chunks;
```

---

### 12. Generate Embeddings (Bedrock Titan)
**Type:** HTTP Request  
**Method:** POST  
**URL:** `https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/amazon.titan-embed-text-v1/invoke`

**Authentication:** AWS (use n8n's AWS credentials)

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "inputText": "={{ $json.chunk_text }}"
}
```

**Response:** JSON with `embedding` field (array of 1536 floats)

---

### 13. Store Chunks in pgvector
**Type:** Postgres  
**Operation:** Execute Query

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
  $1,
  {{ $json.chunk_index }},
  $2::jsonb,
  $3::vector
)
ON CONFLICT (document_id, chunk_index) DO NOTHING
RETURNING id;
```

**Parameters:**
- `$1`: `{{ $json.chunk_text }}`
- `$2`: `{{ JSON.stringify($json.chunk_metadata) }}`
- `$3`: `{{ '[' + $json.embedding.join(',') + ']' }}`

---

### 14. Fetch Requirements
**Type:** HTTP Request  
**Method:** POST  
**URL:** `={{ $env.SUPABASE_URL }}/functions/v1/get-requirements`

**Headers:**
```json
{
  "Authorization": "Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "validation_detail_id": "={{ $json.validation_detail_id }}"
}
```

---

### 15. Loop Through Requirements
**Type:** Loop Over Items  
**Mode:** Each Item

---

### 16. Generate Query Embedding
**Type:** HTTP Request  
**Method:** POST  
**URL:** `https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/amazon.titan-embed-text-v1/invoke`

**Authentication:** AWS

**Body:**
```json
{
  "inputText": "{{ $json.requirement_type }}: {{ $json.requirement_text }}"
}
```

---

### 17. Retrieve Relevant Chunks (pgvector)
**Type:** Postgres  
**Operation:** Execute Query

**Query:**
```sql
SELECT * FROM match_document_chunks(
  $1::vector,
  0.7,
  5,
  {{ $json.validation_detail_id }}
);
```

**Parameters:**
- `$1`: `{{ '[' + $json.embedding.join(',') + ']' }}`

---

### 18. Build Prompt with Retrieved Chunks
**Type:** Code (JavaScript)

**Code:**
```javascript
const requirement = $('Loop Through Requirements').item.json;
const chunks = $input.all().map(item => item.json);

// Build the context from retrieved chunks
const context = chunks.map((chunk, index) => 
  `[Chunk ${index + 1} from ${chunk.chunk_metadata.document_name}]\n${chunk.chunk_text}`
).join('\n\n---\n\n');

// Build the prompt
const prompt = `You are validating RTO assessment materials against training package requirements.

**Requirement:**
Type: ${requirement.display_type}
Number: ${requirement.number}
Text: ${requirement.text}

**Relevant Document Content:**
${context}

**Task:**
Validate whether the document content meets the requirement. Provide your response in JSON format:

{
  "status": "Met | Partially Met | Not Met",
  "reasoning": "Detailed explanation with specific evidence. If Partially Met or Not Met, clearly state what is missing.",
  "mapped_content": "Specific sections with inline page numbers (e.g., Section 2.1 (Page 14) covers...)",
  "citations": ["Document v2.1, Page 14, Section 2.1: Title"],
  "smart_question": "One simple, relevant question",
  "benchmark_answer": "Concise correct answer"
}

**Important:**
- Always include page numbers in parentheses in mapped_content
- Citations must include document name, page number, and section
- Be specific and evidence-based in your reasoning`;

return {
  requirement,
  prompt,
  retrieved_chunks: chunks
};
```

---

### 19. Call Bedrock API (Claude 3.5 Sonnet)
**Type:** HTTP Request  
**Method:** POST  
**URL:** `https://bedrock-runtime.ap-southeast-2.amazonaws.com/model/anthropic.claude-3-5-sonnet-20250219-v1:0/invoke`

**Authentication:** AWS

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "anthropic_version": "bedrock-2023-05-31",
  "max_tokens": 4096,
  "temperature": 0.3,
  "messages": [
    {
      "role": "user",
      "content": "={{ $json.prompt }}"
    }
  ]
}
```

---

### 20. Parse Bedrock Response
**Type:** Code (JavaScript)

**Code:**
```javascript
const response = $input.first().json;
const requirement = $('Build Prompt with Retrieved Chunks').first().json.requirement;

// Extract the content from Bedrock response
const content = response.content[0].text;

// Parse JSON from content
let validation;
try {
  validation = JSON.parse(content);
} catch (error) {
  // If JSON parsing fails, try to extract JSON from markdown code block
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    validation = JSON.parse(jsonMatch[1]);
  } else {
    throw new Error('Failed to parse Bedrock response: ' + error.message);
  }
}

// Normalize status
const statusMap = {
  'Met': 'met',
  'Partially Met': 'partial',
  'Not Met': 'not_met'
};
const normalizedStatus = statusMap[validation.status] || validation.status.toLowerCase().replace(' ', '_');

// Return in unified format
return {
  validation_detail_id: requirement.validation_detail_id,
  requirement_type: requirement.type,
  requirement_number: requirement.number,
  requirement_text: requirement.text,
  status: normalizedStatus,
  reasoning: validation.reasoning,
  mapped_content: validation.mapped_content,
  citations: validation.citations,
  smart_question: validation.smart_question,
  benchmark_answer: validation.benchmark_answer,
  ai_provider: 'bedrock',
  ai_metadata: {
    model: 'claude-3-5-sonnet',
    retrieved_chunks: $('Build Prompt with Retrieved Chunks').first().json.retrieved_chunks.length,
    timestamp: new Date().toISOString()
  }
};
```

---

### 21. Merge Gemini and Bedrock Outputs
**Type:** Merge  
**Mode:** Append

**Purpose:** Combine the outputs from both Gemini and Bedrock flows before saving.

---

### 22. Save Validation Results
**Type:** Postgres  
**Operation:** Execute Query

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
  ai_provider,
  metadata
) VALUES (
  {{ $json.validation_detail_id }},
  '{{ $json.requirement_type }}',
  '{{ $json.requirement_number }}',
  $1,
  '{{ $json.status }}',
  $2,
  $3::jsonb,
  $4::jsonb,
  '{{ $json.ai_provider }}',
  $5::jsonb
)
ON CONFLICT (validation_detail_id, requirement_type, requirement_number, COALESCE(document_namespace, ''))
DO UPDATE SET
  status = EXCLUDED.status,
  reasoning = EXCLUDED.reasoning,
  citations = EXCLUDED.citations,
  smart_questions = EXCLUDED.smart_questions,
  ai_provider = EXCLUDED.ai_provider,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING id;
```

**Parameters:**
- `$1`: `{{ $json.requirement_text }}`
- `$2`: `{{ $json.reasoning }}`
- `$3`: `{{ JSON.stringify($json.citations) }}`
- `$4`: `{{ JSON.stringify([{question: $json.smart_question, answer: $json.benchmark_answer}]) }}`
- `$5`: `{{ JSON.stringify($json.ai_metadata || {}) }}`

---

### 23. Update Validation Status: Complete
**Type:** Postgres  
**Operation:** Execute Query

**Query:**
```sql
UPDATE validation_detail 
SET 
  validation_status = 'completed', 
  updated_at = NOW() 
WHERE id = {{ $json.validation_detail_id }}
```

---

### 24. Send Completion Notification (Optional)
**Type:** HTTP Request or Email

**Purpose:** Notify the user that validation is complete.

---

## Environment Variables

Add these to your n8n environment:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-southeast-2

# Bedrock Model IDs
BEDROCK_CLAUDE_MODEL_ID=anthropic.claude-3-5-sonnet-20250219-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v1

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Feature Flags
DEFAULT_AI_PROVIDER=gemini
ENABLE_BEDROCK=true
```

---

## Testing Checklist

- [ ] Test router node with both `gemini` and `bedrock` providers
- [ ] Test document chunking with a sample PDF
- [ ] Test embedding generation with Bedrock Titan
- [ ] Test pgvector storage and retrieval
- [ ] Test Claude 3.5 Sonnet API call
- [ ] Test response parsing and error handling
- [ ] Test full end-to-end flow with a real validation
- [ ] Compare results with Gemini flow

---

## Notes

1. **Error Handling:** Add error handling nodes after each HTTP request to catch and log failures.
2. **Retry Logic:** Add retry logic for Bedrock API calls (rate limits, temporary failures).
3. **Monitoring:** Add logging nodes to track performance and costs.
4. **Optimization:** Consider batching embedding generation for better performance.

---

## Next Steps

1. Import this template into n8n
2. Configure AWS credentials
3. Test each node individually
4. Test the full workflow end-to-end
5. Deploy to production with parallel operation

**This template provides a complete implementation of the Bedrock validation flow. Follow the migration guide for a phased rollout.**
