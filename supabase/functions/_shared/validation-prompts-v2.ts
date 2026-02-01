/**
 * Validation Prompts V2 - JSON Requirements Processing
 * 
 * Updated validation prompts that process requirements as structured JSON arrays
 * instead of text strings. This enables more precise validation and better
 * tracking of individual requirements.
 */

export interface ValidationPromptConfig {
  validationType: string;
  variant: 'simple' | 'smart';
  target: 'unit' | 'learner_guide';
}

/**
 * Get validation prompt for a specific type (V2 - JSON requirements)
 * 
 * This version expects requirements to be passed as a JSON array in the format:
 * [
 *   {
 *     "id": 123,
 *     "unitCode": "BSBWHS211",
 *     "type": "knowledge_evidence",
 *     "number": "1",
 *     "text": "Requirement text here",
 *     "description": "Description here"
 *   },
 *   ...
 * ]
 */
export function getValidationPromptV2(
  validationType: string,
  unit: any,
  requirementsJSON: string
): string {
  const baseIntro = `You are an expert RTO (Registered Training Organisation) validator with access to assessment documents through AI-powered semantic search. The documents have been indexed and you can retrieve relevant information by understanding the context and meaning of requirements.

IMPORTANT: You have access to the full assessment documents through semantic search. When you reference content, the system will automatically retrieve relevant sections. Focus on validation logic rather than document retrieval.

`;

  const jsonInstructions = `
REQUIREMENTS FORMAT:
The requirements are provided as a JSON array. Each requirement object contains:
- id: Unique identifier for the requirement
- unitCode: The unit of competency code
- type: The requirement type (knowledge_evidence, performance_evidence, etc.)
- number: The requirement number/identifier
- text: The actual requirement text to validate against
- description: Additional description or context

YOU MUST:
1. Parse the JSON array of requirements
2. Validate EACH requirement individually against the assessment documents
3. Return results in the specified JSON format with validation for each requirement
4. Include the requirement ID in your response so results can be linked back to the database

`;

  const citationNote = `
CITATION REQUIREMENTS:
- When you find evidence in the documents, reference the specific location (page numbers, section names, document names)
- Be specific about what content you found and where
- If content is missing, clearly state what you looked for and couldn't find
- The system will provide citations automatically, but you should mention document locations in your analysis
`;

  switch (validationType) {
    case 'knowledge_evidence':
      return baseIntro + jsonInstructions + getKnowledgeEvidencePromptV2(unit, requirementsJSON) + citationNote;

    case 'performance_evidence':
      return baseIntro + jsonInstructions + getPerformanceEvidencePromptV2(unit, requirementsJSON) + citationNote;

    case 'foundation_skills':
      return baseIntro + jsonInstructions + getFoundationSkillsPromptV2(unit, requirementsJSON) + citationNote;

    case 'elements_criteria':
      return baseIntro + jsonInstructions + getElementsCriteriaPromptV2(unit, requirementsJSON) + citationNote;

    case 'assessment_conditions':
      return baseIntro + jsonInstructions + getAssessmentConditionsPromptV2(unit, requirementsJSON) + citationNote;

    case 'full_validation':
      return baseIntro + jsonInstructions + getFullValidationPromptV2(unit, requirementsJSON) + citationNote;

    default:
      return baseIntro + jsonInstructions + `Analyze this assessment document for compliance with unit requirements for ${unit.code}.` + citationNote;
  }
}

/**
 * Knowledge Evidence validation prompt (V2 - JSON requirements)
 */
