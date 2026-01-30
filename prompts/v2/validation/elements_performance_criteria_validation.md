# Elements Performance Criteria Unit Validation v2.0 (Phase 1)

## Purpose
Validate a single Performance Criterion against Unit assessment documents. This is Phase 1 (validation only) - smart tasks are generated separately in Phase 2 if needed.

## Prompt

```
Validate the following Performance Criterion against the provided Unit assessment documents.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

## Validation Focus

Performance criteria define competent performance standards. Assessment must require **practical demonstration** of skills, not just knowledge.

### Critical Requirement Alignment

Before validating, parse the Performance Criterion:
- **ACTION VERB**: What must the learner DO? (e.g., "identify", "apply", "communicate", "implement")
- **OBJECT**: What is being acted upon? (e.g., "workplace procedures", "safety requirements")
- **CONTEXT**: When/where/how does this happen? (e.g., "in accordance with regulations")

The assessment task MUST require the learner to perform the EXACT action described using the same verb, object, and context.

### Valid Assessment Methods
1. **Direct Observation** - Assessor watches learner perform tasks
2. **Practical Demonstration** - Learner shows skills under specified conditions
3. **Competency Checklists** - Structured observation against criteria
4. **Scenario-Based Assessment** - Only when other methods unsuitable

### Content to Exclude
- Assessor/Trainer Checklists (support evidence collection, not assessment)
- Knowledge-only questions (must require performance)
- Generic tasks that relate to the Element but miss the specific PC wording

## Validation Instructions

1. **Search ALL documents** for tasks requiring learners to **perform** the criterion action
2. For each match, record: Document name, Section, Task/Observation number, Page number
3. Verify tasks require the **same action** specified in the criterion (same verb, object, context)
4. Determine if assessment is sufficient for competent performance

## Output Requirements

Return a JSON object with these fields:

### status (required)
- **"Met"**: Fully assessed through practical tasks/observations that directly address the PC
- **"Partially Met"**: Some assessment exists but gaps remain (missing verb, object, or context)
- **"Not Met"**: No practical tasks assess this criterion, or tasks are generic/misaligned

### reasoning (required, max 300 words)
Explain your assessment with specific task/observation references.
Include the parsed ACTION VERB, OBJECT, and CONTEXT from the PC.
State whether the assessment task requires the learner to perform the exact action.

### mapped_content (required, max 250 words)
List specific tasks assessing this criterion with page numbers.
Format: "Task X (Page Y) requires: '[description]'"
Use "N/A" if none found.

### citations (required, array)
Document references in format: ["Document name, Section, Task number, Page X"]
Use empty array [] if none.

### unmapped_content (required, max 200 words)
**Only if Partially Met or Not Met**: What aspects are not assessed?
- Which component is missing: verb, object, or context?
- What would make the assessment sufficient?
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
