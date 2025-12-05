# AI Smart Question Generator and Requirement Regenerator Workflows

## Overview

This document describes two new AI-powered workflows that extend the NytroAI validation platform:

1. **Smart Question Generator**: Generates intelligent, contextually relevant questions about validation documents
2. **Requirement Regenerator**: Regenerates and refines individual requirements with improved clarity and evidence alignment

Both workflows follow the same architectural pattern as the existing AI Chat Agent workflow, leveraging the existing `documents` table and `prompts` table infrastructure.

---

## 1. Smart Question Generator Workflow

### Purpose

The Smart Question Generator analyzes validation documents and generates 5-10 intelligent questions that help users discover and understand critical information within the validation context.

### Workflow File

`AISmartQuestionGenerator-Workflow.json`

### Endpoint

```
POST /webhook/smart-questions
```

### Request Body

```json
{
  "validation_detail_id": "validation-uuid"
}
```

### Response

```json
{
  "validation_detail_id": "validation-uuid",
  "questions": [
    {
      "question": "What assessment criteria are addressed in the documents?",
      "question_type": "factual",
      "difficulty_level": "basic",
      "focus_area": "assessment_criteria",
      "expected_document_sections": ["Section 2", "Assessment Overview"],
      "rationale": "Understanding assessment criteria is fundamental to validation"
    }
  ],
  "summary": "Generated questions covering assessment criteria, evidence, and compliance",
  "response_timestamp": "2024-01-15T10:30:00Z"
}
```

### Question Types

- **Factual**: What specific information is stated in the documents?
- **Analytical**: How do the documents support or address specific requirements?
- **Comparative**: How do different sections or documents relate to each other?
- **Inferential**: What can be concluded from the evidence presented?
- **Application**: How can this information be applied to the validation context?

### Difficulty Levels

- **Basic**: Surface-level comprehension of document content
- **Intermediate**: Understanding relationships and implications
- **Advanced**: Critical analysis and synthesis of information

### Focus Areas

- `assessment_criteria`: Questions about assessment requirements and criteria
- `evidence`: Questions about evidence requirements and documentation
- `compliance`: Questions about regulatory compliance and standards
- `structure`: Questions about document organization and structure
- `findings`: Questions about conclusions and key findings

### Prompt Configuration

The workflow uses the `smart_question_generator` prompt type from the `prompts` table. The prompt is configured with:

- **Temperature**: 0.8 (higher creativity for diverse questions)
- **Max Output Tokens**: 4096
- **System Instruction**: Expert instructional design specialist persona
- **Output Schema**: Structured JSON with question metadata

---

## 2. Requirement Regenerator Workflow

### Purpose

The Requirement Regenerator analyzes an individual requirement and the validation documents, then regenerates the requirement with improved clarity, specificity, and evidence alignment while maintaining the original intent.

### Workflow File

`AIRequirementRegenerator-Workflow.json`

### Endpoint

```
POST /webhook/regenerate-requirement
```

### Request Body

```json
{
  "validation_detail_id": "validation-uuid",
  "requirement_id": "requirement-identifier",
  "requirement_text": "Original requirement text to be regenerated",
  "requirement_type": "performance_evidence"
}
```

### Response

```json
{
  "validation_detail_id": "validation-uuid",
  "requirement_id": "requirement-identifier",
  "original_requirement": "Original requirement text",
  "regenerated_requirement": "Improved requirement text with enhanced clarity and specificity",
  "improvement_summary": "Enhanced clarity, added specific evidence references, improved measurability",
  "evidence_references": [
    {
      "document": "Assessment Guide.pdf",
      "page": "12",
      "section": "Performance Criteria",
      "evidence_snippet": "Relevant quote from the document"
    }
  ],
  "alignment_notes": "Aligns with ASQA standards and unit competency requirements",
  "confidence_level": 0.85,
  "change_justification": "Original requirement was vague; regenerated version includes specific criteria and evidence references",
  "response_timestamp": "2024-01-15T10:30:00Z"
}
```

### Regeneration Principles

1. **Evidence Alignment**: Regenerated requirements are grounded in document evidence
2. **Clarity and Specificity**: Uses clear, unambiguous language with measurable criteria
3. **Completeness**: Addresses all relevant assessment dimensions
4. **Professional Quality**: Maintains formal, professional tone
5. **Context Preservation**: Maintains original intent and scope

### Prompt Configuration

The workflow uses the `requirement_regenerator` prompt type from the `prompts` table. The prompt is configured with:

- **Temperature**: 0.6 (balanced creativity and consistency)
- **Max Output Tokens**: 4096
- **System Instruction**: Expert RTO assessment specialist persona
- **Output Schema**: Structured JSON with requirement metadata and evidence references

---

## Architecture

### Common Pattern

Both workflows follow the same architectural pattern:

```
Webhook Input
    ↓
Parallel Fetching
    ├─ Fetch Documents (from documents table)
    └─ Fetch Prompt Template (from prompts table)
    ↓
Merge
    ↓
Prepare Context (JavaScript Code Node)
    ↓
Build Gemini Request (JavaScript Code Node)
    ↓
Call Gemini API (HTTP Request)
    ↓
Extract Response (JavaScript Code Node)
    ↓
Respond to Webhook
```

### Key Components

