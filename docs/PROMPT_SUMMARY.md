# Prompt Summary - Streamlined Validation

## Overview

All validation prompts have been updated to focus on **core validation** and **strong citations**, with simplified output schemas for faster processing.

---

## Updated Prompt Types

| Requirement Type | Document Type | Prompt Name | Version | Focus |
|------------------|---------------|-------------|---------|-------|
| Knowledge Evidence | Learner Guide | KE Learner Guide Validation | v1.1 | Content coverage for knowledge acquisition |
| Knowledge Evidence | Unit | KE Unit Validation | v1.1 | Assessment of knowledge requirements |
| Performance Evidence | Unit | PE Unit Validation | v1.1 | Demonstration of performance in assessments |
| Performance Evidence | Learner Guide | PE Learner Guide Validation | v1.1 | Preparation for performance requirements |
| Performance Criteria | Unit | PC Unit Validation | v1.1 | Measurement of performance criteria |
| Performance Criteria | Learner Guide | PC Learner Guide Validation | v1.1 | Preparation for performance criteria |
| Foundation Skills | Unit | FS Unit Validation | v1.1 | Embedded assessment of foundation skills |

---

## Standard Output Schema (All Prompts)

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["Met", "Partially Met", "Not Met"]
    },
    "reasoning": {
      "type": "string"
    },
    "mapped_content": {
      "type": "string"
    },
    "citations": {
      "type": "array",
      "items": {"type": "string"}
    },
    "smart_question": {
      "type": "string"
    },
    "benchmark_answer": {
      "type": "string"
    }
  },
  "required": [
    "status",
    "reasoning",
    "mapped_content",
    "citations",
    "smart_question",
    "benchmark_answer"
  ]
}
```

---

## Key Principles

### 1. Validation First

Every prompt focuses on answering: **"Is this requirement met by the document?"**

- **Met**: Requirement is fully addressed with sufficient evidence
- **Partially Met**: Requirement is partially addressed, gaps exist
- **Not Met**: Requirement is not addressed or evidence is insufficient

### 2. Evidence-Based Reasoning

The `reasoning` field must reference specific content from the documents, explaining:

- What was found (or not found)
- Why it meets/doesn't meet the requirement
- If Partially Met or Not Met, what specific content is missing
- What specific evidence supports the assessment

### 3. Mandatory Citations

Every validation must include citations with:

- **Document name**: e.g., "BSBWHS332X Learner Guide v2.1"
- **Page numbers**: e.g., "Page 14-15"
- **Section headings**: e.g., "Section 3.2: Risk Assessment Procedures"
- **Task numbers** (for assessments): e.g., "Task 2, Question 3"

Example citation array:
```json
"citations": [
  "BSBWHS332X Learner Guide v2.1, Page 14, Section 3.2: Risk Assessment Procedures",
  "BSBWHS332X Learner Guide v2.1, Page 18, Table 3.1: Risk Control Hierarchy"
]
```

### 4. Simple, Relevant Questions

Each prompt generates **ONE** question that:

- Directly relates to the requirement being validated
- Is simple and clear (not complex or multi-part)
- Can be used by assessors or instructional designers
- Has a clear, concise benchmark answer

---

## Prompt-Specific Guidance

### Knowledge Evidence (KE)

**Purpose**: Validate if learners can acquire the required knowledge from the materials.

**Smart Question Example**:
- "What are the three main steps in conducting a risk assessment?"

**Benchmark Answer Example**:
- "1) Identify hazards, 2) Assess risks, 3) Implement controls"

---

### Performance Evidence (PE)

**Purpose**: Validate if learners are required to demonstrate the specified performance.

**Smart Question Example** (as observation checklist):
- "Does the learner correctly identify all hazards in the workplace scenario?"

**Benchmark Answer Example**:
- "Learner identifies at least 5 hazards including electrical, manual handling, and chemical hazards"

---

### Performance Criteria (PC)

**Purpose**: Validate if the assessment explicitly measures the performance criteria.

**Smart Question Example**:
- "How does the learner demonstrate compliance with WHS legislation?"

**Benchmark Answer Example**:
- "Learner references relevant WHS Act sections and applies them to the workplace scenario"

---

### Foundation Skills (FS)

**Purpose**: Validate if the foundation skill is naturally embedded and assessed in context.

**Smart Question Example**:
- "What numeracy skills are required to complete the risk rating matrix?"

**Benchmark Answer Example**:
- "Learner must calculate likelihood × consequence to determine risk ratings (e.g., 3 × 4 = 12)"

---

## Migration Path

1. **Backup current prompts** (optional):
   ```sql
   CREATE TABLE prompts_backup AS SELECT * FROM prompts;
   ```

2. **Apply migration**:
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20251130_update_prompts.sql
   ```

3. **Verify updates**:
   ```sql
   SELECT requirement_type, document_type, name, description
   FROM prompts
   WHERE name LIKE '%v1.1%';
   ```

4. **Test workflow** with sample validation request

---

## Performance Impact

### Expected Improvements

- **30-40% faster** Gemini API responses (fewer fields to generate)
- **Reduced token usage** (simpler schema)
- **More reliable parsing** (no nested objects)
- **Better citations** (now required, not optional)

### Monitoring

After deployment, monitor:

- Average validation time per requirement
- Gemini API error rates
- Citation quality and completeness
- Smart question relevance

---

## Rollback

If needed, restore previous prompts:

```bash
psql $DATABASE_URL -f supabase/migrations/20250129_seed_prompts.sql
```

Or restore from backup:

```sql
DELETE FROM prompts;
INSERT INTO prompts SELECT * FROM prompts_backup;
```

---

**Last Updated**: 2025-11-30  
**Migration File**: `20251130_update_prompts.sql`  
**Documentation**: `PROMPT_UPDATE_GUIDE.md`
