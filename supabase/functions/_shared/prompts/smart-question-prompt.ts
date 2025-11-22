/**
 * Standalone Smart Question Generation Prompt Module
 * 
 * Provides focused, reusable prompts for generating SMART questions
 * based on validation results. Completely independent from validation logic.
 * Can be called from UI for regeneration with additional context.
 */

export interface SmartQuestionInput {
  requirementNumber: string;
  requirementType: string;
  requirementText: string;
  validationStatus: 'met' | 'not-met' | 'partial';
  validationReasoning?: string;
  evidence?: {
    strengths?: string[];
    gaps?: string[];
    suggestions?: string[];
  };
  unitCode?: string;
  unitTitle?: string;
  userContext?: string; // Additional context from user for regeneration
}

export interface SmartQuestionOptions {
  includeBenchmarkAnswer?: boolean;
  includeAssessmentCriteria?: boolean;
  difficultyLevel?: 'basic' | 'intermediate' | 'advanced';
  questionCount?: number;
}

/**
 * Generate a SMART question prompt for a single requirement
 * 
 * SMART = Specific, Measurable, Achievable, Relevant, Time-bound
 * 
 * @param input - Requirement and validation details
 * @param options - Question generation options
 * @returns Smart question generation prompt
 */
export function createSmartQuestionPrompt(
  input: SmartQuestionInput,
  options: SmartQuestionOptions = {}
): string {
  const {
    includeBenchmarkAnswer = true,
    includeAssessmentCriteria = true,
    difficultyLevel = 'intermediate',
    questionCount = 1,
  } = options;

  const statusGuidance = getStatusGuidance(input.validationStatus);

  return `You are an expert assessment question writer for vocational education and training (VET).

## Task
Generate ${questionCount} SMART ${questionCount > 1 ? 'questions' : 'question'} to help learners demonstrate the following requirement.

## Requirement Details
- **Number:** ${input.requirementNumber}
- **Type:** ${input.requirementType}
${input.unitCode ? `- **Unit:** ${input.unitCode}${input.unitTitle ? ` - ${input.unitTitle}` : ''}` : ''}

**Requirement Text:**
${input.requirementText}

## Current Validation Status
- **Status:** ${input.validationStatus}
${input.validationReasoning ? `- **Reasoning:** ${input.validationReasoning}` : ''}

${input.evidence ? `## Evidence from Validation
${input.evidence.strengths && input.evidence.strengths.length > 0 ? `**Strengths:**\n${input.evidence.strengths.map(s => `- ${s}`).join('\n')}\n` : ''}
${input.evidence.gaps && input.evidence.gaps.length > 0 ? `**Gaps:**\n${input.evidence.gaps.map(g => `- ${g}`).join('\n')}\n` : ''}
${input.evidence.suggestions && input.evidence.suggestions.length > 0 ? `**Suggestions:**\n${input.evidence.suggestions.map(s => `- ${s}`).join('\n')}` : ''}
` : ''}

${input.userContext ? `## Additional Context from User\n${input.userContext}\n` : ''}

## Question Requirements
${statusGuidance}

Your ${questionCount > 1 ? 'questions' : 'question'} should be:
- **Specific:** Clearly focused on ${input.requirementNumber}
- **Measurable:** Has clear criteria for assessment
- **Achievable:** Appropriate for the ${difficultyLevel} level
- **Relevant:** Directly addresses the requirement
- **Time-bound:** Can be completed within a reasonable timeframe

## Response Format
${questionCount === 1 ? `Provide your question in the following JSON structure:

\`\`\`json
{
  "question": "The SMART question text",
  ${includeBenchmarkAnswer ? `"benchmark_answer": "A model answer showing what a good response looks like",` : ''}
  ${includeAssessmentCriteria ? `"assessment_criteria": [
    "Criterion 1: What to look for in the answer",
    "Criterion 2: Key points that should be covered",
    "Criterion 3: Level of detail expected"
  ],` : ''}
  "question_type": "scenario" | "case-study" | "practical" | "knowledge" | "analysis",
  "difficulty_level": "${difficultyLevel}",
  "estimated_time": "Estimated time to complete (e.g., '15 minutes')",
  "focus_areas": ["Key area 1", "Key area 2"]
}
\`\`\`` : `Provide your questions as a JSON array:

\`\`\`json
[
  {
    "question": "The SMART question text",
    ${includeBenchmarkAnswer ? `"benchmark_answer": "A model answer",` : ''}
    ${includeAssessmentCriteria ? `"assessment_criteria": ["Criterion 1", "Criterion 2"],` : ''}
    "question_type": "scenario" | "case-study" | "practical" | "knowledge" | "analysis",
    "difficulty_level": "${difficultyLevel}",
    "estimated_time": "15 minutes",
    "focus_areas": ["Key area 1", "Key area 2"]
  }
  // ... ${questionCount} questions total
]
\`\`\``}

## Important Guidelines
- Focus ONLY on ${input.requirementNumber} - do not mix in other requirements
- Make questions practical and realistic for workplace scenarios
- Ensure questions can be objectively assessed
- ${includeBenchmarkAnswer ? 'Provide detailed benchmark answers that demonstrate expected quality' : ''}
- ${input.userContext ? 'Incorporate the user\'s additional context where relevant' : ''}
- Questions should help address any identified gaps in the current assessment
`;
}

/**
 * Get guidance based on validation status
 */
function getStatusGuidance(status: string): string {
  switch (status) {
    case 'met':
      return `Since this requirement is already MET, generate questions that:
- Reinforce and deepen understanding
- Provide alternative ways to demonstrate competency
- Challenge learners to apply knowledge in different contexts`;
    
    case 'not-met':
      return `Since this requirement is NOT MET, generate questions that:
- Directly address the gaps identified in validation
- Provide clear opportunities to demonstrate the requirement
- Guide learners toward meeting the requirement`;
    
    case 'partial':
      return `Since this requirement is PARTIALLY met, generate questions that:
- Address the specific gaps while building on strengths
- Fill in missing aspects of the requirement
- Help learners complete their demonstration of competency`;
    
    default:
      return `Generate questions that help learners fully demonstrate this requirement.`;
  }
}

/**
 * Generate a regeneration prompt (when user wants to improve existing questions)
 * 
 * @param input - Requirement and validation details
 * @param currentQuestion - Current question to improve
 * @param userFeedback - User's feedback on current question
 * @param options - Question generation options
 * @returns Regeneration prompt
 */
export function createRegenerationPrompt(
  input: SmartQuestionInput,
  currentQuestion: {
    question: string;
    benchmarkAnswer?: string;
  },
  userFeedback: string,
  options: SmartQuestionOptions = {}
): string {
  const {
    includeBenchmarkAnswer = true,
    includeAssessmentCriteria = true,
    difficultyLevel = 'intermediate',
  } = options;

  return `You are improving a SMART question based on user feedback.

## Requirement Details
- **Number:** ${input.requirementNumber}
- **Type:** ${input.requirementType}
${input.unitCode ? `- **Unit:** ${input.unitCode}${input.unitTitle ? ` - ${input.unitTitle}` : ''}` : ''}

**Requirement Text:**
${input.requirementText}

## Current Validation Status
- **Status:** ${input.validationStatus}
${input.validationReasoning ? `- **Reasoning:** ${input.validationReasoning}` : ''}

## Current SMART Question
**Question:**
${currentQuestion.question}

${currentQuestion.benchmarkAnswer ? `**Current Benchmark Answer:**
${currentQuestion.benchmarkAnswer}` : ''}

## User Feedback
${userFeedback}

${input.userContext ? `## Additional Context\n${input.userContext}\n` : ''}

## Task
Generate an improved SMART question that:
1. Addresses the user's feedback
2. Maintains focus on ${input.requirementNumber} ONLY
3. Improves upon the current question
4. Remains practical and assessable

## Response Format
Provide the improved question in JSON format:

\`\`\`json
{
  "question": "The improved SMART question",
  ${includeBenchmarkAnswer ? `"benchmark_answer": "Improved benchmark answer",` : ''}
  ${includeAssessmentCriteria ? `"assessment_criteria": ["Criterion 1", "Criterion 2", "Criterion 3"],` : ''}
  "question_type": "scenario" | "case-study" | "practical" | "knowledge" | "analysis",
  "difficulty_level": "${difficultyLevel}",
  "estimated_time": "Estimated completion time",
  "improvements_made": ["What was improved based on feedback"],
  "focus_areas": ["Key area 1", "Key area 2"]
}
\`\`\`

## Important Guidelines
- Directly address the user's feedback
- Keep the question focused on ${input.requirementNumber} only
- Maintain SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)
- Ensure the question is practical for workplace scenarios
- Provide clear assessment criteria
`;
}

