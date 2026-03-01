// Validation prompts extracted from production n8n workflows
// Adapted for Gemini File Search API

export interface ValidationPromptConfig {
  validationType: string;
  variant: 'simple' | 'smart';
  target: 'unit' | 'learner_guide';
  originalFile: string;
}

/**
 * Get validation prompt for a specific type
 * 
 * NOTE: For 'full_validation', the database prompt is preferred and should be fetched
 * by the edge function. This fallback is only used if database prompt is not available.
 */
export function getValidationPrompt(
  validationType: string,
  unit: any,
  requirements?: any[]
): string {
  const baseIntro = `You are an expert RTO (Registered Training Organisation) validator with access to assessment documents through AI-powered semantic search. The documents have been indexed and you can retrieve relevant information by understanding the context and meaning of requirements.

IMPORTANT: You have access to the full assessment documents through semantic search. When you reference content, the system will automatically retrieve relevant sections. Focus on validation logic rather than document retrieval.

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
      return baseIntro + getKnowledgeEvidencePrompt(unit, requirements) + citationNote;
    
    case 'performance_evidence':
      return baseIntro + getPerformanceEvidencePrompt(unit, requirements) + citationNote;
    
    case 'foundation_skills':
      return baseIntro + getFoundationSkillsPrompt(unit, requirements) + citationNote;
    
    case 'elements_criteria':
      return baseIntro + getElementsCriteriaPrompt(unit, requirements) + citationNote;
    
    case 'assessment_conditions':
      return baseIntro + getAssessmentConditionsPrompt(unit, requirements) + citationNote;
    
    case 'assessment_instructions':
      return baseIntro + getAssessmentInstructionsPrompt(unit, requirements) + citationNote;
    
    case 'full_validation':
      // For full validation, prefer the database-stored comprehensive prompt
      // This fallback uses the simple version
      console.log('⚠️ Using fallback prompt for full_validation. Database prompt is preferred.');
      return baseIntro + getFullValidationPrompt(unit, requirements) + citationNote;
    
    default:
      return baseIntro + `Analyze this assessment document for compliance with unit requirements for ${unit.code}.` + citationNote;
  }
}

/**
 * Knowledge Evidence validation prompt (from SimpleKEValidateUnit.json)
 */
function getKnowledgeEvidencePrompt(unit: any, requirements?: any[]): string {
  // If requirements array is provided, format it inline (legacy behavior)
  // Otherwise, use {requirements} placeholder for JSON injection
  const keRequirements = requirements
    ? requirements
        .filter((r) => r.type === 'knowledge_evidence')
        .map((r, i) => `${i + 1}. ${r.description}`)
        .join('\n')
    : '{requirements}';

  return `Your task is to analyze the assessment documents using the information retrieved through semantic search to create a JSON response mapping knowledge points to assessment questions. Follow these streamlined steps:

**Unit of Competency**: ${unit.code} - ${unit.title}

**Knowledge Evidence Requirements**:
${keRequirements}

**Validation Process**:

1. **Locate Matching Assessment Questions**
   - Search the document(s) for assessment questions that directly align with the Knowledge Evidence Requirement.
   - For each relevant match, include:
     - Page Number
     - Document name
     - Section name
     - Question Number: The specific reference number (e.g., Question 1, Question 3)
     - Exact Question Text: The full text of the question as written
   - If multiple questions align, list all relevant matches using the same format

2. **Mark Gaps (Unmapped Content) — Only if Necessary**
   - Include "Unmapped Content" only if no questions fully align with the Knowledge Evidence Requirement
   - If gaps exist:
     - Status: Set to "Not Met" or "Partially Met"
     - Explanation: Briefly explain why the requirement was not fully addressed
     - Recommendation: Suggest a question or adjustment that would address the gap

3. **Generate High-Quality Assessment Questions and Benchmark Answers**
   To ensure questions are purposeful and well-formulated, generate a new question that addresses the entire Knowledge Evidence Requirement. The question should be designed based on the specific assessment purpose, using the appropriate verbs and phrasing as outlined in the table below.

   **Assessment Categories and Guidelines**:

   | Category | Purpose | Common Verbs |
   |----------|---------|--------------|
   | Concept Understanding | To assess understanding of core concepts, ideas, and reasoning | explain, describe, outline, summarise, discuss, identify, clarify |
   | Definitions & Terminology | To confirm understanding of key terms and vocabulary | define, identify, list, state, explain meaning of |
   | Processes & Procedures | To ensure learners can describe and explain relevant processes | describe, outline, explain, identify steps, summarise process |
   | Regulatory & Legislative | To verify awareness of laws, standards, and frameworks | identify, outline, describe, explain, summarise application of |
   | Safety and WHS | To ensure understanding of WHS obligations, hazards, and risks | explain, describe, outline, identify, discuss, summarise |
   | Environmental and Sustainability | To assess awareness of environmental responsibilities | explain, describe, discuss, outline, identify, summarise |
   | Roles & Responsibilities | To confirm understanding of one's own role, duties, and limits | explain, describe, outline, identify, discuss, state responsibilities |
   | Workplace Policies | To check knowledge of organisational documents and procedures | describe, explain, identify, summarise, outline, discuss purpose |
   | Problem Solving & Scenarios | To assess theoretical problem-solving and responses | explain, describe, outline, discuss, identify steps, suggest approach |
   | Customer and Communication | To evaluate knowledge of communication techniques | describe, explain, outline, identify, discuss, summarise |
   | Quality and Continuous Improvement | To assess knowledge of quality assurance systems | explain, describe, discuss, outline, identify benefits, summarise methods |
   | Technology and Equipment | To verify knowledge of workplace technology and tools | describe, explain, identify, outline, discuss purpose, summarise features |
   | Cultural and Ethical Awareness | To confirm understanding of diversity, ethics, inclusion | describe, explain, discuss, identify, outline principles, summarise |
   | Industry Knowledge and Trends | To demonstrate knowledge of industry context and trends | describe, explain, discuss, identify, summarise industry context |

   - **Generated Question**: A question that addresses the entire Knowledge Evidence Requirement, using the appropriate category and verbs from the table. Also generate a second, multiple-choice question.
   - **Benchmark Answer**: Provide the expected learner response for the generated questions.

4. **Assign Status**
   For each Knowledge Evidence Requirement, it is mandatory to assign one of the following statuses:
   - **Met**: Fully mapped to one or more questions
   - **Partially Met**: Some alignment exists, but gaps remain
   - **Not Met**: No matching questions were found

**Output Format**:

\`\`\`json
{
  "Knowledge Evidence Requirement": "Insert the exact Knowledge Evidence Requirement here.",
  "Status": "Met / Not Met / Partially Met",
  "Document and Pages": "assessment.pdf: Section1, Page 6, 7",
  "Mapped Questions": [
    {
      "Question Number": 1,
      "Exact Question Text": "Insert the full question text here."
    },
    {
      "Question Number": 3,
      "Exact Question Text": "Insert the full question text here."
    }
  ],
  "Generated Question": {
    "Question Text": "Insert generated question here that addresses the full Knowledge Evidence Requirement.",
    "Benchmark Answer": "Insert the benchmark answer here that fully meets the requirement."
  },
  "Unmapped Content": [
    {
      "Knowledge Evidence Requirement": "Insert text of unmapped requirement here.",
      "Explanation": "Brief explanation of why no relevant question aligns.",
      "Recommendation": "Suggest a question that directly addresses the Knowledge Evidence Requirement."
    }
  ]
}
\`\`\`

**Important**: When assessing, be very lenient. If the content is close enough to the requirement, mark it as met.

Return only the JSON structure.`;
}

