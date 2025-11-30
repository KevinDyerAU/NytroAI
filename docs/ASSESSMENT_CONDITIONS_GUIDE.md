# Assessment Conditions Guide

This document explains how assessment conditions are handled in the NytroAI validation system.

---

## Overview

**Assessment Conditions** are standard RTO compliance requirements that apply to **all units of competency**. Unlike other requirement types that vary by unit, assessment conditions are consistent across all training packages.

---

## Hard-Coded Requirements

Assessment conditions are **hard-coded** in the `get-requirements` edge function rather than stored in the database. This is because:

1. **They never change** - Same 5 conditions for all units
2. **Standard RTO requirements** - Mandated by the Standards for RTOs
3. **Simpler maintenance** - No database records to manage
4. **Consistent IDs** - IDs start at 9000001 to avoid conflicts

---

## The 5 Standard Assessment Conditions

### AC1: Assessor Credentials
> Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment.

**What this means:**
- Assessors must have TAE40116 or TAE40110 (or equivalent)
- Assessors must have vocational competency in the area being assessed
- Assessors must have current industry skills

---

### AC2: Principles of Assessment and Rules of Evidence
> Assessment must satisfy the Principles of Assessment and Rules of Evidence and all regulatory requirements included within the Standards for Registered Training Organisations current at the time of assessment.

**What this means:**
- **Principles of Assessment:** Fairness, Flexibility, Validity, Reliability
- **Rules of Evidence:** Validity, Sufficiency, Authenticity, Currency
- Must comply with Standards for RTOs 2015

---

### AC3: Workplace or Simulated Environment
> Assessment must occur in workplace operational situations where it is appropriate to do so; where this is not appropriate, assessment must occur in simulated workplace operational situations that replicate workplace conditions.

**What this means:**
- Preference for real workplace assessment
- If not possible, use realistic simulation
- Simulated environment must replicate actual workplace conditions

---

### AC4: Language, Literacy and Numeracy
> Assessment processes and techniques must be appropriate to the language, literacy and numeracy requirements of the work being performed and the needs of the candidate.

**What this means:**
- Assessment language matches job requirements
- Reasonable adjustments for LLN needs
- Assessment tools are accessible

---

### AC5: Resources for Assessment
> Resources for assessment must include access to: a range of relevant exercises, case studies and/or simulations; relevant and appropriate materials, tools, equipment and PPE currently used in industry; applicable documentation, including legislation, regulations, codes of practice, workplace procedures and operation manuals.

**What this means:**
- Variety of assessment methods available
- Current industry-standard equipment
- Up-to-date documentation and references

---

## Response Format

Each assessment condition is returned as a separate requirement:

```json
{
  "id": 9000001,
  "number": "AC1",
  "text": "Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment.",
  "type": "assessment_conditions",
  "display_type": "Assessment Conditions",
  "description": "Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment."
}
```

### Field Details

| Field | Value | Notes |
|-------|-------|-------|
| `id` | 9000001-9000005 | High IDs to avoid conflicts with database records |
| `number` | AC1-AC5 | Standard numbering for assessment conditions |
| `text` | Full condition text | Complete requirement text |
| `type` | `assessment_conditions` | Backend identifier |
| `display_type` | `Assessment Conditions` | User-friendly label |
| `description` | Same as text | Full description |

---

## Validation Approach

Assessment conditions are validated **against the assessment tools** (Unit Assessment, Learner Guide), not the unit of competency itself.

### What to Check

**For each assessment condition, verify:**

1. **AC1 (Assessor Credentials)**
   - Does the assessment tool specify assessor requirements?
   - Are credential requirements documented?

2. **AC2 (Principles & Rules)**
   - Are assessment methods valid and reliable?
   - Is evidence sufficient and authentic?
   - Are fairness and flexibility addressed?

3. **AC3 (Workplace/Simulation)**
   - Does the assessment specify workplace or simulated environment?
   - Are simulation conditions realistic?

4. **AC4 (LLN)**
   - Is assessment language appropriate for the job?
   - Are reasonable adjustments mentioned?

5. **AC5 (Resources)**
   - Are required resources listed?
   - Is equipment current and industry-standard?
   - Is documentation up-to-date?

