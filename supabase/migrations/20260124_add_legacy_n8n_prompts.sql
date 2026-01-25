-- Add legacy prompts from original n8n workflows as version 0.1 for historical reference
-- These are the original hardcoded prompts that were later replaced by database-driven prompts

-- 1. Legacy Multi-Document Validation Prompt (from AIValidationFlow.json)
INSERT INTO prompts (
    name,
    prompt_type,
    requirement_type,
    document_type,
    version,
    is_default,
    is_active,
    prompt_text,
    system_instruction,
    output_schema,
    generation_config,
    created_at
) VALUES (
    'Legacy Multi-Document Validation Prompt (n8n)',
    'validation',
    'general',
    'all',
    'v0.1',
    false,
    false,
    '**Unit of Competency**: {{unit_code}}

**Validation Type**: {{requirement_type}}

**Requirements** (JSON Array):
```json
{{requirements_json}}
```

**Assessment Documents** ({{document_count}} documents):
{{document_names}}

{{aggregated_text}}

**MULTI-DOCUMENT INSTRUCTIONS**:
You have access to multiple assessment documents separated by document markers (═══).
When citing evidence:
1. ALWAYS reference the specific document name
2. Include page numbers relative to that document
3. Format: "Document: [name], Page: [number]"
4. Consider evidence across ALL documents

Example: "Assessment Task (Page 3, Question 5) supported by Marking Guide (Page 2)"

**Task**: Validate each requirement in the JSON array against the assessment documents. Return results in JSON format with the following structure:

```json
{
  "validationType": "{{requirement_type}}",
  "unitCode": "{{unit_code}}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation",
      "evidenceFound": [
        {
          "location": "Page X, Section Y",
          "content": "Relevant content",
          "relevance": "How this addresses the requirement"
        }
      ],
      "gaps": ["Gap 1", "Gap 2"],
      "smartQuestions": [
        {
          "question": "Proposed question",
          "rationale": "Why this addresses the gap"
        }
      ]
    }
  ]
}
```

IMPORTANT: Return ONLY valid JSON, no additional text.',
    'You are an expert RTO validator.',
    '{
      "type": "object",
      "properties": {
        "validationType": {"type": "string"},
        "unitCode": {"type": "string"},
        "overallStatus": {"type": "string", "enum": ["met", "partial", "not_met"]},
        "summary": {"type": "string"},
        "requirementValidations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "requirementId": {"type": "integer"},
              "requirementNumber": {"type": "string"},
              "requirementText": {"type": "string"},
              "status": {"type": "string", "enum": ["met", "partial", "not_met"]},
              "reasoning": {"type": "string"},
              "evidenceFound": {"type": "array"},
              "gaps": {"type": "array"},
              "smartQuestions": {"type": "array"}
            }
          }
        }
      }
    }',
    '{"temperature": 0.1, "maxOutputTokens": 8192}',
    NOW()
);

-- 2. Legacy Single Requirement Revalidation Prompt (from SingleRequirementRevalidationFlow.json)
INSERT INTO prompts (
    name,
    prompt_type,
    requirement_type,
    document_type,
    version,
    is_default,
    is_active,
    prompt_text,
    system_instruction,
    output_schema,
    generation_config,
    created_at
) VALUES (
    'Legacy Single Requirement Revalidation Prompt (n8n)',
    'requirement_revalidation',
    'general',
    'all',
    'v0.1',
    false,
    false,
    '**Unit Code:** {{unit_code}}

**Requirement Type:** {{requirement_type}}

**Requirement {{requirement_number}}:**
{{requirement_text}}

**Assessment Documents:**
{{aggregated_text}}

**Task:** Validate this single requirement and return results in JSON format:

```json
{
  "requirementId": {{requirement_id}},
  "requirementNumber": "{{requirement_number}}",
  "requirementText": "{{requirement_text}}",
  "status": "met" | "partial" | "not_met",
  "reasoning": "Detailed explanation of validation",
  "evidenceFound": [
    {
      "location": "Page X, Section Y",
      "content": "Relevant content",
      "relevance": "How this addresses the requirement"
    }
  ],
  "gaps": ["Gap 1", "Gap 2"],
  "smartQuestions": [
    {
      "question": "Proposed question",
      "rationale": "Why this addresses the gap"
    }
  ]
}
```

IMPORTANT: Return ONLY valid JSON, no additional text.',
    'You are an expert RTO validator. Revalidate the following requirement against the assessment documents.',
    '{
      "type": "object",
      "required": ["requirementId", "requirementNumber", "status", "reasoning"],
      "properties": {
        "requirementId": {"type": "integer"},
        "requirementNumber": {"type": "string"},
        "requirementText": {"type": "string"},
        "status": {"type": "string", "enum": ["met", "partial", "not_met"]},
        "reasoning": {"type": "string"},
        "evidenceFound": {"type": "array"},
        "gaps": {"type": "array"},
        "smartQuestions": {"type": "array"}
      }
    }',
    '{"temperature": 0.1, "maxOutputTokens": 4096}',
    NOW()
);