/**
 * Performance Evidence validation prompt (from SimplePEValidateUnit.json)
 */
function getPerformanceEvidencePrompt(unit: any, requirements?: any[]): string {
  // If requirements array is provided, format it inline (legacy behavior)
  // Otherwise, use {requirements} placeholder for JSON injection
  const peRequirements = requirements
    ? requirements
        .filter((r) => r.type === 'performance_evidence')
        .map((r, i) => `${i + 1}. ${r.description}`)
        .join('\n')
    : '{requirements}';

  return `Your task is to analyze the assessment documents using the information retrieved through semantic search to create a JSON response detailing the mapping between performance evidence requirements and assessment tasks or observations.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Performance Evidence Requirements**:
${peRequirements}

**Assessment Methods for Performance Evidence**:
Elements and performance criteria are assessed through practical demonstration, using methods such as:

- **Direct Observation**: Watching the student perform tasks in real or simulated environments (e.g., observing safe equipment operation)
- **Practical Demonstration**: The student shows their skills in specific scenarios (e.g., demonstrating correct use of workplace machinery)
- **Competency Checklists**: Assessing tasks against set criteria (e.g., completing a step-by-step task assessment)
- **Scenario-Based Assessments**: Simulating real-world conditions to test responses (only if there is no other option, e.g., handling an emergency situation)

**Validation Steps**:

1. **Identify Matching Observations or Tasks (Do Not Include Knowledge Questions)**
   - Search ALL provided documents for tasks or observations that directly align with the Performance Evidence Requirement
   - **EXCLUDE** these specific sections: "Assessor Checklist" and "Trainer Checklist" sections (these support evidence collection but cannot be used to meet requirements)
   - **INCLUDE** all other content from documents, regardless of document name or type
   - **ONLY** include student tasks that explicitly require the learner to perform the same action or response as specified in the performance criterion
   - For each relevant match, include:
     - Page number, document name, and section name
     - Observation/Task Number: The specific observation or task with reference number (e.g., Task 3.1, Question 4)
   - If multiple tasks align, list all matches using the same format

2. **Mark Gaps (Unmapped Content) — Only if Necessary**
   - Include "Unmapped Content" only if tasks don't fully align with the Performance Evidence Requirement
   - If gaps exist:
     - Status: Set to "Not Met" or "Partially Met"
     - Explanation: Briefly explain why the requirement was not fully addressed
     - Recommendation: Suggest a new task or observation that would address the gap

3. **Generate SMART Task and Benchmark Criteria**
   - Create a SMART task for the requirement
   - Condense into short, clear, and direct task description
   - Avoid unnecessary wording and ensure each task targets one requirement only
   - Create concise and accurate benchmark criteria that fully meet both the task and the performance requirement
   - Write in plain English and directly address the requirement

4. **Assign Status**
   For each Performance Evidence Requirement, assign one of the following statuses:
   - **Met**: Fully mapped to one or more tasks/observations
   - **Partially Met**: Some alignment exists, but gaps remain
   - **Not Met**: No matching tasks were found

**Output Format**:

\`\`\`json
{
  "Performance Evidence Requirement": "Insert the exact requirement here.",
  "Status": "Met / Not Met / Partially Met",
  "Document and Pages": "assessment.pdf: Page 12, Section 3",
  "Mapped Tasks": [
    {
      "Task Number": "3.1",
      "Task Description": "Insert the full task description here."
    }
  ],
  "Generated Task": {
    "Task Description": "Insert SMART task description here.",
    "Benchmark Criteria": "Insert benchmark criteria here."
  },
  "Unmapped Content": [
    {
      "Performance Evidence Requirement": "Insert text of unmapped requirement.",
      "Explanation": "Brief explanation of why no relevant task aligns.",
      "Recommendation": "Suggest a task that directly addresses the requirement."
    }
  ]
}
\`\`\`

**Important**: When assessing, be very lenient. If the content is close enough to the requirement, mark it as met.

Return only the JSON structure.`;
}

