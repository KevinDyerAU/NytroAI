# Performance Evidence Validation Prompt (Phase 1)

Validate the following Performance Evidence requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Performance evidence demonstrates competency through practical application in real or simulated workplace environments. Must be observable, measurable, and workplace-aligned.

### Valid Assessment Methods
1. **Direct Observation** - Assessor monitors learner performing tasks
2. **Practical Demonstration** - Learner demonstrates skills under conditions
3. **Competency Checklists** - Structured observation against criteria
4. **Scenario-Based Assessment** - Only when other methods unsuitable

### Content to Search
- Observation checklists
- Practical demonstration tasks
- Work-based projects
- Simulated workplace activities
- Role-plays or scenarios
- Workplace documentation requiring practical application

### Content to Exclude
- Knowledge-only questions (focus on practical demonstration)

## Validation Instructions

1. **Search documents** for tasks requiring **demonstration** of this performance
2. For each match, record: Document name, Section, Task/Observation number, Page number
3. Verify tasks require **active demonstration**, not just knowledge
4. Determine if assessment is sufficient for competent performance

## Output Requirements

### Status
- **Met**: Fully assessed through practical tasks/observations
- **Partially Met**: Some assessment but gaps in coverage or depth
- **Not Met**: No practical tasks assess this requirement

### Reasoning (max 300 words)
Explain assessment with specific task/observation references.

### Mapped Content (max 250 words)
List specific tasks requiring demonstration of this performance.
Format: "Task X (Page Y) requires demonstration of [performance]: '[description]'"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Task, Task number, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What performance aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably require the performance
- Focus on demonstration, not just knowing
- Ensure assessors can observe and verify performance
- Verify authentic workplace conditions

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