/**
 * Generate questions for multiple requirements at once
 * More efficient for batch generation
 * 
 * @param requirements - Array of requirements with validation results
 * @param options - Question generation options
 * @returns Batch question generation prompt
 */
export function createBatchSmartQuestionPrompt(
  requirements: SmartQuestionInput[],
  options: SmartQuestionOptions = {}
): string {
  const {
    includeBenchmarkAnswer = true,
    includeAssessmentCriteria = true,
    difficultyLevel = 'intermediate',
  } = options;

  const requirementsList = requirements.map((req, index) => 
    `### Requirement ${index + 1}: ${req.requirementNumber}
**Type:** ${req.requirementType}
**Text:** ${req.requirementText}
**Validation Status:** ${req.validationStatus}
${req.validationReasoning ? `**Reasoning:** ${req.validationReasoning}` : ''}
${req.evidence?.gaps ? `**Gaps to Address:** ${req.evidence.gaps.join(', ')}` : ''}
`
  ).join('\n');

  return `You are generating SMART questions for multiple requirements.

## Requirements to Address
${requirementsList}

## Task
Generate ONE SMART question for EACH requirement listed above.

## Question Requirements
Each question should be:
- **Specific:** Clearly focused on its requirement number
- **Measurable:** Has clear assessment criteria
- **Achievable:** Appropriate for ${difficultyLevel} level
- **Relevant:** Directly addresses the requirement
- **Time-bound:** Can be completed in reasonable time

## Response Format
Provide questions as a JSON array, one per requirement:

\`\`\`json
[
  {
    "requirement_number": "${requirements[0]?.requirementNumber}",
    "question": "SMART question for this requirement",
    ${includeBenchmarkAnswer ? `"benchmark_answer": "Model answer",` : ''}
    ${includeAssessmentCriteria ? `"assessment_criteria": ["Criterion 1", "Criterion 2"],` : ''}
    "question_type": "scenario" | "case-study" | "practical" | "knowledge" | "analysis",
    "difficulty_level": "${difficultyLevel}",
    "estimated_time": "15 minutes",
    "focus_areas": ["Key area 1"]
  }
  // ... one object per requirement
]
\`\`\`

## Important Guidelines
- Generate exactly ONE question per requirement
- Keep each question focused on its specific requirement ONLY
- Make questions practical and realistic
- Ensure questions address any identified gaps
- Provide clear, detailed benchmark answers
`;
}

