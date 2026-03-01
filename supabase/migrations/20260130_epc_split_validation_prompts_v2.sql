-- Migration: Add EPC (Elements Performance Criteria) v2.0 Split Prompts
-- Date: 2026-01-30
-- Description: Adds missing v2.0 split prompts for elements_performance_criteria validation
-- These prompts include {{requirement_text}} placeholder to fix intermittent "requirement not provided" errors

-- =====================================================
-- EPC Unit Validation v2.0 (Phase 1) - Validation Only
-- =====================================================
INSERT INTO prompts (
  name,
  prompt_type,
  requirement_type,
  document_type,
  prompt_text,
  system_instruction,
  output_schema,
  version,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'EPC Unit Validation v2.0 (Phase 1)',
  'validation',
  'elements_performance_criteria',
  'unit',
  'Validate the following Performance Criterion against the provided Unit assessment documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Performance criteria define competent performance standards. Assessment must require **practical demonstration** of skills, not just knowledge.

### Critical Requirement Alignment

Before validating, parse the Performance Criterion:
- **ACTION VERB**: What must the learner DO? (e.g., "identify", "apply", "communicate", "implement")
- **OBJECT**: What is being acted upon? (e.g., "workplace procedures", "safety requirements")
- **CONTEXT**: When/where/how does this happen? (e.g., "in accordance with regulations")

The assessment task MUST require the learner to perform the EXACT action described using the same verb, object, and context.

### Valid Assessment Methods
1. **Direct Observation** - Assessor watches learner perform tasks
2. **Practical Demonstration** - Learner shows skills under specified conditions
3. **Competency Checklists** - Structured observation against criteria
4. **Scenario-Based Assessment** - Only when other methods unsuitable

### Content to Exclude
- Assessor/Trainer Checklists (support evidence collection, not assessment)
- Knowledge-only questions (must require performance)
- Generic tasks that relate to the Element but miss the specific PC wording

## Validation Instructions

1. **Search ALL documents** for tasks requiring learners to **perform** the criterion action
2. For each match, record: Document name, Section, Task/Observation number, Page number
3. Verify tasks require the **same action** specified in the criterion (same verb, object, context)
4. Determine if assessment is sufficient for competent performance

## Output Requirements

### status (required)
- **"Met"**: Fully assessed through practical tasks/observations that directly address the PC
- **"Partially Met"**: Some assessment exists but gaps remain (missing verb, object, or context)
- **"Not Met"**: No practical tasks assess this criterion, or tasks are generic/misaligned

### reasoning (required, max 300 words)
Explain your assessment with specific task/observation references.
Include the parsed ACTION VERB, OBJECT, and CONTEXT from the PC.

### mapped_content (required, max 250 words)
List specific tasks assessing this criterion with page numbers.
Format: "Task X (Page Y) requires: ''[description]''"
Use "N/A" if none found.

### citations (required, array)
Document references in format: ["Document name, Section, Task number, Page X"]

### unmapped_content (required, max 200 words)
**Only if Partially Met or Not Met**: What aspects are not assessed?
Use "N/A" if Met.',
  'You are a Senior VET Compliance Consultant auditing assessment tools for Australian RTOs. You ensure all Performance Criteria are assessed through OBSERVABLE PRACTICAL TASKS that DIRECTLY address the specific criterion text. Return only valid JSON.',
  '{"type":"object","properties":{"status":{"type":"string","enum":["Met","Partially Met","Not Met"]},"reasoning":{"type":"string"},"mapped_content":{"type":"string"},"citations":{"type":"array","items":{"type":"string"}},"unmapped_content":{"type":"string"}},"required":["status","reasoning","mapped_content","citations","unmapped_content"]}',
  '2.0',
  true,
  true,
  NOW(),
  NOW()
);

-- =====================================================
-- EPC Generation v2.0 (Phase 2) - Smart Task Generation
-- =====================================================
INSERT INTO prompts (
  name,
  prompt_type,
  requirement_type,
  document_type,
  prompt_text,
  system_instruction,
  output_schema,
  version,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'EPC Generation v2.0 (Phase 2)',
  'generation',
  'elements_performance_criteria',
  'unit',
  'Generate a SMART remediation task for the following Performance Criterion that requires improvement.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}
**Current Status:** {{status}}
**Gaps Identified:** {{unmapped_content}}

## Task Generation Rules

### Critical Requirement Alignment

The SMART Task MUST:
1. Use the EXACT or equivalent wording from the PC
2. Directly require the learner to demonstrate ACTION VERB + OBJECT + CONTEXT
3. Be practical and observable
4. NOT be a generic task that merely relates to the Element topic

### Verb Alignment (CRITICAL)

The task must require the SAME verb action stated in the Performance Criterion:
- If the verb is "identify", the task must require identification
- If the verb is "explain", the task must require explanation
- If the verb is "provide", the task must require provision
- If the verb is "apply", the task must require application

Do NOT elevate or substitute the verb.

### Prohibited Substitutions

These substitutions are NOT acceptable:
- Providing feedback when the PC requires reporting
- Explaining or describing when the PC requires performing
- Identifying a scenario when the PC requires implementation
- Completing training when the PC requires workplace action

### Task Construction

The SMART Task must be written so the learner is required to perform the exact workplace action described in the Performance Criterion.

Where the PC contains multiple actions (e.g., "identify and record"), the task MUST require ALL components.

## Output Requirements

### smart_task (required)
A practical, observable task that directly addresses the Performance Criterion.
Must use the exact verb from the PC.

### benchmark_answer (required)
Describe what the assessor observes when the learner competently demonstrates the SPECIFIC PC.
Write in third person (e.g., "The learner demonstrates...").

### recommendations (required)
Specific guidance for the RTO on how to implement this assessment task.',
  'You are a Senior VET Compliance Consultant creating SMART remediation tasks for Australian RTOs. Tasks must directly address the Performance Criterion using the exact verb, object, and context. Return only valid JSON.',
  '{"type":"object","properties":{"smart_task":{"type":"string"},"benchmark_answer":{"type":"string"},"recommendations":{"type":"string"}},"required":["smart_task","benchmark_answer","recommendations"]}',
  '2.0',
  true,
  true,
  NOW(),
  NOW()
);

