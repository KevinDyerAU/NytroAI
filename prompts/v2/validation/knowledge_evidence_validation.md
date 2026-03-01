# Knowledge Evidence Validation Prompt (Phase 1)

Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.

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
Format: "Question X (Page Y) asks: '[question text]'"
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
  "mapped_content": "string (max 250 words) or 'N/A'",
  "citations": ["array of citation strings"] or [],
  "unmapped_content": "string (max 200 words) or 'N/A'"
}
```
