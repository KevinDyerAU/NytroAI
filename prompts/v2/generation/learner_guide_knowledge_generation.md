# Learner Guide Knowledge Evidence Generation Prompt (Phase 2)

Generate a smart question and benchmark answer for the following Knowledge Evidence requirement that was assessed as **{{status}}**.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

**Validation Status:** {{status}}
**Unmapped Content:** {{unmapped_content}}

## Generation Instructions

### Smart Question
Create ONE simple question to assess learner understanding of this knowledge requirement.

**Requirements:**
- Test comprehension of key knowledge
- Answerable based on learner guide content
- Clear, concise, focused on essential knowledge
- Use appropriate verbs (explain, describe, identify, outline)

**Examples:**
- "What is the purpose of the National Quality Framework in early childhood education?"
- "Describe the five steps in the risk management process."
- "Explain the difference between hazard identification and risk assessment."
- "What are your key responsibilities under the WHS Act 2011?"

### Benchmark Answer
Provide a concise, correct answer based on learner guide content.

**Requirements:**
- Written in plain English
- Reflect knowledge taught in learner guide
- Include key points and concepts
- Focused and realistic for qualification level
- Avoid excessive detail

**Examples:**
- "The National Quality Framework aims to ensure consistent, high-quality education and care for all children across Australia. It establishes national standards through the NQS, provides regulatory oversight through assessment and rating, and guides practice through approved learning frameworks (EYLF, MTOP)."
- "The five steps in risk management are: 1) Identify hazards in the workplace, 2) Assess the risks associated with each hazard, 3) Implement control measures using the hierarchy of controls, 4) Review the effectiveness of controls regularly, 5) Maintain documentation and records of the risk management process."

### Recommendations (max 200 words)
Provide actionable suggestions to improve knowledge coverage in learner guide.
**Do NOT include page numbers in recommendations.**

**Examples:**
- "Add Section X.X explaining [concept] with definition and workplace relevance"
- "Include 2-3 workplace examples demonstrating [knowledge] in different contexts"
- "Expand Section Y to include detailed explanation of [specific aspect]"
- "Add a diagram or flowchart illustrating [process/concept]"

## Output Format

Return **only** this JSON structure:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string - simple question to assess understanding",
  "benchmark_answer": "string - correct answer based on learner guide content",
  "recommendations": "string (max 200 words)"
}
```
