# Learner Guide Performance Evidence Generation Prompt (Phase 2)

Generate a smart question and benchmark answer for the following Performance Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE simple, clear question about how to perform a key step or aspect of this performance requirement.

**Requirements:**
- Test learner understanding of procedure or process
- Answerable based on learner guide content
- Focus on practical "how-to" knowledge
- Concise and direct

**Examples:**
- "What are the three steps you must complete before starting the equipment?"
- "How do you identify which control measures are required for the hazard?"
- "What information must be documented when completing the incident report?"
- "In what order should you perform the safety checks?"

### Benchmark Answer
Provide a concise, correct answer based on learner guide instructions.

**Requirements:**
- Written in plain English
- Reflect content and procedures from learner guide
- Include specific steps, actions, key points
- Focused, avoid unnecessary detail

**Examples:**
- "The three steps are: 1) Check the equipment is in off position, 2) Inspect for any visible damage or hazards, 3) Confirm all safety guards are in place and secure."
- "Review the hazard identification chart, determine the risk level using the risk matrix, then select control measures from the hierarchy of controls starting with elimination, substitution, engineering controls, administrative controls, and PPE."
- "Document the date, time, location, people involved, description of what occurred, injuries sustained, immediate actions taken, and supervisor notification details."

### Recommendations (max 200 words)
Provide actionable suggestions to improve learner preparation.

**Examples:**
- "Add a step-by-step procedure for [specific task] with diagrams showing each step"
- "Include 2-3 workplace scenarios demonstrating [performance] in different contexts"
- "Create a practice activity where learners must [perform task] using provided materials"
- "Expand Section X to include troubleshooting guidance and common mistakes to avoid"

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string - question about how to perform a key step",
  "benchmark_answer": "string - correct answer based on guide's instructions",
  "recommendations": "string (max 200 words)"
}
```
