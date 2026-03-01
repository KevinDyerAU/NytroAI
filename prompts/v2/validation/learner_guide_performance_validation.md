# Learner Guide Performance Evidence Validation Prompt (Phase 1)

Analyze the provided Learner Guide to determine if it adequately **prepares** the learner for the following Performance Evidence requirement.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

## Validation Focus

The learner guide must provide comprehensive instruction, explanations, examples, and practice activities that **prepare** learners to demonstrate the required performance.

### Content Types to Search
- **Instructional Content**: Explanations, procedures, step-by-step guides
- **Examples**: Case studies, workplace scenarios, sample demonstrations
- **Activities**: Practice exercises, simulations, self-assessment
- **Visual Aids**: Diagrams, flowcharts, photographs
- **Support Materials**: Templates, checklists, reference guides

### Quality Criteria
- Clear description of what needs to be demonstrated
- Step-by-step instructions for performing the task
- Tips, techniques, best practices
- Practice opportunities
- Common challenges and troubleshooting

## Validation Instructions

1. **Search learner guide** for content teaching/preparing this performance
2. For each match, record: Section title, Page number, Content type
3. Verify content teaches HOW to perform, not just WHAT
4. Evaluate if learners will be prepared for assessment

## Output Requirements

### Status
- **Met**: Comprehensive preparation with instruction, examples, practice
- **Partially Met**: Some preparation but missing key elements
- **Not Met**: Little to no preparation for this performance

### Reasoning (max 300 words)
Explain preparation coverage with specific section references.

### Mapped Content (max 250 words)
List specific sections preparing learners for this performance.
Format: "Section X (Page Y) provides [content type]: '[description]'"
Use "N/A" if none found.

### Citations (array)
Provide specific citations.
Format: "Document name, Section/Topic title, Page(s)"
Use empty array [] if none.

### Unmapped Content (max 200 words)
**Only if Partially Met or Not Met**: What preparation is missing?
Use "N/A" if Met.

## Assessment Principles

- Be lenient if content provides reasonable preparation
- Focus on teaching HOW to perform, not just explaining WHAT
- Value practice activities and examples
- Consider learner perspective: would they be prepared?

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
