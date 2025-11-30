# All Requirement Types Summary

This document provides a complete overview of all requirement types in the NytroAI validation system.

---

## Overview

The system validates **7 requirement types** against assessment documents:

1. **Knowledge Evidence** (KE) - Database-driven, varies by unit
2. **Performance Evidence** (PE) - Database-driven, varies by unit
3. **Foundation Skills** (FS) - Database-driven, varies by unit
4. **Performance Criteria** (PC/EPC) - Database-driven, varies by unit
5. **Assessment Conditions** (AC) - Hard-coded, 5 standard requirements
6. **Assessment Instructions** (AI) - Hard-coded, 8 quality criteria
7. ~~**Assessment Instructions Requirements**~~ - Not implemented yet

---

## Requirement Types

### 1. Knowledge Evidence (KE)

**Source:** `knowledge_evidence_requirements` table  
**Count:** Varies by unit (typically 5-15)  
**Numbering:** KE1, KE2, KE3, etc. (or just 1, 2, 3)  
**Display Type:** "Knowledge Evidence"  
**Validation Target:** Learner Guide content  

**What it validates:**
- Does the Learner Guide cover the required knowledge points?
- Is the knowledge explained clearly and in sufficient detail?
- Are examples and context provided?

**Example:**
```json
{
  "id": 1581,
  "number": "1",
  "text": "Explain the principles of safe loading and unloading procedures",
  "type": "knowledge_evidence",
  "display_type": "Knowledge Evidence",
  "description": "Explain the principles of safe loading and unloading procedures"
}
```

---

### 2. Performance Evidence (PE)

**Source:** `performance_evidence_requirements` table  
**Count:** Varies by unit (typically 5-12)  
**Numbering:** PE1, PE2, PE3, etc. (or just 1, 2, 3)  
**Display Type:** "Performance Evidence"  
**Validation Target:** Unit Assessment tasks  

**What it validates:**
- Does the Unit Assessment include tasks that require demonstrating the required performances?
- Are the tasks realistic and aligned with workplace requirements?
- Do tasks provide sufficient opportunity to demonstrate competency?

**Example:**
```json
{
  "id": 1582,
  "number": "1",
  "text": "Complete at least three customer service interactions demonstrating appropriate communication",
  "type": "performance_evidence",
  "display_type": "Performance Evidence",
  "description": "Complete at least three customer service interactions demonstrating appropriate communication"
}
```

---

### 3. Foundation Skills (FS)

**Source:** `foundation_skills_requirements` table  
**Count:** Varies by unit (typically 1-5)  
**Numbering:** FS1, FS2, FS3, etc. (or just 1, 2, 3)  
**Display Type:** "Foundation Skills"  
**Validation Target:** Both Learner Guide and Unit Assessment  

**What it validates:**
- Are foundation skills (reading, writing, numeracy, digital literacy) addressed?
- Are these skills integrated into learning and assessment activities?
- Is support provided for developing these skills?

**Example:**
```json
{
  "id": 1583,
  "number": "1",
  "text": "Reading skills to interpret workplace documentation and safety procedures",
  "type": "foundation_skills",
  "display_type": "Foundation Skills",
  "description": "Reading skills to interpret workplace documentation and safety procedures"
}
```

---

### 4. Performance Criteria (PC/EPC)

**Source:** `elements_performance_criteria_requirements` table  
**Count:** Varies by unit (typically 10-20)  
**Numbering:** 1.1, 1.2, 2.1, 2.2, etc. (element.criteria)  
**Display Type:** "Performance Criteria"  
**Validation Target:** Both Learner Guide and Unit Assessment  

**Special fields:**
- `element`: Parent element name (e.g., "Prepare for driving")
- `element_number`: Element number (e.g., "1")

**What it validates:**
- Does the Learner Guide explain how to perform each criterion?
- Does the Unit Assessment include tasks that assess each criterion?
- Are all criteria from all elements covered?