-- 3. Legacy Smart Question Regeneration Prompt (from SmartQuestionRegenerationFlow.json)
INSERT INTO prompts (
    name,
    prompt_type,
    requirement_type,
    document_type,
    version,
    is_default,
    is_active,
    prompt_text,
    system_instruction,
    output_schema,
    generation_config,
    created_at
) VALUES (
    'Legacy Smart Question Regeneration Prompt (n8n)',
    'smart_question',
    'general',
    'all',
    'v0.1',
    false,
    false,
    '**Unit Code:** {{unit_code}}

**Requirement Type:** {{requirement_type}}

**Requirement {{requirement_number}}:**
{{requirement_text}}

**Current Status:** {{status}}

**Reasoning:** {{reasoning}}

**Identified Gaps:**
{{gaps}}

{{user_guidance}}

**Task:** Generate 3-5 high-quality assessment questions that would address these gaps. Questions should be:
- Directly related to the requirement
- Appropriate for the assessment type (written, practical, or oral)
- Clear and unambiguous
- Assessable and measurable

Return results in JSON format:

```json
{
  "questions": [
    {
      "question": "Full question text",
      "rationale": "Why this question addresses the gap",
      "assessmentType": "written" | "practical" | "oral",
      "bloomsLevel": "knowledge" | "comprehension" | "application" | "analysis" | "synthesis" | "evaluation"
    }
  ]
}
```

IMPORTANT: Return ONLY valid JSON, no additional text.',
    'You are an expert RTO assessment designer. Generate smart assessment questions to address gaps in the following requirement.',
    '{
      "type": "object",
      "required": ["questions"],
      "properties": {
        "questions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "question": {"type": "string"},
              "rationale": {"type": "string"},
              "assessmentType": {"type": "string", "enum": ["written", "practical", "oral"]},
              "bloomsLevel": {"type": "string", "enum": ["knowledge", "comprehension", "application", "analysis", "synthesis", "evaluation"]}
            }
          }
        }
      }
    }',
    '{"temperature": 0.7, "maxOutputTokens": 2048}',
    NOW()
);

-- 4. Legacy Gemini Validation Prompt (from AIValidationFlow_Gemini.json)
INSERT INTO prompts (
    name,
    prompt_type,
    requirement_type,
    document_type,
    version,
    is_default,
    is_active,
    prompt_text,
    system_instruction,
    output_schema,
    generation_config,
    created_at
) VALUES (
    'Legacy Gemini File API Validation Prompt (n8n)',
    'validation',
    'general',
    'unit',
    'v0.1',
    false,
    false,
    '**UNIT REQUIREMENTS TO VALIDATE**

{{requirements_by_type}}

**INSTRUCTIONS:**
Analyze the uploaded assessment documents and validate against ALL requirements listed above.

For each requirement, provide:
1. Status: "Addressed", "Partially Addressed", or "Not Addressed"
2. Evidence found with document name and page/section
3. Reasoning for your assessment
4. Smart questions if gaps exist

Return your response in this JSON format:
{
  "validationType": "assessment",
  "overallStatus": "string",
  "summary": "string",
  "requirementValidations": [
    {
      "requirementNumber": "string",
      "requirementText": "string",
      "status": "Addressed|Partially Addressed|Not Addressed",
      "reasoning": "string",
      "evidenceFound": [
        {
          "document": "filename.pdf",
          "location": "Page X, Section Y",
          "content": "quote from document",
          "relevance": "explanation"
        }
      ],
      "gaps": ["string"],
      "smartQuestions": ["string"]
    }
  ]
}',
    'You are an expert RTO validator.',
    '{
      "type": "object",
      "properties": {
        "validationType": {"type": "string"},
        "overallStatus": {"type": "string"},
        "summary": {"type": "string"},
        "requirementValidations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "requirementNumber": {"type": "string"},
              "requirementText": {"type": "string"},
              "status": {"type": "string"},
              "reasoning": {"type": "string"},
              "evidenceFound": {"type": "array"},
              "gaps": {"type": "array"},
              "smartQuestions": {"type": "array"}
            }
          }
        }
      }
    }',
    '{"temperature": 0.1, "maxOutputTokens": 8192}',
    NOW()
);

-- Add a comment to track these are historical/legacy prompts
COMMENT ON TABLE prompts IS 'AI prompts for validation workflows. Version 0.1 prompts are legacy prompts extracted from original n8n workflows for historical reference.';
