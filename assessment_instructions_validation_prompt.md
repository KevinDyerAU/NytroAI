# Assessment Instructions Validation Prompt

Validate the following Assessment Instruction requirement against the provided Unit assessment documents to ensure clear, comprehensive instructions are provided to assessors and learners.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Assessment Instructions Framework

Assessment instructions provide essential guidance to assessors and learners about how assessment will be conducted. They ensure consistency, fairness, and clarity in the assessment process.

### Purpose of Assessment Instructions

Assessment instructions should:

1. **Guide Assessors**
   - Explain how to conduct each assessment task
   - Clarify marking criteria and standards
   - Describe observation requirements
   - Outline documentation expectations

2. **Inform Learners**
   - Explain what is required for each task
   - Clarify submission requirements
   - Describe conditions and timeframes
   - Outline resources and materials needed

3. **Ensure Consistency**
   - Provide standardized assessment procedures
   - Define clear expectations for all parties
   - Support reliable and valid assessment outcomes

### Types of Assessment Instructions

1. **General Instructions**
   - Overview of the assessment process
   - Submission requirements
   - Time allocations
   - Resources and materials
   - Assessment overview and structure

2. **Task-Specific Instructions**
   - Step-by-step guidance for each task
   - Specific requirements and conditions
   - Expected outputs or deliverables
   - Performance standards

3. **Assessor Instructions**
   - Observation protocols
   - Marking guides and rubrics
   - Documentation requirements
   - Quality assurance procedures

4. **Learner Instructions**
   - Task requirements and expectations
   - Submission formats
   - Due dates and timeframes
   - Support and resources available

## Validation Instructions

Review the assessment documents using these steps:

### 1. Identify the Instruction Requirement
- Determine what specific instruction is required
- Identify the target audience (assessor, learner, or both)
- Clarify the purpose and scope of the instruction

### 2. Locate Matching Instructions
- Search the assessment documents for instructions that address this requirement
- Look for:
  - General instructions sections
  - Task-specific instructions
  - Assessor guides
  - Learner guidance
  - Submission requirements
  - Assessment procedures
- For each relevant match, note:
  - Document name
  - Section name
  - Page number(s)
  - Content of the instruction

### 3. Evaluate Instruction Quality
- Assess whether instructions are:
  - Clear and unambiguous
  - Complete and comprehensive
  - Appropriate for the audience
  - Consistent with assessment requirements
  - Practical and implementable

### 4. Identify Gaps
- Determine if instructions are missing, incomplete, or unclear
- Note any ambiguities or contradictions
- Identify areas where additional guidance is needed

### 5. Assign Status
- **Met**: Clear, comprehensive instructions are provided
- **Partially Met**: Instructions exist but are incomplete, unclear, or insufficient
- **Not Met**: No relevant instructions are provided

## Analysis Requirements

### 1. Status
Are clear instructions provided?
- **Met**: Clear, comprehensive, and appropriate instructions are provided
- **Partially Met**: Instructions exist but are incomplete, unclear, or need improvement
- **Not Met**: No relevant instructions are provided

### 2. Reasoning (max 300 words)
- For "Met": Explain how instructions adequately address the requirement
- For "Partially Met": Explain what is provided AND what is missing or unclear
- For "Not Met": Detail why instructions are absent and what is needed
- Reference specific sections or pages from the documents
- Focus on clarity, completeness, and appropriateness

### 3. Mapped Content (max 200 words)
- What specific instructions address this requirement?
- Include document names, section names, and page numbers
- Provide brief excerpts or descriptions of the instructions
- Format: "Section X (Page Y) provides instructions: '[excerpt or description]'"
- Use "N/A" if no relevant content found

### 4. Doc References (max 150 words)
- Provide specific document references
- Format: "Document name, Section name, Page number(s)"
- Use semicolons to separate multiple references
- Example: "Assessment Tool v2.1, General Instructions, Pages 2-3; Assessment Tool v2.1, Task 1 Instructions, Page 8"
- Use "N/A" if no relevant references

### 5. Unmapped Content (max 200 words)
- What aspects of this instruction requirement are not addressed?
- **Only include if Status is "Partially Met" or "Not Met"**
- For "Partially Met" or "Not Met":
  - State what specific instruction is missing
  - Identify gaps in clarity or completeness
  - Explain why current instructions are insufficient
- For "Met": Use "N/A"

## Assessment Principles

- **Be lenient**: If instructions are reasonably clear and adequate, mark as "Met"
- **Focus on clarity**: Instructions should be easily understood by the intended audience
- **Ensure completeness**: All necessary information should be provided
- **Consider context**: Instructions should be appropriate for the assessment type and level
- **Value consistency**: Instructions should be consistent across the assessment tool