/**
 * Foundation Skills validation prompt (from SimpleFSValidateUnit.json)
 */
function getFoundationSkillsPrompt(unit: any, requirements?: any[]): string {
  return `Your task is to analyze the assessment documents to validate that foundation skills are adequately integrated and assessed.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Foundation Skills to Assess**:

1. **Language, Literacy and Numeracy (LLN)**
   - Reading: Ability to read and comprehend workplace documents
   - Writing: Ability to write workplace documents clearly
   - Oral Communication: Ability to communicate effectively verbally
   - Numeracy: Ability to use mathematics in workplace contexts

2. **Learning Skills**
   - Ability to learn new information and adapt to changes
   - Self-management and organization

3. **Problem-Solving Skills**
   - Ability to identify and solve workplace problems
   - Critical thinking and decision-making

4. **Technology Skills**
   - Use of workplace technology and digital tools
   - Information and communication technology (ICT) skills

5. **Teamwork and Collaboration**
   - Working effectively with others
   - Contributing to team goals

**Validation Process**:

1. **Identify Foundation Skills Integration**
   - Search the assessment documents for tasks, questions, or activities that require foundation skills
   - For each foundation skill area, identify:
     - Specific tasks or questions that assess the skill
     - Page numbers and document references
     - How the skill is integrated (explicit or embedded)

2. **Assess Integration Quality**
   - Determine if foundation skills are:
     - **Explicitly assessed**: Dedicated tasks/questions for the skill
     - **Embedded**: Integrated naturally into other assessment tasks
     - **Missing**: Not assessed at all

3. **Identify Gaps**
   - Mark any foundation skill areas that are not adequately assessed
   - Provide recommendations for integration

4. **Assign Status**
   For each foundation skill area:
   - **Met**: Adequately assessed (explicitly or embedded)
   - **Partially Met**: Some assessment present but insufficient
   - **Not Met**: Not assessed

**Output Format**:

\`\`\`json
{
  "Foundation Skill Area": "Language, Literacy and Numeracy",
  "Status": "Met / Not Met / Partially Met",
  "Integration Type": "Explicit / Embedded / Missing",
  "Document and Pages": "assessment.pdf: Pages 5-8",
  "Evidence": [
    {
      "Task/Question": "Describe the specific task or question",
      "How It Assesses": "Explain how this assesses the foundation skill"
    }
  ],
  "Gaps": "Explanation of any gaps",
  "Recommendations": "Suggestions for improving foundation skills assessment"
}
\`\`\`

**Important**: When assessing, be very lenient. If foundation skills are reasonably integrated, mark as met.

Return only the JSON structure for all foundation skill areas.`;
}

