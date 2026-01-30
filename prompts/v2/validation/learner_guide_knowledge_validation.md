# Learner Guide Knowledge Evidence Validation Prompt (Phase 1)

Validate the following Knowledge Evidence requirement against the provided Learner Guide documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

The learner guide must provide comprehensive content enabling learners to **acquire** the required knowledge. Focus on whether the guide **teaches and explains** effectively.

### Content Types to Search
- **Explanatory Content**: Definitions, descriptions, concept explanations
- **Instructional Content**: Detailed process/procedure information
- **Examples**: Case studies, scenarios, workplace examples
- **Visual Aids**: Diagrams, tables, flowcharts
- **Activities**: Exercises, self-check questions, reflection
- **References**: Citations to legislation, standards, resources

### Quality Criteria
- Clear, accessible language
- Logical sequence and progressive building
- Sufficient depth and detail
- Practical examples and illustrations

## Validation Instructions

1. **Search learner guide** for content teaching this knowledge requirement
2. For each match, record: Section title, Page number, Content type
3. Consider synonyms or related terms that convey same knowledge
4. Evaluate if content enables learners to acquire the knowledge

## Output Requirements

### Status
- **Met**: Thoroughly covered with adequate explanation and examples
- **Partially Met**: Some content but lacks depth or completeness
- **Not Met**: Not covered in learner guide

### Reasoning (max 300 words)
Explain coverage with specific section references.

### Mapped Content (max 250 words)
List specific sections addressing this requirement.
Format: "Section X (Page Y) provides [content type]: '[description]'"
Include synonyms/related terms with justification.
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Topic title, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What knowledge is missing?
**Do NOT include page numbers in this section.**
Use "N/A" if Met.

## Assessment Principles

- Be lenient if content reasonably covers the requirement
- Consider synonyms and alternative terminology
- Focus on whether learners can acquire the knowledge
- Value depth and practical examples

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
