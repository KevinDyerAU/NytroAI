/**
 * Standalone Validation Prompt Module
 * 
 * Provides focused, reusable validation prompts for assessing requirements
 * against assessment documents. Completely independent from smart question generation.
 */

export interface ValidationPromptInput {
  requirementNumber: string;
  requirementType: string;
  requirementText: string;
  assessmentContext?: string;
  unitCode?: string;
  unitTitle?: string;
}

export interface ValidationPromptOptions {
  includeEvidence?: boolean;
  includeCitations?: boolean;
  detailedReasoning?: boolean;
}

/**
 * Generate a focused validation prompt for a single requirement
 * 
 * @param input - Requirement details and context
 * @param options - Validation options
 * @returns Validation prompt string
 */
export function createValidationPrompt(
  input: ValidationPromptInput,
  options: ValidationPromptOptions = {}
): string {
  const {
    includeEvidence = true,
    includeCitations = true,
    detailedReasoning = true,
  } = options;

  return `You are an expert assessment validator for vocational education and training (VET).

## Task
Validate whether the following requirement is adequately addressed in the assessment.

## Requirement Details
- **Number:** ${input.requirementNumber}
- **Type:** ${input.requirementType}
${input.unitCode ? `- **Unit:** ${input.unitCode}${input.unitTitle ? ` - ${input.unitTitle}` : ''}` : ''}

**Requirement Text:**
${input.requirementText}

${input.assessmentContext ? `## Assessment Context\n${input.assessmentContext}\n` : ''}

## Validation Criteria
Determine if the assessment:
1. **Directly addresses** the requirement
2. **Provides sufficient opportunities** for learners to demonstrate the requirement
3. **Includes appropriate assessment methods** for this requirement type
4. **Meets the depth and breadth** expected for this requirement

## Response Format
Provide your validation in the following JSON structure:

\`\`\`json
{
  "status": "met" | "not-met" | "partial",
  "reasoning": "Brief explanation (2-3 sentences) of why this status was assigned",
  ${includeEvidence ? `"evidence": {
    "strengths": ["List specific strengths found in the assessment"],
    "gaps": ["List specific gaps or weaknesses"],
    "suggestions": ["Specific suggestions for improvement if not fully met"]
  },` : ''}
  ${includeCitations ? `"citations": [
    {
      "text": "Relevant excerpt from assessment",
      "page": "Page number or section",
      "relevance": "How this supports the validation"
    }
  ],` : ''}
  ${detailedReasoning ? `"detailed_analysis": {
    "coverage_score": 0-100,
    "assessment_methods": ["Methods used to assess this requirement"],
    "alignment": "How well the assessment aligns with the requirement"
  }` : ''}
}
\`\`\`

## Important Guidelines
- Be objective and evidence-based
- Consider the requirement type when assessing adequacy
- "met" = Fully addresses the requirement with appropriate assessment methods
- "partial" = Addresses some aspects but has gaps or insufficient depth
- "not-met" = Does not adequately address the requirement
- Provide specific, actionable feedback
- Reference specific parts of the assessment when possible
`;
}

/**
 * Generate a batch validation prompt for multiple requirements
 * More efficient when validating many requirements at once
 * 
 * @param requirements - Array of requirements to validate
 * @param assessmentContext - Common assessment context
 * @returns Batch validation prompt string
 */
