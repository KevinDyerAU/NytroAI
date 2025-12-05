# AI Smart Question Generator and Individual Requirement Revalidation Workflows

## Overview

This document describes two new AI-powered workflows that extend the NytroAI validation platform:

1. **Smart Question Generator**: Generates intelligent, contextually relevant questions about validation documents
2. **Individual Requirement Revalidation**: Validates individual requirements against document evidence using the same prompts as the full validation flow

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

## 2. Individual Requirement Revalidation Workflow

### Purpose

The Individual Requirement Revalidation workflow validates a single requirement against the validation documents, providing a comprehensive assessment of whether the requirement is met, along with evidence references, gap analysis, and actionable recommendations.

**Important**: This workflow **reuses the existing validation prompts** from the `prompts` table based on `requirement_type` and `document_type`, ensuring consistency with the full validation flow.

### Workflow File

`AIRequirementRevalidation-Workflow.json`

### Endpoint

```
POST /webhook/revalidate-requirement
```

### Request Body

```json
{
  "validation_detail_id": "validation-uuid",
  "requirement_id": "requirement-identifier",
  "requirement_text": "The learner must demonstrate competency in performing the assessment task under workplace conditions",
  "requirement_type": "performance_evidence",
  "document_type": "unit"
}
```

**Required Fields**:
- `validation_detail_id`: UUID of the validation
- `requirement_id`: Identifier for the requirement
- `requirement_text`: The requirement statement to validate
- `requirement_type`: Type of requirement (e.g., `performance_evidence`, `knowledge_evidence`, `assessment_conditions`)
- `document_type`: Type of document (e.g., `unit`, `learner_guide`) - defaults to `unit` if not provided

### Response

```json
{
  "validation_detail_id": "validation-uuid",
  "requirement_id": "requirement-identifier",
  "requirement_text": "The learner must demonstrate competency in performing the assessment task under workplace conditions",
  "requirement_type": "performance_evidence",
  "document_type": "unit",
  "validation_status": "Met",
  "confidence_level": 0.85,
  "summary": "The requirement is fully met with strong evidence of workplace-based assessment",
  "evidence_found": [
    {
      "document": "Assessment Guide.pdf",
      "page": "12",
      "section": "Performance Criteria",
      "evidence_snippet": "All assessments are conducted in simulated workplace environments...",
      "relevance": "Directly demonstrates workplace conditions requirement"
    }
  ],
  "gaps_identified": [
    {
      "gap_description": "No explicit mention of specific workplace equipment used",
      "severity": "Minor",
      "impact": "Does not significantly affect validation outcome"
    }
  ],
  "compliance_notes": "Aligns with ASQA standards for workplace assessment and meets unit competency requirements",
  "recommendations": [
    {
      "recommendation": "Include specific examples of workplace equipment in assessment documentation",
      "priority": "Low",
      "rationale": "Would strengthen evidence and provide clearer context"
    }
  ],
  "validation_notes": "Strong evidence of workplace-based assessment with appropriate conditions",
  "response_timestamp": "2024-01-15T10:30:00Z"
}
```

### Prompt Reuse Pattern

The revalidation workflow **does not use a separate prompt**. Instead, it queries the existing `prompts` table using the same pattern as the full validation flow:

```sql
SELECT * FROM prompts 
WHERE prompt_type = 'validation'
  AND requirement_type = '<requirement_type>'
  AND document_type = '<document_type>'
  AND is_active = true
  AND is_default = true
LIMIT 1
```

**Benefits of this approach**:
1. **Consistency**: Individual revalidation uses the exact same prompts as full validation
2. **Maintainability**: Only one set of prompts to maintain per requirement type
3. **Quality**: Ensures validation quality is consistent across the platform
4. **Flexibility**: Prompt improvements automatically apply to both workflows

### Validation Status Values

- **Met**: The requirement is fully satisfied by the evidence in the documents
- **Partially Met**: The requirement is addressed but with gaps or limitations
- **Not Met**: The requirement is not satisfied by the evidence
- **Not Applicable**: The requirement does not apply to this validation context

### Evidence Structure

Each evidence item includes:
- **document**: Name of the document containing the evidence
- **page**: Page number where evidence is found
- **section**: Section or heading reference
- **evidence_snippet**: Quote or description of the evidence
- **relevance**: Explanation of how this evidence supports the requirement

### Gap Analysis

Each gap includes:
- **gap_description**: Description of missing or insufficient evidence
- **severity**: Critical, Major, or Minor
- **impact**: Impact on the validation outcome

### Recommendations

Each recommendation includes:
- **recommendation**: Specific actionable recommendation
- **priority**: High, Medium, or Low
- **rationale**: Why this recommendation is important

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

### Key Difference: Prompt Fetching

**Smart Question Generator**:
```sql
SELECT * FROM prompts 
WHERE prompt_type = 'smart_question_generator'
  AND is_active = true 
  AND is_default = true 
LIMIT 1
```

**Individual Requirement Revalidation**:
```sql
SELECT * FROM prompts 
WHERE prompt_type = 'validation'
  AND requirement_type = '<requirement_type>'
  AND document_type = '<document_type>'
  AND is_active = true
  AND is_default = true
LIMIT 1
```

### Shared Infrastructure

| Component | Description |
|-----------|-------------|
| Database | Supabase PostgreSQL |
| Documents Table | `documents` (validation_detail_id, gemini_file_uri, storage_path) |
| Prompts Table | `prompts` (prompt_type, requirement_type, document_type, system_instruction, output_schema) |
| AI Model | Google Gemini 2.0 Flash Experimental |
| Storage | Supabase Storage (for document files) |
| Credentials | Google PaLM API credentials |

---

## Database Schema

