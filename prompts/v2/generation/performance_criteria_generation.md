# Performance Criteria Generation Prompt (Phase 2)

Generate a smart task and benchmark answer for the following Performance Criterion that was assessed as **{{status}}**.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Task
Create ONE practical task or observation checklist item that assesses this performance criterion.

**Requirements:**
- Must be **practical/task-oriented**, NOT a knowledge question
- Observable and measurable by an assessor
- SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Requires learners to **perform the same action** as the criterion

**Examples by Method:**
- **Direct Observation**: "Observe the learner follow workplace procedures for safe equipment operation, including all pre-operation checks, safe operating practices, and shutdown procedures."
- **Practical Demonstration**: "Demonstrate the process for monitoring and responding to changes in client condition according to the provided care plan requirements."
- **Checklist Item**: "Learner applies quality assurance processes and verifies completed work meets required standards using the workplace quality checklist."
- **Scenario**: "In the simulated workplace scenario, handle the emergency situation following documented workplace procedures."

### Benchmark Answer
Describe expected observable behavior demonstrating competent performance.

**Requirements:**
- Written in plain English
- Focus on what assessor should observe
- Include specific actions, steps, or behaviors
- Avoid theoretical explanations
- Reflect competent achievement of the criterion

**Examples:**
- "The learner follows all documented workplace procedures for equipment operation. Pre-operation: inspects guards, checks emergency stops, verifies workspace clear. Operation: follows manufacturer instructions, maintains safe position, uses controls correctly. Shutdown: completes proper power-down sequence, secures equipment, completes safety checklist."
- "The learner monitors the simulated client and identifies changes in condition. Reviews the care plan to determine required responses. Takes appropriate actions: provides immediate comfort measures, adjusts care delivery as specified, notifies appropriate personnel, documents changes and actions taken."

### Recommendations (max 200 words)
Provide actionable suggestions to improve assessment.

**Examples:**
- "Add an observation task requiring learners to [specific performance action] demonstrating [criterion requirement]"
- "Expand Task X to require learners to also [missing aspect of criterion]"
- "Replace knowledge Question Y with a practical demonstration task where learners must [perform action]"

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_task": "string - practical task or observation checklist item",
  "benchmark_answer": "string - expected observable behavior",
  "recommendations": "string (max 200 words)"
}
```
