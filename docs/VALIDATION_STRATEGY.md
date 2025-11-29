# Validation Strategy Design

## Overview

This document outlines the enhanced validation strategy for NytroAI that consolidates all requirement types into a unified `validation_results` table with proper citations, smart questions, and comprehensive tracking.

---

## Key Requirements

1. **Individual requirement validation** - Each requirement gets its own row in `validation_results`
2. **Citations from Gemini** - Track document references with confidence scores
3. **Smart questions** - Generate assessment questions with benchmark answers
4. **Unit vs Learner Guide** - Different prompts for different document types
5. **Multiple requirement types** - KE, PE, AC, FS, E_PC, AI
6. **Batch processing** - Group by type for efficiency
7. **Progress tracking** - Update status as validation progresses

---

## Requirement Types

Based on legacy system analysis:

| Code | Name | Description | Typical Count |
|------|------|-------------|---------------|
| KE | Knowledge Evidence | Theoretical knowledge requirements | 8-12 |
| PE | Performance Evidence | Practical demonstration requirements | 3-6 |
| FS | Foundation Skills | Core skills (reading, writing, numeracy, etc.) | 6-10 |
| E_PC | Elements & Performance Criteria | Unit elements and criteria | 10-20 |
| AC | Assessment Conditions | Assessment environment requirements | 4-8 |
| AI | Assessment Instructions | Assessment guidance | 1-2 |

**Total per validation**: 40-80 individual requirements

---

## Validation Strategy: Hybrid Batch Approach

### Why Hybrid?

**Single Prompt (All Requirements)**:
- ❌ Too large (40-80 requirements)
- ❌ Parsing complexity
- ❌ All-or-nothing failure

**Individual Prompts (Per Requirement)**:
- ❌ Too slow (40-80 API calls)
- ❌ Too expensive
- ❌ No context sharing

**Hybrid (Batch by Type)** ✅:
- ✅ Manageable batches (3-20 per type)
- ✅ Context sharing within type
- ✅ 6-7 API calls total
- ✅ Progress tracking
- ✅ Retry individual types

### Implementation

```
For each validation session:

1. Group requirements by type:
   - KE: 10 requirements
   - PE: 4 requirements
   - FS: 8 requirements
   - E_PC: 14 requirements
   - AC: 6 requirements
   - AI: 1 requirement

2. For each type (6 batches):
   - Fetch prompt template
   - Build batch request
   - Call Gemini API
   - Parse array response
   - Save individual results
   - Update progress

3. Aggregate results:
   - Total: 43 requirements
   - Met: 35 (81%)
   - Partially Met: 6 (14%)
   - Not Met: 2 (5%)

4. Update validation status
5. Trigger report generation
```

---

## Prompt Structure

### Template Variables

```
{{requirements_array}} - JSON array of requirements to validate
{{document_type}} - 'unit' or 'learner_guide'
{{rto_code}} - RTO identifier
{{unit_code}} - Unit of competency code
{{requirement_type}} - 'KE', 'PE', etc.
```

### System Message Structure

```
You are validating {requirement_type} requirements against {document_type} documents.

Requirements to validate:
{{requirements_array}}

For each requirement, provide:
1. Status: Met/Not Met/Partially Met
2. Mapped Content: What addresses the requirement
3. Unmapped Content: What's missing (if not Met)
4. Recommendations: How to address gaps
5. Smart Question: Generated assessment question
6. Benchmark Answer: Expected learner response
7. Document References: Page numbers and sections

Return JSON array with one object per requirement.
```

### Output Schema (JSON)

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {
        "type": "string",
        "enum": ["Met", "Not Met", "Partially Met"]
      },
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "smart_question": {
        "type": "object",
        "properties": {
          "question_text": {"type": "string"},
          "question_category": {"type": "string"},
          "benchmark_answer": {"type": "string"},
          "multiple_choice": {
            "type": "object",
            "properties": {
              "question": {"type": "string"},
              "options": {
                "type": "array",
                "items": {"type": "string"}
              },
              "correct_answer": {"type": "string"}
            }
          }
        }
      },
      "confidence_score": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      }
    },
    "required": ["requirement_number", "status", "reasoning"]
  }
}
```

---

## Gemini API Request

### Request Structure

```javascript
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "fileData": {
            "mimeType": "application/pdf",
            "fileUri": "files/abc123"  // Unit document 1
          }
        },
        {
          "fileData": {
            "mimeType": "application/pdf",
            "fileUri": "files/def456"  // Unit document 2
          }
        },
        {
          "text": "Validate these Knowledge Evidence requirements: [...]"
        }
      ]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": { ... },  // Output schema above
    "temperature": 0.2,
    "topP": 0.95,
    "topK": 40,
    "maxOutputTokens": 8192
  },
  "systemInstruction": {
    "parts": [
      {
        "text": "You are validating Knowledge Evidence requirements..."
      }
    ]
  }
}
```

### Response with Citations

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "[{\"requirement_number\": \"KE 1\", \"status\": \"Met\", ...}]"
          }
        ]
      },
      "groundingMetadata": {
        "groundingChunks": [
          {
            "retrievedContext": {
              "uri": "files/abc123",
              "title": "BSBOPS304_Assessment.pdf"
            }
          }
        ],
        "groundingSupports": [
          {
            "segment": {
              "startIndex": 0,
              "endIndex": 150,
              "text": "..."
            },
            "groundingChunkIndices": [0],
            "confidenceScores": [0.95]
          }
        ]
      },
      "citationMetadata": {
        "citations": [
          {
            "startIndex": 0,
            "endIndex": 150,
            "uri": "files/abc123",
            "title": "BSBOPS304_Assessment.pdf"
          }
        ]
      }
    }
  ]
}
```

