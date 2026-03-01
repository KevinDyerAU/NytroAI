# Learner Guide Performance Criteria Validation Prompt (Phase 1)

Validate the following Performance Criterion against the provided Learner Guide documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

The learner guide must help learners understand what **competent performance** looks like for each performance criterion. Focus on whether the guide **teaches and prepares** learners to perform competently.

### Content Types to Search
- **Explanatory Content**: What the criterion requires, what competent performance looks like
- **Procedural Guidance**: Step-by-step instructions, tips, techniques
- **Examples**: Real-world examples, case studies, scenarios
- **Visual Aids**: Diagrams, photos, flowcharts
- **Practice Activities**: Exercises, simulations, self-check questions
- **Quality Standards**: Benchmarks, common mistakes, troubleshooting

## Validation Instructions

1. **Search learner guide** for content teaching this performance criterion
2. For each match, record: Section title, Page number, Content type
3. Verify content teaches HOW to perform competently
4. Ensure content is specific to the criterion, not generic

## Output Requirements

### Status
- **Met**: Comprehensively covered with explanation, examples, guidance
- **Partially Met**: Some coverage but lacks depth, clarity, or practical guidance
- **Not Met**: Little to no content addressing this criterion

### Reasoning (max 300 words)
Explain coverage with specific section references.

### Mapped Content (max 250 words)
List specific sections addressing this criterion.
Format: "Section X (Page Y) provides [content type]: '[description]'"
Use "N/A" if none found.

### Document References (max 150 words)
Cite: Document/Guide name, Section title, Page(s).
**Only provide if Met or Partially Met.**
Use "N/A" if Not Met.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What content is missing?
**Do NOT include page numbers in this section.**
Use "N/A" if Met.

## Assessment Principles

- Be lenient if content reasonably prepares learners
- Focus on preparation for competent performance
- Value practical guidance, procedures, examples
- Consider learner perspective: would they know how to perform?
- Verify content is specific, not generic

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
