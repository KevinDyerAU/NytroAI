# NytroAI Validation Prompts

## Overview

NytroAI uses a **prompt-based validation system** where AI validation behavior is controlled through database-stored prompt templates. This approach provides:

- ✅ **Flexibility**: Update prompts without code changes
- ✅ **Versioning**: Track prompt evolution over time
- ✅ **A/B Testing**: Compare different prompt strategies
- ✅ **Customization**: Different prompts for different requirement types
- ✅ **Consistency**: Structured outputs with JSON schemas

---

## Validation Strategy

### Individual Validation Approach

**Decision**: Validate each requirement individually (not in batches)

**Rationale**:
1. **Maximum Accuracy**: AI focuses on one requirement at a time
2. **No Cross-Contamination**: No risk of confusing similar requirements
3. **Clear Reasoning**: Focused, detailed explanations per requirement
4. **Proven Approach**: Legacy system validates this strategy works
5. **Debuggable**: Easy to verify and troubleshoot individual results

**Trade-offs**:
- More API calls (50 vs 6 for batch)
- Slightly slower (~3-5 min vs ~1 min)
- Higher cost ($0.50 vs $0.07 per validation)
- **BUT**: Accuracy is the top priority

### Context Window Utilization

**Modern Context Windows Change Everything**:
- Gemini 2.0 Flash: **1M tokens** (~2,000 pages)
- Average validation: ~350K tokens (all documents + requirement)
- **No need for embeddings or chunking**

**Individual Validation with Shared Context**:
```
For each requirement:
  Input: ALL documents (200K-500K tokens) + ONE requirement (50-100 tokens)
  Output: Detailed validation result with citations
  
Total: 50 requirements × 350K tokens = 17.5M tokens processed
Cost: 50 × $0.01 = $0.50 per validation
Time: 50 × 4 seconds (with rate limiting) = 3.3 minutes
```

---

## Prompt Structure

### Database Schema

```sql
CREATE TABLE prompts (
  id BIGSERIAL PRIMARY KEY,
  
  -- Identification
  prompt_type TEXT NOT NULL,           -- 'validation', 'smart_question', 'report'
  requirement_type TEXT,                -- 'knowledge_evidence', 'performance_evidence', etc.
  document_type TEXT,                   -- 'unit', 'learner_guide', 'both'
  
  -- Content
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,           -- Main prompt with {{variables}}
  system_instruction TEXT,             -- System role/persona
  
  -- Output Configuration
  output_schema JSONB,                 -- JSON schema for structured output
  generation_config JSONB,             -- Temperature, topP, etc.
  
  -- Versioning
  version TEXT DEFAULT 'v1.0',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Prompt Components

**1. Prompt Text** (`prompt_text`):
- Main instruction to the AI
- Uses `{{variable}}` placeholders for dynamic content
- Structured with numbered sections
- Specific about expected output

**2. System Instruction** (`system_instruction`):
- Defines AI's role and expertise
- Sets context and expectations
- Examples: "You are an expert RTO assessor..."

**3. Output Schema** (`output_schema`):
- JSON schema defining expected response structure
- Ensures consistent, parseable outputs
- Required fields, types, enums

**4. Generation Config** (`generation_config`):
- Temperature: 0.2 (low for consistency)
- topP: 0.95
- topK: 40
- maxOutputTokens: 8192
- responseMimeType: "application/json"

---

## Requirement Types

### 1. Knowledge Evidence (KE)

**Purpose**: Validate that assessment covers required knowledge

**Unit Documents**:
```
Validates: Assessment questions/tasks cover the knowledge requirement
Focus: Will learners be assessed on this knowledge?
Output: Status, reasoning, mapped questions, smart question, benchmark
```

**Learner Guide**:
```
Validates: Learning content covers the knowledge requirement
Focus: Can learners acquire this knowledge from the materials?
Output: Status, reasoning, mapped content, recommendations
```

**Example Prompt** (Unit):
```
Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.

Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}

Analyze the documents thoroughly and determine:
1. **Status**: Is this requirement Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment in detail
3. **Mapped Content**: What specific questions, tasks, or content address this requirement? Include question numbers and exact text.
4. **Unmapped Content**: If not fully Met, what aspects are missing?
5. **Recommendations**: How can gaps be addressed?
6. **Smart Question**: Generate an open-ended assessment question that addresses this requirement
7. **Benchmark Answer**: Provide the expected learner response
8. **Document References**: Cite specific pages, sections, and documents

