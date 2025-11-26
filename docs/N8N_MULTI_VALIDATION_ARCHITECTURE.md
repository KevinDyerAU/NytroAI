# N8n Multi-Validation Type Architecture

**Date**: November 26, 2025  
**Version**: 4.0 (Multi-Validation)

---

## Overview

This document describes the n8n workflow architecture for processing **6 validation types** separately, each with its own:

- Requirements fetching logic
- Validation prompt from database
- Gemini API call with File Search
- Citation extraction
- Storage in validation_results table

---

## Validation Types

### 1. Knowledge Evidence
- **Table**: `knowledge_evidence_requirements`
- **Prompt ID**: 1
- **Query**: `unit_url` or `unit_code`

### 2. Elements & Performance Criteria
- **Table**: `elements_performance_criteria_requirements`
- **Prompt ID**: 2
- **Query**: `unit_url` or `unit_code`

### 3. Performance Evidence
- **Table**: `performance_evidence_requirements`
- **Prompt ID**: 3
- **Query**: `unit_url` or `unit_code`

### 4. Assessment Conditions
- **Table**: `UnitOfCompetency` (column: `ac`)
- **Prompt ID**: 4
- **Query**: `Link` (unitLink)

### 5. Foundation Skills
- **Table**: `foundation_skills_requirements`
- **Prompt ID**: 5
- **Query**: `unit_url` or `unit_code`

### 6. Assessment Instructions
- **Table**: `UnitOfCompetency` (columns: `ac` + `epc`)
- **Prompt ID**: 7
- **Query**: `Link` (unitLink)

---

## Workflow Architecture

### Main Flow

```
1. Webhook Trigger
   ↓
2. Fetch Validation Context (DB query)
   ↓
3. Get File from Supabase Storage
   ↓
4. Get File Search Stores (Gemini API)
   ↓
5. Find File Search Store (Function)
   ↓
6. Upload to Gemini File Search
   ↓
7. Poll for Indexing Complete
   ↓
8. Update Indexing Status (DB)
   ↓
9. Split by Validation Type (Switch node)
   ↓
   ├─→ Knowledge Evidence Sub-flow
   ├─→ Performance Evidence Sub-flow
   ├─→ Foundation Skills Sub-flow
   ├─→ Elements & Performance Criteria Sub-flow
   ├─→ Assessment Conditions Sub-flow
   └─→ Assessment Instructions Sub-flow
```

### Sub-flow Pattern (for each validation type)

```
A. Fetch Requirements (DB query)
   ↓
B. Fetch Prompt (DB query - from prompt table)
   ↓
C. Build Validation Prompt (Function - inject requirements JSON)
   ↓
D. Call Gemini API (HTTP Request with File Search)
   ↓
E. Extract Citations (Function)
   ↓
F. Validate Quality (Function)
   ↓
G. Store Validation Results (DB insert)
   ↓
H. Update Validation Status (DB update)
```

---

## Node Breakdown

### Main Flow Nodes (1-9)

#### Node 1: Webhook Trigger
**Type**: Webhook  
**Path**: `/webhook/validate-document`  
**Method**: POST

**Input**:
```json
{
  "validationDetailId": 123,
  "fileSearchStore": "rto-7148-assessments",
  "signedUrl": "https://...",
  "fileName": "assessment.pdf"
}
```

---

#### Node 2: Fetch Validation Context
**Type**: PostgreSQL  
**Query**:
```sql
SELECT 
  vd.id as validation_detail_id,
  vd.summary_id,
  vd.namespace_code,
  vd.validation_type_id,
  vs."unitLink",
  vs."unitCode",
  vs."rtoCode",
  uoc."Link" as unit_link,
  uoc."Title" as unit_title,
  vt.name as validation_type_name
FROM validation_detail vd
INNER JOIN validation_summary vs ON vd.summary_id = vs.id
LEFT JOIN "UnitOfCompetency" uoc ON vs."unitLink" = uoc."Link"
LEFT JOIN validation_type vt ON vd.validation_type_id = vt.id
WHERE vd.id = {{ $json.body.validationDetailId }}
```

