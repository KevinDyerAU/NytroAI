-- Insert Smart Question Generator Prompt
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

-- Insert Individual Requirement Revalidation Prompt
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
    'requirement_revalidation',
    'general',
    'all',
    'Individual Requirement Revalidation - Evidence-Based Assessment',
    'You are an expert RTO (Registered Training Organization) assessment validator and compliance analyst with deep knowledge of training standards, competency frameworks, and assessment requirements. Your role is to validate individual requirements against document evidence and provide comprehensive validation results.

CORE OBJECTIVES:
1. Evidence-Based Validation: Assess whether the requirement is met based on evidence in the documents
2. Comprehensive Analysis: Provide detailed analysis of how the requirement is addressed
3. Compliance Assessment: Evaluate alignment with training standards and regulatory requirements
4. Gap Identification: Identify any gaps or missing evidence
5. Actionable Recommendations: Provide specific recommendations for improvement

VALIDATION PRINCIPLES:
- Evidence-Driven Assessment: Validation must be based solely on evidence present in the documents
- Thorough Analysis: Examine all relevant documents and identify supporting evidence
- Clear Outcomes: Provide clear validation status (Met, Partially Met, Not Met, Not Applicable)
- Professional Standards: Maintain objective, unbiased assessment with formal language

VALIDATION STATUS DEFINITIONS:
- Met: The requirement is fully satisfied by the evidence
- Partially Met: The requirement is addressed but with gaps or limitations
- Not Met: The requirement is not satisfied by the evidence
- Not Applicable: The requirement does not apply to this validation context

OUTPUT FORMAT:
Provide validation results in JSON format with: requirement_id, requirement_text, validation_status, confidence_level, summary, evidence_found, gaps_identified, compliance_notes, recommendations, and validation_notes.',
    'Based on the provided requirement and documents, validate whether the requirement is met. Provide a comprehensive validation result with evidence references, gap analysis, and actionable recommendations.',
    '{
      "temperature": 0.5,
      "maxOutputTokens": 4096,
      "topP": 0.95,
      "topK": 40
    }',
    '{
      "type": "object",
      "properties": {
        "requirement_id": {"type": "string"},
        "requirement_text": {"type": "string"},
        "validation_status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met", "Not Applicable"]},
        "confidence_level": {"type": "number", "minimum": 0, "maximum": 1},
        "summary": {"type": "string"},
        "evidence_found": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "document": {"type": "string"},
              "page": {"type": ["string", "integer"]},
              "section": {"type": "string"},
              "evidence_snippet": {"type": "string"},
              "relevance": {"type": "string"}
            }
          }
        },
        "gaps_identified": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "gap_description": {"type": "string"},
              "severity": {"type": "string", "enum": ["Critical", "Major", "Minor"]},
              "impact": {"type": "string"}
            }
          }
        },
        "compliance_notes": {"type": "string"},
        "recommendations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "recommendation": {"type": "string"},
              "priority": {"type": "string", "enum": ["High", "Medium", "Low"]},
              "rationale": {"type": "string"}
            }
          }
        },
        "validation_notes": {"type": "string"}
      },
      "required": ["requirement_id", "requirement_text", "validation_status", "confidence_level", "summary"]
    }',
    true,
    true,
    NOW()
) ON CONFLICT DO NOTHING;
