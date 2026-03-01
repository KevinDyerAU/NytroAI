-- ============================================================================
-- Migration: Split Validation Prompts v2
-- ============================================================================
-- Adds new split prompts that separate validation from question/task generation
-- Phase 1: Validation only prompts
-- Phase 2: Generation prompts (only run when status != "Met")
--
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- PHASE 1: VALIDATION PROMPTS
-- ============================================================================

-- Performance Criteria Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'performance_criteria',
  'unit',
  'PC Unit Validation v2.0 (Phase 1)',
  'Phase 1: Validates Performance Criteria against Unit assessment documents - validation only',
  'Validate the following Performance Criterion against the provided Unit assessment documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Performance criteria define competent performance standards. Assessment must require **practical demonstration** of skills, not just knowledge.

### Valid Assessment Methods
1. **Direct Observation** - Assessor watches learner perform tasks
2. **Practical Demonstration** - Learner shows skills under specified conditions
3. **Competency Checklists** - Structured observation against criteria
4. **Scenario-Based Assessment** - Only when other methods unsuitable

### Content to Exclude
- Assessor/Trainer Checklists (support evidence collection, not assessment)
- Knowledge-only questions (must require performance)

## Validation Instructions

1. **Search ALL documents** for tasks requiring learners to **perform** the criterion action
2. For each match, record: Document name, Section, Task/Observation number, Page number
3. Verify tasks require the **same action** specified in the criterion
4. Determine if assessment is sufficient for competent performance

## Output Requirements

### Status
- **Met**: Fully assessed through practical tasks/observations
- **Partially Met**: Some assessment exists but gaps remain
- **Not Met**: No practical tasks assess this criterion

### Reasoning (max 300 words)
Explain assessment with specific task/observation references.

### Mapped Content (max 250 words)
List specific tasks assessing this criterion with page numbers.
Format: "Task X (Page Y) requires: ''[description]''"
Use "N/A" if none found.

### Document References (max 150 words)
Cite: Document name, Section, Task number, Page(s).
Use "N/A" if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably assess the criterion
- Focus on performance demonstration, not knowledge
- Verify learners must DO the action, not just know about it',
  'You are an expert RTO assessor validating Performance Criteria against Unit assessment documents. Focus only on determining validation status. Do not generate questions or recommendations.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "doc_references": {"type": "string"},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- Knowledge Evidence Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'knowledge_evidence',
  'unit',
  'KE Unit Validation v2.0 (Phase 1)',
  'Phase 1: Validates Knowledge Evidence against Unit assessment documents - validation only',
  'Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Knowledge evidence assesses understanding of concepts, principles, processes, and information required for competent performance.

### Knowledge Categories
- **Conceptual**: Core concepts, relationships, application of theories
- **Factual**: Definitions, terminology, classifications
- **Procedural**: Steps, processes, workflows
- **Regulatory**: Laws, regulations, standards, codes of practice
- **Contextual**: Industry context, roles, safety considerations

### Valid Assessment Methods
- Written questions (short answer, extended response)
- Multiple choice or true/false questions
- Case study analysis
- Research tasks
- Scenario-based knowledge questions

## Validation Instructions

1. **Search documents** for questions/tasks assessing this knowledge requirement
2. For each match, record: Document name, Section, Question/Task number, Page number, Question text
3. Verify questions adequately assess the knowledge depth required
4. Determine if assessment coverage is sufficient

## Output Requirements

### Status
- **Met**: Fully assessed with appropriate questions/tasks
- **Partially Met**: Some assessment but lacks coverage or depth
- **Not Met**: Not assessed in documents

### Reasoning (max 300 words)
Explain assessment with specific question/task references.