## Output Format

Return **only** the JSON structure below. Do not provide additional text outside this structure.

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 200 words) or 'N/A'",
  "doc_references": "string (max 150 words) or 'N/A'",
  "unmapped_content": "string (max 200 words) or 'N/A'"
}
```

## Example JSON Output - Met

```json
{
  "requirement_number": "AI-002",
  "requirement_text": "Clear instructions for completing written assessment tasks",
  "status": "Met",
  "reasoning": "The assessment tool provides clear, comprehensive instructions for written assessment tasks. The General Instructions section (Pages 2-3) outlines overall expectations including word limits, referencing requirements, and submission formats. Each written task includes specific instructions detailing what learners must address, expected length, and any specific requirements. For example, Task 2 (Page 8) provides clear instructions: 'Write a 300-500 word response explaining the risk management process. Include the five key steps and provide a workplace example for each step. Submit as a Word document or PDF.' Instructions are written in plain language appropriate for learners and include all necessary details for successful completion.",
  "mapped_content": "General Instructions (Pages 2-3): Outlines submission requirements, word limits (200-500 words for short answer, 800-1200 for extended response), referencing style (APA 7th edition), file formats (Word or PDF), and due dates. Task 2 Instructions (Page 8): Specifies response length (300-500 words), content requirements (explain process, include five steps, provide examples), and submission format. Task 5 Instructions (Page 14): Details case study analysis requirements including structure, word count, and assessment criteria.",
  "doc_references": "Assessment Tool v3.1, General Instructions, Pages 2-3; Assessment Tool v3.1, Task 2: Risk Management Process, Page 8; Assessment Tool v3.1, Task 5: Case Study Analysis, Page 14",
  "unmapped_content": "N/A"
}
```

## Example JSON Output - Partially Met

```json
{
  "requirement_number": "AI-005",
  "requirement_text": "Instructions for assessors on conducting workplace observations",
  "status": "Partially Met",
  "reasoning": "The assessment tool includes some guidance for assessors conducting workplace observations, but it is incomplete. The Assessor Guide (Page 4) briefly mentions that 'observations should be conducted in the workplace or simulated environment' and that 'assessors must complete the observation checklist.' However, there are no detailed instructions on: how to set up observations, what to observe and record, how to interact with learners during observation, time requirements for observations, or how to handle situations where performance is not satisfactory. The observation checklist (Pages 18-20) lists criteria but lacks guidance on how assessors should use it or how to document observations comprehensively.",
  "mapped_content": "Assessor Guide (Page 4): Brief statement that observations should be conducted in workplace or simulated environment and that the observation checklist must be completed. Observation Checklist (Pages 18-20): Lists performance criteria to observe but provides no guidance on observation protocols, time requirements, or documentation standards.",
  "doc_references": "Assessment Tool v2.5, Assessor Guide, Page 4; Assessment Tool v2.5, Observation Checklist, Pages 18-20",
  "unmapped_content": "Missing detailed instructions on observation protocols including: how to arrange and prepare for observations, specific behaviors and actions to observe for each criterion, how to interact with learners during observation without influencing performance, minimum observation time requirements, procedures for documenting observations, how to provide feedback, and processes for re-assessment if performance is unsatisfactory. No guidance on using the observation checklist systematically or recording detailed evidence."
}
```

## Example JSON Output - Not Met

```json
{
  "requirement_number": "AI-008",
  "requirement_text": "Instructions for learners on preparing and submitting portfolio evidence",
  "status": "Not Met",
  "reasoning": "The assessment documents do not include any instructions for learners on preparing or submitting portfolio evidence. While Task 6 (Page 22) requires learners to 'compile a portfolio of workplace evidence,' there are no instructions explaining what a portfolio is, what types of evidence to include, how to organize or structure the portfolio, authentication requirements, confidentiality considerations, or submission procedures. Learners are expected to complete this task without any guidance on requirements, formats, or expectations. This absence of instructions could result in inconsistent submissions and learner confusion.",
  "mapped_content": "N/A",
  "doc_references": "N/A",
  "unmapped_content": "Completely missing instructions on portfolio preparation and submission. Required instructions should include: definition of portfolio and its purpose, types of evidence to include (documents, photos, supervisor statements, work samples), how many pieces of evidence are required, authentication requirements (signatures, dates, verification), confidentiality and privacy requirements for workplace documents, how to organize and structure the portfolio, acceptable formats (physical folder, digital, online platform), naming conventions for files, submission method and deadline, and what to do if workplace evidence is not available."
}
```