/**
 * Elements and Criteria validation prompt (from SimpleE_PCValidateUnit.json)
 */
function getElementsCriteriaPrompt(unit: any, requirements?: any[]): string {
  const elements = unit.elements || 'Not specified in database';

  return `Your task is to analyze the assessment documents to validate coverage of all elements and performance criteria.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Unit Elements**:
${elements}

**Assessment Methods**:
Elements and performance criteria are assessed through practical demonstration:
- **Direct Observation**: Watching the student perform tasks in real or simulated environments
- **Practical Demonstration**: Student shows skills in specific scenarios
- **Competency Checklists**: Assessing tasks against set criteria
- **Scenario-Based Assessments**: Simulating real-world conditions (only if no other option)

**Validation Steps**:

1. **Identify Matching Observations or Tasks**
   - Search ALL documents for tasks or observations that align with each Element and Performance Criterion
   - **EXCLUDE**: "Assessor Checklist" and "Trainer Checklist" sections
   - **INCLUDE**: All other content regardless of document type
   - **ONLY** include student tasks that require performing the same action as specified
   - For each match, include:
     - Page number, document name, section name
     - Task/Observation number and description

2. **Mark Gaps**
   - If no tasks align with an element or criterion, mark as "Not Met"
   - Provide explanation and recommendations

3. **Generate SMART Task**
   - Create a clear, direct task for the element/criterion
   - Provide benchmark criteria

4. **Assign Status**
   - **Met**: Fully mapped to tasks/observations
   - **Partially Met**: Some alignment but gaps remain
   - **Not Met**: No matching tasks found

**Output Format**:

\`\`\`json
{
  "Element": "Element description",
  "Performance Criterion": "Criterion description",
  "Status": "Met / Not Met / Partially Met",
  "Document and Pages": "assessment.pdf: Page 10, Section 2",
  "Mapped Tasks": [
    {
      "Task Number": "2.1",
      "Task Description": "Full task description"
    }
  ],
  "Generated Task": {
    "Task Description": "SMART task description",
    "Benchmark Criteria": "Benchmark criteria"
  },
  "Unmapped Content": {
    "Explanation": "Why criterion not met",
    "Recommendation": "Suggested task to address gap"
  }
}
\`\`\`

**Important**: Be very lenient. If content is close enough, mark as met.

Return only the JSON structure for all elements and criteria.`;
}

