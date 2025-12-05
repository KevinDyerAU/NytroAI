-- ============================================================================
-- AI Smart Question Generator Prompt
-- ============================================================================
-- This prompt is used to generate intelligent, contextually relevant questions
-- about validation documents to help users discover and understand critical
-- information within the validation context.
-- ============================================================================

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
    is_default,
    created_at
) VALUES (
    'smart_question_generator',
    'general',
    'all',
    'Smart Question Generator - Validation Context',
    'You are an expert instructional design specialist and assessment analyst with deep expertise in RTO (Registered Training Organization) validation, competency frameworks, and evidence-based learning assessment. Your role is to generate intelligent, contextually relevant questions that help users discover and understand critical information within validation documents.

CORE OBJECTIVES:
1. Intelligent Question Generation: Create thought-provoking questions that guide users to key evidence and information in documents
2. Context Awareness: Generate questions that are specifically relevant to the validation context and requirements
3. Progressive Disclosure: Create questions that progressively reveal information, helping users understand document structure and content
4. Validation-Focused: Ensure questions address assessment criteria, evidence requirements, and compliance elements
5. Clarity and Precision: Frame questions in clear, professional language that is easy to understand

QUESTION GENERATION PRINCIPLES:
- Relevance: Questions must be directly relevant to the validation context and documents provided
- Variety: Generate diverse question types (factual, analytical, comparative, inferential, application)
- Depth: Create questions at multiple levels (surface, intermediate, deep)
- Engagement: Frame questions to encourage exploration and highlight important sections

OUTPUT FORMAT:
Generate questions in JSON format with: question, question_type, difficulty_level, focus_area, expected_document_sections, and rationale for each question.',
    'Based on the provided documents and validation context, generate 5-10 intelligent questions that help users discover and understand critical information. Focus on assessment criteria, evidence requirements, and validation-relevant content.',
    '{
      "temperature": 0.8,
      "maxOutputTokens": 4096,
      "topP": 0.95,
      "topK": 40
    }',
    '{
      "type": "object",
      "properties": {
        "questions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "question": {"type": "string"},
              "question_type": {"type": "string", "enum": ["factual", "analytical", "comparative", "inferential", "application"]},
              "difficulty_level": {"type": "string", "enum": ["basic", "intermediate", "advanced"]},
              "focus_area": {"type": "string"},
              "expected_document_sections": {"type": "array", "items": {"type": "string"}},
              "rationale": {"type": "string"}
            },
            "required": ["question", "question_type", "difficulty_level"]
          },
          "description": "Array of generated questions"
        },
        "summary": {
          "type": "string",
          "description": "Brief summary of the question generation approach"
        }
      },
      "required": ["questions"]
    }',
    true,
    true,
    NOW()
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- NOTE: Individual Requirement Revalidation
-- ============================================================================
-- The Individual Requirement Revalidation workflow does NOT use a separate
-- prompt. Instead, it reuses the existing validation prompts from the prompts
-- table by querying based on requirement_type and document_type:
--
-- SELECT * FROM prompts 
-- WHERE prompt_type = 'validation'
--   AND requirement_type = '<requirement_type>'
--   AND document_type = '<document_type>'
--   AND is_active = true
--   AND is_default = true
-- LIMIT 1
--
-- This ensures that individual requirement revalidation uses the same prompts
-- as the full validation flow, maintaining consistency across the platform.
-- ============================================================================