### Mapped Content (max 250 words)
List specific questions assessing this requirement.
Format: "Question X (Page Y) asks: ''[question text]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section, Question number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What knowledge aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if questions reasonably assess the requirement
- Focus on assessment quality, not just presence
- Consider depth appropriate to qualification level
- Value variety in question types',
  'You are an expert RTO assessor validating Knowledge Evidence against Unit assessment documents. Focus only on determining validation status. Do not generate questions or recommendations.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- Performance Evidence Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'performance_evidence',
  'unit',
  'PE Unit Validation v2.0 (Phase 1)',
  'Phase 1: Validates Performance Evidence against Unit assessment documents - validation only',
  'Validate the following Performance Evidence requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Performance evidence demonstrates competency through practical application in real or simulated workplace environments. Must be observable, measurable, and workplace-aligned.

### Valid Assessment Methods
1. **Direct Observation** - Assessor monitors learner performing tasks
2. **Practical Demonstration** - Learner demonstrates skills under conditions
3. **Competency Checklists** - Structured observation against criteria
4. **Scenario-Based Assessment** - Only when other methods unsuitable

### Content to Search
- Observation checklists
- Practical demonstration tasks
- Work-based projects
- Simulated workplace activities
- Role-plays or scenarios
- Workplace documentation requiring practical application

### Content to Exclude
- Knowledge-only questions (focus on practical demonstration)

## Validation Instructions

1. **Search documents** for tasks requiring **demonstration** of this performance
2. For each match, record: Document name, Section, Task/Observation number, Page number
3. Verify tasks require **active demonstration**, not just knowledge
4. Determine if assessment is sufficient for competent performance

## Output Requirements

### Status
- **Met**: Fully assessed through practical tasks/observations
- **Partially Met**: Some assessment but gaps in coverage or depth
- **Not Met**: No practical tasks assess this requirement

### Reasoning (max 300 words)
Explain assessment with specific task/observation references.

### Mapped Content (max 250 words)
List specific tasks requiring demonstration of this performance.
Format: "Task X (Page Y) requires demonstration of [performance]: ''[description]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Task, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What performance aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably require the performance
- Focus on demonstration, not just knowing
- Ensure assessors can observe and verify performance
- Verify authentic workplace conditions',
  'You are an expert RTO assessor validating Performance Evidence against Unit assessment documents. Focus only on determining validation status. Do not generate questions or recommendations.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- Foundation Skills Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'foundation_skills',
  'unit',
  'FS Unit Validation v2.0 (Phase 1)',
  'Phase 1: Validates Foundation Skills against Unit assessment documents - validation only',
  'Validate the following Foundation Skill against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Foundation skills are core non-technical skills required for work performance. They must be **embedded within performance tasks**, not assessed separately.

### Foundation Skill Categories
1. **Learning** - Self-directed learning, adapting, applying feedback
2. **Reading** - Comprehending written info, interpreting instructions
3. **Writing** - Producing documents, completing forms, written communication
4. **Oral Communication** - Verbal expression, listening, presenting
5. **Numeracy** - Calculations, measurements, data interpretation
6. **Teamwork** - Working cooperatively, contributing to team goals
7. **Problem-Solving** - Identifying issues, developing solutions
8. **Planning & Organizing** - Task prioritization, time management
9. **Self-Management** - Responsibility, independence, professionalism
10. **Technology** - Using digital tools, navigating software

### Key Principle
Foundation skills must be **naturally integrated** into performance tasks, not standalone tests.

## Validation Instructions

1. **Search documents** for tasks requiring application of this skill
2. For each match, record: Document name, Section, Task number, Page number
3. Verify skill is **embedded** within practical tasks, not isolated
4. Confirm tasks reflect authentic workplace scenarios

## Output Requirements

### Status
- **Met**: Skill naturally integrated into assessment with clear application
- **Partially Met**: Skill present but lacks depth or authentic integration
- **Not Met**: Skill missing, isolated, or inadequately addressed

### Reasoning (max 300 words)
Explain assessment with specific task references.