/**
 * Assessment Conditions validation prompt (from SimpleACValidateUnit.json)
 */
function getAssessmentConditionsPrompt(unit: any, requirements?: any[]): string {
  return `Your task is to validate that the assessment document meets all required assessment conditions for RTO compliance.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Assessment Conditions to Validate**:

1. **Assessment Environment**
   - Check: Verify if the document specifies whether skills should be demonstrated in a real or simulated workplace environment
   - Verify: Does it reflect real-world industry conditions?
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain why (e.g., missing environment details, ambiguity about simulation standards, lack of industry alignment)
   - Recommendation: If "Not Met", suggest improvements

2. **Necessary Resources**
   - Check: Ensure all required tools, equipment, and materials are explicitly listed
   - Status: "Met" or "Not Met"
   - If "Not Met": Detail what resources are missing, outdated, or inadequate
   - Recommendation: If "Not Met", specify missing resources

3. **Supervision and Observation Requirements**
   - Check: Confirm that a qualified assessor's role is specified
   - Check: Are third-party supervisors allowed? Are qualifications specified?
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain gaps (e.g., missing assessor qualifications, unclear third-party roles)
   - Recommendation: If "Not Met", suggest including qualifications

4. **Supplemental Evidence**
   - Check: Confirm if additional evidence (e.g., third-party reports, journals) is required
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain what's missing (e.g., lack of guidelines on supplemental evidence)
   - Recommendation: If "Not Met", recommend guidelines for evidence collection

5. **Compliance with Standards (ASQA, NQF)**
   - Check: Validate alignment with ASQA, NQF, or other relevant standards
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain if standards are missing or document is outdated
   - Recommendation: If "Not Met", suggest adding compliance references

6. **Qualification-Specific Requirements**
   - Check: Ensure assessment conditions are tailored to the qualification (e.g., healthcare, construction)
   - Status: "Met" or "Not Met"
   - If "Not Met": Describe misalignment or lack of industry-specific requirements
   - Recommendation: If "Not Met", suggest adjustments for industry needs

7. **Feedback and Review Procedures**
   - Check: Verify if there is a clear process for feedback and review
   - Status: "Met" or "Not Met"
   - If "Not Met": Specify missing elements (e.g., review timelines, feedback protocols)
   - Recommendation: If "Not Met", suggest providing timelines or guidelines

**Output Format**:

\`\`\`json
{
  "Assessment Environment": {
    "condition": "Assessment Environment",
    "status": "Met/Not Met",
    "reasoning": "Explanation of whether the condition is met",
    "recommendation": "Specific action to address any gap, if Not Met"
  },
  "Necessary Resources": {
    "condition": "Necessary Resources",
    "status": "Met/Not Met",
    "reasoning": "Explanation of whether resources are adequately listed",
    "recommendation": "Specific resources to add, if Not Met"
  },
  "Supervision and Observation Requirements": {
    "condition": "Supervision and Observation Requirements",
    "status": "Met/Not Met",
    "reasoning": "Explanation of whether supervision requirements are specified",
    "recommendation": "Suggestions for qualifications, if Not Met"
  },
  "Supplemental Evidence": {
    "condition": "Supplemental Evidence",
    "status": "Met/Not Met",
    "reasoning": "Explanation of whether additional evidence requirements are met",
    "recommendation": "Suggestions for evidence guidelines, if Not Met"
  },
  "Compliance with Standards": {
    "condition": "Compliance with Standards",
    "status": "Met/Not Met",
    "reasoning": "Explanation of whether document shows compliance",
    "recommendation": "Compliance additions, if Not Met"
  },
  "Qualification-Specific Requirements": {
    "condition": "Qualification-Specific Requirements",
    "status": "Met/Not Met",
    "reasoning": "Explanation of alignment with qualification specifics",
    "recommendation": "Suggestions for industry-specific requirements, if Not Met"
  },
  "Feedback and Review Procedures": {
    "condition": "Feedback and Review Procedures",
    "status": "Met/Not Met",
    "reasoning": "Explanation of feedback process clarity",
    "recommendation": "Suggestions for review guidelines, if Not Met"
  }
}
\`\`\`

**Important**: Be very lenient. If content is close enough, mark as met.

Return only the JSON structure.`;
}

