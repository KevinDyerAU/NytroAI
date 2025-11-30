# Assessment Instructions Guide

This document explains how assessment instructions are handled in the NytroAI validation system.

---

## Overview

**Assessment Instructions** are compliance criteria used to evaluate the overall quality and completeness of assessment documentation. Unlike requirement-specific validations, assessment instructions provide a **holistic assessment** of the assessment tool's compliance with RTO standards.

---

## Hard-Coded Requirements

Assessment instructions are **hard-coded** in the `get-requirements` edge function as 8 separate compliance criteria. This is because:

1. **Standard compliance criteria** - Same 8 criteria for all assessments
2. **Quality assurance focus** - Evaluate overall assessment quality, not specific content
3. **Simpler maintenance** - No database records to manage
4. **Consistent IDs** - IDs start at 8000001 to avoid conflicts

---

## The 8 Assessment Instructions Criteria

### AI1: Assessment Methods
> Assessment methods include simulated customer interactions and require learners to assess customer interactions against established criteria and document compliance with requirements.

**What to check:**
- Are assessment methods appropriate and varied?
- Do methods align with unit requirements?
- Are methods clearly documented?
- Do methods assess all required competencies?

---

### AI2: Evidence Requirements
> Evidence requirements are met through documenting feedback and recording insights from customer interactions, with clear documentation of complaints and non-compliant interactions.

**What to check:**
- Are evidence requirements clearly documented?
- Do evidence requirements align with assessment methods?
- Is the type and amount of evidence specified?
- Are evidence collection methods clear?

---

### AI3: Clarity and Language
> Instructions are clear and use simple language throughout the assessment documents, with visual aids or flowcharts to simplify process where appropriate.

**What to check:**
- Are instructions clear and unambiguous?
- Is language appropriate for the target audience?
- Are complex processes explained simply?
- Are visual aids used effectively?

---

### AI4: Consistency
> Consistent language and instructions are maintained throughout the assessment tool, with all sections referencing the same documents for consistency and using consistent practices.

**What to check:**
- Is terminology consistent across all documents?
- Are instructions consistent throughout?
- Do all sections reference the same documents?
- Are practices and procedures consistent?

---

### AI5: Assessment Review Process
> Opportunities for feedback and review are embedded within the assessment structure, with clearly documented follow-up procedures post-feedback to ensure continuous improvement.

**What to check:**
- Are feedback opportunities embedded in the assessment?
- Are review processes clearly documented?
- Are follow-up procedures specified?
- Is continuous improvement addressed?

---

### AI6: Reasonable Adjustments
> Guidance for reasonable adjustments is limited in documentation provided, with recommendations to add detailed guidance for accommodating learners with special needs including alternative assessment methods.

**What to check:**
- Is guidance for reasonable adjustments provided?
- Are alternative assessment methods documented?
- Are special needs accommodations addressed?
- Is the process for requesting adjustments clear?

---

### AI7: Resubmission and Reassessment Policy
> Resubmission and reassessment pathways can be inferred but are not explicitly stated, with recommendations to clearly state the process for resubmission or reassessment.

**What to check:**
- Are resubmission policies clearly documented?
- Are reassessment pathways explicit?
- Are timeframes and limits specified?
- Is the process for requesting reassessment clear?

---

### AI8: Compliance Report
> Overall compliance report indicates that assessment instructions meet RTO standards with identified areas for improvement in reasonable adjustments and reassessment policies.

**What to check:**
- Overall compliance with RTO standards
- Identification of improvement areas
- Summary of strengths and weaknesses
- Recommendations for enhancement

---

## Response Format

Each assessment instruction criterion is returned as a separate requirement:

```json
{
  "id": 8000001,
  "number": "AI1",
  "text": "Assessment methods include simulated customer interactions and require learners to assess customer interactions against established criteria and document compliance with requirements.",
  "type": "assessment_instructions",
  "display_type": "Assessment Instructions",
  "description": "Assessment methods: Evaluate whether assessment methods are appropriate, varied, and aligned with unit requirements."
}
```