Be thorough and cite specific evidence. Focus on whether learners will be assessed on this knowledge.
```

### 2. Performance Evidence (PE)

**Purpose**: Validate that assessment requires demonstration of performance

**Unit Documents**:
```
Validates: Assessment tasks require the performance
Focus: Will learners demonstrate this performance?
Output: Status, reasoning, mapped tasks, recommendations
```

**Learner Guide**:
```
Validates: Learning materials prepare learners for the performance
Focus: Are learners adequately prepared?
Output: Status, reasoning, mapped content, recommendations
```

**Key Differences from KE**:
- Focus on **doing** not **knowing**
- Look for practical tasks, simulations, role-plays
- Assess whether performance is observable and measurable

### 3. Foundation Skills (FS)

**Purpose**: Validate that foundation skills are integrated and assessed

**Foundation Skills Include**:
- Reading
- Writing
- Oral Communication
- Numeracy
- Learning
- Problem Solving
- Initiative and Enterprise
- Technology
- Planning and Organising
- Self Management
- Teamwork

**Unit Documents**:
```
Validates: Skills are assessed in integrated, authentic ways
Focus: Are skills embedded in assessment tasks?
Output: Status, reasoning, mapped tasks, smart question
```

**Learner Guide**:
```
Validates: Materials develop the foundation skills
Focus: Do learners practice and develop the skills?
Output: Status, reasoning, mapped content, activities
```

**Key Considerations**:
- Skills should be **integrated** (not standalone)
- Assessment should be **authentic** (real-world context)
- Multiple skills often assessed together

### 4. Elements & Performance Criteria (E_PC)

**Purpose**: Validate coverage of performance criteria

**Structure**:
- Elements: Major components of competency
- Performance Criteria: Observable indicators of competent performance

**Unit Documents**:
```
Validates: Assessment covers the performance criterion
Focus: Is this criterion adequately assessed?
Output: Status, reasoning, mapped content
```

**Learner Guide**:
```
Validates: Content explains what competent performance looks like
Focus: Do learners understand the criterion?
Output: Status, reasoning, mapped content
```

### 5. Assessment Conditions (AC)

**Purpose**: Validate that assessment conditions are specified and met

**Conditions Include**:
- Skills must be demonstrated in workplace or simulated environment
- Assessment must occur over time
- Required resources and equipment
- Required supervision or support

**Unit Documents**:
```
Validates: Conditions are specified and implemented
Focus: Are conditions clearly stated and achievable?
Output: Status, reasoning, mapped specifications
```

---

## Prompt Variables

### Standard Variables

All prompts support these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{requirement_number}}` | Requirement identifier | "KE1.1", "PE2", "FS3" |
| `{{requirement_text}}` | Full requirement text | "Knowledge of WHS legislation..." |
| `{{requirement_type}}` | Type of requirement | "knowledge_evidence" |
| `{{unit_code}}` | Unit of competency code | "TLIF0006" |
| `{{unit_title}}` | Unit title | "Apply a fatigue risk management system" |
| `{{document_type}}` | Type of document | "unit", "learner_guide" |
| `{{documents}}` | List of document URIs | Array of Gemini file URIs |

### Document Context

Documents are provided as Gemini File API URIs:

```json
{
  "documents": [
    {
      "filename": "TLIF0006_Assessment.pdf",
      "gemini_file_uri": "files/abc123xyz",
      "mime_type": "application/pdf"
    }
  ]
}
```

---

## Output Schema

### Validation Result Schema

```json
{
  "type": "object",
  "properties": {
    "requirement_number": {"type": "string"},
    "requirement_text": {"type": "string"},
    "status": {
      "type": "string", 
      "enum": ["Met", "Partially Met", "Not Met"]
    },
    "reasoning": {"type": "string"},
    "mapped_content": {"type": "string"},
    "unmapped_content": {"type": "string"},
    "recommendations": {"type": "string"},
    "smart_question": {
      "type": "object",
      "properties": {
        "question_text": {"type": "string"},
        "question_category": {"type": "string"},
        "benchmark_answer": {"type": "string"}
      }
    },
    "doc_references": {"type": "string"},
    "confidence_score": {
      "type": "number", 
      "minimum": 0, 
      "maximum": 1
    }
  },
  "required": ["requirement_number", "status", "reasoning"]
}
```

### Status Values

**Met**:
- Requirement is fully addressed
- Sufficient evidence in documents
- No significant gaps

**Partially Met**:
- Requirement is partially addressed
- Some evidence present
- Significant gaps exist

**Not Met**:
- Requirement is not addressed
- Little to no evidence
- Major gaps

### Smart Question Schema

```json
{
  "question_text": "Explain how you would...",
  "question_category": "Application",
  "benchmark_answer": "A competent learner would..."
}
```

