# Foundation Skills Validation Prompt

Validate the following Foundation Skill against the provided Unit assessment documents to ensure it is effectively embedded and assessed within the training materials.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Foundation Skills Framework

Foundation skills are the core non-technical skills required for work performance. When evaluating, focus on:

### Foundation Skill Categories:

1. **Learning Skills**
   - Behaviors: Self-directed learning, adapting to new information, applying feedback, problem-solving in unfamiliar situations.
   - Context: How learners demonstrate ability to acquire and apply new knowledge.

2. **Reading Skills**
   - Behaviors: Comprehending written information, interpreting instructions, understanding workplace documents, extracting key information.
   - Context: How learners demonstrate reading comprehension in practical tasks.

3. **Writing Skills**
   - Behaviors: Producing written documents, completing forms, documenting processes, written communication clarity.
   - Context: How learners demonstrate written expression in workplace-relevant formats.

4. **Oral Communication Skills**
   - Behaviors: Verbal expression, active listening, presenting information, workplace discussions, customer interactions.
   - Context: How learners demonstrate spoken communication in practical scenarios.

5. **Numeracy Skills**
   - Behaviors: Mathematical calculations, measurements, data interpretation, budgeting, time management.
   - Context: How learners demonstrate numerical competence in workplace tasks.

6. **Teamwork & Collaboration**
   - Behaviors: Working cooperatively, contributing to team goals, respecting diverse perspectives, conflict resolution.
   - Context: How learners demonstrate collaborative skills in group activities.

7. **Problem-Solving & Initiative**
   - Behaviors: Identifying issues, developing solutions, critical thinking, decision-making, innovation.
   - Context: How learners demonstrate analytical and creative thinking.

8. **Planning & Organizing**
   - Behaviors: Task prioritization, time management, resource allocation, workflow planning.
   - Context: How learners demonstrate organizational capabilities.

9. **Self-Management**
   - Behaviors: Taking responsibility, working independently, managing stress, maintaining professionalism.
   - Context: How learners demonstrate personal accountability.

10. **Technology & Digital Literacy**
    - Behaviors: Using digital tools, navigating software, online communication, information technology.
    - Context: How learners demonstrate technical competence.

## Validation Instructions

Review the assessment documents using these steps:

### 1. Break Down the Skill
- Identify specific behaviors or abilities within the foundation skill
- Clearly describe what should be demonstrated (e.g., for communication: presenting ideas clearly, active listening, adapting language to audience)

### 2. Ensure Real-World Relevance
- Verify that tasks reflect authentic workplace scenarios where the skill would be applied
- Confirm practical relevance to employability and job performance

### 3. Check for Skill Integration
- Foundation skills MUST be embedded within performance tasks, not assessed separately
- Skills should be naturally integrated (e.g., literacy assessed through workplace writing tasks, numeracy through budget calculations)
- Avoid standalone foundation skills tests disconnected from practical application

### 4. Assessment Boundaries
- **Integration with Performance Tasks**: Foundation skills assessed alongside unit competencies
- **Alignment with Unit Requirements**: Skills must relate to unit outcomes
- **Avoid Redundancy**: Assess skills naturally within tasks without duplication
- **Consistency**: Apply consistent assessment approach across similar units

### 5. Assessment Methods
- Performance tasks, group projects, workplace interactions, written documentation, numeracy tasks, scenarios requiring communication/teamwork, problem-solving activities

### 6. Map Skill to Assessment Tasks
- Identify specific tasks, questions, or activities that require the skill
- Note document name, section name, page numbers, and task numbers
- Extract exact question/task text and relevant sub-points
- ALWAYS include page numbers in parentheses (e.g., "Task 4 (Page 15)")

## Analysis Requirements

### 1. Status
Is this foundation skill embedded and assessed?
- **Met**: Skill is naturally integrated into assessment tasks with clear, authentic application
- **Partially Met**: Skill is present but lacks depth, clarity, or authentic integration
- **Not Met**: Skill is missing, assessed in isolation, or inadequately addressed

### 2. Reasoning (max 300 words)
- For "Met": Explain how the skill is effectively embedded with specific examples
- For "Partially Met": Explain what is present AND what is missing or needs improvement
- For "Not Met": Detail why the skill is not adequately assessed and specific gaps
- Reference specific tasks, questions, or activities from the documents

### 3. Mapped Content (max 250 words)
- What specific tasks, questions, or activities require application of this skill?
- Include document names, section names, task numbers, and page numbers
- Provide brief excerpts or descriptions of relevant content
- Format: "Task X (Page Y) requires [skill application]: '[excerpt or description]'"
- Use "N/A" if no relevant content found

### 4. Citations (array of strings)
- Provide an array of specific citations
- Each citation should include: Document name, Section/Task name, Task number, Page number(s)
- Format examples:
  - "Assessment Tool v2.1, Task 3: Written Report, Page 12-13"
  - "Learner Workbook, Section 2.4: Communication Activity, Page 18"
  - "Observation Checklist, Item 7: Teamwork Demonstration, Page 5"