### Prompts Table

The revalidation workflow reuses existing validation prompts. The `prompts` table structure:

```sql
CREATE TABLE prompts (
  id SERIAL PRIMARY KEY,
  prompt_type VARCHAR(50) NOT NULL,           -- 'validation' or 'smart_question_generator'
  requirement_type VARCHAR(100),              -- e.g., 'performance_evidence', 'knowledge_evidence'
  document_type VARCHAR(100),                 -- e.g., 'unit', 'learner_guide'
  prompt_name VARCHAR(255) NOT NULL,
  system_instruction TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  generation_config JSONB,
  output_schema JSONB,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### New Prompt Added

Only the Smart Question Generator prompt needs to be added:

```sql
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
```

The SQL migration file is located at:
`supabase/migrations/20251206_add_smart_question_generator_prompt.sql`

---

## Deployment

### Prerequisites

1. Supabase PostgreSQL database with `documents` and `prompts` tables
2. Existing validation prompts in the `prompts` table (for revalidation workflow)
3. n8n instance with Google Gemini API credentials configured
4. Documents uploaded to Supabase Storage with Gemini File URIs

### Deployment Steps

#### 1. Run Database Migration

```bash
# Apply the SQL migration (only adds Smart Question Generator prompt)
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20251206_add_smart_question_generator_prompt.sql
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
6. Repeat for `AIRequirementRevalidation-Workflow.json`

#### 3. Test the Workflows

**Test Smart Question Generator:**

```bash
curl -X POST http://n8n-instance/webhook/smart-questions \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": "your-validation-id"
  }'
```

**Test Individual Requirement Revalidation:**

```bash
curl -X POST http://n8n-instance/webhook/revalidate-requirement \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": "your-validation-id",
    "requirement_id": "req-123",
    "requirement_text": "Demonstrate competency in the unit",
    "requirement_type": "performance_evidence",
    "document_type": "unit"
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

### Individual Requirement Revalidation

```typescript
async function revalidateRequirement(
  validationDetailId: string,
  requirementId: string,
  requirementText: string,
  requirementType: string,
  documentType: string = 'unit'
) {
  const response = await fetch('http://n8n-instance/webhook/revalidate-requirement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
      requirement_id: requirementId,
      requirement_text: requirementText,
      requirement_type: requirementType,
      document_type: documentType
    })
  });
  
  const data = await response.json();
  return data;
}

// Example: Display validation result
function displayValidationResult(result: any) {
  console.log(`Status: ${result.validation_status}`);
  console.log(`Confidence: ${(result.confidence_level * 100).toFixed(0)}%`);
  console.log(`Summary: ${result.summary}`);
  
  if (result.evidence_found.length > 0) {
    console.log('Evidence:');
    result.evidence_found.forEach((evidence: any) => {
      console.log(`  - ${evidence.document} (p.${evidence.page}): ${evidence.evidence_snippet}`);
    });
  }
  
  if (result.gaps_identified.length > 0) {
    console.log('Gaps:');
    result.gaps_identified.forEach((gap: any) => {
      console.log(`  - [${gap.severity}] ${gap.gap_description}`);
    });
  }
  
  if (result.recommendations.length > 0) {
    console.log('Recommendations:');
    result.recommendations.forEach((rec: any) => {
      console.log(`  - [${rec.priority}] ${rec.recommendation}`);
    });
  }
}
```

---

## Monitoring and Maintenance

### Key Metrics

- Average response time per workflow
- Gemini API token usage
- Question generation quality (user feedback)
- Validation accuracy and consistency
- Error rates and types

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No documents found | Invalid validation_detail_id | Verify the validation_detail_id exists in documents table |
| Gemini API errors | Invalid file URIs | Check gemini_file_uri format in documents table |
| Poor question quality | Prompt needs refinement | Update smart_question_generator prompt in prompts table |
| No prompt found for revalidation | Missing validation prompt | Ensure validation prompts exist for the requirement_type and document_type |
| Inconsistent validation | Wrong prompt retrieved | Verify requirement_type and document_type are correct |

---

## Use Cases

### Smart Question Generator

1. **Onboarding**: Help new validators understand document structure
2. **Training**: Generate practice questions for validator training
3. **Quality Assurance**: Ensure comprehensive document review
4. **Self-Assessment**: Allow users to test their understanding
5. **Documentation**: Generate FAQ content from validation documents

### Individual Requirement Revalidation

1. **Spot Checks**: Quickly validate specific requirements without full revalidation
2. **Dispute Resolution**: Provide evidence-based validation for contested requirements
3. **Continuous Improvement**: Identify gaps and recommendations for specific requirements
4. **Compliance Audits**: Validate individual compliance requirements
5. **Requirement Updates**: Re-validate requirements after document updates
6. **Quality Assurance**: Verify specific requirements meet standards

---

## Future Enhancements

1. **Question Filtering**: Allow users to filter questions by type or difficulty
2. **Batch Revalidation**: Support revalidating multiple requirements at once
3. **Feedback Loop**: Collect user feedback to improve prompt quality
4. **Custom Prompts**: Allow users to customize prompts per validation context
5. **Question Answering**: Automatically answer generated questions
6. **Validation History**: Track validation results over time
7. **Confidence Thresholds**: Alert when confidence levels are below threshold
8. **Evidence Extraction**: Extract and store evidence separately for reuse

---

## Related Documentation

- [AI Chat Agent Documentation](./AIChatFlow.json)
- [AI Validation Flow Documentation](./AI%20Validation%20Flow%20-%20Enhanced%20(Individual%20+%20Session%20Context).json)
- [n8n Workflows README](./README.md)

---

## Support

For issues or questions, please refer to the main NytroAI documentation or contact the development team.