**Example:**
```json
{
  "id": 1207,
  "number": "1.1",
  "text": "Check vehicle documentation is current and complete",
  "type": "elements_performance_criteria",
  "display_type": "Performance Criteria",
  "description": "Prepare for driving: Check vehicle documentation is current and complete",
  "element": "Prepare for driving",
  "element_number": "1"
}
```

---

### 5. Assessment Conditions (AC) - Hard-Coded

**Source:** Hard-coded in edge function  
**Count:** Always 5  
**Numbering:** AC1, AC2, AC3, AC4, AC5  
**Display Type:** "Assessment Conditions"  
**IDs:** 9000001-9000005  
**Validation Target:** Assessment tool compliance  

**The 5 Standard Conditions:**

1. **AC1: Assessor Credentials**  
   Assessors must hold credentials specified within the Standards for RTOs

2. **AC2: Principles of Assessment and Rules of Evidence**  
   Assessment must satisfy Principles of Assessment and Rules of Evidence

3. **AC3: Workplace or Simulated Environment**  
   Assessment must occur in workplace or simulated workplace conditions

4. **AC4: Language, Literacy and Numeracy**  
   Assessment processes must be appropriate to LLN requirements

5. **AC5: Resources for Assessment**  
   Resources must include exercises, equipment, and documentation

**What it validates:**
- Are assessor requirements documented?
- Are assessment principles addressed?
- Is the environment specified?
- Are LLN considerations included?
- Are required resources listed?

**Example:**
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

---

### 6. Assessment Instructions (AI) - Hard-Coded

**Source:** Hard-coded in edge function  
**Count:** Always 8  
**Numbering:** AI1, AI2, AI3, AI4, AI5, AI6, AI7, AI8  
**Display Type:** "Assessment Instructions"  
**IDs:** 8000001-8000008  
**Validation Target:** Overall assessment quality  

**The 8 Quality Criteria:**

1. **AI1: Assessment Methods**  
   Are assessment methods appropriate, varied, and aligned with requirements?

2. **AI2: Evidence Requirements**  
   Are evidence requirements clearly documented and aligned with methods?

3. **AI3: Clarity and Language**  
   Are instructions clear and language appropriate for the audience?

4. **AI4: Consistency**  
   Is terminology and instruction consistent across all documents?

5. **AI5: Assessment Review Process**  
   Are feedback and review processes embedded and documented?

6. **AI6: Reasonable Adjustments**  
   Is guidance for reasonable adjustments provided?

7. **AI7: Resubmission and Reassessment Policy**  
   Are resubmission and reassessment policies clearly documented?

8. **AI8: Compliance Report**  
   Overall compliance summary with strengths and improvement areas

**What it validates:**
- Overall quality of assessment documentation
- Compliance with RTO standards
- Completeness of assessment instructions
- Accessibility and clarity

**Example:**
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

---

## Comparison Table

| Type | Source | Count | IDs | Numbering | Validation Target |
|------|--------|-------|-----|-----------|-------------------|
| **Knowledge Evidence** | Database | Varies | DB-generated | 1, 2, 3... | Learner Guide content |
| **Performance Evidence** | Database | Varies | DB-generated | 1, 2, 3... | Unit Assessment tasks |
| **Foundation Skills** | Database | Varies | DB-generated | 1, 2, 3... | Both documents |
| **Performance Criteria** | Database | Varies | DB-generated | 1.1, 1.2, 2.1... | Both documents |
| **Assessment Conditions** | Hard-coded | 5 | 9000001-9000005 | AC1-AC5 | Assessment compliance |
| **Assessment Instructions** | Hard-coded | 8 | 8000001-8000008 | AI1-AI8 | Overall quality |

---

## Typical Unit Breakdown

**Example: TLIF0025 - Operate a light vehicle**

```
Knowledge Evidence:        12 requirements
Performance Evidence:       9 requirements
Foundation Skills:          1 requirement
Performance Criteria:      12 requirements (across 3 elements)
Assessment Conditions:      5 requirements (standard)
Assessment Instructions:    8 requirements (standard)
                           --
Total:                     47 requirements
```