**Output**:
```json
{
  "validation_detail_id": 123,
  "summary_id": 45,
  "namespace_code": "ns-1732435200-abc",
  "validation_type_id": 1,
  "unitLink": "https://training.gov.au/Training/Details/BSBWHS332X",
  "unitCode": "BSBWHS332X",
  "rtoCode": "7148",
  "unit_link": "https://training.gov.au/Training/Details/BSBWHS332X",
  "unit_title": "Apply infection prevention and control procedures",
  "validation_type_name": "knowledge_evidence"
}
```

---

#### Node 3-8: Same as before (file upload, indexing, etc.)

---

#### Node 9: Split by Validation Type
**Type**: Switch  
**Mode**: Expression

**Rules**:
```javascript
// Route 0: Knowledge Evidence
{{ $json.validation_type_id === 1 }}

// Route 1: Elements & Performance Criteria
{{ $json.validation_type_id === 2 }}

// Route 2: Performance Evidence
{{ $json.validation_type_id === 3 }}

// Route 3: Assessment Conditions
{{ $json.validation_type_id === 4 }}

// Route 4: Foundation Skills
{{ $json.validation_type_id === 5 }}

// Route 5: Assessment Instructions
{{ $json.validation_type_id === 7 }}
```

---

## Sub-flow Nodes (A-H)

### Node A: Fetch Requirements

**Type**: PostgreSQL or Function (depends on validation type)

#### For Knowledge Evidence, Performance Evidence, Foundation Skills, Elements & Performance Criteria:

**Query** (example for Knowledge Evidence):
```sql
SELECT 
  id,
  unit_code,
  unit_url,
  knowledge_point as text,
  requirement_number as number
FROM knowledge_evidence_requirements
WHERE unit_url = {{ $node['Fetch Validation Context'].json.unit_link }}
   OR unit_code = {{ $node['Fetch Validation Context'].json.unitCode }}
ORDER BY id ASC
```

**Output**:
```json
[
  {
    "id": 1,
    "unit_code": "BSBWHS332X",
    "unit_url": "https://training.gov.au/...",
    "text": "Infection control procedures",
    "number": "1"
  },
  {
    "id": 2,
    "unit_code": "BSBWHS332X",
    "unit_url": "https://training.gov.au/...",
    "text": "Hand hygiene practices",
    "number": "2"
  }
]
```

---

#### For Assessment Conditions:

**Query**:
```sql
SELECT 
  ac as text,
  "Link" as unit_url
FROM "UnitOfCompetency"
WHERE "Link" = {{ $node['Fetch Validation Context'].json.unit_link }}
   OR "unitCode" = {{ $node['Fetch Validation Context'].json.unitCode }}
```

**Output**:
```json
{
  "text": "Assessment must be conducted in a workplace or simulated environment...",
  "unit_url": "https://training.gov.au/..."
}
```

---

#### For Assessment Instructions:

**Query**:
```sql
SELECT 
  ac,
  epc,
  "Link" as unit_url
FROM "UnitOfCompetency"
WHERE "Link" = {{ $node['Fetch Validation Context'].json.unit_link }}
   OR "unitCode" = {{ $node['Fetch Validation Context'].json.unitCode }}
```

**Function** (to combine ac + epc):
```javascript
const ac = $json.ac || '';
const epc = $json.epc || '';
const text = `${ac}  -  ${epc}`.trim();

return {
  text: text,
  unit_url: $json.unit_url
};
```

---

### Node B: Fetch Prompt

**Type**: PostgreSQL  
**Query**:
```sql
SELECT 
  id,
  prompt,
  validation_type_id
FROM prompt
WHERE validation_type_id = {{ $node['Fetch Validation Context'].json.validation_type_id }}
  AND current = true
LIMIT 1
```