**Question Categories**:
- Knowledge Recall
- Comprehension
- Application
- Analysis
- Evaluation
- Creation

---

## Prompt Versioning

### Version Strategy

**Semantic Versioning**: `v{major}.{minor}`

- **Major**: Breaking changes to output schema
- **Minor**: Prompt improvements, clarifications

**Example**:
- `v1.0`: Initial prompt
- `v1.1`: Improved wording, same schema
- `v2.0`: New output fields added

### Managing Versions

**Create New Version**:
```sql
-- Deactivate old version
UPDATE prompts
SET is_active = false
WHERE prompt_type = 'validation'
  AND requirement_type = 'knowledge_evidence'
  AND document_type = 'unit'
  AND version = 'v1.0';

-- Insert new version
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  prompt_text,
  version,
  is_active,
  is_default
) VALUES (
  'validation',
  'knowledge_evidence',
  'unit',
  'KE Unit Validation v1.1',
  '... improved prompt text ...',
  'v1.1',
  true,
  true
);
```

**Rollback to Previous Version**:
```sql
-- Activate old version
UPDATE prompts
SET is_active = true, is_default = true
WHERE id = 123;  -- Old version ID

-- Deactivate new version
UPDATE prompts
SET is_active = false, is_default = false
WHERE id = 456;  -- New version ID
```

---

## Prompt Lookup

### n8n Workflow Lookup

**Node**: "Fetch Prompt Template"

```sql
SELECT 
  prompt_text,
  system_instruction,
  output_schema,
  generation_config
FROM prompts
WHERE prompt_type = 'validation'
  AND requirement_type = '{{requirement_type}}'
  AND document_type = '{{document_type}}'
  AND is_active = true
  AND is_default = true
LIMIT 1;
```

### Fallback Strategy

If no exact match found:

1. Try `document_type = 'both'`
2. Try `requirement_type = 'all'`
3. Use generic validation prompt

**Example**:
```sql
SELECT prompt_text, system_instruction, output_schema, generation_config
FROM prompts
WHERE prompt_type = 'validation'
  AND is_active = true
  AND is_default = true
  AND (
    (requirement_type = '{{requirement_type}}' AND document_type = '{{document_type}}')
    OR (requirement_type = '{{requirement_type}}' AND document_type = 'both')
    OR (requirement_type = 'all' AND document_type = '{{document_type}}')
    OR (requirement_type = 'all' AND document_type = 'both')
  )
ORDER BY 
  CASE 
    WHEN requirement_type = '{{requirement_type}}' AND document_type = '{{document_type}}' THEN 1
    WHEN requirement_type = '{{requirement_type}}' AND document_type = 'both' THEN 2
    WHEN requirement_type = 'all' AND document_type = '{{document_type}}' THEN 3
    ELSE 4
  END
LIMIT 1;
```

---

## Prompt Best Practices

### 1. Be Specific

❌ **Bad**: "Validate this requirement"

✅ **Good**: "Validate the following Knowledge Evidence requirement against the provided Unit assessment documents. Determine if learners will be assessed on this knowledge."

### 2. Structure Output

❌ **Bad**: "Provide your analysis"

✅ **Good**: "Analyze and provide: 1. Status (Met/Partially Met/Not Met), 2. Reasoning, 3. Mapped Content, 4. Recommendations"

### 3. Request Evidence

❌ **Bad**: "Is this requirement met?"

✅ **Good**: "Cite specific questions, tasks, or content that address this requirement. Include question numbers and exact text."

### 4. Define Criteria

❌ **Bad**: "Assess the requirement"

✅ **Good**: "Status is Met if: requirement is fully addressed, sufficient evidence exists, no significant gaps. Partially Met if: some evidence present but gaps exist. Not Met if: little to no evidence."

### 5. Use Examples

Include examples in prompts when helpful:

```
Example of Mapped Content:
"Question 3 asks 'Explain the WHS legislation requirements...' which directly addresses this knowledge requirement. Question 7 requires learners to identify relevant legislation."
```

### 6. Set Persona

Define AI's role and expertise:

```
You are an expert RTO assessor with 10+ years experience validating assessment tools against Training Package requirements. You understand Australian VET standards, competency-based assessment principles, and ASQA compliance requirements.
```

### 7. Specify Tone

```
Provide constructive, professional feedback. Be thorough but concise. Focus on actionable recommendations.
```

---

## Testing Prompts

### A/B Testing

Compare two prompt versions:

1. Create two prompts with same type/requirement/document but different versions
2. Set both to `is_active = true`
3. Randomly select one in workflow
4. Compare results
5. Promote winner to `is_default = true`