---

## Prompt Considerations

When validating assessment conditions, the AI should:

1. **Look for explicit statements** in the assessment tool
2. **Check assessment instructions** section
3. **Review assessment context** and conditions
4. **Verify resource lists** and requirements
5. **Check for RTO policy references**

### Example Validation

**Status:** Met / Partially Met / Not Met

**Reasoning:**
> "AC1 is addressed in the Assessment Instructions (Page 2) which states 'Assessors must hold TAE40116 and current industry experience.' AC2 is partially met - the tool includes valid assessment methods but does not explicitly reference the Principles of Assessment or Rules of Evidence..."

**Citations:**
- "Unit Assessment v1.3, Page 2, Assessment Instructions: Assessor Requirements"
- "Unit Assessment v1.3, Page 3, Assessment Context"

---

## Differences from Other Requirements

| Aspect | Other Requirements | Assessment Conditions |
|--------|-------------------|----------------------|
| **Source** | Database tables | Hard-coded in edge function |
| **Variability** | Varies by unit | Same for all units |
| **Count** | Varies (5-20+ per type) | Always 5 |
| **IDs** | Database-generated | Fixed (9000001-9000005) |
| **Validation Target** | Learner Guide content | Assessment tool compliance |

---

## UI Display Recommendations

### Simple List
```
Assessment Conditions (5 requirements)
======================================
✓ AC1 - Assessor Credentials
✓ AC2 - Principles of Assessment and Rules of Evidence
⚠ AC3 - Workplace or Simulated Environment
✓ AC4 - Language, Literacy and Numeracy
✗ AC5 - Resources for Assessment
```

### Detailed View
```
AC1: Assessor Credentials
Status: Met
Reasoning: The Assessment Instructions (Page 2) clearly specify that 
assessors must hold TAE40116 and have current industry experience in 
logistics and transport.
Citations: 
- Unit Assessment v1.3, Page 2, Assessment Instructions
```

### Grouped with Other Requirements
```
Requirements Summary
====================
Knowledge Evidence:        12 requirements
Performance Evidence:       9 requirements
Foundation Skills:          1 requirement
Performance Criteria:      12 requirements
Assessment Conditions:      5 requirements (standard)
                           --
Total:                     39 requirements
```

---

## Implementation Notes

### Edge Function
The assessment conditions are added to the response **after** fetching all other requirements:

```typescript
// Add hard-coded assessment conditions (standard RTO requirements)
const assessmentConditions: Requirement[] = [
  { id: 9000001, number: 'AC1', text: '...', type: 'assessment_conditions', display_type: 'Assessment Conditions', description: '...' },
  // ... AC2-AC5
];

allRequirements.push(...assessmentConditions);
```

### Database
**No database table required** for assessment conditions. The `assessment_conditions_requirements` table can remain empty or be removed.

### Validation Workflow
Assessment conditions are validated like any other requirement type, but the AI should understand they are **compliance checks** rather than content coverage checks.

---

## Future Considerations

### If Assessment Conditions Change

If the Standards for RTOs are updated and assessment conditions change:

1. Update the hard-coded array in `get-requirements/index.ts`
2. Update this documentation
3. Redeploy the edge function
4. No database migration needed

### If Unit-Specific Conditions Needed

Some units may have additional assessment conditions beyond the standard 5. If needed:

1. Create `assessment_conditions_requirements` table records
2. Fetch them in the edge function
3. Append to the hard-coded standard conditions
4. Number them AC6, AC7, etc.

---

## Summary

| Aspect | Details |
|--------|---------|
| **Count** | 5 standard conditions (AC1-AC5) |
| **Source** | Hard-coded in edge function |
| **IDs** | 9000001-9000005 (fixed) |
| **Validation Target** | Assessment tool compliance |
| **Display Type** | "Assessment Conditions" |
| **Variability** | Same for all units |

**Key Point:** Assessment conditions are **standard RTO requirements** that apply universally, not unit-specific content requirements.

---

**Last Updated:** 2025-11-30  
**Related File:** `supabase/functions/get-requirements/index.ts`
