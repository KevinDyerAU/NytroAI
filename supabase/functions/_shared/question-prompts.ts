/**
 * Question Generation Prompts
 * 
 * Comprehensive prompts for generating SMART assessment questions
 * with document context and unit requirements
 */

export interface QuestionGenerationParams {
  unitCode: string;
  unitTitle: string;
  requirementType?: string;
  requirementText?: string;
  questionCount: number;
  hasDocument: boolean;
  userContext?: string;
}

/**
 * Get question generation prompt based on parameters
 */
export function getQuestionGenerationPrompt(params: QuestionGenerationParams): string {
  const {
    unitCode,
    unitTitle,
    requirementType,
    requirementText,
    questionCount,
    hasDocument,
    userContext,
  } = params;

  let prompt = `# SMART Assessment Question Generation\n\n`;

  prompt += `## Unit of Competency\n`;
  prompt += `- **Code**: ${unitCode}\n`;
  prompt += `- **Title**: ${unitTitle}\n\n`;

  if (requirementType && requirementText) {
    prompt += `## Specific Requirement\n`;
    prompt += `- **Type**: ${requirementType}\n`;
    prompt += `- **Requirement**: ${requirementText}\n\n`;
  }

  if (userContext) {
    prompt += `## Additional Context\n`;
    prompt += `${userContext}\n\n`;
  }

  prompt += `## Task\n\n`;

  if (hasDocument) {
    prompt += `Generate **${questionCount} SMART assessment questions** based on the unit requirements and the assessment document provided.\n\n`;
    prompt += `### Instructions\n\n`;
    prompt += `1. **Review the Assessment Document**: Carefully examine the provided document to understand:\n`;
    prompt += `   - Current assessment approach and methodology\n`;
    prompt += `   - Existing questions and assessment tasks\n`;
    prompt += `   - Coverage of unit requirements\n`;
    prompt += `   - Assessment context and scenarios\n\n`;
    prompt += `2. **Align with Requirements**: Ensure questions directly assess the specified unit requirements\n\n`;
    prompt += `3. **Build on Document Context**: Create questions that:\n`;
    prompt += `   - Are grounded in the actual assessment materials\n`;
    prompt += `   - Reference specific sections or scenarios from the document\n`;
    prompt += `   - Complement or improve upon existing assessments\n`;
    prompt += `   - Maintain consistency with the document's approach\n\n`;
    prompt += `4. **Provide Document References**: Include specific references to document sections, pages, or scenarios\n\n`;
  } else {
    prompt += `Generate **${questionCount} SMART assessment questions** based on the unit requirements.\n\n`;
    prompt += `### Instructions\n\n`;
    prompt += `1. **Align with Requirements**: Ensure questions directly assess the specified unit requirements\n\n`;
    prompt += `2. **Create Comprehensive Questions**: Cover different aspects of the competency\n\n`;
    prompt += `3. **Vary Question Types**: Include knowledge, performance, and foundation skills questions\n\n`;
    prompt += `4. **Provide Detailed Answers**: Include comprehensive benchmark answers\n\n`;
  }

  prompt += `### SMART Criteria\n\n`;
  prompt += `Each question must be:\n\n`;
  prompt += `- **Specific**: Clearly defined and unambiguous, targeting a specific skill or knowledge area\n`;
  prompt += `- **Measurable**: Can be assessed objectively with clear success criteria\n`;
  prompt += `- **Achievable**: Realistic for the competency level and learner capability\n`;
  prompt += `- **Relevant**: Directly related to unit requirements and workplace application\n`;
  prompt += `- **Time-bound**: Can be completed within a reasonable assessment timeframe\n\n`;

  prompt += `### Question Types\n\n`;
  prompt += `**Knowledge Questions**: Assess understanding of concepts, principles, and procedures\n`;
  prompt += `- Example: "Explain the five steps of the infection control procedure as outlined in Section 3 of the assessment"\n\n`;
  
  prompt += `**Performance Questions**: Assess practical skills and task completion\n`;
  prompt += `- Example: "Demonstrate the correct procedure for donning and doffing PPE as described in the assessment scenario"\n\n`;
  
  prompt += `**Foundation Skills Questions**: Assess literacy, numeracy, and communication skills\n`;
  prompt += `- Example: "Calculate the required dilution ratio for the cleaning solution based on the manufacturer's instructions"\n\n`;

  prompt += `### Assessment Categories\n\n`;
  prompt += `Choose appropriate categories based on the unit requirements:\n\n`;
  prompt += `1. **Workplace Safety & WHS**: Safety procedures, risk assessment, hazard identification\n`;
  prompt += `2. **Infection Control**: Hygiene practices, PPE use, contamination prevention\n`;
  prompt += `3. **Communication**: Workplace communication, documentation, reporting\n`;
  prompt += `4. **Teamwork & Collaboration**: Working with others, team roles, collaboration\n`;
  prompt += `5. **Problem Solving**: Critical thinking, decision making, troubleshooting\n`;
  prompt += `6. **Technical Skills**: Equipment use, procedures, technical knowledge\n`;
  prompt += `7. **Quality Assurance**: Standards compliance, quality control, monitoring\n`;
  prompt += `8. **Customer Service**: Client interaction, service delivery, satisfaction\n`;
  prompt += `9. **Planning & Organization**: Task planning, resource management, scheduling\n`;
  prompt += `10. **Legal & Compliance**: Regulations, policies, ethical considerations\n`;
  prompt += `11. **Technology Use**: Digital tools, software, systems\n`;
  prompt += `12. **Sustainability**: Environmental practices, resource efficiency\n`;
  prompt += `13. **Continuous Improvement**: Reflection, feedback, development\n`;
  prompt += `14. **Industry-Specific Skills**: Specialized skills for the industry sector\n\n`;

  prompt += `### Difficulty Levels\n\n`;
  prompt += `**Basic**: Recall and comprehension of fundamental concepts\n`;
  prompt += `- Example: "List the three main types of PPE required for this task"\n\n`;

  prompt += `**Intermediate**: Application and analysis of knowledge in context\n`;
  prompt += `- Example: "Analyze the workplace scenario and identify potential safety hazards"\n\n`;

  prompt += `**Advanced**: Synthesis and evaluation requiring higher-order thinking\n`;
  prompt += `- Example: "Evaluate the effectiveness of the current infection control procedures and recommend improvements"\n\n`;

  prompt += `### Benchmark Answers\n\n`;
  prompt += `Each question must include a comprehensive benchmark answer that:\n\n`;
  prompt += `1. **Provides the Complete Answer**: Include all key points and details\n`;
  prompt += `2. **Explains the Reasoning**: Show why this is the correct answer\n`;
  prompt += `3. **References Standards**: Cite relevant regulations, policies, or best practices\n`;
  prompt += `4. **Includes Examples**: Provide practical examples where appropriate\n`;
  prompt += `5. **Identifies Common Errors**: Note common mistakes to avoid\n\n`;

  if (hasDocument) {
    prompt += `### Document References\n\n`;
    prompt += `For each question, provide specific references to the assessment document:\n\n`;
    prompt += `- **Section References**: "Section 2.3: Infection Control Procedures"\n`;
    prompt += `- **Page References**: "Page 5, Paragraph 3"\n`;
    prompt += `- **Scenario References**: "Scenario B: Hospital Ward Cleaning"\n`;
    prompt += `- **Appendix References**: "Appendix A: Safety Checklist"\n\n`;
  }

  prompt += `## Output Format\n\n`;
  prompt += `Return a JSON array with exactly ${questionCount} questions in the following structure:\n\n`;
  prompt += `\`\`\`json\n`;
  prompt += `[\n`;
  prompt += `  {\n`;
  prompt += `    "question": "The complete SMART question text",\n`;
  prompt += `    "benchmark_answer": "Comprehensive benchmark answer with key points, reasoning, and examples",\n`;
  prompt += `    "question_type": "knowledge|performance|foundation_skills",\n`;
  prompt += `    "difficulty_level": "basic|intermediate|advanced",\n`;
  prompt += `    "assessment_category": "One of the 14 categories listed above",\n`;
  prompt += `    "doc_references": "${hasDocument ? 'Specific references to document sections, pages, or scenarios' : ''}"\n`;
  prompt += `  }\n`;
  prompt += `]\n`;
  prompt += `\`\`\`\n\n`;

  prompt += `## Quality Checklist\n\n`;
  prompt += `Before finalizing, verify each question:\n\n`;
  prompt += `- [ ] Meets all SMART criteria\n`;
  prompt += `- [ ] Aligns with unit requirements\n`;
  prompt += `- [ ] Has appropriate difficulty level\n`;
  prompt += `- [ ] Includes comprehensive benchmark answer\n`;
  prompt += `- [ ] Fits within assessment category\n`;
  if (hasDocument) {
    prompt += `- [ ] References specific document sections\n`;
    prompt += `- [ ] Builds on document context\n`;
  }
  prompt += `- [ ] Is clear and unambiguous\n`;
  prompt += `- [ ] Can be objectively assessed\n`;
  prompt += `- [ ] Is realistic and achievable\n\n`;

  prompt += `## Generate Questions Now\n\n`;
  prompt += `Generate ${questionCount} SMART assessment questions following all the guidelines above.\n`;

  return prompt;
}