- Use empty array [] if no relevant citations

### 5. Unmapped Content (max 200 words)
- What aspects of this foundation skill are missing or inadequately assessed?
- For "Partially Met" or "Not Met": Identify specific gaps in coverage
- For "Met": Use "N/A"

### 6. Smart Question
- Generate ONE concise, clear, direct question that requires the learner to use this foundation skill
- Question should be specific, measurable, achievable, relevant, and targeted to one requirement
- Avoid unnecessary wording; focus on practical application
- Question should assess authentic skill application, not theoretical knowledge
- Examples:
  - **Reading**: "Review the workplace safety document and identify three key hazard controls."
  - **Writing**: "Document the steps you took to resolve the customer complaint."
  - **Numeracy**: "Calculate the total material cost for the project using the price list provided."
  - **Oral Communication**: "Explain to your supervisor the issue you identified and your proposed solution."

### 7. Benchmark Answer
- Provide a concise, accurate answer that fully meets both the smart question and the foundation skill requirement
- Answer must be written in plain English and directly address the question
- Describe the expected application of the skill in the answer
- Avoid unnecessary wording or repetition
- Focus on demonstrating competent skill application
- Examples:
  - **Reading**: "The three key hazard controls are: 1) PPE requirements (safety goggles and gloves), 2) Equipment lockout procedures before maintenance, 3) Designated safe zones marked with yellow tape."
  - **Writing**: "I documented the complaint details, investigation steps, actions taken, and customer resolution in the complaint log, ensuring all timestamps and outcomes were recorded clearly."

### 8. Recommendations (max 200 words)
- Provide actionable suggestions to improve foundation skills assessment
- **Only include if Status is "Partially Met" or "Not Met"**
- Examples:
  - Missing skill integration: "Add a task requiring learners to [specific skill application] within the context of [workplace activity]"
  - Insufficient authenticity: "Expand Task X to include authentic workplace documentation such as [specific document type]"
  - Standalone assessment: "Integrate the foundation skill assessment into Task Y by requiring learners to [demonstrate skill] while [performing practical task]"
  - Suggested task: "Add Task [X]: Learners must [demonstrate specific skill] by [authentic workplace activity]"
  - Missing depth: "Enhance Task X to require more complex application of [skill] such as [specific behavior]"
- For "Met": Use "None"

## Assessment Principles

- **Be lenient**: If content is close enough to the requirement and skill is authentically integrated, mark it as "Met"
- **Focus on integration**: Foundation skills should be naturally embedded, not standalone tests
- **Emphasize authenticity**: Skills should be assessed in realistic workplace contexts
- **Avoid redundancy**: Don't assess the same skill multiple times unless contextually different
- **Consider learner level**: Assessment should be appropriate for the qualification level
- **Ensure practicality**: Skills should be demonstrable through observable behaviors

## Output Format

Return **only** the JSON structure below. Do not provide additional text outside this structure.

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or 'N/A'",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or 'N/A'",
  "smart_question": "string",
  "benchmark_answer": "string",
  "recommendations": "string (max 200 words) or 'None'"
}
```

## Example JSON Output

```json
{
  "requirement_number": "FS-002",
  "requirement_text": "Writing Skills - Producing clear written documentation relevant to workplace tasks",
  "status": "Met",
  "reasoning": "Writing skills are effectively integrated throughout the assessment. Task 2 (Pages 8-9) requires learners to complete a detailed incident report using workplace templates. Task 5 (Page 15) requires written documentation of a work process with clear steps. Task 7 (Page 19) includes email communication to stakeholders. All writing tasks use authentic workplace formats and contexts, demonstrating practical application of writing skills rather than isolated grammar exercises.",
  "mapped_content": "Task 2 'Incident Report Documentation' (Pages 8-9): Learners must complete a workplace incident report form including incident details, actions taken, and recommendations. Task 5 'Process Documentation' (Page 15): Requires written step-by-step documentation of equipment maintenance procedure. Task 7 'Stakeholder Communication' (Page 19): Learners compose professional email to supervisor outlining project progress and issues.",
  "citations": [
    "Assessment Tool v3.2, Task 2: Incident Report Documentation, Pages 8-9",
    "Assessment Tool v3.2, Task 5: Process Documentation, Page 15",
    "Assessment Tool v3.2, Task 7: Stakeholder Communication, Page 19",
    "Observation Checklist, Item 12: Written Communication Quality, Page 4"
  ],
  "unmapped_content": "N/A",
  "smart_question": "Document the safety incident that occurred during the machine maintenance, including what happened, immediate actions taken, and recommendations to prevent recurrence.",
  "benchmark_answer": "The incident report should include: date, time, and location of incident; description of what occurred (e.g., 'Oil spill during filter replacement'); immediate actions taken (e.g., 'Area cordoned off, spill kit used, supervisor notified'); injuries or damage; and recommendations (e.g., 'Provide drip trays for future maintenance, review filter replacement procedure'). Documentation should be clear, factual, and use appropriate workplace terminology.",
  "recommendations": "None"
}
```