**Output**:
```json
{
  "id": 15,
  "prompt": "You are validating a VET assessment...\n\nUnit: {unitCode} - {unitTitle}\n\nRequirements to validate:\n{requirements}\n\n...",
  "validation_type_id": 1
}
```

---

### Node C: Build Validation Prompt

**Type**: Function  
**Code**:
```javascript
// Get data from previous nodes
const prompt = $node['Fetch Prompt'].json.prompt;
const context = $node['Fetch Validation Context'].json;
const requirements = $node['Fetch Requirements'].json;

// Format requirements as JSON array
let requirementsJSON = '';

if (Array.isArray(requirements)) {
  // For tables with multiple requirements (KE, PE, FS, EPC)
  requirementsJSON = JSON.stringify(
    requirements.map((req, index) => ({
      requirementId: req.id,
      requirementNumber: req.number || (index + 1).toString(),
      requirementText: req.text
    })),
    null,
    2
  );
} else {
  // For UnitOfCompetency fields (AC, AI) - single requirement
  requirementsJSON = JSON.stringify([{
    requirementId: 999999,
    requirementNumber: '1',
    requirementText: requirements.text
  }], null, 2);
}

// Replace placeholders in prompt
const finalPrompt = prompt
  .replace(/{unitCode}/g, context.unitCode)
  .replace(/{unitTitle}/g, context.unit_title)
  .replace(/{requirements}/g, requirementsJSON);

console.log('[Build Prompt] Final prompt length:', finalPrompt.length);
console.log('[Build Prompt] Requirements count:', Array.isArray(requirements) ? requirements.length : 1);

return {
  prompt: finalPrompt,
  requirementsCount: Array.isArray(requirements) ? requirements.length : 1
};
```

**Output**:
```json
{
  "prompt": "You are validating a VET assessment...\n\nUnit: BSBWHS332X - Apply infection prevention...\n\nRequirements to validate:\n[\n  {\n    \"requirementId\": 1,\n    \"requirementNumber\": \"1\",\n    \"requirementText\": \"Infection control procedures\"\n  },\n  ...\n]\n\n...",
  "requirementsCount": 15
}
```

---

### Node D: Call Gemini API

**Type**: HTTP Request  
**URL**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`  
**Method**: POST  
**Authentication**: Gemini API Key

**Body**:
```javascript
={{
  JSON.stringify({
    contents: [{
      parts: [{ text: $json.prompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          validations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                requirementId: { type: "integer" },
                status: { type: "string", enum: ["covered", "partial", "not_covered", "unclear"] },
                evidence: { type: "string" },
                pageNumbers: { type: "array", items: { type: "integer" } },
                confidence: { type: "string", enum: ["high", "medium", "low"] }
              },
              required: ["requirementId", "status", "evidence"]
            }
          },
          overallStatus: { type: "string", enum: ["compliant", "partial", "non_compliant"] },
          summary: { type: "string" }
        },
        required: ["validations", "overallStatus", "summary"]
      }
    },
    tools: [{
      fileSearchTool: {
        fileSearchConfigs: [{
          filter: {
            metadataFilter: {
              operator: "AND",
              conditions: [
                {
                  key: "namespace",
                  operator: "EQUAL",
                  value: {
                    stringValue: $node['Fetch Validation Context'].json.namespace_code
                  }
                },
                {
                  key: "unit-link",
                  operator: "EQUAL",
                  value: {
                    stringValue: $node['Fetch Validation Context'].json.unit_link
                  }
                }
              ]
            }
          }
        }]
      }
    }]
  })
}}
```

**Output** (from Gemini):
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "{\"validations\": [...], \"overallStatus\": \"compliant\", \"summary\": \"...\"}"
      }]
    },
    "groundingMetadata": {
      "groundingChunks": [...],
      "groundingSupports": [...]
    }
  }]
}
```

---

### Node E: Extract Citations