/**
 * Assessment Instructions validation prompt (from SimpleAIValidateUnit.json)
 */
function getAssessmentInstructionsPrompt(unit: any, requirements?: any[]): string {
  return `Your task is to analyze the assessment documents to validate that clear, comprehensive instructions are provided for candidates.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Assessment Instructions to Validate**:

1. **Purpose and Overview**
   - Check: Is the assessment purpose clearly stated with an overview of what will be assessed?
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain what is missing or unclear
   - Recommendation: Suggest specific improvements

2. **Instructions Clarity**
   - Check: Are instructions clear, written in plain English, and free from ambiguity?
   - Status: "Met" or "Not Met"
   - If "Not Met": Identify unclear or confusing sections
   - Recommendation: Suggest how to improve clarity

3. **Task Requirements**
   - Check: Is it clear what the candidate needs to do? Are requirements specific and measurable?
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain what task details are missing
   - Recommendation: Suggest specific task clarifications

4. **Submission Requirements**
   - Check: Are submission formats, methods, and timeframes clearly specified?
   - Status: "Met" or "Not Met"
   - If "Not Met": Detail what submission information is missing
   - Recommendation: Suggest submission details to add

5. **Assessment Criteria**
   - Check: Are assessment criteria clearly communicated so candidates know how they will be judged?
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain what criteria information is missing
   - Recommendation: Suggest criteria to include

6. **Resources and Materials**
   - Check: Are required resources and accessible materials clearly listed?
   - Status: "Met" or "Not Met"
   - If "Not Met": Identify missing resource information
   - Recommendation: Suggest resources to specify

7. **Support and Assistance**
   - Check: Is it clear how candidates can get help? Are contact details provided?
   - Status: "Met" or "Not Met"
   - If "Not Met": Explain what support information is missing
   - Recommendation: Suggest support details to add

**Validation Process**:

1. **Locate Relevant Sections**
   - Search the document(s) for instruction sections, candidate guides, or assessment overviews
   - For each instruction area, identify the relevant content and page/section references

2. **Assess Each Instruction Area**
   - Evaluate whether each area meets the validation criteria
   - Document specific evidence found (or not found) in the assessment

3. **Assign Status**
   For each instruction area:
   - **Met**: Instruction area is clearly addressed
   - **Partially Met**: Some information present but incomplete
   - **Not Met**: Information is missing or unclear

**Output Format**:

\`\`\`json
{
  "Purpose and Overview": {
    "instruction_area": "Purpose and Overview",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Page 1, Section: Introduction",
    "reasoning": "Explanation of whether the instruction area is adequately addressed",
    "recommendation": "Specific action to address any gap, if Not Met"
  },
  "Instructions Clarity": {
    "instruction_area": "Instructions Clarity",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Pages 2-3",
    "reasoning": "Explanation of instruction clarity assessment",
    "recommendation": "Suggestions for improving clarity, if Not Met"
  },
  "Task Requirements": {
    "instruction_area": "Task Requirements",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Page 4, Section: Tasks",
    "reasoning": "Explanation of task requirements clarity",
    "recommendation": "Suggestions for task clarification, if Not Met"
  },
  "Submission Requirements": {
    "instruction_area": "Submission Requirements",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Page 5",
    "reasoning": "Explanation of submission requirements clarity",
    "recommendation": "Suggestions for submission details, if Not Met"
  },
  "Assessment Criteria": {
    "instruction_area": "Assessment Criteria",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Page 6",
    "reasoning": "Explanation of criteria clarity",
    "recommendation": "Suggestions for criteria improvements, if Not Met"
  },
  "Resources and Materials": {
    "instruction_area": "Resources and Materials",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Page 2",
    "reasoning": "Explanation of resource listing adequacy",
    "recommendation": "Suggestions for resource specification, if Not Met"
  },
  "Support and Assistance": {
    "instruction_area": "Support and Assistance",
    "status": "Met/Not Met/Partially Met",
    "document_and_pages": "assessment.pdf: Page 1",
    "reasoning": "Explanation of support information adequacy",
    "recommendation": "Suggestions for support details, if Not Met"
  }
}
\`\`\`

**Important**: Be very lenient. If instructions are reasonably clear, mark as met.

Return only the JSON structure.`;
}

