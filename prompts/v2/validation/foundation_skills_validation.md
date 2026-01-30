# Foundation Skills Validation Prompt (Phase 1)

Validate the following Foundation Skill against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Foundation skills are core non-technical skills required for work performance. They must be **embedded within performance tasks**, not assessed separately.

### Foundation Skill Categories
1. **Learning** - Self-directed learning, adapting, applying feedback
2. **Reading** - Comprehending written info, interpreting instructions
3. **Writing** - Producing documents, completing forms, written communication
4. **Oral Communication** - Verbal expression, listening, presenting
5. **Numeracy** - Calculations, measurements, data interpretation
6. **Teamwork** - Working cooperatively, contributing to team goals
7. **Problem-Solving** - Identifying issues, developing solutions
8. **Planning & Organizing** - Task prioritization, time management
9. **Self-Management** - Responsibility, independence, professionalism
10. **Technology** - Using digital tools, navigating software

### Key Principle
Foundation skills must be **naturally integrated** into performance tasks, not standalone tests.

## Validation Instructions

1. **Search documents** for tasks requiring application of this skill
2. For each match, record: Document name, Section, Task number, Page number
3. Verify skill is **embedded** within practical tasks, not isolated
4. Confirm tasks reflect authentic workplace scenarios

## Output Requirements

### Status
- **Met**: Skill naturally integrated into assessment with clear application
- **Partially Met**: Skill present but lacks depth or authentic integration
- **Not Met**: Skill missing, isolated, or inadequately addressed

### Reasoning (max 300 words)
Explain assessment with specific task references.

### Mapped Content (max 250 words)
List specific tasks requiring this skill.
Format: "Task X (Page Y) requires [skill application]: '[description]'"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Task, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What skill aspects are missing?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if skill is authentically integrated
- Focus on integration, not standalone tests
- Emphasize authentic workplace contexts
- Avoid redundant assessment of same skill

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or 'N/A'",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or 'N/A'"
}
```
