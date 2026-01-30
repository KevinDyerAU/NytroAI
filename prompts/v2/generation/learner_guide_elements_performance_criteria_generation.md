# Elements Performance Criteria Learner Guide Generation v2.0 (Phase 2)

## Purpose
Generate learning content recommendations for a Performance Criterion that was validated as "Partially Met" or "Not Met" in a Learner Guide. This is Phase 2 - only called after Phase 1 validation identifies gaps.

## Prompt

```
Generate learning content recommendations for the following Performance Criterion that requires improvement in the Learner Guide.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}
**Current Status:** {{status}}
**Gaps Identified:** {{unmapped_content}}

## Content Generation Rules

### Critical Requirement Alignment

The recommended content MUST:
1. Directly address the ACTION VERB + OBJECT + CONTEXT from the PC
2. Prepare learners to perform the exact action required
3. Include both theory and practical application
4. Be appropriate for vocational education level

### Content Types to Recommend

1. **Explanatory Content** - Theory covering the criterion topic
2. **Worked Examples** - Step-by-step demonstrations
3. **Practice Activities** - Hands-on exercises for skill development
4. **Self-Check Questions** - Knowledge verification questions
5. **Workplace Scenarios** - Real-world application examples

### Learning Activity Design

Activities should:
- Build from simple to complex
- Include clear instructions
- Provide opportunities for self-assessment
- Connect theory to workplace practice

## Output Requirements

Return a JSON object with these fields:

### smart_task (required)
A learning activity that helps learners understand and practice the Performance Criterion.
Should include clear instructions and expected outcomes.
Must directly relate to the verb, object, and context of the PC.

### benchmark_answer (required)
Describe what successful completion of the learning activity looks like.
Include key learning points the learner should demonstrate understanding of.
Reference the specific criterion components.

### recommendations (required)
Specific guidance for the RTO on what content to add to the Learner Guide.
Include suggested topics, examples, and activities.
Note any resources or references that would support learning.

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
