# Performance Criteria Validation Prompt (Phase 1)

Validate the following Performance Criterion against the provided Unit assessment documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Performance criteria define competent performance standards. Assessment must require **practical demonstration** of skills, not just knowledge.

### Valid Assessment Methods
1. **Direct Observation** - Assessor watches learner perform tasks
2. **Practical Demonstration** - Learner shows skills under specified conditions
3. **Competency Checklists** - Structured observation against criteria
4. **Scenario-Based Assessment** - Only when other methods unsuitable

### Content to Exclude
- Assessor/Trainer Checklists (support evidence collection, not assessment)
- Knowledge-only questions (must require performance)

## Validation Instructions

1. **Search ALL documents** for tasks requiring learners to **perform** the criterion action
2. For each match, record: Document name, Section, Task/Observation number, Page number
3. Verify tasks require the **same action** specified in the criterion
4. Determine if assessment is sufficient for competent performance

## Output Requirements

### Status
- **Met**: Fully assessed through practical tasks/observations
- **Partially Met**: Some assessment exists but gaps remain
- **Not Met**: No practical tasks assess this criterion

### Reasoning (max 300 words)
Explain assessment with specific task/observation references.

### Mapped Content (max 250 words)
List specific tasks assessing this criterion with page numbers.
Format: "Task X (Page Y) requires: '[description]'"
Use "N/A" if none found.

### Document References (max 150 words)
Cite: Document name, Section, Task number, Page(s).
Use "N/A" if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What aspects are not assessed?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if tasks reasonably assess the criterion
- Focus on performance demonstration, not knowledge
- Verify learners must DO the action, not just know about it

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string (max 300 words)",
  "mapped_content": "string (max 250 words) or 'N/A'",
  "doc_references": "string (max 150 words) or 'N/A'",
  "unmapped_content": "string (max 200 words) or 'N/A'"
}
```