### Mapped Content (max 250 words)
List specific tasks requiring this skill.
Format: "Task X (Page Y) requires [skill application]: ''[description]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Task, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What skill aspects are missing?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if skill is authentically integrated
- Focus on integration, not standalone tests
- Emphasize authentic workplace contexts
- Avoid redundant assessment of same skill',
  'You are an expert RTO assessor validating Foundation Skills against Unit assessment documents. Focus only on determining validation status. Do not generate questions or recommendations.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 2: GENERATION PROMPTS
-- ============================================================================

-- Performance Criteria Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'performance_criteria',
  'unit',
  'PC Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart task and benchmark for Performance Criteria - only when status != Met',
  'Generate a smart task and benchmark answer for the following Performance Criterion that was assessed as **{{status}}**.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Task
Create ONE practical task or observation checklist item that assesses this performance criterion.

**Requirements:**
- Must be **practical/task-oriented**, NOT a knowledge question
- Observable and measurable by an assessor
- SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Requires learners to **perform the same action** as the criterion

**Examples by Method:**
- **Direct Observation**: "Observe the learner follow workplace procedures for safe equipment operation, including all pre-operation checks, safe operating practices, and shutdown procedures."
- **Practical Demonstration**: "Demonstrate the process for monitoring and responding to changes in client condition according to the provided care plan requirements."
- **Checklist Item**: "Learner applies quality assurance processes and verifies completed work meets required standards using the workplace quality checklist."
- **Scenario**: "In the simulated workplace scenario, handle the emergency situation following documented workplace procedures."

### Benchmark Answer
Describe expected observable behavior demonstrating competent performance.

**Requirements:**
- Written in plain English
- Focus on what assessor should observe
- Include specific actions, steps, or behaviors
- Avoid theoretical explanations
- Reflect competent achievement of the criterion

### Recommendations (max 200 words)
Provide actionable suggestions to improve assessment.',
  'You are an expert RTO assessment designer. Generate practical tasks and benchmark answers for Performance Criteria that were not fully met.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_task": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_task", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- Knowledge Evidence Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'knowledge_evidence',
  'unit',
  'KE Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart question and benchmark for Knowledge Evidence - only when status != Met',
  'Generate a smart question and benchmark answer for the following Knowledge Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE well-formulated question addressing this Knowledge Evidence requirement.

**Question Categories and Verbs:**
- **Concept Understanding**: explain, describe, outline, summarise, discuss
- **Definitions**: define, identify, list, state
- **Processes**: describe, outline, explain steps, summarise process
- **Regulatory**: identify, outline, describe requirements
- **Safety/WHS**: explain, describe, outline hazards/controls
- **Roles**: explain, describe responsibilities
- **Problem Solving**: explain approach, describe response

**Requirements:**
- Clear, concise, focused on one aspect
- Answerable and assessable
- Appropriate verbs for knowledge type
- Avoid complex wording

### Benchmark Answer
Provide the expected learner response.

**Requirements:**
- Concise, accurate, plain English
- Fully meets the knowledge requirement
- Include key points demonstrating competent knowledge
- Avoid excessive detail
- Realistic for qualification level

### Recommendations (max 200 words)
Provide actionable suggestions to improve knowledge assessment.',
  'You are an expert RTO assessment designer. Generate knowledge questions and benchmark answers for Knowledge Evidence that was not fully met.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_question", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- Performance Evidence Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'performance_evidence',
  'unit',
  'PE Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart task and benchmark for Performance Evidence - only when status != Met',
  'Generate a smart task and benchmark answer for the following Performance Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Task
Create ONE practical task or observation checklist item assessing this performance requirement.

**Requirements:**
- Must be **practical/task-oriented**, NOT a knowledge question
- Observable and measurable by an assessor
- SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Target one specific performance requirement

**Examples by Method:**
- **Direct Observation**: "Observe the learner prepare the worksite ensuring all safety barriers are correctly positioned and signage is visible."
- **Practical Demonstration**: "Demonstrate the correct procedure for shutting down the equipment, including all safety checks and documentation."
- **Checklist Item**: "Learner correctly identifies hazards and implements three appropriate control measures during the task."
- **Scenario**: "Respond to the simulated customer complaint, demonstrating active listening and problem resolution."

