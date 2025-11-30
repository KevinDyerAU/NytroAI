
-- ===========================================================================
-- Description:
-- This script updates all existing validation prompts to streamline their focus,
-- simplify the output schema, and improve performance.
--
-- Key Changes:
-- 1. Focus on Core Validation: Keeps Status, Reasoning, and Mapped Content.
-- 2. Simplified Q&A: Reduces complexity to a single `smart_question` (string)
--    and a single `benchmark_answer` (string).
-- 3. Enforced Citations: Makes `citations` a required array of strings to ensure
--    all assessments are backed by specific document references.
-- 4. Performance: Reduces the number of fields and complexity for faster
--    and more reliable Gemini API responses.
-- ===========================================================================

-- ===========================================================================
-- KNOWLEDGE EVIDENCE (KE) PROMPT UPDATES
-- ===========================================================================

-- Update KE - Learner Guide
UPDATE prompts
SET
  prompt_text = 'Validate the following Knowledge Evidence requirement against the provided Learner Guide documents.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the learner guide content and determine:
1. **Status**: Is this knowledge content covered? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment in detail. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific sections, topics, or content address this requirement? Always include page numbers in parentheses after each reference (e.g., 'Section 2.1 (Page 14) covers...').
4. **Citations**: Cite the exact document name, page numbers, and section headings.
5. **Smart Question**: Generate ONE simple question to assess a learner''s understanding of this requirement.
6. **Benchmark Answer**: Provide a concise, correct answer to the smart question based on the document.
Focus on whether the learner guide provides sufficient content for learners to acquire this knowledge.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'KE Learner Guide Validation v1.1',
  description = 'Validates Knowledge Evidence requirements against Learner Guide documents with a focus on core validation and a single question.'
WHERE
  requirement_type = 'knowledge_evidence' AND document_type = 'learner_guide';

-- Update KE - Unit Documents
UPDATE prompts
SET
  prompt_text = 'Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the assessment tasks and determine:
1. **Status**: Is this knowledge requirement assessed? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment in detail. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific tasks, questions, or activities assess this knowledge? Always include page numbers and task numbers in parentheses (e.g., 'Task 2 (Page 8) includes questions...').
4. **Citations**: Cite the exact document name, task numbers, and page numbers.
5. **Smart Question**: Generate ONE simple question that could be added to the assessment.
6. **Benchmark Answer**: Provide a concise, correct answer to that question.
Focus on whether the assessment tools effectively evaluate a learner''s knowledge.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'KE Unit Validation v1.1',
  description = 'Validates Knowledge Evidence requirements against Unit assessment documents with a focus on core validation and a single question.'
WHERE
  requirement_type = 'knowledge_evidence' AND document_type = 'unit';

-- ===========================================================================
-- PERFORMANCE EVIDENCE (PE) PROMPT UPDATES
-- ===========================================================================

-- Update PE - Unit Documents
UPDATE prompts
SET
  prompt_text = 'Validate the following Performance Evidence requirement against the provided Unit assessment documents.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the assessment tasks and determine:
1. **Status**: Is this performance requirement assessed? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment in detail. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific tasks, observations, or activities require the learner to demonstrate this performance? Always include page numbers and task numbers in parentheses (e.g., 'Task 3 (Page 12) requires demonstration...').
4. **Citations**: Cite the exact document name, task numbers, and page numbers.
5. **Smart Question**: Generate ONE simple observation checklist item to assess this performance.
6. **Benchmark Answer**: Describe the expected observable behavior for the checklist item.
Focus on whether learners are required to actively demonstrate the specified performance.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'PE Unit Validation v1.1',
  description = 'Validates Performance Evidence requirements against Unit assessment documents with a focus on core validation and a single observation point.'
WHERE
  requirement_type = 'performance_evidence' AND document_type = 'unit';

-- Update PE - Learner Guide (Note: This is an anti-pattern, but the prompt exists)
UPDATE prompts
SET
  prompt_text = 'Analyze the provided Learner Guide to determine if it PREPARES the learner for the following Performance Evidence requirement.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the learner guide content and determine:
1. **Status**: Does the guide provide instructions or practice activities for this performance? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific sections, topics, or activities relate to this performance? Always include page numbers in parentheses after each reference (e.g., 'Section 4.2 (Page 22) provides instructions...').
4. **Citations**: Cite the exact document name, page numbers, and section headings.
5. **Smart Question**: Generate ONE simple question about how to perform a key step.
6. **Benchmark Answer**: Provide a concise, correct answer based on the guide''s instructions.
Focus on whether the guide adequately prepares the learner to be assessed.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'PE Learner Guide Validation v1.1',
  description = 'Assesses if the Learner Guide prepares a learner for a Performance Evidence requirement.'
WHERE
  requirement_type = 'performance_evidence' AND document_type = 'learner_guide';

-- ===========================================================================
-- PERFORMANCE CRITERIA (PC) PROMPT UPDATES
-- ===========================================================================

-- Update PC - Unit Documents
UPDATE prompts
SET
  prompt_text = 'Validate the following Performance Criteria against the provided Unit assessment documents.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the assessment tasks and determine:
1. **Status**: Is this performance criteria assessed? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment in detail. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific tasks or criteria points measure this outcome? Always include page numbers and task numbers in parentheses (e.g., 'Task 1, Criteria 2.1 (Page 5) measures...').
4. **Citations**: Cite the exact document name, task numbers, and page numbers.
5. **Smart Question**: Generate ONE simple question for the assessor to ask the learner related to this criteria.
6. **Benchmark Answer**: Provide the expected answer or observable action.
Focus on whether the assessment tool explicitly measures this specific performance criteria.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'PC Unit Validation v1.1',
  description = 'Validates Performance Criteria against Unit assessment documents with a focus on direct measurement.'
WHERE
  requirement_type = 'performance_criteria' AND document_type = 'unit';

-- Update PC - Learner Guide
UPDATE prompts
SET
  prompt_text = 'Analyze the provided Learner Guide to determine if it PREPARES the learner for the following Performance Criteria.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the learner guide content and determine:
1. **Status**: Does the guide provide content or activities related to this criteria? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific sections, topics, or activities relate to this criteria? Always include page numbers in parentheses after each reference (e.g., 'Section 3.1 (Page 16) explains...').
4. **Citations**: Cite the exact document name, page numbers, and section headings.
5. **Smart Question**: Generate ONE simple question to check understanding of this performance standard.
6. **Benchmark Answer**: Provide a concise, correct answer based on the guide.
Focus on whether the guide adequately prepares the learner to meet the performance criteria.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'PC Learner Guide Validation v1.1',
  description = 'Assesses if the Learner Guide prepares a learner for a specific Performance Criteria.'
WHERE
  requirement_type = 'performance_criteria' AND document_type = 'learner_guide';

-- ===========================================================================
-- FOUNDATION SKILLS (FS) PROMPT UPDATES
-- ===========================================================================

-- Update FS - Unit Documents
UPDATE prompts
SET
  prompt_text = 'Validate the following Foundation Skill against the provided Unit assessment documents.
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}
Analyze the assessment tasks and determine:
1. **Status**: Is this foundation skill (reading, writing, oral communication, numeracy, learning) embedded and assessed? (Met, Partially Met, or Not Met)
2. **Reasoning**: Explain your assessment. If Partially Met or Not Met, clearly state what is missing.
3. **Mapped Content**: What specific tasks require the application of this skill? Always include page numbers and task numbers in parentheses (e.g., 'Task 4 (Page 15) requires written responses...).
4. **Citations**: Cite the exact document name, task numbers, and page numbers.
5. **Smart Question**: Generate ONE simple question that requires the learner to use this skill.
6. **Benchmark Answer**: Describe the expected application of the skill in the answer.
Focus on whether the assessment naturally and genuinely assesses the foundation skill in context.',
  output_schema = '{
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "citations": {"type": "array", "items": {"type": "string"}},
      "smart_question": {"type": "string"},
      "benchmark_answer": {"type": "string"}
    },
    "required": ["status", "reasoning", "mapped_content", "citations", "smart_question", "benchmark_answer"]
  }'::jsonb,
  name = 'FS Unit Validation v1.1',
  description = 'Validates Foundation Skills against Unit assessment documents.'
WHERE
  requirement_type = 'foundation_skills' AND document_type = 'unit';