---

## Validation Workflow

### Step 1: Fetch Requirements
```
GET /functions/v1/get-requirements
{
  "validation_detail_id": "741"
}
```

Returns all requirements including hard-coded AC and AI.

### Step 2: Validate Each Requirement
For each requirement, AI validates against documents and returns:
- `status`: Met / Partially Met / Not Met
- `reasoning`: Detailed explanation with evidence
- `mapped_content`: Specific sections with page numbers
- `citations`: Document references
- `smart_question`: One relevant question
- `benchmark_answer`: Correct answer

### Step 3: Store Results
Save validation results to `validation_results` table.

### Step 4: Generate Reports
- Requirements summary by type
- Overall compliance percentage
- Identified gaps and recommendations

---

## Display Recommendations

### Requirements Summary
```
Validation Results for TLIF0025
================================

Content Requirements:
  Knowledge Evidence:        12 requirements (10 Met, 2 Partially Met)
  Performance Evidence:       9 requirements (8 Met, 1 Not Met)
  Foundation Skills:          1 requirement  (1 Met)
  Performance Criteria:      12 requirements (11 Met, 1 Partially Met)

Compliance Requirements:
  Assessment Conditions:      5 requirements (5 Met)
  Assessment Instructions:    8 requirements (6 Met, 2 Partially Met)

Total:                       47 requirements
Overall Compliance:          87.2%
```

### Grouped by Element (Performance Criteria)
```
Element 1: Prepare for driving (4 criteria)
  ✓ 1.1 - Check vehicle documentation
  ✓ 1.2 - Conduct pre-start checks
  ⚠ 1.3 - Identify route requirements
  ✓ 1.4 - Plan for contingencies

Element 2: Drive vehicle (5 criteria)
  ✓ 2.1 - Start vehicle safely
  ✓ 2.2 - Operate controls correctly
  ...
```

### Quality Report (Assessment Instructions)
```
Assessment Instructions Quality Report
======================================

Assessment Design:
  ✓ AI1 - Assessment Methods: Met
  ✓ AI2 - Evidence Requirements: Met

Documentation Quality:
  ✓ AI3 - Clarity and Language: Met
  ⚠ AI4 - Consistency: Partially Met

Assessment Processes:
  ✓ AI5 - Assessment Review Process: Met
  ⚠ AI6 - Reasonable Adjustments: Partially Met
  ✓ AI7 - Resubmission/Reassessment: Met

Overall:
  ✓ AI8 - Compliance Report: Met
```

---

## Documentation

Each requirement type has detailed documentation:

- **Knowledge Evidence:** Standard requirement validation
- **Performance Evidence:** Standard requirement validation
- **Foundation Skills:** Standard requirement validation
- **Performance Criteria:** `docs/DISPLAY_TYPE_MAPPING_GUIDE.md`
- **Assessment Conditions:** `docs/ASSESSMENT_CONDITIONS_GUIDE.md`
- **Assessment Instructions:** `docs/ASSESSMENT_INSTRUCTIONS_GUIDE.md`

---

## Summary

| Aspect | Details |
|--------|---------|
| **Total Types** | 6 (4 database + 2 hard-coded) |
| **Database Types** | KE, PE, FS, PC/EPC |
| **Hard-Coded Types** | AC (5), AI (8) |
| **Typical Total** | 40-50 requirements per unit |
| **Validation Target** | Learner Guide + Unit Assessment |

**Key Points:**
- Database types vary by unit
- Hard-coded types are consistent across all units
- All types use the same validation schema
- Results stored in `validation_results` table

---

**Last Updated:** 2025-11-30  
**Related Files:**
- `supabase/functions/get-requirements/index.ts`
- `docs/ASSESSMENT_CONDITIONS_GUIDE.md`
- `docs/ASSESSMENT_INSTRUCTIONS_GUIDE.md`
- `docs/DISPLAY_TYPE_MAPPING_GUIDE.md`