### Benchmark Answer
Describe expected observable behavior demonstrating competent performance.

**Requirements:**
- Written in plain English
- Focus on what assessor should observe
- Include specific actions, steps, or behaviors
- Avoid theoretical explanations

### Recommendations (max 200 words)
Provide actionable suggestions to improve performance evidence assessment.',
  'You are an expert RTO assessment designer. Generate practical tasks and benchmark answers for Performance Evidence that was not fully met.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_task": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_task", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- Foundation Skills Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'foundation_skills',
  'unit',
  'FS Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart question and benchmark for Foundation Skills - only when status != Met',
  'Generate a smart question and benchmark answer for the following Foundation Skill that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE concise, clear question requiring the learner to **use** this foundation skill.

**Requirements:**
- Specific, measurable, achievable, relevant
- Assess **authentic skill application**, not theoretical knowledge
- Embedded within practical context
- Avoid unnecessary wording

**Examples by Skill:**
- **Reading**: "Review the workplace safety document and identify three key hazard controls."
- **Writing**: "Document the steps you took to resolve the customer complaint."
- **Numeracy**: "Calculate the total material cost for the project using the price list provided."
- **Oral Communication**: "Explain to your supervisor the issue you identified and your proposed solution."
- **Problem-Solving**: "Identify the cause of the equipment malfunction and describe your troubleshooting steps."
- **Teamwork**: "Describe how you coordinated with team members to complete the project task."

### Benchmark Answer
Provide a concise, accurate answer demonstrating competent skill application.

**Requirements:**
- Written in plain English
- Directly addresses the question
- Describes expected skill application
- Avoid unnecessary wording

### Recommendations (max 200 words)
Provide actionable suggestions to improve foundation skills assessment.',
  'You are an expert RTO assessment designer. Generate questions and benchmark answers for Foundation Skills that were not fully met.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_question", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- LEARNER GUIDE PROMPTS (Phase 1 & 2)
-- ============================================================================

-- LG Knowledge Evidence Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'knowledge_evidence',
  'learner_guide',
  'KE Learner Guide Validation v2.0 (Phase 1)',
  'Phase 1: Validates Knowledge Evidence against Learner Guide - validation only',
  'Validate the following Knowledge Evidence requirement against the provided Learner Guide documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

The learner guide must provide comprehensive content enabling learners to **acquire** the required knowledge. Focus on whether the guide **teaches and explains** effectively.

### Content Types to Search
- **Explanatory Content**: Definitions, descriptions, concept explanations
- **Instructional Content**: Detailed process/procedure information
- **Examples**: Case studies, scenarios, workplace examples
- **Visual Aids**: Diagrams, tables, flowcharts
- **Activities**: Exercises, self-check questions, reflection
- **References**: Citations to legislation, standards, resources

### Quality Criteria
- Clear, accessible language
- Logical sequence and progressive building
- Sufficient depth and detail
- Practical examples and illustrations

## Validation Instructions

1. **Search learner guide** for content teaching this knowledge requirement
2. For each match, record: Section title, Page number, Content type
3. Consider synonyms or related terms that convey same knowledge
4. Evaluate if content enables learners to acquire the knowledge

## Output Requirements

### Status
- **Met**: Thoroughly covered with adequate explanation and examples
- **Partially Met**: Some content but lacks depth or completeness
- **Not Met**: Not covered in learner guide

### Reasoning (max 300 words)
Explain coverage with specific section references.

### Mapped Content (max 250 words)
List specific sections addressing this requirement.
Format: "Section X (Page Y) provides [content type]: ''[description]''"
Include synonyms/related terms with justification.
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Topic title, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What knowledge is missing?
**Do NOT include page numbers in this section.**
Use "N/A" if Met.',
  'You are an expert instructional designer validating Knowledge Evidence against Learner Guide content. Focus only on determining validation status.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- LG Knowledge Evidence Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'knowledge_evidence',
  'learner_guide',
  'KE Learner Guide Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart question and benchmark for LG Knowledge Evidence - only when status != Met',
  'Generate a smart question and benchmark answer for the following Knowledge Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE simple question to assess learner understanding of this knowledge requirement.