/**
 * Get prompt for specific requirement types
 */
export function getRequirementSpecificPrompt(requirementType: string): string {
  const prompts: Record<string, string> = {
    knowledge_evidence: `
### Knowledge Evidence Focus

Generate questions that specifically assess the learner's understanding of:
- Concepts, principles, and theories
- Procedures and processes
- Regulations and standards
- Industry terminology and definitions
- Cause-and-effect relationships
- Underlying reasons and rationale

Questions should require learners to:
- Explain, describe, or define
- Compare and contrast
- Analyze and interpret
- Apply knowledge to scenarios
`,
    performance_evidence: `
### Performance Evidence Focus

Generate questions that specifically assess the learner's ability to:
- Perform tasks and procedures
- Demonstrate practical skills
- Apply knowledge in workplace contexts
- Complete work activities to standard
- Use tools, equipment, and resources
- Follow workplace procedures

Questions should require learners to:
- Demonstrate or perform
- Complete practical tasks
- Apply skills in realistic scenarios
- Show competence through action
`,
    foundation_skills: `
### Foundation Skills Focus

Generate questions that specifically assess:
- **Literacy**: Reading, writing, oral communication
- **Numeracy**: Mathematical operations, measurements, calculations
- **Digital Literacy**: Technology use, digital tools
- **Critical Thinking**: Problem-solving, decision-making
- **Learning Skills**: Self-management, continuous improvement

Questions should integrate foundation skills naturally within the competency context.
`,
    elements_criteria: `
### Elements & Performance Criteria Focus

Generate questions that assess specific elements and performance criteria:
- Each question should target specific performance criteria
- Questions should assess observable performance
- Include criteria for successful completion
- Reference specific elements from the unit
`,
    assessment_conditions: `
### Assessment Conditions Focus

Generate questions that reflect the assessment conditions:
- Workplace environment and context
- Required resources and equipment
- Time constraints and deadlines
- Supervision and support available
- Realistic workplace scenarios
`,
  };

  return prompts[requirementType] || '';
}
