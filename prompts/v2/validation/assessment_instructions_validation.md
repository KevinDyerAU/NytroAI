# Assessment Instructions Validation Prompt (Phase 1)

Validate the following Assessment Instruction requirement against the provided Unit assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

Assessment instructions provide essential guidance to assessors and learners for consistent, fair assessment.

### Instruction Types
1. **General Instructions** - Overview, submissions, time, resources
2. **Task-Specific Instructions** - Step-by-step guidance, requirements, outputs
3. **Assessor Instructions** - Observation protocols, marking guides, documentation
4. **Learner Instructions** - Task requirements, formats, due dates, support

### Quality Criteria
- Clear and unambiguous
- Complete and comprehensive
- Appropriate for audience
- Consistent with assessment requirements
- Practical and implementable

## Validation Instructions

1. **Search documents** for instructions addressing this requirement
2. For each match, record: Document name, Section, Page number, Content summary
3. Evaluate instruction quality (clarity, completeness, appropriateness)
4. Identify any gaps or ambiguities

## Output Requirements

### Status
- **Met**: Clear, comprehensive instructions provided
- **Partially Met**: Instructions exist but incomplete, unclear, or insufficient
- **Not Met**: No relevant instructions provided

### Reasoning (max 300 words)
Explain assessment with specific instruction references.

### Mapped Content (max 200 words)
List specific instructions addressing this requirement.
Format: "Section X (Page Y) provides instructions: '[excerpt or description]'"
Use "N/A" if none found.

### Document References (max 150 words)
Cite: Document name, Section name, Page(s).
Use "N/A" if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What instruction aspects are missing?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if instructions are reasonably clear and adequate
- Focus on clarity for intended audience
- Ensure completeness of necessary information
- Consider context appropriateness

## Output Format

Return **only** this JSON structure:

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
