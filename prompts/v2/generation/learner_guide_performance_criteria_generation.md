# Learner Guide Performance Criteria Generation Prompt (Phase 2)

Generate a smart question and benchmark answer for the following Performance Criterion that was assessed as **{{status}}**.

**Element/Criterion Number:** {{requirement_number}}
**Element (if applicable):** {{element_text}}
**Performance Criterion Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE simple question about how to perform a key aspect of this performance criterion.

**Requirements:**
- Test learner understanding of procedures/processes
- Answerable based on learner guide content
- Focus on practical "how-to" knowledge
- Concise and direct

**Examples:**
- "What are the key steps you must follow when operating equipment safely according to workplace procedures?"
- "How do you respond to changes in a client's condition according to their care plan?"
- "What process should you follow to apply quality assurance and verify your work meets standards?"
- "Describe the procedure for handling an emergency situation in the workplace."

### Benchmark Answer
Provide a concise, correct answer based on learner guide instructions.

**Requirements:**
- Written in plain English
- Reflect content and procedures from learner guide
- Include specific steps, actions, key points
- Focused, avoid unnecessary detail

**Examples:**
- "The key steps are: 1) Complete all pre-operation safety checks (guards, emergency stops, clear workspace), 2) Follow manufacturer operating instructions and maintain safe working position, 3) Complete proper shutdown sequence and secure equipment, 4) Document operation in equipment logbook."
- "Monitor the client for changes, review their care plan to identify required responses, take appropriate immediate actions (comfort measures, vital signs), notify appropriate personnel as per escalation protocols, adjust care delivery as specified, and document all changes and actions taken."

### Recommendations (max 200 words)
Provide actionable suggestions to improve content coverage.
**Do NOT include page numbers in recommendations.**

**Examples:**
- "Add a section explaining what competent performance looks like for [criterion], including quality standards"
- "Include step-by-step procedures for [specific action] with explanations of each step"
- "Provide 2-3 workplace examples demonstrating competent performance in different contexts"
- "Create a practice activity where learners must [perform action] following the procedures taught"
- "Add a flowchart or diagram illustrating the process for [criterion]"

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string - question about how to perform a key aspect",
  "benchmark_answer": "string - correct answer based on learner guide instructions",
  "recommendations": "string (max 200 words)"
}
```
