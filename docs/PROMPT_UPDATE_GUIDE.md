# Prompt Update Guide

## Overview

This document explains the streamlined prompt updates applied to the NytroAI validation system. The updates focus on **core validation**, **strong citations**, and **performance optimization** by simplifying the output schema and reducing unnecessary complexity.

---

## Key Changes

### 1. **Simplified Output Schema**

The previous schema included nested objects for questions, multiple recommendation fields (unmapped_content, recommendations), and optional metadata. The new schema focuses on **five essential fields** plus one optional question/answer pair:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string (enum) | ✅ | Validation result: "Met", "Partially Met", or "Not Met" |
| `reasoning` | string | ✅ | Detailed explanation including what was found AND what is missing (if Partially Met or Not Met) |
| `mapped_content` | string | ✅ | Specific sections, tasks, or content that address the requirement **with inline page numbers** |
| `citations` | array of strings | ✅ | Document names, page numbers, section headings, task numbers |
| `smart_question` | string | ✅ | ONE simple, relevant question to assess understanding or performance |
| `benchmark_answer` | string | ✅ | Concise, correct answer or expected observable behavior |

### 2. **Focus on Validation, Not Question Generation**

The primary goal is to **validate requirements against documents**, not to generate comprehensive assessment banks. The smart question and benchmark answer are kept simple and directly relevant to the requirement being validated.

**Removed fields:**
- `unmapped_content` - Now handled within the `reasoning` field
- `recommendations` - Not needed for core validation
- Nested `smart_question` object - Simplified to a single string

### 3. **Inline Page Numbers in Mapped Content**

The `mapped_content` field now requires **inline page numbers** in parentheses after each reference. This makes the validation immediately useful without needing to cross-reference citations.

**Example format:**
- "Section 2.1 (Page 14) covers hazard identification..."
- "Task 3 (Page 12) requires demonstration of..."
- "Section 4.2 (Page 22-24) provides instructions..."

### 4. **Mandatory Citations**

Citations are now **required** in the output schema. Every validation must include specific references to:

- Document name
- Page numbers
- Section headings or task numbers
- Specific content locations

This ensures all assessments are evidence-based and auditable.

### 5. **Performance Optimization**

By reducing the number of fields and eliminating nested objects, the Gemini API can process each requirement faster. This is critical because:

- Each requirement is validated individually (not in batches)
- Rate limiting requires 1-second delays between requests
- Simpler schemas reduce token usage and processing time

---

## Prompt Types Updated

The following prompt types have been updated:

### Knowledge Evidence (KE)

- **KE - Learner Guide**: Validates if learner guide content covers the knowledge requirement
- **KE - Unit Documents**: Validates if assessment tasks evaluate the knowledge requirement

### Performance Evidence (PE)

- **PE - Unit Documents**: Validates if assessment tasks require demonstration of the performance
- **PE - Learner Guide**: Assesses if the guide prepares learners for the performance requirement

### Performance Criteria (PC)

- **PC - Unit Documents**: Validates if assessment tasks measure the performance criteria
- **PC - Learner Guide**: Assesses if the guide prepares learners to meet the criteria

### Foundation Skills (FS)

- **FS - Unit Documents**: Validates if assessment tasks embed and assess the foundation skill

---

## Application Instructions

### Step 1: Apply the Migration

Run the SQL migration script to update all prompts in the database:

```bash
cd /home/ubuntu/NytroAI
psql $DATABASE_URL -f supabase/migrations/20251130_update_prompts.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

### Step 2: Update the Workflow

The n8n workflow (`AIValidationFlow-Enhanced-RESTRUCTURED.json`) already expects this output schema. The **Parse Gemini Response** code node should be updated to match the new structure:

```javascript
// Extract validation results from Gemini response
const geminiResponse = $input.item.json;
const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

if (!content) {
  throw new Error('No content in Gemini response');
}

// Parse JSON response
let validationResult;
try {
  validationResult = JSON.parse(content);
} catch (error) {
  throw new Error(`Failed to parse Gemini response: ${error.message}`);
}

// Map to database schema
return {
  json: {
    validation_id: $('Webhook').item.json.body.validation_id,
    requirement_id: $input.item.json.requirement_id,
    requirement_number: $input.item.json.requirement_number,
    requirement_text: $input.item.json.requirement_text,
    requirement_type: $input.item.json.requirement_type,
    status: validationResult.status,
    reasoning: validationResult.reasoning,
    mapped_content: validationResult.mapped_content,
    citations: validationResult.citations, // Now an array
    smart_question: validationResult.smart_question, // Now a string
    benchmark_answer: validationResult.benchmark_answer, // Now a string
    confidence_score: 0.85 // Default confidence
  }
};
```

### Step 3: Update Database Schema (if needed)

If the `validation_results` table still expects nested objects for `smart_question`, update the schema:

```sql
-- Update validation_results table to match new schema
ALTER TABLE validation_results
  ALTER COLUMN smart_question TYPE TEXT,
  ALTER COLUMN benchmark_answer TYPE TEXT,
  ALTER COLUMN citations TYPE TEXT[];
```

### Step 4: Test the Workflow

Send a test validation request with `gemini_file_uris` in the webhook body:

```bash
curl -X POST https://your-n8n-instance.com/webhook/validate \
  -H "Content-Type: application/json" \
  -d '{
    "validation_id": "test-123",
    "gemini_file_uris": ["gemini://file-abc", "gemini://file-xyz"],
    "session_id": "session-456"
  }'
```

Monitor the workflow execution to ensure:

- Prompts are fetched correctly
- Gemini API returns valid JSON matching the new schema
- Parse node successfully extracts all fields
- Results are saved to `validation_results` table
- Citations are properly stored as an array

---

## Benefits

### For RTO Assessors

- **Faster validation**: Reduced processing time per requirement (30-40% improvement expected)
- **Clear evidence**: Mandatory citations ensure all assessments are backed by specific document references
- **Clearer reasoning**: What's found AND what's missing in a single field
- **Simple questions**: One relevant question per requirement for quick understanding checks

### For System Performance

- **Reduced token usage**: Simpler schema means fewer tokens per request
- **Faster API responses**: Less complex output generation
- **Better reliability**: Fewer fields reduce the chance of schema mismatches or parsing errors

### For Developers

- **Cleaner code**: Simpler parsing logic in the workflow
- **Easier debugging**: Fewer nested objects to traverse
- **Better maintainability**: Standardized schema across all prompt types

---

## Rollback Plan

If issues arise, the previous prompts can be restored by:

1. Reverting the migration:
   ```sql
   -- Restore from backup or re-run the original seed script
   psql $DATABASE_URL -f supabase/migrations/20250129_seed_prompts.sql
   ```

2. Updating the workflow Parse node to handle the old schema

3. Testing with a known validation request

---

## Next Steps

1. ✅ Apply the migration script
2. ✅ Update the Parse node in the n8n workflow
3. ✅ Test with a sample validation request
4. ✅ Monitor Gemini API response times
5. ✅ Verify citations are being captured correctly
6. ✅ Adjust rate limiting if needed (increase Wait node delay if hitting limits)

---

## Contact

For questions or issues, please open a GitHub issue in the NytroAI repository.