**Requirements:**
- Test comprehension of key knowledge
- Answerable based on learner guide content
- Clear, concise, focused on essential knowledge
- Use appropriate verbs (explain, describe, identify, outline)

### Benchmark Answer
Provide a concise, correct answer based on learner guide content.

**Requirements:**
- Written in plain English
- Reflect knowledge taught in learner guide
- Include key points and concepts
- Focused and realistic for qualification level
- Avoid excessive detail

### Recommendations (max 200 words)
Provide actionable suggestions to improve knowledge coverage in learner guide.
**Do NOT include page numbers in recommendations.**',
  'You are an expert instructional designer. Generate questions and benchmark answers for Knowledge Evidence content gaps in Learner Guides.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_question", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- LG Performance Evidence Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'performance_evidence',
  'learner_guide',
  'PE Learner Guide Validation v2.0 (Phase 1)',
  'Phase 1: Validates Performance Evidence against Learner Guide - validation only',
  'Analyze the provided Learner Guide to determine if it adequately **prepares** the learner for the following Performance Evidence requirement.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

The learner guide must provide comprehensive instruction, explanations, examples, and practice activities that **prepare** learners to demonstrate the required performance.

### Content Types to Search
- **Instructional Content**: Explanations, procedures, step-by-step guides
- **Examples**: Case studies, workplace scenarios, sample demonstrations
- **Activities**: Practice exercises, simulations, self-assessment
- **Visual Aids**: Diagrams, flowcharts, photographs
- **Support Materials**: Templates, checklists, reference guides

### Quality Criteria
- Clear description of what needs to be demonstrated
- Step-by-step instructions for performing the task
- Tips, techniques, best practices
- Practice opportunities
- Common challenges and troubleshooting

## Validation Instructions

1. **Search learner guide** for content teaching/preparing this performance
2. For each match, record: Section title, Page number, Content type
3. Verify content teaches HOW to perform, not just WHAT
4. Evaluate if learners will be prepared for assessment

## Output Requirements

### Status
- **Met**: Comprehensive preparation with instruction, examples, practice
- **Partially Met**: Some preparation but missing key elements
- **Not Met**: Little to no preparation for this performance

### Reasoning (max 300 words)
Explain preparation coverage with specific section references.

### Mapped Content (max 250 words)
List specific sections preparing learners for this performance.
Format: "Section X (Page Y) provides [content type]: ''[description]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Topic title, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What preparation is missing?
Use "N/A" if Met.',
  'You are an expert instructional designer validating Performance Evidence preparation in Learner Guides. Focus only on determining validation status.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- LG Performance Evidence Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'performance_evidence',
  'learner_guide',
  'PE Learner Guide Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart question and benchmark for LG Performance Evidence - only when status != Met',
  'Generate a smart question and benchmark answer for the following Performance Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE simple, clear question about how to perform a key step or aspect of this performance requirement.

**Requirements:**
- Test learner understanding of procedure or process
- Answerable based on learner guide content
- Focus on practical "how-to" knowledge
- Concise and direct

### Benchmark Answer
Provide a concise, correct answer based on learner guide instructions.

**Requirements:**
- Written in plain English
- Reflect content and procedures from learner guide
- Include specific steps, actions, key points
- Focused, avoid unnecessary detail

### Recommendations (max 200 words)
Provide actionable suggestions to improve learner preparation.',
  'You are an expert instructional designer. Generate questions and benchmark answers for Performance Evidence preparation gaps in Learner Guides.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_question", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- LG Performance Criteria Validation (Phase 1)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'validation',
  'performance_criteria',
  'learner_guide',
  'PC Learner Guide Validation v2.0 (Phase 1)',
  'Phase 1: Validates Performance Criteria against Learner Guide - validation only',
  'Validate the following Performance Criterion against the provided Learner Guide documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

