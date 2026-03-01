# Elements Performance Criteria Generation v2.0 (Phase 2)

## Purpose
Generate a SMART remediation task for a Performance Criterion that was validated as "Partially Met" or "Not Met". This is Phase 2 - only called after Phase 1 validation identifies gaps.

## Prompt

```
Generate a SMART remediation task for the following Performance Criterion that requires improvement.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}
**Current Status:** {{status}}
**Gaps Identified:** {{unmapped_content}}

## Task Generation Rules

### Critical Requirement Alignment

The SMART Task MUST:
1. Use the EXACT or equivalent wording from the PC
2. Directly require the learner to demonstrate ACTION VERB + OBJECT + CONTEXT
3. Be practical and observable
4. NOT be a generic task that merely relates to the Element topic

### Verb Alignment (CRITICAL)

The task must require the SAME verb action stated in the Performance Criterion:
- If the verb is "identify", the task must require identification
- If the verb is "explain", the task must require explanation
- If the verb is "provide", the task must require provision
- If the verb is "apply", the task must require application

Do NOT elevate or substitute the verb.

### Prohibited Substitutions

These substitutions are NOT acceptable:
- Providing feedback when the PC requires reporting
- Explaining or describing when the PC requires performing
- Identifying a scenario when the PC requires implementation
- Completing training when the PC requires workplace action

### Task Construction

The SMART Task must be written so the learner is required to perform the exact workplace action described in the Performance Criterion.

Where the PC does not require identification, the task must include the required context and factual information within the task itself.

Where the PC requires identification, the task must require the learner to identify real workplace items, conditions, records, or behaviours using actual workplace evidence.

Where the PC contains multiple actions (e.g., "identify and record"), the task MUST require ALL components.

## Output Requirements

Return a JSON object with these fields:

### smart_task (required)
A practical, observable task that directly addresses the Performance Criterion.
Must use the exact verb from the PC.
Must be specific enough that completion demonstrates competency.

### benchmark_answer (required)
Describe what the assessor observes when the learner competently demonstrates the SPECIFIC PC.
Reference the exact criterion components (verb, object, context).
Write in third person (e.g., "The learner demonstrates..." not "I demonstrate...").

### recommendations (required)
Specific guidance for the RTO on how to implement this assessment task.
Include any required resources, conditions, or assessor observations.

## JSON Output Format

{
  "smart_task": "string",
  "benchmark_answer": "string",
  "recommendations": "string"
}

Return ONLY the JSON object, no additional text.
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "smart_task": {
      "type": "string",
      "maxLength": 1500
    },
    "benchmark_answer": {
      "type": "string",
      "maxLength": 1500
    },
    "recommendations": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": ["smart_task", "benchmark_answer", "recommendations"]
}
```
