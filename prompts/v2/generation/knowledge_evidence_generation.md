# Knowledge Evidence Generation Prompt (Phase 2)

Generate a smart question and benchmark answer for the following Knowledge Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE well-formulated question addressing this Knowledge Evidence requirement.

**Question Categories and Verbs:**
- **Concept Understanding**: explain, describe, outline, summarise, discuss
- **Definitions**: define, identify, list, state
- **Processes**: describe, outline, explain steps, summarise process
- **Regulatory**: identify, outline, describe requirements
- **Safety/WHS**: explain, describe, outline hazards/controls
- **Roles**: explain, describe responsibilities
- **Problem Solving**: explain approach, describe response

**Requirements:**
- Clear, concise, focused on one aspect
- Answerable and assessable
- Appropriate verbs for knowledge type
- Avoid complex wording

**Examples:**
- "Explain the relationship between risk assessment and hazard control."
- "Define 'duty of care' in the context of workplace safety."
- "Outline the steps involved in conducting a workplace risk assessment."
- "Describe the key requirements of the Work Health and Safety Act 2011."
- "Explain the hierarchy of control and how it applies to hazard management."

### Benchmark Answer
Provide the expected learner response.

**Requirements:**
- Concise, accurate, plain English
- Fully meets the knowledge requirement
- Include key points demonstrating competent knowledge
- Avoid excessive detail
- Realistic for qualification level

**Examples:**
- "The National Quality Framework (NQF) supports quality outcomes by establishing consistent national standards through the National Quality Standard, providing regulatory oversight through assessment and rating, and guiding practice through approved learning frameworks."
- "The five steps in risk management are: 1) Identify hazards, 2) Assess risks, 3) Control risks using hierarchy of controls, 4) Review effectiveness, 5) Maintain records."

### Recommendations (max 200 words)
Provide actionable suggestions to improve knowledge assessment.

**Examples:**
- "Add a question asking learners to explain [specific concept]"
- "Expand Question X to also assess [missing aspect]"
- "Include a question addressing [regulatory/procedural/conceptual] knowledge"

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string - well-formulated knowledge question",
  "benchmark_answer": "string - expected answer demonstrating competent knowledge",
  "recommendations": "string (max 200 words)"
}
```