function getKnowledgeEvidencePromptV2(unit: any, requirementsJSON: string): string {
  return `**Unit of Competency**: ${unit.code} - ${unit.title}

**Knowledge Evidence Requirements** (JSON Array):
\`\`\`json
${requirementsJSON}
\`\`\`

**Validation Task**:

For EACH requirement in the JSON array above, you must:

1. **Identify the Requirement**
   - Use the requirement ID, number, and text from the JSON
   - Understand what knowledge is being assessed

2. **Search for Evidence**
   - Look for assessment questions that test this specific knowledge
   - Find relevant content in the assessment documents
   - Note page numbers, sections, and question numbers

3. **Determine Status**
   - "met": Assessment fully covers this knowledge requirement with appropriate questions
   - "partial": Assessment partially covers this requirement but gaps exist
   - "not_met": Assessment does not adequately test this knowledge

4. **Provide Reasoning**
   - Explain what evidence you found (or didn't find)
   - Reference specific questions and their locations
   - Justify your status determination

5. **Generate Smart Questions** (if status is "partial" or "not_met")
   - Create 1-3 assessment questions that would address the gaps
   - Questions should directly test the missing knowledge
   - Format: Clear, assessable questions with context

**Required JSON Response Format**:

\`\`\`json
{
  "validationType": "knowledge_evidence",
  "unitCode": "${unit.code}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary of validation results",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation of why this status was assigned",
      "evidenceFound": [
        {
          "location": "Page X, Section Y",
          "questionNumber": "Question Z",
          "questionText": "The actual question text",
          "relevance": "How this question addresses the requirement"
        }
      ],
      "gaps": [
        "Specific gap 1",
        "Specific gap 2"
      ],
      "smartQuestions": [
        {
          "question": "Proposed assessment question text",
          "rationale": "Why this question addresses the gap",
          "assessmentType": "written" | "practical" | "oral"
        }
      ],
      "citations": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "chunkText": "Relevant excerpt"
        }
      ]
    }
  ]
}
\`\`\`

**Important Notes**:
- You MUST validate every requirement in the JSON array
- Each requirement must have its own validation entry in the response
- Include the requirementId so results can be stored in the database
- Be thorough but concise in your reasoning
- Smart questions should be practical and directly address gaps
`;
}

/**
 * Performance Evidence validation prompt (V2 - JSON requirements)
 */
function getPerformanceEvidencePromptV2(unit: any, requirementsJSON: string): string {
  return `**Unit of Competency**: ${unit.code} - ${unit.title}

**Performance Evidence Requirements** (JSON Array):
\`\`\`json
${requirementsJSON}
\`\`\`

**Validation Task**:

For EACH requirement in the JSON array above, you must:

1. **Identify the Requirement**
   - Use the requirement ID, number, and text from the JSON
   - Understand what performance/task is being assessed

2. **Search for Evidence**
   - Look for assessment tasks, scenarios, or activities that require this performance
   - Find practical demonstrations or simulations
   - Note page numbers, task numbers, and descriptions

3. **Determine Status**
   - "met": Assessment includes tasks that demonstrate this performance
   - "partial": Assessment partially covers this performance but gaps exist
   - "not_met": Assessment does not require demonstration of this performance

4. **Provide Reasoning**
   - Explain what tasks/activities you found (or didn't find)
   - Reference specific assessment components and their locations
   - Justify your status determination

5. **Generate Smart Questions/Tasks** (if status is "partial" or "not_met")
   - Create 1-3 assessment tasks that would demonstrate the missing performance
   - Tasks should be practical and realistic
   - Format: Clear task descriptions with context

**Required JSON Response Format**:

\`\`\`json
{
  "validationType": "performance_evidence",
  "unitCode": "${unit.code}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary of validation results",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation of why this status was assigned",
      "evidenceFound": [
        {
          "location": "Page X, Task Y",
          "taskNumber": "Task Z",
          "taskDescription": "The actual task description",
          "relevance": "How this task demonstrates the required performance"
        }
      ],
      "gaps": [
        "Specific gap 1",
        "Specific gap 2"
      ],
      "smartQuestions": [
        {
          "question": "Proposed assessment task description",
          "rationale": "Why this task addresses the gap",
          "assessmentType": "practical" | "simulation" | "workplace"
        }
      ],
      "citations": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "chunkText": "Relevant excerpt"
        }
      ]
    }
  ]
}
\`\`\`

**Important Notes**:
- You MUST validate every requirement in the JSON array
- Each requirement must have its own validation entry in the response
- Include the requirementId so results can be stored in the database
- Focus on practical demonstrations, not just theoretical knowledge
- Smart tasks should be realistic and achievable in an assessment context
`;
}

/**
 * Foundation Skills validation prompt (V2 - JSON requirements)
 */