export function createBatchValidationPrompt(
  requirements: ValidationPromptInput[],
  assessmentContext?: string
): string {
  const requirementsList = requirements.map((req, index) => 
    `### Requirement ${index + 1}: ${req.requirementNumber}
**Type:** ${req.requirementType}
**Text:** ${req.requirementText}
`
  ).join('\n');

  return `You are an expert assessment validator for vocational education and training (VET).

## Task
Validate whether the following requirements are adequately addressed in the assessment.

${assessmentContext ? `## Assessment Context\n${assessmentContext}\n` : ''}

## Requirements to Validate
${requirementsList}

## Validation Criteria (for each requirement)
Determine if the assessment:
1. **Directly addresses** the requirement
2. **Provides sufficient opportunities** for learners to demonstrate the requirement
3. **Includes appropriate assessment methods** for this requirement type
4. **Meets the depth and breadth** expected for this requirement

## Response Format
Provide your validation as a JSON array, one object per requirement:

\`\`\`json
[
  {
    "requirement_number": "${requirements[0]?.requirementNumber}",
    "status": "met" | "not-met" | "partial",
    "reasoning": "Brief explanation (2-3 sentences)",
    "evidence": {
      "strengths": ["Specific strengths"],
      "gaps": ["Specific gaps"],
      "suggestions": ["Improvement suggestions"]
    },
    "citations": [
      {
        "text": "Relevant excerpt",
        "page": "Page or section",
        "relevance": "How this supports validation"
      }
    ]
  }
  // ... one object per requirement
]
\`\`\`

## Important Guidelines
- Validate each requirement independently
- Be objective and evidence-based
- Provide specific, actionable feedback for each requirement
- Reference specific parts of the assessment when possible
`;
}

/**
 * Generate a re-validation prompt (when re-running validation with updates)
 * 
 * @param input - Requirement and previous validation details
 * @param previousValidation - Previous validation result
 * @param changesNote - Note about what changed
 * @returns Re-validation prompt string
 */
export function createRevalidationPrompt(
  input: ValidationPromptInput,
  previousValidation: {
    status: string;
    reasoning: string;
    evidence?: any;
  },
  changesNote?: string
): string {
  return `You are re-validating a requirement that was previously assessed.

## Requirement Details
- **Number:** ${input.requirementNumber}
- **Type:** ${input.requirementType}
${input.unitCode ? `- **Unit:** ${input.unitCode}${input.unitTitle ? ` - ${input.unitTitle}` : ''}` : ''}

**Requirement Text:**
${input.requirementText}

## Previous Validation Result
- **Status:** ${previousValidation.status}
- **Reasoning:** ${previousValidation.reasoning}
${previousValidation.evidence ? `- **Previous Evidence:** ${JSON.stringify(previousValidation.evidence, null, 2)}` : ''}

${changesNote ? `## Changes Since Last Validation\n${changesNote}\n` : ''}

${input.assessmentContext ? `## Updated Assessment Context\n${input.assessmentContext}\n` : ''}

## Task
Re-validate this requirement considering:
1. The previous validation result
2. Any changes or updates since the last validation
3. Current state of the assessment

## Response Format
Provide your re-validation in JSON format:

\`\`\`json
{
  "status": "met" | "not-met" | "partial",
  "reasoning": "Explanation of current validation status",
  "changes_from_previous": "What changed compared to previous validation",
  "evidence": {
    "strengths": ["Current strengths"],
    "gaps": ["Current gaps"],
    "improvements_made": ["Improvements since last validation"],
    "remaining_issues": ["Issues that still need addressing"]
  },
  "recommendation": "Next steps or recommendations"
}
\`\`\`

## Important Guidelines
- Compare against the previous validation
- Highlight what has improved or regressed
- Be specific about remaining gaps
- Provide clear recommendations for next steps
`;
}

/**
 * Helper function to extract validation result from AI response
 * Handles various response formats and extracts JSON
 * 
 * @param aiResponse - Raw AI response text
 * @returns Parsed validation result or null
 */
export function parseValidationResponse(aiResponse: string): any | null {
  try {
    // Try to extract JSON from code blocks
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || 
                     aiResponse.match(/```\n([\s\S]*?)\n```/) ||
                     aiResponse.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    }
    
    // Try parsing the entire response as JSON
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error('[Validation Prompt] Failed to parse validation response:', error);
    return null;
  }
}

/**
 * Validate the structure of a validation result
 * Ensures required fields are present
 * 
 * @param result - Validation result to check
 * @returns true if valid, false otherwise
 */
export function isValidValidationResult(result: any): boolean {
  if (!result || typeof result !== 'object') return false;
  
  const hasStatus = ['met', 'not-met', 'partial'].includes(result.status);
  const hasReasoning = typeof result.reasoning === 'string' && result.reasoning.length > 0;
  
  return hasStatus && hasReasoning;
}