### Prompt Metrics

Track prompt performance:

```sql
-- Average confidence by prompt version
SELECT 
  p.version,
  AVG((vr.metadata->>'confidence_score')::numeric) as avg_confidence,
  COUNT(*) as validation_count
FROM validation_results vr
JOIN prompts p ON vr.metadata->>'prompt_id' = p.id::text
WHERE p.prompt_type = 'validation'
  AND p.requirement_type = 'knowledge_evidence'
GROUP BY p.version
ORDER BY avg_confidence DESC;
```

### Quality Checks

**Manual Review**:
- Sample 10 random validations
- Check reasoning quality
- Verify citations are accurate
- Assess recommendation usefulness

**Automated Checks**:
- All required fields present
- Status is valid enum value
- Confidence score in range [0, 1]
- Citations reference actual documents

---

## Prompt Maintenance

### Regular Reviews

**Monthly**:
- Review validation results
- Check for common issues
- Gather user feedback
- Update prompts as needed

**Quarterly**:
- Analyze prompt performance metrics
- A/B test new prompt variations
- Update documentation
- Archive old versions

### Updating Prompts

**Process**:
1. Identify issue or improvement opportunity
2. Draft new prompt text
3. Test with sample requirements
4. Create new version in database
5. Deploy and monitor
6. Rollback if issues arise

**Testing Checklist**:
- [ ] Prompt produces valid JSON
- [ ] All required fields present
- [ ] Reasoning is clear and detailed
- [ ] Citations are specific and accurate
- [ ] Recommendations are actionable
- [ ] Smart questions are appropriate
- [ ] Benchmark answers are correct

---

## Advanced Features

### Custom Prompts

Organizations can create custom prompts for specific needs:

```sql
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  prompt_text,
  system_instruction,
  version,
  is_active,
  metadata
) VALUES (
  'validation',
  'knowledge_evidence',
  'unit',
  'Custom KE Validation for Industry X',
  '... custom prompt text ...',
  '... custom system instruction ...',
  'v1.0-custom',
  true,
  '{"organization": "Acme RTO", "industry": "Transport"}'::jsonb
);
```

### Prompt Templates

Use template inheritance:

```sql
-- Base template
INSERT INTO prompts (name, prompt_text, metadata)
VALUES (
  'Base Validation Template',
  'Validate {{requirement_type}} requirement...',
  '{"is_template": true}'::jsonb
);

-- Derived prompts reference base
INSERT INTO prompts (name, prompt_text, metadata)
VALUES (
  'KE Validation',
  '{{base_template}} Focus on knowledge assessment...',
  '{"base_template_id": 123}'::jsonb
);
```

### Multi-Language Prompts

Support multiple languages:

```sql
ALTER TABLE prompts ADD COLUMN language TEXT DEFAULT 'en';

-- English prompt
INSERT INTO prompts (name, prompt_text, language)
VALUES ('KE Validation', '...', 'en');

-- Spanish prompt
INSERT INTO prompts (name, prompt_text, language)
VALUES ('Validación KE', '...', 'es');
```

---

## Troubleshooting

### Common Issues

**Issue**: Validation returns "Not Met" for everything

**Solution**: Check prompt is not too strict. Review criteria for "Met" status.

---

**Issue**: Citations are vague or incorrect

**Solution**: Update prompt to request specific page numbers, question numbers, exact quotes.

---

**Issue**: Smart questions are too simple

**Solution**: Add examples of good questions to prompt. Specify Bloom's taxonomy level.

---

**Issue**: Output doesn't match schema

**Solution**: Verify `output_schema` is correct. Check `responseMimeType` is "application/json". Test with simpler schema first.

---

**Issue**: Inconsistent results for same requirement

**Solution**: Lower temperature (0.1-0.2). Add more specific criteria to prompt. Use examples.

---

## Summary

NytroAI's prompt-based validation system provides:

✅ **Flexibility**: Update behavior without code changes  
✅ **Accuracy**: Individual validation with focused prompts  
✅ **Consistency**: Structured outputs with JSON schemas  
✅ **Versioning**: Track and rollback prompt changes  
✅ **Customization**: Different prompts for different needs  
✅ **Testability**: A/B test and measure prompt performance  

**Key Principles**:
1. **Individual > Batch**: Accuracy is the priority
2. **Specific > Generic**: Detailed prompts produce better results
3. **Structured > Freeform**: JSON schemas ensure consistency
4. **Evidence-Based**: Always request citations and examples
5. **Iterative**: Continuously improve prompts based on results

For implementation details, see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).
