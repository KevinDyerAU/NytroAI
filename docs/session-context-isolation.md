# Session Context Isolation for NytroAI Validations

## Problem Statement

**Current Issue**: Filtering by `unit_code` and `unitLink` alone is insufficient for context isolation because:

1. **Multiple validations of same unit**: Different RTOs may validate the same unit with different documents
2. **Temporal separation**: Same RTO may revalidate the same unit over time
3. **Document versioning**: Same unit may have updated assessment documents
4. **Concurrent validations**: Multiple users validating same unit simultaneously

**Example Scenario**:
```
RTO A validates BSBWHS211 on 2025-01-15 with documents v1
RTO A validates BSBWHS211 on 2025-01-28 with documents v2

Without proper isolation:
- Documents from v1 and v2 might mix
- Validation results could cross-contaminate
- Citations could reference wrong document versions
```

## Current Schema Analysis

### validation_summary Table
```sql
CREATE TABLE validation_summary (
  id BIGSERIAL PRIMARY KEY,
  rto_id BIGINT REFERENCES rtos(id),
  unit_code TEXT,
  unitLink TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ...
);
```

### validation_detail Table
```sql
CREATE TABLE validation_detail (
  id BIGSERIAL PRIMARY KEY,
  validation_summary_id BIGINT REFERENCES validation_summary(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ...
);
```

### documents Table
```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ...
);
```

### validation_results Table
```sql
CREATE TABLE validation_results (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- ...
);
```

## ✅ Existing Solution: validation_detail_id

**Good news**: The schema already has proper isolation via `validation_detail_id`!

### Hierarchy
```
validation_summary (1) ──→ (many) validation_detail
validation_detail (1) ──→ (many) documents
validation_detail (1) ──→ (many) validation_results
```

### Context Isolation
Each `validation_detail` record represents a **unique validation session**:
- Created when user starts a new validation
- Links to specific documents uploaded for this session
- Links to validation results for this session
- Has timestamp (`created_at`) for temporal tracking

### Query Pattern (Already Correct)
```sql
-- Get all documents for THIS validation session
SELECT * FROM documents 
WHERE validation_detail_id = :validation_detail_id;

-- Get all results for THIS validation session
SELECT * FROM validation_results 
WHERE validation_detail_id = :validation_detail_id;

-- No cross-contamination possible!
```

## ✅ Current n8n Flows Already Use validation_detail_id

### DocumentProcessingFlow_Gemini.json
```json
{
  "body": {
    "validation_detail_id": 123,  // ✅ Session identifier
    "storage_paths": [...]
  }
}
```

### AIValidationFlow_Gemini.json
```json
{
  "body": {
    "validation_detail_id": 123  // ✅ Same session identifier
  }
}
```

### All Queries Filter by validation_detail_id
```sql
-- Fetch documents for this session only
SELECT * FROM documents 
WHERE validation_detail_id = :validation_detail_id;

-- Fetch results for this session only
SELECT * FROM validation_results 
WHERE validation_detail_id = :validation_detail_id;
```

## ⚠️ Potential Issue: Gemini File API Context

### Problem
When using Gemini File API, we need to ensure the AI understands **which validation session** it's processing.

### Current Prompt (Needs Enhancement)
```javascript
const promptText = `
**Unit of Competency**: ${unitCode}
**Validation Type**: ${validationType}
**Documents Available**: ...
`;
```

**Missing**: Session context, timestamp, validation scope

### Enhanced Prompt (Recommended)
```javascript
const validationDetail = await fetchValidationDetail(validation_detail_id);

const promptText = `
**Validation Session Context**:
- Validation ID: ${validation_detail_id}
- Unit Code: ${unitCode}
- RTO: ${rto_code}
- Validation Date: ${validationDetail.created_at}
- Session Scope: This validation session only (isolated from other validations of the same unit)

**Documents for THIS Session** (${documents.length} files):
${documents.map(d => `- ${d.file_name} (uploaded ${d.created_at})`).join('\n')}

**Important**: Only consider documents uploaded for THIS validation session. 
Do not reference or assume knowledge from other validations of this unit.

**Requirements to validate**: ...
`;
```

## 🔧 Recommended Enhancements

### 1. Add Session Metadata to Prompts

**Update all validation flows** to include session context:

```javascript
// Fetch validation detail with full context
const validationDetail = await supabase
  .from('validation_detail')
  .select(`
    id,
    created_at,
    validation_summary(
      unit_code,
      unitLink,
      rto_code,
      created_at
    )
  `)
  .eq('id', validation_detail_id)
  .single();

// Include in prompt
const sessionContext = `
**Validation Session Context**:
- Session ID: ${validationDetail.id}
- Created: ${new Date(validationDetail.created_at).toLocaleString()}
- Unit: ${validationDetail.validation_summary.unit_code}
- RTO: ${validationDetail.validation_summary.rto_code}
- Scope: Isolated validation session

**Session Documents** (uploaded ${new Date(validationDetail.created_at).toLocaleString()}):
${documents.map(d => `- ${d.file_name} (${d.document_type})`).join('\n')}

**Important**: This is a self-contained validation session. Only consider the documents 
and requirements provided in THIS session. Do not assume or reference information from 
other validations of the same unit code.
`;
```

### 2. Add Session Identifier to Citations

**Enhance citation format** to include session context:

```json
{
  "citations": [
    {
      "validation_session_id": 123,
      "document_id": 456,
      "document_name": "Assessment_Task_BSBWHS211.pdf",
      "document_uploaded_at": "2025-01-28T10:30:00Z",
      "page_numbers": [3, 5],
      "location": "Page 3, Question 5",
      "content": "Relevant excerpt",
      "relevance": "How this addresses the requirement"
    }
  ]
}
```

### 3. Add Session Tracking to validation_results

**Enhance metadata** in validation_results:

```javascript
const metadata = JSON.stringify({
  gaps: rv.gaps || [],
  overall_status: validationResult.overallStatus,
  summary: validationResult.summary,
  documents_analyzed: documentNames,
  validated_at: new Date().toISOString(),
  validation_method: 'gemini_file_api',
  // Add session context
  session_context: {
    validation_detail_id: validationDetailId,
    validation_session_created_at: validationDetail.created_at,
    document_count: documents.length,
    document_upload_timestamps: documents.map(d => ({
      name: d.file_name,
      uploaded_at: d.created_at
    }))
  }
});
```

### 4. Add Session Validation Check

**Prevent accidental cross-session queries**:

```javascript
// Before processing, verify session integrity
const sessionCheck = await supabase
  .from('documents')
  .select('validation_detail_id')
  .in('id', document_ids);

const uniqueSessions = new Set(sessionCheck.data.map(d => d.validation_detail_id));

if (uniqueSessions.size > 1) {
  throw new Error(`Session contamination detected: Documents from ${uniqueSessions.size} different validation sessions`);
}
```

## 📊 Session Isolation Verification Queries

### Check for Cross-Session Contamination
```sql
-- Verify all documents belong to same session
SELECT 
  validation_detail_id,
  COUNT(*) as document_count
FROM documents
WHERE id IN (:document_ids)
GROUP BY validation_detail_id
HAVING COUNT(DISTINCT validation_detail_id) > 1;
-- Should return 0 rows
```

### Verify Session Completeness
```sql
-- Ensure all components of a session are linked correctly
SELECT 
  vd.id as validation_detail_id,
  vd.created_at as session_created,
  COUNT(DISTINCT d.id) as document_count,
  COUNT(DISTINCT vr.id) as result_count,
  MIN(d.created_at) as first_document_uploaded,
  MAX(d.created_at) as last_document_uploaded,
  MIN(vr.created_at) as first_result_created,
  MAX(vr.created_at) as last_result_created
FROM validation_detail vd
LEFT JOIN documents d ON d.validation_detail_id = vd.id
LEFT JOIN validation_results vr ON vr.validation_detail_id = vd.id
WHERE vd.id = :validation_detail_id
GROUP BY vd.id, vd.created_at;
```

### Find Concurrent Validations of Same Unit
```sql
-- Identify concurrent validation sessions for same unit
SELECT 
  vd.id as validation_detail_id,
  vd.created_at as session_start,
  vs.unit_code,
  vs.rto_code,
  COUNT(d.id) as document_count
FROM validation_detail vd
JOIN validation_summary vs ON vs.id = vd.validation_summary_id
LEFT JOIN documents d ON d.validation_detail_id = vd.id
WHERE vs.unit_code = :unit_code
  AND vd.created_at >= NOW() - INTERVAL '7 days'
GROUP BY vd.id, vd.created_at, vs.unit_code, vs.rto_code
ORDER BY vd.created_at DESC;
```

## 🔄 Updated n8n Flow Changes

### 1. Fetch Validation Context (Enhanced)

**Old**:
```javascript
const validationContext = await supabase
  .from('validation_detail')
  .select('validation_summary(unit_code, unitLink)')
  .eq('id', validation_detail_id)
  .single();
```