/**
 * Helper function to parse smart question response from AI
 * 
 * @param aiResponse - Raw AI response text
 * @returns Parsed question(s) or null
 */
export function parseSmartQuestionResponse(aiResponse: string): any | null {
  try {
    // Try to extract JSON from code blocks
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || 
                     aiResponse.match(/```\n([\s\S]*?)\n```/) ||
                     aiResponse.match(/\{[\s\S]*\}/) ||
                     aiResponse.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    }
    
    // Try parsing the entire response as JSON
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error('[Smart Question Prompt] Failed to parse question response:', error);
    return null;
  }
}

/**
 * Validate the structure of a smart question result
 * 
 * @param result - Question result to validate
 * @returns true if valid, false otherwise
 */
export function isValidSmartQuestion(result: any): boolean {
  if (!result || typeof result !== 'object') return false;
  
  const hasQuestion = typeof result.question === 'string' && result.question.length > 0;
  const hasType = ['scenario', 'case-study', 'practical', 'knowledge', 'analysis'].includes(result.question_type);
  
  return hasQuestion && hasType;
}

/**
 * Helper to extract just the question and answer for simple use cases
 * 
 * @param result - Full question result
 * @returns Simplified question object
 */
export function simplifyQuestionResult(result: any): { question: string; answer: string } {
  return {
    question: result.question || '',
    answer: result.benchmark_answer || result.answer || '',
  };
}