function getFoundationSkillsPromptV2(unit: any, requirementsJSON: string): string {
  return `**Unit of Competency**: ${unit.code} - ${unit.title}

**Foundation Skills Requirements** (JSON Array):
\`\`\`json
${requirementsJSON}
\`\`\`

**Validation Task**:

For EACH foundation skill requirement in the JSON array above, you must:

1. **Identify the Skill**
   - Use the requirement ID, number, and text from the JSON
   - Understand what foundation skill is being assessed (literacy, numeracy, communication, etc.)

2. **Search for Evidence**
   - Look for assessment components that require use of this skill
   - Find implicit or explicit skill demonstrations
   - Note where and how the skill is applied

3. **Determine Status**
   - "met": Assessment requires demonstration of this foundation skill
   - "partial": Assessment partially requires this skill but could be strengthened
   - "not_met": Assessment does not adequately require this foundation skill

4. **Provide Reasoning**
   - Explain where and how the skill is (or isn't) required
   - Reference specific assessment components
   - Justify your status determination

5. **Generate Smart Questions/Tasks** (if status is "partial" or "not_met")
   - Create 1-3 assessment components that would require the missing skill
   - Ensure the skill application is clear and assessable

**Required JSON Response Format**:

\`\`\`json
{
  "validationType": "foundation_skills",
  "unitCode": "${unit.code}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary of validation results",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation of why this status was assigned",
      "evidenceFound": [
        {
          "location": "Page X, Component Y",
          "description": "How the skill is demonstrated",
          "relevance": "Why this demonstrates the required skill"
        }
      ],
      "gaps": [
        "Specific gap 1",
        "Specific gap 2"
      ],
      "smartQuestions": [
        {
          "question": "Proposed assessment component",
          "rationale": "Why this addresses the skill gap",
          "skillApplication": "How the skill is demonstrated"
        }
      ],
      "citations": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "chunkText": "Relevant excerpt"
        }
      ]
    }
  ]
}
\`\`\`

**Important Notes**:
- You MUST validate every foundation skill in the JSON array
- Foundation skills can be demonstrated implicitly through other assessment tasks
- Look for both explicit and implicit skill requirements
- Include the requirementId so results can be stored in the database
`;
}

/**
 * Elements & Performance Criteria validation prompt (V2 - JSON requirements)
 */
function getElementsCriteriaPromptV2(unit: any, requirementsJSON: string): string {
  return `**Unit of Competency**: ${unit.code} - ${unit.title}

**Elements & Performance Criteria Requirements** (JSON Array):
\`\`\`json
${requirementsJSON}
\`\`\`

**Validation Task**:

For EACH performance criterion in the JSON array above, you must:

1. **Identify the Criterion**
   - Use the requirement ID, number, and text from the JSON
   - Understand what specific performance is being measured

2. **Search for Evidence**
   - Look for assessment components that test this criterion
   - Find questions, tasks, or observations that address it
   - Note locations and specific references

3. **Determine Status**
   - "met": Assessment adequately tests this performance criterion
   - "partial": Assessment partially tests this criterion but gaps exist
   - "not_met": Assessment does not test this performance criterion

4. **Provide Reasoning**
   - Explain what evidence you found (or didn't find)
   - Reference specific assessment components
   - Justify your status determination

5. **Generate Smart Questions/Tasks** (if status is "partial" or "not_met")
   - Create 1-3 assessment components that would test the missing criterion
   - Be specific to the performance being measured

**Required JSON Response Format**:

\`\`\`json
{
  "validationType": "elements_criteria",
  "unitCode": "${unit.code}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary of validation results",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation of why this status was assigned",
      "evidenceFound": [
        {
          "location": "Page X, Component Y",
          "description": "What tests this criterion",
          "relevance": "How it addresses the criterion"
        }
      ],
      "gaps": [
        "Specific gap 1",
        "Specific gap 2"
      ],
      "smartQuestions": [
        {
          "question": "Proposed assessment component",
          "rationale": "Why this tests the criterion",
          "assessmentType": "question" | "task" | "observation"
        }
      ],
      "citations": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "chunkText": "Relevant excerpt"
        }
      ]
    }
  ]
}
\`\`\`

**Important Notes**:
- You MUST validate every performance criterion in the JSON array
- Each criterion must be individually assessed
- Include the requirementId so results can be stored in the database
- Be precise about which criterion is being tested by which assessment component
`;
}

/**
 * Assessment Conditions validation prompt (V2 - JSON requirements)
 */