**Type**: Function  
**Code**:
```javascript
// Parse Gemini response
const response = $json;
const candidate = response.candidates?.[0];

if (!candidate) {
  throw new Error('No candidate in Gemini response');
}

// Parse validation results
const validationText = candidate.content?.parts?.[0]?.text;
const validationData = JSON.parse(validationText);

// Extract grounding metadata
const groundingMetadata = candidate.groundingMetadata || {};
const groundingChunks = groundingMetadata.groundingChunks || [];
const groundingSupports = groundingMetadata.groundingSupports || [];

// Build citations array
const allCitations = groundingChunks.map((chunk, index) => {
  const fileSearchChunk = chunk.fileSearchChunk || {};
  const customMetadata = fileSearchChunk.customMetadata || [];
  
  // Extract unit-link from metadata
  const unitLinkMeta = customMetadata.find(m => m.key === 'unit-link');
  const unitLink = unitLinkMeta?.stringValue || '';
  
  return {
    citationId: index + 1,
    documentName: fileSearchChunk.displayName || 'Unknown',
    pageNumbers: fileSearchChunk.pageNumbers || [],
    excerpt: fileSearchChunk.chunkText || '',
    unitLink: unitLink
  };
});

// Map citations to validations using grounding supports
const validationsWithCitations = validationData.validations.map(validation => {
  // Find grounding supports that reference this validation's evidence
  const relatedSupports = groundingSupports.filter(support => {
    const segmentText = support.segment?.text || '';
    return validation.evidence && segmentText.includes(validation.evidence.substring(0, 50));
  });
  
  // Extract citation indices from supports
  const citationIndices = relatedSupports.flatMap(s => s.groundingChunkIndices || []);
  const citations = citationIndices.map(idx => allCitations[idx]).filter(Boolean);
  
  // Calculate confidence from grounding supports
  const confidenceScores = relatedSupports.flatMap(s => s.confidenceScores || []);
  const avgConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
    : 0;
  
  return {
    ...validation,
    citations: citations,
    confidenceScore: avgConfidence
  };
});

// Calculate metrics
const citationCount = allCitations.length;
const validationsWithCitationsCount = validationsWithCitations.filter(v => v.citations.length > 0).length;
const citationCoverage = validationsWithCitations.length > 0
  ? (validationsWithCitationsCount / validationsWithCitations.length) * 100
  : 0;
const averageConfidence = validationsWithCitations.reduce((sum, v) => sum + (v.confidenceScore || 0), 0) / validationsWithCitations.length;

console.log('[Extract Citations] Citation count:', citationCount);
console.log('[Extract Citations] Citation coverage:', citationCoverage.toFixed(2) + '%');
console.log('[Extract Citations] Average confidence:', averageConfidence.toFixed(2));

return {
  validations: validationsWithCitations,
  overallStatus: validationData.overallStatus,
  summary: validationData.summary,
  citationCount: citationCount,
  citationCoverage: citationCoverage,
  averageConfidence: averageConfidence,
  allCitations: allCitations,
  groundingSupports: groundingSupports
};
```

---

### Node F: Validate Quality

**Type**: Function  
**Code**:
```javascript
const data = $json;

// Quality flags
const noCitations = data.citationCount === 0;
const lowCoverage = data.citationCoverage < 50;
const lowConfidence = data.averageConfidence < 0.6;
const goodQuality = data.citationCount > 0 && data.citationCoverage >= 80 && data.averageConfidence >= 0.8;

const qualityFlags = {
  noCitations,
  lowCoverage,
  lowConfidence,
  goodQuality
};

console.log('[Validate Quality] Flags:', qualityFlags);

return {
  ...data,
  qualityFlags
};
```

---

### Node G: Store Validation Results

**Type**: PostgreSQL  
**Operation**: Insert

