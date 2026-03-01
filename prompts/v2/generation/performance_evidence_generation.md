# Performance Evidence Generation Prompt (Phase 2)

Generate a smart task and benchmark answer for the following Performance Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Task
Create ONE practical task or observation checklist item assessing this performance requirement.

**Requirements:**
- Must be **practical/task-oriented**, NOT a knowledge question
- Observable and measurable by an assessor
- SMART: Specific, Measurable, Achievable, Relevant, Time-bound
- Target one specific performance requirement

**Examples by Method:**
- **Direct Observation**: "Observe the learner prepare the worksite ensuring all safety barriers are correctly positioned and signage is visible."
- **Practical Demonstration**: "Demonstrate the correct procedure for shutting down the equipment, including all safety checks and documentation."
- **Checklist Item**: "Learner correctly identifies hazards and implements three appropriate control measures during the task."
- **Scenario**: "Respond to the simulated customer complaint, demonstrating active listening and problem resolution."

### Benchmark Answer
Describe expected observable behavior demonstrating competent performance.

**Requirements:**
- Written in plain English
- Focus on what assessor should observe
- Include specific actions, steps, or behaviors
- Avoid theoretical explanations

**Examples:**
- "The learner correctly positions safety barriers at minimum 2-meter perimeter around the work area, places 'Caution: Work in Progress' signs at two entry points, and confirms area is secure before commencing work. All actions completed without prompting."
- "The learner follows the shutdown sequence: 1) Stops operation using emergency stop, 2) Waits for complete cessation of movement, 3) Isolates power source and applies lockout, 4) Completes shutdown checklist form with time and signature, 5) Secures work area. All steps performed in correct order with safety protocols observed."

### Recommendations (max 200 words)
Provide actionable suggestions to improve performance evidence assessment.

**Examples:**
- "Add a practical task requiring learners to demonstrate [specific performance] in a workplace or simulated environment"
- "Expand Task X to require learners to also demonstrate [missing aspect]"
- "Replace knowledge Question Y with an observation task where assessors verify learners [perform action]"

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
