-- ============================================================================
-- Add Legacy v0.1 Prompts for All Requirement Types
-- ============================================================================
-- These are the original prompts from 20250129_seed_prompts.sql
-- Added as v0.1 (legacy/historical) versions for versioning reference
-- Current active prompts may be v2.0+ after iterations
-- 
-- Date: 2026-01-24
-- ============================================================================

-- ============================================================================
-- KNOWLEDGE EVIDENCE - LEGACY PROMPTS
-- ============================================================================

-- KE Unit v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'knowledge_evidence', 'unit',
  'KE Unit Validation v0.1 (Legacy)',
  'Original Knowledge Evidence Unit prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.

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

Be thorough and cite specific evidence. Focus on whether learners will be assessed on this knowledge.',
  'You are an expert RTO assessor validating Knowledge Evidence requirements against Unit assessment documents. You understand Australian VET standards and assessment principles. Provide accurate, evidence-based assessments with specific citations.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
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
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- KE Learner Guide v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'knowledge_evidence', 'learner_guide',
  'KE Learner Guide Validation v0.1 (Legacy)',
  'Original Knowledge Evidence Learner Guide prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Knowledge Evidence requirement against the provided Learner Guide documents.

Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}

Analyze the learner guide content and determine:
1. **Status**: Is this knowledge content covered? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment in detail
3. **Mapped Content**: What sections, topics, or content address this requirement? Include specific headings and page numbers.
4. **Unmapped Content**: If not fully Met, what knowledge is missing?
5. **Recommendations**: What content should be added or expanded?
6. **Smart Question**: Generate a question that could assess this knowledge
7. **Benchmark Answer**: Provide the expected response based on the learner guide content
8. **Document References**: Cite specific pages, sections, and chapters

Focus on whether the learner guide provides sufficient content for learners to acquire this knowledge.',
  'You are an expert instructional designer validating Knowledge Evidence requirements against Learner Guide content. You understand learning design principles and content coverage. Provide accurate assessments of whether learners can acquire the required knowledge from the materials.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
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
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- ============================================================================
-- PERFORMANCE EVIDENCE - LEGACY PROMPTS
-- ============================================================================

-- PE Unit v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'performance_evidence', 'unit',
  'PE Unit Validation v0.1 (Legacy)',
  'Original Performance Evidence Unit prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Performance Evidence requirement against the provided Unit assessment documents.

Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}

Analyze the assessment tasks and determine:
1. **Status**: Is this performance requirement assessed? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment in detail
3. **Mapped Content**: What specific tasks, activities, or assessments require this performance? Include task numbers and descriptions.
4. **Unmapped Content**: If not fully Met, what performance aspects are not assessed?
5. **Recommendations**: What tasks or activities should be added?
6. **Document References**: Cite specific tasks, pages, and assessment instruments

Focus on whether learners will be required to demonstrate this performance.',
  'You are an expert RTO assessor validating Performance Evidence requirements against Unit assessment tools. You understand competency-based assessment and performance requirements. Assess whether learners will actually demonstrate the required performance.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- PE Learner Guide v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'performance_evidence', 'learner_guide',
  'PE Learner Guide Validation v0.1 (Legacy)',
  'Original Performance Evidence Learner Guide prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Performance Evidence requirement against the provided Learner Guide documents.

Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}

Analyze the learner guide and determine:
1. **Status**: Does the guide prepare learners for this performance? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: What sections, examples, or activities prepare learners for this performance?
4. **Unmapped Content**: What preparation is missing?
5. **Recommendations**: What content or activities should be added?
6. **Document References**: Cite specific pages and sections

Focus on whether the learner guide adequately prepares learners to demonstrate this performance.',
  'You are an expert instructional designer validating Performance Evidence requirements against Learner Guide content. Assess whether learners will be adequately prepared to demonstrate the required performance.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- ============================================================================
-- FOUNDATION SKILLS - LEGACY PROMPTS
-- ============================================================================

-- FS Unit v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'foundation_skills', 'unit',
  'FS Unit Validation v0.1 (Legacy)',
  'Original Foundation Skills Unit prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Foundation Skill requirement against the provided Unit assessment documents.

Skill Number: {{requirement_number}}
Skill Description: {{requirement_text}}

Analyze the assessment and determine:
1. **Status**: Is this skill assessed? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: What questions or tasks require this skill? Be specific.
4. **Unmapped Content**: What aspects of the skill are not assessed?
5. **Recommendations**: How can the skill be better assessed?
6. **Smart Question**: Generate a question that assesses this skill
7. **Benchmark Answer**: Expected response demonstrating the skill
8. **Document References**: Cite specific questions and tasks

Foundation skills include: Reading, Writing, Oral Communication, Numeracy, Learning, Problem Solving, Initiative and Enterprise, Technology, Planning and Organising, Self Management, Teamwork.',
  'You are an expert in foundation skills assessment. Validate whether the assessment adequately assesses the foundation skill in an integrated, authentic way.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "smart_question": {
        "type": "object",
        "properties": {
          "question_text": {"type": "string"},
          "benchmark_answer": {"type": "string"}
        }
      },
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- FS Learner Guide v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'foundation_skills', 'learner_guide',
  'FS Learner Guide Validation v0.1 (Legacy)',
  'Original Foundation Skills Learner Guide prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Foundation Skill requirement against the provided Learner Guide documents.

