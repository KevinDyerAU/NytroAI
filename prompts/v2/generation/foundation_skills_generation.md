# Foundation Skills Generation Prompt (Phase 2)

Generate a smart question and benchmark answer for the following Foundation Skill that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE concise, clear question requiring the learner to **use** this foundation skill.

**Requirements:**
- Specific, measurable, achievable, relevant
- Assess **authentic skill application**, not theoretical knowledge
- Embedded within practical context
- Avoid unnecessary wording

**Examples by Skill:**
- **Reading**: "Review the workplace safety document and identify three key hazard controls."
- **Writing**: "Document the steps you took to resolve the customer complaint."
- **Numeracy**: "Calculate the total material cost for the project using the price list provided."
- **Oral Communication**: "Explain to your supervisor the issue you identified and your proposed solution."
- **Problem-Solving**: "Identify the cause of the equipment malfunction and describe your troubleshooting steps."
- **Teamwork**: "Describe how you coordinated with team members to complete the project task."

### Benchmark Answer
Provide a concise, accurate answer demonstrating competent skill application.

**Requirements:**
- Written in plain English
- Directly addresses the question
- Describes expected skill application
- Avoid unnecessary wording

**Examples:**
- **Reading**: "The three key hazard controls are: 1) PPE requirements (safety goggles and gloves), 2) Equipment lockout procedures before maintenance, 3) Designated safe zones marked with yellow tape."
- **Writing**: "I documented the complaint details, investigation steps, actions taken, and customer resolution in the complaint log, ensuring all timestamps and outcomes were recorded clearly."
- **Numeracy**: "Material A: 50 units × $12.50 = $625. Material B: 25 units × $8.00 = $200. Material C: 10 units × $45.00 = $450. Total: $1,275."

### Recommendations (max 200 words)
Provide actionable suggestions to improve foundation skills assessment.

**Examples:**
- "Add a task requiring learners to [specific skill application] within the context of [workplace activity]"
- "Expand Task X to include authentic workplace documentation such as [specific document type]"
- "Integrate the foundation skill assessment into Task Y by requiring learners to [demonstrate skill] while [performing practical task]"

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string",
  "benchmark_answer": "string",
  "recommendations": "string (max 200 words)"
}
```