---

## Citations Processing

### Extract Citations

```javascript
const response = await gemini.generateContent(request);
const candidate = response.candidates[0];

// Parse validation results
const validations = JSON.parse(candidate.content.parts[0].text);

// Extract citations
const citations = candidate.citationMetadata?.citations || [];
const groundingMetadata = candidate.groundingMetadata || {};

// Calculate metrics
const citationCount = citations.length;
const confidenceScores = groundingMetadata.groundingSupports?.flatMap(
  s => s.confidenceScores || []
) || [];
const averageConfidence = confidenceScores.length > 0
  ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
  : 0;

// Map citations to validations (by text position)
for (const validation of validations) {
  validation.citations = citations.filter(c => 
    // Match citations to this validation's text
    // (implementation depends on text structure)
  );
  validation.citation_count = validation.citations.length;
  validation.grounding_metadata = groundingMetadata;
}
```

### Save to Database

```sql
INSERT INTO validation_results (
  validation_detail_id,
  validation_type_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  mapped_content,
  unmapped_content,
  recommendations,
  doc_references,
  smart_questions,
  confidence_score,
  citations,
  grounding_metadata,
  citation_count,
  average_confidence,
  validation_method,
  metadata
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
  $11, $12::jsonb, $13, $14::jsonb, $15::jsonb,
  $16, $17, 'batch_prompt', $18::jsonb
);
```

---

## n8n Workflow Design

### AIValidationFlow_Enhanced.json

**Flow**:
```
Webhook
  ↓
Fetch Validation Context (validation_detail)
  ↓
Fetch Documents (gemini_file_uri)
  ↓
Call Edge Function: get-requirements-grouped
  ↓
Loop: For Each Requirement Type
  ├─ Fetch Prompt Template
  ├─ Build Batch Request
  ├─ Call Gemini API
  ├─ Parse Response
  ├─ Extract Citations
  ├─ Loop: Save Each Validation
  └─ Aggregate Type Results
  ↓
Update Validation Detail Counts
  ↓
Trigger Report Generation
  ↓
Respond Success
```

**Key Nodes**:

1. **Webhook - Start Validation**
   - Input: `{validation_detail_id, document_type}`
   - Output: Validation context

2. **Fetch Documents**
   - Query: `documents` table
   - Filter: `validation_detail_id`
   - Output: Array of `{gemini_file_uri, storage_path}`

3. **Get Requirements Grouped** (Edge Function)
   - Input: `{validation_detail_id, document_type}`
   - Output: Requirements grouped by type
   ```json
   {
     "KE": [{requirement_number, requirement_text, requirement_id}, ...],
     "PE": [...],
     "FS": [...],
     ...
   }
   ```

4. **Loop: For Each Type**
   - Input: Requirement type (KE, PE, etc.)
   - Iterations: 6-7 types

5. **Fetch Prompt**
   - Query: `prompts` table
   - Filter: `requirement_type`, `document_type`
   - Output: `{prompt_text, output_schema}`

6. **Build Batch Request** (Code Node)
   ```javascript
   const requirements = $input.item.json.requirements;
   const prompt = $('Fetch Prompt').item.json.prompt_text;
   const fileUris = $('Fetch Documents').all().map(d => d.json.gemini_file_uri);
   
   return {
     json: {
       contents: [{
         role: 'user',
         parts: [
           ...fileUris.map(uri => ({fileData: {mimeType: 'application/pdf', fileUri: uri}})),
           {text: prompt.replace('{{requirements_array}}', JSON.stringify(requirements))}
         ]
       }],
       generationConfig: {...},
       systemInstruction: {...}
     }
   };
   ```

7. **Call Gemini API** (HTTP Request)
   - URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
   - Method: POST
   - Headers: `X-Goog-Api-Key: {{GEMINI_API_KEY}}`
   - Body: From previous node