**Query**:
```sql
INSERT INTO validation_results (
  document_id,
  validation_detail_id,
  unit_code,
  unit_link,
  validation_type,
  validation_data,
  grounding_metadata,
  citation_count,
  average_confidence,
  citation_coverage,
  quality_flags,
  created_at
) VALUES (
  {{ $node['Webhook Trigger'].json.body.documentId }},
  {{ $node['Fetch Validation Context'].json.validation_detail_id }},
  {{ $node['Fetch Validation Context'].json.unitCode }},
  {{ $node['Fetch Validation Context'].json.unit_link }},
  {{ $node['Fetch Validation Context'].json.validation_type_name }},
  {{ JSON.stringify({ validations: $json.validations, overallStatus: $json.overallStatus, summary: $json.summary }) }},
  {{ JSON.stringify({ allCitations: $json.allCitations, groundingSupports: $json.groundingSupports }) }},
  {{ $json.citationCount }},
  {{ $json.averageConfidence }},
  {{ $json.citationCoverage }},
  {{ JSON.stringify($json.qualityFlags) }},
  NOW()
)
RETURNING id
```

---

### Node H: Update Validation Status

**Type**: PostgreSQL  
**Operation**: Update

**Query**:
```sql
UPDATE validation_detail
SET 
  status = 'validated',
  updated_at = NOW()
WHERE id = {{ $node['Fetch Validation Context'].json.validation_detail_id }}
```

---

## Complete Workflow Structure

```
Main Flow:
1. Webhook Trigger
2. Fetch Validation Context
3. Get File from Supabase Storage
4. Get File Search Stores
5. Find File Search Store
6. Upload to Gemini File Search
7. Poll for Indexing Complete
8. Update Indexing Status
9. Split by Validation Type (Switch)

Knowledge Evidence Sub-flow (Route 0):
10. Fetch KE Requirements
11. Fetch KE Prompt
12. Build KE Prompt
13. Call Gemini (KE)
14. Extract KE Citations
15. Validate KE Quality
16. Store KE Results
17. Update KE Status

Performance Evidence Sub-flow (Route 2):
18. Fetch PE Requirements
19. Fetch PE Prompt
20. Build PE Prompt
21. Call Gemini (PE)
22. Extract PE Citations
23. Validate PE Quality
24. Store PE Results
25. Update PE Status

Foundation Skills Sub-flow (Route 4):
26. Fetch FS Requirements
27. Fetch FS Prompt
28. Build FS Prompt
29. Call Gemini (FS)
30. Extract FS Citations
31. Validate FS Quality
32. Store FS Results
33. Update FS Status

Elements & Performance Criteria Sub-flow (Route 1):
34. Fetch EPC Requirements
35. Fetch EPC Prompt
36. Build EPC Prompt
37. Call Gemini (EPC)
38. Extract EPC Citations
39. Validate EPC Quality
40. Store EPC Results
41. Update EPC Status

Assessment Conditions Sub-flow (Route 3):
42. Fetch AC from UnitOfCompetency
43. Fetch AC Prompt
44. Build AC Prompt
45. Call Gemini (AC)
46. Extract AC Citations
47. Validate AC Quality
48. Store AC Results
49. Update AC Status

Assessment Instructions Sub-flow (Route 5):
50. Fetch AI from UnitOfCompetency
51. Combine AC + EPC
52. Fetch AI Prompt
53. Build AI Prompt
54. Call Gemini (AI)
55. Extract AI Citations
56. Validate AI Quality
57. Store AI Results
58. Update AI Status

Final:
59. Respond Success (all routes merge here)
```

**Total Nodes**: 59

---

## Benefits of This Architecture

1. **Separation of Concerns**: Each validation type has its own sub-flow
2. **Specific Prompts**: Each type uses its own prompt from database
3. **Parallel Processing**: n8n can run sub-flows in parallel (if needed)
4. **Easy Debugging**: Click any node to see input/output for that validation type
5. **Scalability**: Easy to add new validation types
6. **Maintainability**: Update one sub-flow without affecting others

---

## Next Steps

1. Create database schema for `prompt` table
2. Create n8n workflow JSON with all nodes
3. Create prompt templates for each validation type
4. Test each sub-flow individually
5. Test full workflow end-to-end

---

**End of Architecture Document**
