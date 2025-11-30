# Page Number Format Guide

This guide explains how page numbers are included in the validation output for RTO compliance and auditing.

---

## Overview

Page numbers are critical for RTO auditors to quickly verify evidence. The NytroAI validation system includes page numbers in **two places**:

1. **Inline in `mapped_content`** - For immediate visibility
2. **Detailed in `citations`** - For full audit trail

This dual approach ensures page numbers are always visible without requiring cross-referencing.

---

## Format: Inline Page Numbers in Mapped Content

The `mapped_content` field includes page numbers **in parentheses** immediately after each section or task reference.

### Format Pattern

```
[Section/Task Name] (Page [number or range]) [description]
```

### Examples by Document Type

#### Learner Guide Documents

```json
{
  "mapped_content": "Section 2.1 (Page 14) covers hazard identification with practical examples and workplace scenarios. Section 2.3 (Page 18-20) explains the hierarchy of controls in detail with case studies. Appendix A (Page 45) includes a sample risk assessment form showing the structure and required fields."
}
```

**Key features:**
- Section name first
- Page number in parentheses
- Description of content
- Multiple sections separated by periods

#### Unit Assessment Documents

```json
{
  "mapped_content": "Task 2 (Page 8) includes three knowledge questions about risk assessment procedures. Task 3 (Page 12) requires demonstration of hazard identification in a workplace scenario. Assessment Checklist (Page 20) includes observation criteria for safe work practices."
}
```

**Key features:**
- Task number first
- Page number in parentheses
- Description of what the task assesses
- Multiple tasks separated by periods

---

## Format: Detailed Citations

The `citations` array provides the full audit trail with document name, page numbers, and section headings.

### Citation Pattern

```
[Document Name] [Version], Page [number or range], [Section/Task]: [Heading or Title]
```

### Examples

```json
{
  "citations": [
    "BSBWHS332X Learner Guide v2.1, Page 14, Section 2.1: Identifying Hazards",
    "BSBWHS332X Learner Guide v2.1, Page 18-20, Section 2.3: Hierarchy of Controls",
    "BSBWHS332X Unit Assessment v1.3, Page 8, Task 2: Knowledge Questions",
    "BSBWHS332X Unit Assessment v1.3, Page 12, Task 3: Practical Demonstration"
  ]
}
```

---

## Correlation Between Mapped Content and Citations

Each reference in `mapped_content` should have a corresponding entry in `citations` with the same page number.

### Example: Perfect Correlation

**Mapped Content:**
```
"Section 2.1 (Page 14) covers hazard identification. Section 2.3 (Page 18-20) explains controls."
```

**Citations:**
```json
[
  "BSBWHS332X Learner Guide v2.1, Page 14, Section 2.1: Identifying Hazards",
  "BSBWHS332X Learner Guide v2.1, Page 18-20, Section 2.3: Hierarchy of Controls"
]
```

**Verification:**
- ✅ Section 2.1 → Page 14 (matches in both)
- ✅ Section 2.3 → Page 18-20 (matches in both)

---

## Benefits for RTO Auditors

### Immediate Visibility
Auditors can see page numbers directly in the `mapped_content` description without scrolling to citations.

**Before (without inline page numbers):**
```
"Section 2.1 covers hazard identification."
```
→ Auditor must check citations to find page number

**After (with inline page numbers):**
```
"Section 2.1 (Page 14) covers hazard identification."
```
→ Auditor sees page number immediately

### Quick Verification
Auditors can quickly verify evidence by:
1. Reading the `mapped_content` to understand what was found
2. Seeing the page numbers inline
3. Cross-referencing with `citations` for full details
4. Opening the document to the exact page

### Audit Trail
The combination of inline page numbers and detailed citations provides:
- **Speed**: Inline numbers for quick scanning
- **Accuracy**: Detailed citations for verification
- **Compliance**: Full document name, version, and section details

---

## Prompt Instructions

All validation prompts include this instruction for the `mapped_content` field:

> "Always include page numbers in parentheses after each reference (e.g., 'Section 2.1 (Page 14) covers...')."

This ensures Gemini AI consistently generates the correct format.

---

## Validation Examples

### ✅ Correct Format

```json
{
  "mapped_content": "Task 1 (Page 5) includes questions about WHS legislation. Task 2 (Page 8-9) requires identification of hazards in a case study. Task 3 (Page 12) assesses risk control measures.",
  "citations": [
    "BSBWHS332X Unit Assessment v1.3, Page 5, Task 1: WHS Legislation Questions",
    "BSBWHS332X Unit Assessment v1.3, Page 8-9, Task 2: Hazard Identification Case Study",
    "BSBWHS332X Unit Assessment v1.3, Page 12, Task 3: Risk Control Assessment"
  ]
}
```

**Why it's correct:**
- ✅ Page numbers in parentheses after each task
- ✅ Clear descriptions
- ✅ Citations match the page numbers
- ✅ Full document details in citations

### ❌ Incorrect Format

```json
{
  "mapped_content": "Task 1 includes questions about WHS legislation. Task 2 requires identification of hazards. Task 3 assesses risk control measures.",
  "citations": [
    "See pages 5, 8, and 12"
  ]
}
```

**Why it's incorrect:**
- ❌ No inline page numbers in mapped_content
- ❌ Vague citations without document name or sections
- ❌ Auditor must guess which task is on which page

---

## Page Range Format

When content spans multiple pages, use a hyphen:

- **Single page**: `(Page 14)`
- **Page range**: `(Page 18-20)`
- **Multiple separate pages**: List separately

**Example:**
```
"Section 2.1 (Page 14) covers X. Section 2.2 (Page 16) covers Y. Section 2.3 (Page 18-20) covers Z."
```

---

## Summary

| Element | Format | Example |
|---------|--------|---------|
| Inline page number | `(Page X)` | `Section 2.1 (Page 14)` |
| Page range | `(Page X-Y)` | `Section 2.3 (Page 18-20)` |
| Citation | `Doc, Page X, Section: Title` | `Guide v2.1, Page 14, Section 2.1: Hazards` |

**Key principle:** Page numbers should be visible in both `mapped_content` (for speed) and `citations` (for accuracy).

---

**Last Updated:** 2025-11-30  
**Related Files:** `20251130_update_prompts.sql`, `GEMINI_SAMPLE_OUTPUT.json`