-- =====================================================
-- EPC Learner Guide Validation v2.0 (Phase 1)
-- =====================================================
INSERT INTO prompts (
  name,
  prompt_type,
  requirement_type,
  document_type,
  prompt_text,
  system_instruction,
  output_schema,
  version,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'EPC Learner Guide Validation v2.0 (Phase 1)',
  'validation',
  'elements_performance_criteria',
  'learner_guide',
  'Validate the following Performance Criterion against the provided Learner Guide documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Learner Guides must provide sufficient learning content and activities to prepare learners to demonstrate the Performance Criterion.

### Critical Requirement Alignment

Before validating, parse the Performance Criterion:
- **ACTION VERB**: What must the learner DO? (e.g., "identify", "apply", "communicate")
- **OBJECT**: What is being acted upon? (e.g., "workplace procedures", "safety requirements")
- **CONTEXT**: When/where/how does this happen? (e.g., "in accordance with regulations")

The Learner Guide must prepare learners to perform this EXACT action.

### Valid Learner Guide Content
1. **Explanatory Content** - Theory and concepts related to the criterion
2. **Worked Examples** - Demonstrations of how to perform the action
3. **Practice Activities** - Opportunities to practice the skill
4. **Self-Check Questions** - Knowledge verification before assessment
5. **Workplace Scenarios** - Contextual application examples

## Validation Instructions

1. **Search ALL documents** for content that teaches/prepares learners for this criterion
2. For each match, record: Document name, Section, Page number
3. Verify content addresses the **same action** specified in the criterion
4. Determine if learning content is sufficient preparation for assessment

## Output Requirements

### status (required)
- **"Met"**: Comprehensive learning content addresses all aspects of the PC
- **"Partially Met"**: Some content exists but gaps in coverage
- **"Not Met"**: No relevant learning content found

### reasoning (required, max 300 words)
Explain your assessment with specific content references.

### mapped_content (required, max 250 words)
List specific sections/content addressing this criterion with page numbers.
Use "N/A" if none found.

### citations (required, array)
Document references in format: ["Document name, Section, Page X"]

### unmapped_content (required, max 200 words)
**Only if Partially Met or Not Met**: What learning content is missing?
Use "N/A" if Met.',
  'You are a Senior VET Compliance Consultant auditing Learner Guide materials for Australian RTOs. You ensure learning content adequately prepares learners to demonstrate Performance Criteria. Return only valid JSON.',
  '{"type":"object","properties":{"status":{"type":"string","enum":["Met","Partially Met","Not Met"]},"reasoning":{"type":"string"},"mapped_content":{"type":"string"},"citations":{"type":"array","items":{"type":"string"}},"unmapped_content":{"type":"string"}},"required":["status","reasoning","mapped_content","citations","unmapped_content"]}',
  '2.0',
  true,
  true,
  NOW(),
  NOW()
);

-- =====================================================
-- EPC Learner Guide Generation v2.0 (Phase 2)
-- =====================================================
INSERT INTO prompts (
  name,
  prompt_type,
  requirement_type,
  document_type,
  prompt_text,
  system_instruction,
  output_schema,
  version,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'EPC Learner Guide Generation v2.0 (Phase 2)',
  'generation',
  'elements_performance_criteria',
  'learner_guide',
  'Generate learning content recommendations for the following Performance Criterion that requires improvement in the Learner Guide.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}
**Current Status:** {{status}}
**Gaps Identified:** {{unmapped_content}}

## Content Generation Rules

### Critical Requirement Alignment

The recommended content MUST:
1. Directly address the ACTION VERB + OBJECT + CONTEXT from the PC
2. Prepare learners to perform the exact action required
3. Include both theory and practical application
4. Be appropriate for vocational education level

### Content Types to Recommend

1. **Explanatory Content** - Theory covering the criterion topic
2. **Worked Examples** - Step-by-step demonstrations
3. **Practice Activities** - Hands-on exercises for skill development
4. **Self-Check Questions** - Knowledge verification questions
5. **Workplace Scenarios** - Real-world application examples

## Output Requirements

### smart_task (required)
A learning activity that helps learners understand and practice the Performance Criterion.
Must directly relate to the verb, object, and context of the PC.

### benchmark_answer (required)
Describe what successful completion of the learning activity looks like.
Include key learning points the learner should demonstrate understanding of.

### recommendations (required)
Specific guidance for the RTO on what content to add to the Learner Guide.
Include suggested topics, examples, and activities.',
  'You are a Senior VET Compliance Consultant creating learning content recommendations for Australian RTOs. Content must prepare learners to demonstrate Performance Criteria. Return only valid JSON.',
  '{"type":"object","properties":{"smart_task":{"type":"string"},"benchmark_answer":{"type":"string"},"recommendations":{"type":"string"}},"required":["smart_task","benchmark_answer","recommendations"]}',
  '2.0',
  true,
  true,
  NOW(),
  NOW()
);

-- =====================================================
-- Unset old EPC prompts as default (keep them active for reference)
-- =====================================================
UPDATE prompts 
SET is_default = false, updated_at = NOW()
WHERE requirement_type = 'elements_performance_criteria' 
  AND is_default = true 
  AND name NOT LIKE '%v2.0%';