Skill Number: {{requirement_number}}
Skill Description: {{requirement_text}}

Analyze the learner guide and determine:
1. **Status**: Does the guide develop this skill? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: What content, activities, or examples develop this skill?
4. **Unmapped Content**: What skill development is missing?
5. **Recommendations**: What should be added to develop the skill?
6. **Document References**: Cite specific pages and activities

Focus on whether the learner guide provides opportunities to develop and practice this foundation skill.',
  'You are an expert in foundation skills development. Assess whether the learner guide adequately develops the foundation skill through content and activities.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- ============================================================================
-- ELEMENTS & PERFORMANCE CRITERIA - LEGACY PROMPTS
-- ============================================================================

-- E_PC Unit v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'elements_performance_criteria', 'unit',
  'E_PC Unit Validation v0.1 (Legacy)',
  'Original Elements & Performance Criteria Unit prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Performance Criterion against the provided Unit assessment documents.

Element/Criterion Number: {{requirement_number}}
Criterion Text: {{requirement_text}}

Analyze the assessment and determine:
1. **Status**: Is this criterion assessed? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: What questions or tasks assess this criterion?
4. **Unmapped Content**: What aspects are not assessed?
5. **Recommendations**: How can assessment be improved?
6. **Document References**: Cite specific questions and tasks

Performance criteria define what competent performance looks like.',
  'You are an expert RTO assessor validating Performance Criteria coverage. Assess whether the assessment adequately covers this criterion.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- E_PC Learner Guide v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'elements_performance_criteria', 'learner_guide',
  'E_PC Learner Guide Validation v0.1 (Legacy)',
  'Original Elements & Performance Criteria Learner Guide prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Performance Criterion against the provided Learner Guide documents.

Element/Criterion Number: {{requirement_number}}
Criterion Text: {{requirement_text}}

Analyze the learner guide and determine:
1. **Status**: Does the guide cover this criterion? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: What content addresses this criterion?
4. **Unmapped Content**: What content is missing?
5. **Recommendations**: What should be added?
6. **Document References**: Cite specific pages and sections

Focus on whether learners will understand what competent performance looks like.',
  'You are an expert instructional designer validating Performance Criteria coverage in learner guides. Assess content adequacy.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- ============================================================================
-- ASSESSMENT CONDITIONS - LEGACY PROMPTS
-- ============================================================================

-- AC Unit v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'assessment_conditions', 'unit',
  'AC Unit Validation v0.1 (Legacy)',
  'Original Assessment Conditions Unit prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Assessment Condition against the provided Unit assessment documents.

Condition Number: {{requirement_number}}
Condition Text: {{requirement_text}}

Analyze the assessment and determine:
1. **Status**: Is this condition met? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: Where is this condition specified or implemented?
4. **Unmapped Content**: What is missing?
5. **Recommendations**: How can the condition be better addressed?
6. **Document References**: Cite specific sections

Assessment conditions specify the environment, resources, and context for assessment.',
  'You are an expert RTO assessor validating Assessment Conditions. Assess whether the conditions are adequately specified and implemented.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- ============================================================================
-- ASSESSMENT INSTRUCTIONS - LEGACY PROMPTS
-- ============================================================================

-- AI Unit v0.1
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, name, description,
  version, is_default, is_active,
  prompt_text, system_instruction, output_schema, generation_config
) VALUES (
  'validation', 'assessment_instructions', 'unit',
  'AI Unit Validation v0.1 (Legacy)',
  'Original Assessment Instructions Unit prompt from n8n workflow migration',
  'v0.1', false, false,
  'Validate the following Assessment Instruction against the provided Unit assessment documents.

Instruction Number: {{requirement_number}}
Instruction Text: {{requirement_text}}

Analyze the assessment and determine:
1. **Status**: Is this instruction clearly communicated? Met, Partially Met, or Not Met?
2. **Reasoning**: Explain your assessment
3. **Mapped Content**: Where is this instruction provided to learners?
4. **Unmapped Content**: What clarity or detail is missing?
5. **Recommendations**: How can instructions be improved?
6. **Document References**: Cite specific sections

Assessment instructions guide learners on how to complete assessments correctly.',
  'You are an expert RTO assessor validating Assessment Instructions. Assess whether instructions are clear, complete, and accessible to learners.',
  '{
    "type": "object",
    "properties": {
      "requirement_number": {"type": "string"},
      "requirement_text": {"type": "string"},
      "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
      "reasoning": {"type": "string"},
      "mapped_content": {"type": "string"},
      "unmapped_content": {"type": "string"},
      "recommendations": {"type": "string"},
      "doc_references": {"type": "string"},
      "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}
    },
    "required": ["requirement_number", "status", "reasoning"]
  }',
  '{"temperature": 0.1, "maxOutputTokens": 8192}'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Count legacy prompts
DO $$
DECLARE
  legacy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM prompts WHERE version = 'v0.1';
  RAISE NOTICE 'Total v0.1 legacy prompts: %', legacy_count;
END $$;