8. **Parse Response** (Code Node)
   ```javascript
   const response = $input.item.json;
   const candidate = response.candidates[0];
   const validations = JSON.parse(candidate.content.parts[0].text);
   const citations = candidate.citationMetadata?.citations || [];
   const groundingMetadata = candidate.groundingMetadata || {};
   
   return validations.map(v => ({
     json: {
       ...v,
       citations,
       grounding_metadata: groundingMetadata,
       citation_count: citations.length
     }
   }));
   ```

9. **Loop: Save Each Validation** (Supabase Insert)
   - Table: `validation_results`
   - Fields: All from parsed response

10. **Aggregate Type Results** (Code Node)
    ```javascript
    const validations = $input.all();
    return {
      json: {
        requirement_type: $('Loop Types').item.json.type,
        total: validations.length,
        met: validations.filter(v => v.json.status === 'Met').length,
        partially_met: validations.filter(v => v.json.status === 'Partially Met').length,
        not_met: validations.filter(v => v.json.status === 'Not Met').length
      }
    };
    ```

11. **Update Validation Detail**
    - Table: `validation_detail`
    - Update counts and status

---

## Edge Functions

### get-requirements-grouped

**Purpose**: Fetch all requirements for a validation session, grouped by type.

**Input**:
```json
{
  "validation_detail_id": 123,
  "document_type": "unit"
}
```

**Output**:
```json
{
  "KE": [
    {
      "requirement_id": 1,
      "requirement_number": "KE 1",
      "requirement_text": "key provisions of customer service legislation..."
    },
    ...
  ],
  "PE": [...],
  "FS": [...],
  "E_PC": [...],
  "AC": [...],
  "AI": [...]
}
```

**Implementation**:
```typescript
// Query all requirement tables
const ke = await supabase.from('knowledge_evidence').select('*').eq('unit_code', unitCode);
const pe = await supabase.from('performance_evidence').select('*').eq('unit_code', unitCode);
// ... etc

return {
  KE: ke.data || [],
  PE: pe.data || [],
  FS: fs.data || [],
  E_PC: epc.data || [],
  AC: ac.data || [],
  AI: ai.data || []
};
```

---

## Database Schema Updates

### prompts Table

```sql
CREATE TABLE prompts (
  id BIGSERIAL PRIMARY KEY,
  prompt_type TEXT NOT NULL,              -- 'validation', 'smart_question', 'report'
  requirement_type TEXT NOT NULL,         -- 'KE', 'PE', 'AC', 'FS', 'E_PC', 'AI'
  document_type TEXT NOT NULL,            -- 'unit', 'learner_guide'
  prompt_text TEXT NOT NULL,              -- System message with {{variables}}
  output_schema JSONB,                    -- Expected JSON structure
  version TEXT DEFAULT 'v1.0',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(prompt_type, requirement_type, document_type, version)
);

CREATE INDEX idx_prompts_lookup ON prompts(prompt_type, requirement_type, document_type, is_active);
```

### validation_results Table

Already exists (from pasted_content.txt), no changes needed.

---

## Testing Strategy

### Test with BSBOPS304

1. **Upload documents**
   - Unit assessment tools
   - Learner guide

2. **Trigger validation**
   - POST to n8n webhook
   - `{validation_detail_id: 123, document_type: 'unit'}`

3. **Verify results**
   - Check `validation_results` table
   - Compare with legacy Excel reports
   - Verify citations present
   - Verify smart questions generated

4. **Compare metrics**
   | Metric | Legacy | New | Match? |
   |--------|--------|-----|--------|
   | Total Requirements | 43 | ? | ✓/✗ |
   | Met | 35 | ? | ✓/✗ |
   | Partially Met | 6 | ? | ✓/✗ |
   | Not Met | 2 | ? | ✓/✗ |
   | Citations | Manual | Auto | N/A |
   | Smart Questions | Yes | Yes | ✓/✗ |

---

## Performance Estimates

### API Calls

- **Requirement types**: 6 (KE, PE, FS, E_PC, AC, AI)
- **API calls per validation**: 6
- **Total time**: ~12-18 seconds (2-3s per call)

### Token Usage

- **Input tokens per call**: ~50K (documents + prompt + requirements)
- **Output tokens per call**: ~5K (validations array)
- **Total per validation**: ~330K input + ~30K output

### Cost (Gemini 2.0 Flash)

- **Input**: 330K tokens × $0.15/1M = $0.0495
- **Output**: 30K tokens × $0.60/1M = $0.018
- **Total per validation**: ~$0.07

**vs Legacy**:
- Legacy: $1.50 (embeddings + multiple calls)
- New: $0.07
- **Savings**: 95%

---

## Next Steps

1. ✅ Create prompts table migration
2. ✅ Seed prompts with all requirement type templates
3. ✅ Create get-requirements-grouped edge function
4. ✅ Create AIValidationFlow_Enhanced.json
5. ✅ Test with BSBOPS304
6. ✅ Compare with legacy results
7. ✅ Document differences
8. ✅ Create PR