function getAssessmentConditionsPromptV2(unit: any, requirementsJSON: string): string {
  return `**Unit of Competency**: ${unit.code} - ${unit.title}

**Assessment Conditions Requirements** (JSON Array):
\`\`\`json
${requirementsJSON}
\`\`\`

**Validation Task**:

For EACH assessment condition in the JSON array above, you must:

1. **Identify the Condition**
   - Use the requirement ID, number, and text from the JSON
   - Understand what condition or context is required

2. **Search for Evidence**
   - Look for specifications of assessment conditions in the documents
   - Find references to environment, resources, timing, etc.
   - Note where conditions are specified

3. **Determine Status**
   - "met": Assessment specifies appropriate conditions for this requirement
   - "partial": Assessment partially specifies conditions but gaps exist
   - "not_met": Assessment does not specify this required condition

4. **Provide Reasoning**
   - Explain what condition specifications you found (or didn't find)
   - Reference specific sections of the assessment
   - Justify your status determination

5. **Generate Recommendations** (if status is "partial" or "not_met")
   - Suggest 1-3 ways to specify the missing conditions
   - Be specific about what needs to be added

**Required JSON Response Format**:

\`\`\`json
{
  "validationType": "assessment_conditions",
  "unitCode": "${unit.code}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary of validation results",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation of why this status was assigned",
      "evidenceFound": [
        {
          "location": "Page X, Section Y",
          "description": "What condition is specified",
          "relevance": "How it meets the requirement"
        }
      ],
      "gaps": [
        "Specific gap 1",
        "Specific gap 2"
      ],
      "smartQuestions": [
        {
          "question": "Recommended condition specification",
          "rationale": "Why this is needed",
          "implementationNote": "How to add this to the assessment"
        }
      ],
      "citations": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "chunkText": "Relevant excerpt"
        }
      ]
    }
  ]
}
\`\`\`

**Important Notes**:
- You MUST validate every assessment condition in the JSON array
- Assessment conditions include environment, resources, tools, timing, supervision, etc.
- Include the requirementId so results can be stored in the database
- Be specific about what conditions are missing or inadequately specified
`;
}

/**
 * Full Validation prompt (V2 - JSON requirements for all types)
 */
function getFullValidationPromptV2(unit: any, requirementsJSON: string): string {
  return `**Unit of Competency**: ${unit.code} - ${unit.title}

**ALL Requirements** (JSON Array - includes all requirement types):
\`\`\`json
${requirementsJSON}
\`\`\`

**Validation Task**:

This is a FULL VALIDATION covering all requirement types:
- Knowledge Evidence
- Performance Evidence
- Foundation Skills
- Elements & Performance Criteria
- Assessment Conditions

For EACH requirement in the JSON array above (regardless of type), you must:

1. **Identify the Requirement**
   - Use the requirement ID, number, type, and text from the JSON
   - Understand what is being assessed based on the requirement type

2. **Search for Evidence**
   - Look for assessment components that address this requirement
   - Consider the requirement type when searching
   - Note locations and specific references

3. **Determine Status**
   - "met": Assessment adequately addresses this requirement
   - "partial": Assessment partially addresses this requirement but gaps exist
   - "not_met": Assessment does not address this requirement

4. **Provide Reasoning**
   - Explain what evidence you found (or didn't find)
   - Reference specific assessment components
   - Justify your status determination

5. **Generate Smart Questions/Tasks** (if status is "partial" or "not_met")
   - Create appropriate assessment components based on requirement type
   - Ensure they directly address the gaps

**Required JSON Response Format**:

\`\`\`json
{
  "validationType": "full_validation",
  "unitCode": "${unit.code}",
  "overallStatus": "met" | "partial" | "not_met",
  "summary": "Brief overall summary of full validation results",
  "requirementValidations": [
    {
      "requirementId": <id from JSON>,
      "requirementType": "<type from JSON>",
      "requirementNumber": "<number from JSON>",
      "requirementText": "<text from JSON>",
      "status": "met" | "partial" | "not_met",
      "reasoning": "Detailed explanation",
      "evidenceFound": [
        {
          "location": "Page X, Component Y",
          "description": "What addresses this requirement",
          "relevance": "How it addresses the requirement"
        }
      ],
      "gaps": ["Specific gap 1", "Specific gap 2"],
      "smartQuestions": [
        {
          "question": "Proposed assessment component",
          "rationale": "Why this addresses the gap",
          "assessmentType": "appropriate type based on requirement"
        }
      ],
      "citations": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "chunkText": "Relevant excerpt"
        }
      ]
    }
  ],
  "summaryByType": {
    "knowledge_evidence": { "total": X, "met": Y, "partial": Z, "not_met": W },
    "performance_evidence": { "total": X, "met": Y, "partial": Z, "not_met": W },
    "foundation_skills": { "total": X, "met": Y, "partial": Z, "not_met": W },
    "elements_performance_criteria": { "total": X, "met": Y, "partial": Z, "not_met": W },
    "assessment_conditions": { "total": X, "met": Y, "partial": Z, "not_met": W }
  }
}
\`\`\`

**Important Notes**:
- You MUST validate EVERY requirement in the JSON array
- Each requirement must have its own validation entry
- Include the requirementId and requirementType for database storage
- Provide a summary by type at the end
- This is a comprehensive validation - be thorough
`;
}