1. **Webhook Trigger**: Receives requests with validation_detail_id
2. **Document Fetcher**: Queries `documents` table for validation documents
3. **Prompt Fetcher**: Queries `prompts` table for the appropriate prompt template
4. **Context Preparation**: Merges documents and context into a comprehensive prompt
5. **Gemini Request Builder**: Constructs API request with documents and structured output schema
6. **Gemini API Call**: Calls Google Gemini 2.0 Flash with documents
7. **Response Extraction**: Parses JSON response and formats for return
8. **Webhook Response**: Returns structured JSON to the caller

### Shared Infrastructure

| Component | Description |
|-----------|-------------|
| Database | Supabase PostgreSQL |
| Documents Table | `documents` (validation_detail_id, gemini_file_uri, storage_path) |
| Prompts Table | `prompts` (prompt_type, system_instruction, output_schema) |
| AI Model | Google Gemini 2.0 Flash Experimental |
| Storage | Supabase Storage (for document files) |
| Credentials | Google PaLM API credentials |

---

## Database Schema

### Prompts Table Extension

Both workflows require entries in the `prompts` table:

```sql
-- Smart Question Generator Prompt
INSERT INTO prompts (
    prompt_type,
    requirement_type,
    document_type,
    prompt_name,
    system_instruction,
    prompt_text,
    generation_config,
    output_schema,
    is_active,
    is_default
) VALUES (
    'smart_question_generator',
    'general',
    'all',
    'Smart Question Generator - Validation Context',
    '[System instruction...]',
    '[Prompt text...]',
    '{"temperature": 0.8, "maxOutputTokens": 4096}',
    '[Output schema...]',
    true,
    true
);

-- Requirement Regenerator Prompt
INSERT INTO prompts (
    prompt_type,
    requirement_type,
    document_type,
    prompt_name,
    system_instruction,
    prompt_text,
    generation_config,
    output_schema,
    is_active,
    is_default
) VALUES (
    'requirement_regenerator',
    'general',
    'all',
    'Requirement Regenerator - Evidence-Based Refinement',
    '[System instruction...]',
    '[Prompt text...]',
    '{"temperature": 0.6, "maxOutputTokens": 4096}',
    '[Output schema...]',
    true,
    true
);
```

The SQL migration file is located at:
`supabase/migrations/20251206_add_smart_question_and_requirement_regenerator_prompts.sql`

---

## Deployment

### Prerequisites

1. Supabase PostgreSQL database with `documents` and `prompts` tables
2. n8n instance with Google Gemini API credentials configured
3. Documents uploaded to Supabase Storage with Gemini File URIs

### Deployment Steps

#### 1. Run Database Migration

```bash
# Apply the SQL migration
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20251206_add_smart_question_and_requirement_regenerator_prompts.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

#### 2. Import n8n Workflows

1. Open n8n dashboard
2. Create new workflow
3. Import `AISmartQuestionGenerator-Workflow.json`
4. Configure credentials (Supabase PostgreSQL, Google Gemini API)
5. Enable and activate the workflow
6. Repeat for `AIRequirementRegenerator-Workflow.json`

#### 3. Test the Workflows

**Test Smart Question Generator:**

```bash
curl -X POST http://n8n-instance/webhook/smart-questions \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": "your-validation-id"
  }'
```

**Test Requirement Regenerator:**

```bash
curl -X POST http://n8n-instance/webhook/regenerate-requirement \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": "your-validation-id",
    "requirement_id": "req-123",
    "requirement_text": "Demonstrate competency in the unit",
    "requirement_type": "performance_evidence"
  }'
```

---

## Integration with Frontend

### Smart Question Generator

```typescript
async function generateSmartQuestions(validationDetailId: string) {
  const response = await fetch('http://n8n-instance/webhook/smart-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validation_detail_id: validationDetailId })
  });
  
  const data = await response.json();
  return data.questions;
}
```

### Requirement Regenerator

```typescript
async function regenerateRequirement(
  validationDetailId: string,
  requirementId: string,
  requirementText: string,
  requirementType: string
) {
  const response = await fetch('http://n8n-instance/webhook/regenerate-requirement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
      requirement_id: requirementId,
      requirement_text: requirementText,
      requirement_type: requirementType
    })
  });
  
  const data = await response.json();
  return data;
}
```

---

## Monitoring and Maintenance

### Key Metrics

- Average response time per workflow
- Gemini API token usage
- Question generation quality (user feedback)
- Requirement regeneration acceptance rate
- Error rates and types

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No documents found | Invalid validation_detail_id | Verify the validation_detail_id exists in documents table |
| Gemini API errors | Invalid file URIs | Check gemini_file_uri format in documents table |
| Poor question quality | Prompt needs refinement | Update prompt in prompts table |
| Requirement not improved | Insufficient evidence | Ensure documents contain relevant evidence |

---

## Future Enhancements

1. **Question Filtering**: Allow users to filter questions by type or difficulty
2. **Batch Regeneration**: Support regenerating multiple requirements at once
3. **Feedback Loop**: Collect user feedback to improve prompt quality
4. **Custom Prompts**: Allow users to customize prompts per validation context
5. **Question Answering**: Automatically answer generated questions
6. **Requirement Validation**: Validate regenerated requirements against standards

---

## Related Documentation

- [AI Chat Agent Documentation](./AIChatFlow.json)
- [AI Validation Flow Documentation](./AI%20Validation%20Flow%20-%20Enhanced%20(Individual%20+%20Session%20Context).json)
- [n8n Workflows README](./README.md)

---

## Support

For issues or questions, please refer to the main NytroAI documentation or contact the development team.