/**
 * Full Validation prompt - comprehensive check
 */
function getFullValidationPrompt(unit: any, requirements?: any[]): string {
  return `Your task is to perform a comprehensive validation of the assessment document covering all compliance areas.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Comprehensive Validation Areas**:

1. **Knowledge Evidence**
   - Are all knowledge requirements covered?
   - Are questions appropriate and sufficient?

2. **Performance Evidence**
   - Are all performance requirements covered?
   - Are tasks practical and authentic?

3. **Foundation Skills**
   - Are LLN skills adequately assessed?
   - Are other foundation skills integrated?

4. **Elements and Performance Criteria**
   - Are all elements covered?
   - Are all performance criteria addressed?

5. **Assessment Conditions**
   - Is the assessment environment appropriate?
   - Are resources adequate?
   - Are supervision requirements clear?

6. **Assessment Instructions**
   - Are instructions clear and comprehensive?
   - Do candidates know what to do?

**Validation Process**:

1. Review the assessment document comprehensively
2. For each area, determine: Met, Partially Met, or Not Met
3. Identify critical gaps that must be addressed
4. Provide priority recommendations

**Output Format**:

\`\`\`json
{
  "Overall Score": 75,
  "Overall Status": "Partial",
  "Executive Summary": "3-4 sentence overview of validation",
  "Knowledge Evidence": {
    "Score": 80,
    "Status": "Met",
    "Summary": "Brief assessment"
  },
  "Performance Evidence": {
    "Score": 70,
    "Status": "Partial",
    "Summary": "Brief assessment"
  },
  "Foundation Skills": {
    "Score": 65,
    "Status": "Partial",
    "Summary": "Brief assessment"
  },
  "Elements and Criteria": {
    "Score": 80,
    "Status": "Met",
    "Summary": "Brief assessment"
  },
  "Assessment Conditions": {
    "Score": 75,
    "Status": "Partial",
    "Summary": "Brief assessment"
  },
  "Assessment Instructions": {
    "Score": 85,
    "Status": "Met",
    "Summary": "Brief assessment"
  },
  "Critical Gaps": [
    "Most important gap 1",
    "Most important gap 2"
  ],
  "Priority Recommendations": [
    "Top recommendation 1",
    "Top recommendation 2",
    "Top recommendation 3"
  ]
}
\`\`\`

**Scoring**:
- 80-100: Met
- 50-79: Partially Met
- 0-49: Not Met

**Important**: Be thorough but fair. Provide actionable recommendations.

Return only the JSON structure.`;
}