### Field Details

| Field | Value | Notes |
|-------|-------|-------|
| `id` | 8000001-8000008 | High IDs to avoid conflicts with database records |
| `number` | AI1-AI8 | Standard numbering for assessment instructions |
| `text` | Full criterion text | Complete requirement text (example/template) |
| `type` | `assessment_instructions` | Backend identifier |
| `display_type` | `Assessment Instructions` | User-friendly label |
| `description` | Criterion summary | Brief description of what to check |

---

## Validation Approach

Assessment instructions are validated **against the entire assessment tool package** (Unit Assessment + Learner Guide), not individual requirements.

### Validation Focus

**For each criterion, evaluate:**

1. **AI1 (Assessment Methods)**
   - Review all assessment tasks and methods
   - Check alignment with unit requirements
   - Verify variety and appropriateness

2. **AI2 (Evidence Requirements)**
   - Check evidence specifications in assessment instructions
   - Verify alignment with assessment methods
   - Confirm clarity of evidence requirements

3. **AI3 (Clarity and Language)**
   - Review all instructions for clarity
   - Check language level and complexity
   - Assess use of visual aids

4. **AI4 (Consistency)**
   - Compare terminology across all documents
   - Check for consistent instructions
   - Verify consistent document references

5. **AI5 (Assessment Review Process)**
   - Look for feedback opportunities
   - Check for documented review processes
   - Verify follow-up procedures

6. **AI6 (Reasonable Adjustments)**
   - Search for reasonable adjustments guidance
   - Check for alternative assessment methods
   - Verify special needs accommodations

7. **AI7 (Resubmission/Reassessment)**
   - Look for resubmission policies
   - Check for reassessment pathways
   - Verify clarity of processes

8. **AI8 (Compliance Report)**
   - Provide overall compliance summary
   - Identify key strengths
   - Highlight improvement areas

---

## Prompt Considerations

When validating assessment instructions, the AI should:

1. **Review the entire assessment package** - Not individual requirements
2. **Look for explicit documentation** - Policies should be clearly stated
3. **Check assessment instructions section** - Usually at the beginning of assessment tools
4. **Review context and conditions** - Often in introduction or overview sections
5. **Assess overall quality** - Holistic evaluation, not just presence/absence

### Example Validation

**AI6: Reasonable Adjustments**

**Status:** Partially Met

**Reasoning:**
> "The Unit Assessment includes a brief statement on page 2 that 'reasonable adjustments can be made upon request,' but does not provide detailed guidance on what adjustments are available, how to request them, or what alternative assessment methods can be used. The Learner Guide does not mention reasonable adjustments at all. Recommendation: Add a dedicated section outlining specific reasonable adjustments available (e.g., extra time, oral assessments, assistive technology) and the process for requesting them."

**Citations:**
- "Unit Assessment v1.3, Page 2, Assessment Instructions: Brief mention of reasonable adjustments"

---

## Differences from Other Requirements

| Aspect | Other Requirements | Assessment Instructions |
|--------|-------------------|------------------------|
| **Source** | Database tables | Hard-coded in edge function |
| **Variability** | Varies by unit | Same 8 criteria for all units |
| **Count** | Varies (5-20+ per type) | Always 8 |
| **IDs** | Database-generated | Fixed (8000001-8000008) |
| **Validation Target** | Specific content coverage | Overall assessment quality |
| **Validation Scope** | Individual requirements | Holistic assessment package |

---

## UI Display Recommendations

### Simple List
```
Assessment Instructions (8 criteria)
====================================
✓ AI1 - Assessment Methods
✓ AI2 - Evidence Requirements
✓ AI3 - Clarity and Language
⚠ AI4 - Consistency
✓ AI5 - Assessment Review Process
✗ AI6 - Reasonable Adjustments
✗ AI7 - Resubmission and Reassessment Policy
⚠ AI8 - Compliance Report
```