**New**:
```javascript
const validationContext = await supabase
  .from('validation_detail')
  .select(`
    id,
    created_at,
    validation_summary(
      id,
      unit_code,
      unitLink,
      rto_code,
      created_at
    )
  `)
  .eq('id', validation_detail_id)
  .single();

// Add to context
return {
  json: {
    validation_detail_id: validationContext.id,
    session_created_at: validationContext.created_at,
    unit_code: validationContext.validation_summary.unit_code,
    unitLink: validationContext.validation_summary.unitLink,
    rto_code: validationContext.validation_summary.rto_code
  }
};
```

### 2. Prepare Gemini Request (Enhanced)

**Add session context to prompt**:

```javascript
const validationContext = $('Fetch Validation Context').first().json;
const documents = $('Fetch Gemini File URIs').all().map(item => item.json);

const sessionContext = `
**VALIDATION SESSION CONTEXT**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session ID: ${validationContext.validation_detail_id}
Session Created: ${new Date(validationContext.session_created_at).toLocaleString()}
Unit Code: ${validationContext.unit_code}
RTO Code: ${validationContext.rto_code}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DOCUMENTS FOR THIS SESSION** (${documents.length} files):
${documents.map((d, i) => `${i + 1}. ${d.file_name} (${d.document_type || 'Assessment Document'})
   - Uploaded: ${new Date(d.created_at).toLocaleString()}
   - Gemini URI: ${d.gemini_file_uri}`).join('\n')}

**IMPORTANT INSTRUCTIONS**:
1. This is an ISOLATED validation session
2. Only consider documents uploaded for THIS session
3. Do not assume or reference information from other validations
4. All citations must reference documents from THIS session only
5. Include document names and page numbers in all evidence citations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

const promptText = `${sessionContext}\n\n${systemPrompt}\n\n**Unit of Competency**: ${unitCode}\n\n...`;
```

### 3. Parse Response (Enhanced)

**Add session context to metadata**:

```javascript
const metadata = JSON.stringify({
  gaps: rv.gaps || [],
  overall_status: validationResult.overallStatus,
  summary: validationResult.summary,
  documents_analyzed: documentNames,
  validated_at: new Date().toISOString(),
  validation_method: 'gemini_file_api',
  // Enhanced session context
  session_context: {
    validation_detail_id: validationDetailId,
    session_created_at: validationContext.session_created_at,
    unit_code: validationContext.unit_code,
    rto_code: validationContext.rto_code,
    document_count: documents.length,
    documents: documents.map(d => ({
      id: d.id,
      name: d.file_name,
      type: d.document_type,
      uploaded_at: d.created_at,
      gemini_uri: d.gemini_file_uri
    }))
  }
});
```

## ✅ Verification Checklist

After implementing enhancements:

- [ ] All queries filter by `validation_detail_id`
- [ ] Session context included in AI prompts
- [ ] Session metadata stored in validation_results
- [ ] Citations include session identifiers
- [ ] No cross-session queries possible
- [ ] Session integrity checks in place
- [ ] Timestamps tracked at all levels
- [ ] Concurrent sessions properly isolated

## 🎯 Summary

**Current State**: ✅ **Already Good!**
- Schema properly uses `validation_detail_id` for isolation
- All queries filter by session ID
- No cross-contamination possible at database level

**Recommended Enhancements**: 🔧 **Make it Explicit**
- Add session context to AI prompts
- Include timestamps in session metadata
- Enhance citations with session identifiers
- Add session integrity validation checks

**Why This Matters**:
1. **Temporal isolation**: Different validation runs don't interfere
2. **Document versioning**: Clear which document versions were used
3. **Audit trail**: Full traceability of validation sessions
4. **AI context**: Gemini understands session boundaries
5. **User confidence**: Clear that each validation is independent

## 📝 Implementation Priority

**High Priority** (Do Now):
1. ✅ Verify all queries use `validation_detail_id` (already done)
2. 🔧 Add session context to AI prompts
3. 🔧 Include timestamps in metadata

**Medium Priority** (Do Soon):
4. 🔧 Enhance citation format with session IDs
5. 🔧 Add session integrity checks

**Low Priority** (Nice to Have):
6. 📊 Add session analytics queries
7. 🔍 Build session comparison tools

---

**Conclusion**: The database schema already provides proper session isolation via `validation_detail_id`. The main enhancement needed is making this explicit in AI prompts and metadata to ensure Gemini understands the session boundaries.