The learner guide must help learners understand what **competent performance** looks like for each performance criterion. Focus on whether the guide **teaches and prepares** learners to perform competently.

### Content Types to Search
- **Explanatory Content**: What the criterion requires, what competent performance looks like
- **Procedural Guidance**: Step-by-step instructions, tips, techniques
- **Examples**: Real-world examples, case studies, scenarios
- **Visual Aids**: Diagrams, photos, flowcharts
- **Practice Activities**: Exercises, simulations, self-check questions
- **Quality Standards**: Benchmarks, common mistakes, troubleshooting

## Validation Instructions

1. **Search learner guide** for content teaching this performance criterion
2. For each match, record: Section title, Page number, Content type
3. Verify content teaches HOW to perform competently
4. Ensure content is specific to the criterion, not generic

## Output Requirements

### Status
- **Met**: Comprehensively covered with explanation, examples, guidance
- **Partially Met**: Some coverage but lacks depth, clarity, or practical guidance
- **Not Met**: Little to no content addressing this criterion

### Reasoning (max 300 words)
Explain coverage with specific section references.

### Mapped Content (max 250 words)
List specific sections addressing this criterion.
Format: "Section X (Page Y) provides [content type]: ''[description]''"
Use "N/A" if none found.

### Document References (max 150 words)
Cite: Document/Guide name, Section title, Page(s).
**Only provide if Met or Partially Met.**
Use "N/A" if Not Met.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What content is missing?
**Do NOT include page numbers in this section.**
Use "N/A" if Met.',
  'You are an expert instructional designer validating Performance Criteria coverage in Learner Guides. Focus only on determining validation status.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "doc_references": {"type": "string"},
      "unmapped_content": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "status", "reasoning"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- LG Performance Criteria Generation (Phase 2)
INSERT INTO prompts (
  prompt_type,
  requirement_type,
  document_type,
  name,
  description,
  prompt_text,
  system_instruction,
  output_schema,
  is_active,
  is_default,
  version
) VALUES (
  'generation',
  'performance_criteria',
  'learner_guide',
  'PC Learner Guide Generation v2.0 (Phase 2)',
  'Phase 2: Generates smart question and benchmark for LG Performance Criteria - only when status != Met',
  'Generate a smart question and benchmark answer for the following Performance Criterion that was assessed as **{{status}}**.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE simple question about how to perform a key aspect of this performance criterion.

**Requirements:**
- Test learner understanding of procedures/processes
- Answerable based on learner guide content
- Focus on practical "how-to" knowledge
- Concise and direct

### Benchmark Answer
Provide a concise, correct answer based on learner guide instructions.

**Requirements:**
- Written in plain English
- Reflect content and procedures from learner guide
- Include specific steps, actions, key points
- Focused, avoid unnecessary detail

### Recommendations (max 200 words)
Provide actionable suggestions to improve content coverage.
**Do NOT include page numbers in recommendations.**',
  'You are an expert instructional designer. Generate questions and benchmark answers for Performance Criteria content gaps in Learner Guides.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"},
      "recommendations": {"type": "string"}
    },
    "required": ["requirement_number", "requirement_text", "smart_question", "benchmark_answer", "recommendations"]
  }'::jsonb,
  true,
  false,
  '2.0'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Add index for version column if not exists
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_prompts_version ON prompts(version);

-- ============================================================================
-- Summary
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Split Validation Prompts v2 migration complete!';
  RAISE NOTICE 'Added Phase 1 (validation) and Phase 2 (generation) prompts for:';
  RAISE NOTICE '  - Performance Criteria (Unit + Learner Guide)';
  RAISE NOTICE '  - Knowledge Evidence (Unit + Learner Guide)';
  RAISE NOTICE '  - Performance Evidence (Unit + Learner Guide)';
  RAISE NOTICE '  - Foundation Skills (Unit)';
  RAISE NOTICE 'Total: 14 new prompts (7 validation + 7 generation)';
END $$;
