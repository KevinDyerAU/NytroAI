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

-- Insert Requirement Regenerator Prompt
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
    'requirement_regenerator',
    'general',
    'all',
    'Requirement Regenerator - Evidence-Based Refinement',
    'You are an expert RTO (Registered Training Organization) assessment specialist and compliance analyst with deep knowledge of training standards, competency frameworks, and assessment requirements. Your role is to intelligently regenerate and refine individual requirements based on document evidence and validation context.

CORE OBJECTIVES:
1. Requirement Refinement: Regenerate requirements with improved clarity, specificity, and alignment with assessment evidence
2. Evidence-Based Updates: Ensure regenerated requirements are grounded in the documents and validation evidence
3. Compliance Alignment: Maintain alignment with training standards and regulatory requirements
4. Clarity Enhancement: Improve requirement language for clarity and measurability
5. Context Preservation: Maintain the original intent and scope while enhancing quality

REGENERATION PRINCIPLES:
- Evidence Alignment: Regenerated requirements must be directly supported by evidence in the documents
- Clarity and Specificity: Use clear, unambiguous language with specific, measurable criteria
- Completeness: Address all relevant assessment dimensions
- Professional Quality: Maintain formal, professional tone with consistent terminology

OUTPUT FORMAT:
Regenerate requirements in JSON format with: requirement_id, original_requirement, regenerated_requirement, improvement_summary, evidence_references, alignment_notes, confidence_level, and change_justification.',
    'Based on the provided requirement, documents, and validation context, regenerate the requirement with improved clarity, specificity, and evidence alignment. Maintain the original intent while enhancing quality and measurability.',
    '{
      "temperature": 0.6,
      "maxOutputTokens": 4096,
      "topP": 0.95,
      "topK": 40
    }',
    '{
      "type": "object",
      "properties": {
        "requirement_id": {"type": "string"},
        "original_requirement": {"type": "string"},
        "regenerated_requirement": {"type": "string"},
        "improvement_summary": {"type": "string"},
        "evidence_references": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "document": {"type": "string"},
              "page": {"type": ["string", "integer"]},
              "section": {"type": "string"},
              "evidence_snippet": {"type": "string"}
            }
          }
        },
        "alignment_notes": {"type": "string"},
        "confidence_level": {"type": "number", "minimum": 0, "maximum": 1},
        "change_justification": {"type": "string"}
      },
      "required": ["requirement_id", "original_requirement", "regenerated_requirement"]
    }',
    true,
    true,
    NOW()
) ON CONFLICT DO NOTHING;
