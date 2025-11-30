# Display Type Mapping Guide

This document explains how requirement types are mapped to user-friendly display names in the `get-requirements` edge function response.

---

## Overview

The edge function now returns **two type fields** for each requirement:

1. **`type`**: Backend identifier (unchanged) - Used for filtering, grouping, and logic
2. **`display_type`**: User-friendly label - Used for UI display and reporting

This approach allows the backend to maintain consistent type identifiers while providing human-readable labels for the frontend.

---

## Type Mapping

| Backend `type` | Display `display_type` | Description |
|----------------|------------------------|-------------|
| `knowledge_evidence` | **Knowledge Evidence** | Knowledge points learners must understand |
| `performance_evidence` | **Performance Evidence** | Tasks learners must demonstrate |
| `foundation_skills` | **Foundation Skills** | Core skills (reading, writing, numeracy, etc.) |
| `elements_performance_criteria` | **Performance Criteria** | Specific performance criteria within elements |
| `assessment_conditions` | **Assessment Conditions** | Standard RTO compliance requirements (5 hard-coded) |

---

## Response Structure

### Basic Requirements (KE, PE, FS, AC)

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

### Performance Criteria (with Element Context)

Performance criteria include additional fields to show their relationship to parent elements:

```json
{
  "id": 1207,
  "number": "1.1",
  "text": "Check vehicle documentation",
  "type": "elements_performance_criteria",
  "display_type": "Performance Criteria",
  "description": "Prepare for driving: Check vehicle documentation",
  "element": "Prepare for driving",
  "element_number": "1"
}
```

**Additional fields for Performance Criteria:**
- **`element`**: The parent element name (e.g., "Prepare for driving")
- **`element_number`**: The element number extracted from the criteria number (e.g., "1" from "1.1")

---

## UI Display Recommendations

### Results Explorer

**Option 1: Simple Display**
```
Knowledge Evidence #1
Explain the principles of safe loading and unloading procedures
```

**Option 2: With Type Badge**
```
[Knowledge Evidence] #1
Explain the principles of safe loading and unloading procedures
```

**Option 3: Performance Criteria with Element Context**
```
[Performance Criteria] Element 1: Prepare for driving
1.1 - Check vehicle documentation
```

### Filtering and Grouping

Use the `type` field for backend filtering:
```javascript
// Filter by type
const knowledgeEvidence = requirements.filter(r => r.type === 'knowledge_evidence');

// Group by type
const grouped = requirements.reduce((acc, req) => {
  if (!acc[req.type]) acc[req.type] = [];
  acc[req.type].push(req);
  return acc;
}, {});
```

Use the `display_type` field for UI labels:
```javascript
// Display grouped requirements
Object.entries(grouped).forEach(([type, reqs]) => {
  const displayType = reqs[0].display_type; // Get display name from first item
  console.log(`${displayType}: ${reqs.length} requirements`);
});
```

### Element Grouping (Performance Criteria)

For performance criteria, you can group by element:

```javascript
const performanceCriteria = requirements.filter(r => r.type === 'elements_performance_criteria');

const byElement = performanceCriteria.reduce((acc, req) => {
  const key = req.element_number || 'unknown';
  if (!acc[key]) acc[key] = {
    element_number: req.element_number,
    element: req.element,
    criteria: []
  };
  acc[key].criteria.push(req);
  return acc;
}, {});

// Display:
// Element 1: Prepare for driving
//   1.1 - Check vehicle documentation
//   1.2 - Conduct pre-start checks
// Element 2: Drive vehicle
//   2.1 - Start vehicle safely
//   2.2 - Operate vehicle controls
```

---

## Reporting Examples

### Summary Report

```
Validation Summary for TLIF0025
================================

Knowledge Evidence:        12 requirements
Performance Evidence:       9 requirements
Foundation Skills:          1 requirement
Performance Criteria:      12 requirements
Assessment Conditions:      0 requirements

Total:                     34 requirements
```

### Detailed Report with Element Context

```
Performance Criteria (12 requirements)
======================================

Element 1: Prepare for driving (3 criteria)
  ✓ 1.1 - Check vehicle documentation
  ✓ 1.2 - Conduct pre-start checks
  ⚠ 1.3 - Identify route requirements

Element 2: Drive vehicle (4 criteria)
  ✓ 2.1 - Start vehicle safely
  ✓ 2.2 - Operate vehicle controls
  ✓ 2.3 - Navigate route
  ✗ 2.4 - Respond to road conditions
```

---

## Backward Compatibility

**The `type` field remains unchanged**, ensuring backward compatibility with existing code:

- ✅ Existing filters and queries still work
- ✅ Database validation_results table uses `type` field
- ✅ n8n workflow logic unchanged
- ✅ New `display_type` field is additive only

**Frontend changes required:**
- Update UI to use `display_type` instead of `type` for display
- Add logic to show element context for performance criteria
- Update reports to use user-friendly labels

---

## Element Number Extraction

For performance criteria, the `element_number` is extracted from the `epc_number` field using a regex pattern:

```typescript
// Extract "1" from "1.1", "2" from "2.3", etc.
const match = item.epc_number.match(/^(\d+)\./);
element_number = match ? match[1] : undefined;
```

**Examples:**
- `"1.1"` → `element_number: "1"`
- `"2.3"` → `element_number: "2"`
- `"10.5"` → `element_number: "10"`

This allows grouping criteria by their parent element without additional database queries.

---

## API Response Example

```json
{
  "success": true,
  "unit_code": "TLIF0025",
  "validation_detail_id": "741",
  "total_requirements": 34,
  "requirements": [
    {
      "id": 1581,
      "number": "1",
      "text": "Explain the principles of safe loading...",
      "type": "knowledge_evidence",
      "display_type": "Knowledge Evidence",
      "description": "Explain the principles of safe loading..."
    },
    {
      "id": 1207,
      "number": "1.1",
      "text": "Check vehicle documentation",
      "type": "elements_performance_criteria",
      "display_type": "Performance Criteria",
      "description": "Prepare for driving: Check vehicle documentation",
      "element": "Prepare for driving",
      "element_number": "1"
    }
  ],
  "requirements_by_type": {
    "knowledge_evidence": [...],
    "elements_performance_criteria": [...]
  }
}
```

---

## Summary

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| `type` | Backend identifier | `knowledge_evidence` | Filtering, logic, database |
| `display_type` | UI label | `Knowledge Evidence` | Display, reports, UI |
| `element` | Parent element name | `Prepare for driving` | Context for performance criteria |
| `element_number` | Element number | `1` | Grouping criteria by element |

---

**Last Updated:** 2025-11-30  
**Related File:** `supabase/functions/get-requirements/index.ts`
