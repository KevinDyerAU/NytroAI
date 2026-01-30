-- Fix v2.0 prompts - ensure full prompt text including Output Format section
-- The original migration may have truncated the prompt text

-- ID 171: PC Unit Validation v2.0 (Phase 1)
UPDATE prompts SET prompt_text = 'Validate the following Performance Criterion requirement against the provided Unit assessment documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Performance criteria define the specific actions, behaviors, and outcomes that demonstrate competent performance of each element.

### Assessment Requirements
- Practical demonstration of skills
- Observable workplace behaviors
- Measurable outcomes and results
- Application of knowledge in context

### Valid Assessment Methods
- Practical demonstrations
- Workplace observations
- Simulation exercises
- Project work
- Case studies with practical components
- Role plays

## Validation Instructions

1. **Search documents** for tasks/activities assessing this performance criterion
2. For each match, record: Document name, Section, Task number, Page number, Task description
3. Verify tasks require demonstration of the specific criterion
4. Determine if assessment coverage is sufficient

## Output Requirements

### Status
- **Met**: Fully assessed with appropriate practical tasks
- **Partially Met**: Some assessment but lacks coverage or depth
- **Not Met**: Not assessed in documents

### Reasoning (max 300 words)
Explain assessment with specific task references.

### Mapped Content (max 250 words)
List specific tasks assessing this criterion.
Format: "Task X (Page Y): ''[task description]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What aspects of the criterion are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably assess the criterion
- Focus on practical demonstration requirements
- Consider workplace context appropriateness
- Value variety in assessment methods

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or ''N/A''",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or ''N/A''"
}
```' WHERE id = 171;

-- ID 172: KE Unit Validation v2.0 (Phase 1)
UPDATE prompts SET prompt_text = 'Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Knowledge evidence assesses understanding of concepts, principles, processes, and information required for competent performance.

### Knowledge Categories
- **Conceptual**: Core concepts, relationships, application of theories
- **Factual**: Definitions, terminology, classifications
- **Procedural**: Steps, processes, workflows
- **Regulatory**: Laws, regulations, standards, codes of practice
- **Contextual**: Industry context, roles, safety considerations

### Valid Assessment Methods
- Written questions (short answer, extended response)
- Multiple choice or true/false questions
- Case study analysis
- Research tasks
- Scenario-based knowledge questions

## Validation Instructions

1. **Search documents** for questions/tasks assessing this knowledge requirement
2. For each match, record: Document name, Section, Question/Task number, Page number, Question text
3. Verify questions adequately assess the knowledge depth required
4. Determine if assessment coverage is sufficient

## Output Requirements

### Status
- **Met**: Fully assessed with appropriate questions/tasks
- **Partially Met**: Some assessment but lacks coverage or depth
- **Not Met**: Not assessed in documents

### Reasoning (max 300 words)
Explain assessment with specific question/task references.

### Mapped Content (max 250 words)
List specific questions assessing this requirement.
Format: "Question X (Page Y) asks: ''[question text]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section, Question number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What knowledge aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if questions reasonably assess the requirement
- Focus on assessment quality, not just presence
- Consider depth appropriate to qualification level
- Value variety in question types

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or ''N/A''",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or ''N/A''"
}
```' WHERE id = 172;

-- ID 173: PE Unit Validation v2.0 (Phase 1)
UPDATE prompts SET prompt_text = 'Validate the following Performance Evidence requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Performance evidence specifies the practical demonstrations, tasks, and activities that learners must complete to demonstrate competency.

### Performance Categories
- **Practical Skills**: Hands-on demonstrations of technical abilities
- **Workplace Tasks**: Real or simulated workplace activities
- **Process Application**: Following procedures and workflows
- **Problem Solving**: Responding to workplace scenarios
- **Documentation**: Completing workplace records and reports

### Valid Assessment Methods
- Practical demonstrations
- Workplace observations
- Simulation exercises
- Project work
- Portfolio evidence
- Third-party reports

## Validation Instructions

1. **Search documents** for tasks/activities assessing this performance requirement
2. For each match, record: Document name, Section, Task number, Page number, Task description
3. Verify tasks adequately assess the performance depth required
4. Determine if assessment coverage is sufficient

## Output Requirements

### Status
- **Met**: Fully assessed with appropriate practical tasks
- **Partially Met**: Some assessment but lacks coverage or depth
- **Not Met**: Not assessed in documents

### Reasoning (max 300 words)
Explain assessment with specific task references.

### Mapped Content (max 250 words)
List specific tasks assessing this requirement.
Format: "Task X (Page Y): ''[task description]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What performance aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably assess the requirement
- Focus on practical demonstration quality
- Consider workplace context appropriateness
- Value variety in assessment methods

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or ''N/A''",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or ''N/A''"
}
```' WHERE id = 173;

-- ID 174: FS Unit Validation v2.0 (Phase 1)
UPDATE prompts SET prompt_text = 'Validate the following Foundation Skill requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Skill Type:** {{skill_type}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Foundation skills are the non-technical skills required for workplace competency, including reading, writing, oral communication, numeracy, learning, problem solving, initiative, teamwork, planning, self-management, and technology use.

### Foundation Skill Categories
- **Reading**: Interpreting workplace documents
- **Writing**: Creating workplace documents
- **Oral Communication**: Verbal interactions
- **Numeracy**: Mathematical calculations
- **Learning**: Acquiring new knowledge/skills
- **Problem Solving**: Analyzing and resolving issues
- **Initiative and Enterprise**: Self-direction
- **Teamwork**: Collaborative work
- **Planning and Organising**: Task management
- **Self-Management**: Personal effectiveness
- **Technology**: Using digital tools

### Valid Assessment Methods
- Integrated within practical tasks
- Written communication tasks
- Oral presentations/discussions
- Problem-solving scenarios
- Team-based activities
- Technology-based tasks

## Validation Instructions

1. **Search documents** for tasks/activities that assess this foundation skill
2. For each match, record: Document name, Section, Task number, Page number, How skill is assessed
3. Verify the skill is genuinely assessed, not just mentioned
4. Determine if assessment coverage is sufficient

## Output Requirements

### Status
- **Met**: Skill is clearly assessed through appropriate tasks
- **Partially Met**: Some assessment but insufficient coverage
- **Not Met**: Skill is not assessed in documents

### Reasoning (max 300 words)
Explain assessment with specific task references.

### Mapped Content (max 250 words)
List specific tasks assessing this skill.
Format: "Task X (Page Y): ''[how skill is assessed]''"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What aspects of the skill are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably assess the skill
- Foundation skills are often integrated into other tasks
- Look for implicit as well as explicit assessment
- Consider the context of skill application

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or ''N/A''",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or ''N/A''"
}
```' WHERE id = 174;