### Detailed View with Categories
```
Assessment Instructions Quality Report
======================================

Assessment Design (AI1-AI2)
  ✓ AI1 - Assessment Methods: Met
  ✓ AI2 - Evidence Requirements: Met

Documentation Quality (AI3-AI4)
  ✓ AI3 - Clarity and Language: Met
  ⚠ AI4 - Consistency: Partially Met

Assessment Processes (AI5-AI7)
  ✓ AI5 - Assessment Review Process: Met
  ✗ AI6 - Reasonable Adjustments: Not Met
  ✗ AI7 - Resubmission/Reassessment: Not Met

Overall Compliance (AI8)
  ⚠ AI8 - Compliance Report: Partially Met
```

### Summary Report
```
Assessment Instructions Compliance
==================================
Met:           5 criteria (62.5%)
Partially Met: 2 criteria (25%)
Not Met:       1 criterion  (12.5%)

Key Strengths:
- Clear assessment methods and evidence requirements
- Good clarity and language throughout
- Embedded review processes

Improvement Areas:
- Add detailed reasonable adjustments guidance
- Explicitly document resubmission/reassessment policies
- Improve consistency in terminology across documents
```

---

## Implementation Notes

### Edge Function
The assessment instructions are added to the response **after** fetching all other requirements:

```typescript
// Add hard-coded assessment instructions (compliance criteria)
const assessmentInstructions: Requirement[] = [
  { id: 8000001, number: 'AI1', text: '...', type: 'assessment_instructions', display_type: 'Assessment Instructions', description: '...' },
  // ... AI2-AI8
];

allRequirements.push(...assessmentInstructions);
```

### Database
**No database table required** for assessment instructions. They are always hard-coded in the edge function.

### Validation Workflow
Assessment instructions are validated like any other requirement type, but the AI should understand they are **holistic quality checks** rather than specific content requirements.

---

## Legacy Mapping

The legacy n8n flow had a separate assessment instructions output with columns:

| Legacy Column | Maps To | AI Number |
|---------------|---------|-----------|
| Assessment Methods | AI1 | AI1 |
| Evidence Requirements | AI2 | AI2 |
| Clarity and Language | AI3 | AI3 |
| Consistency | AI4 | AI4 |
| Assessment Review Process | AI5 | AI5 |
| Reasonable Adjustments | AI6 | AI6 |
| Resubmission and Reassessment Policy | AI7 | AI7 |
| Compliance Report | AI8 | AI8 |

Each legacy column had:
- Status (Met/Partially Met/Not Met)
- Reasoning (detailed explanation)
- Recommendations (improvement suggestions)

The new structure combines these into the standard validation format:
- `status`: Met/Partially Met/Not Met
- `reasoning`: Detailed explanation including recommendations
- `citations`: Specific references to assessment documents

---

## Future Considerations

### If Criteria Change

If assessment instruction criteria need to be updated:

1. Update the hard-coded array in `get-requirements/index.ts`
2. Update this documentation
3. Redeploy the edge function
4. No database migration needed

### If Unit-Specific Criteria Needed

If some units require additional assessment instruction criteria:

1. Create `assessment_instructions_requirements` table records
2. Fetch them in the edge function
3. Append to the hard-coded standard criteria
4. Number them AI9, AI10, etc.

---

## Summary

| Aspect | Details |
|--------|---------|
| **Count** | 8 standard criteria (AI1-AI8) |
| **Source** | Hard-coded in edge function |
| **IDs** | 8000001-8000008 (fixed) |
| **Validation Target** | Overall assessment quality |
| **Display Type** | "Assessment Instructions" |
| **Variability** | Same for all units |
| **Scope** | Holistic package evaluation |

**Key Point:** Assessment instructions are **quality assurance criteria** that evaluate the overall assessment package, not individual content requirements.

---

**Last Updated:** 2025-11-30  
**Related File:** `supabase/functions/get-requirements/index.ts`
