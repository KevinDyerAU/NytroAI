# Elements Performance Criteria Learner Guide Validation v2.0 (Phase 1)

## Purpose
Validate a single Performance Criterion against Learner Guide documents. This is Phase 1 (validation only) - smart tasks are generated separately in Phase 2 if needed.

## Prompt

```
Validate the following Performance Criterion against the provided Learner Guide documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Learner Guides must provide sufficient learning content and activities to prepare learners to demonstrate the Performance Criterion. This includes:
- Explanatory content covering the criterion topic
- Worked examples or case studies
- Practice activities or exercises
- Self-assessment opportunities

### Critical Requirement Alignment

Before validating, parse the Performance Criterion:
- **ACTION VERB**: What must the learner DO? (e.g., "identify", "apply", "communicate")
- **OBJECT**: What is being acted upon? (e.g., "workplace procedures", "safety requirements")
- **CONTEXT**: When/where/how does this happen? (e.g., "in accordance with regulations")

The Learner Guide must prepare learners to perform this EXACT action.

### Valid Learner Guide Content
1. **Explanatory Content** - Theory and concepts related to the criterion
2. **Worked Examples** - Demonstrations of how to perform the action
3. **Practice Activities** - Opportunities to practice the skill
4. **Self-Check Questions** - Knowledge verification before assessment
5. **Workplace Scenarios** - Contextual application examples

## Validation Instructions

1. **Search ALL documents** for content that teaches/prepares learners for this criterion
2. For each match, record: Document name, Section, Page number
3. Verify content addresses the **same action** specified in the criterion
4. Determine if learning content is sufficient preparation for assessment

## Output Requirements

Return a JSON object with these fields:

### status (required)
- **"Met"**: Comprehensive learning content addresses all aspects of the PC
- **"Partially Met"**: Some content exists but gaps in coverage
- **"Not Met"**: No relevant learning content found

### reasoning (required, max 300 words)
Explain your assessment with specific content references.
Include the parsed ACTION VERB, OBJECT, and CONTEXT from the PC.
State whether the learning content adequately prepares learners.

### mapped_content (required, max 250 words)
List specific sections/content addressing this criterion with page numbers.
Format: "Section X (Page Y) covers: '[description]'"
Use "N/A" if none found.

### citations (required, array)
Document references in format: ["Document name, Section, Page X"]
Use empty array [] if none.

### unmapped_content (required, max 200 words)
**Only if Partially Met or Not Met**: What learning content is missing?
- Which component lacks coverage: verb, object, or context?
- What content would adequately prepare learners?
Use "N/A" if Met.

## JSON Output Format

{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "string",
  "mapped_content": "string",
  "citations": ["string"],
  "unmapped_content": "string"
}

Return ONLY the JSON object, no additional text.
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["Met", "Partially Met", "Not Met"]
    },
    "reasoning": {
      "type": "string",
      "maxLength": 2000
    },
    "mapped_content": {
      "type": "string",
      "maxLength": 1500
    },
    "citations": {
      "type": "array",
      "items": { "type": "string" }
    },
    "unmapped_content": {
      "type": "string",
      "maxLength": 1200
    }
  },
  "required": ["status", "reasoning", "mapped_content", "citations", "unmapped_content"]
}
```
