# Multi-Document Context Handling Strategy

## Problem Statement

When validating assessments, users may upload multiple documents (e.g., Assessment Tasks, Marking Guide, Student Instructions, Learner Guide). Each validation session must maintain clear document boundaries and context isolation to ensure:

1. **Accurate Citations**: References to specific documents and page numbers
2. **Context Separation**: Documents from different validations don't mix
3. **Traceability**: Clear mapping from validation → documents → elements
4. **Multi-Document Validation**: AI can analyze across all documents in a validation session

## Database Schema Enhancements

### Current Schema
```sql
-- documents table
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  storage_path TEXT,
  file_name TEXT,
  document_type TEXT,
  -- ...
);

-- elements table (populated by Unstructured.io)
CREATE TABLE elements (
  id UUID PRIMARY KEY,
  url TEXT,  -- S3 path
  text TEXT,
  filename TEXT,
  page_number INTEGER,
  -- ...
);
```

### Key Relationships

```
validation_detail (1) ──→ (many) documents
documents.storage_path ──→ elements.url (S3 path)
```

### Document Context Isolation

**Per Validation**:
- Each `validation_detail` has multiple `documents`
- Each `document` has a unique `storage_path` (S3 URL)
- `elements` table stores extracted text with `url` field matching `storage_path`

**Query Pattern**:
```sql
-- Get all document text for a specific validation
SELECT e.text, e.filename, e.page_number, e.type, d.document_type, d.file_name
FROM validation_detail vd
JOIN documents d ON d.validation_detail_id = vd.id
JOIN elements e ON e.url = d.storage_path
WHERE vd.id = :validation_detail_id
ORDER BY d.file_name, e.page_number;
```

## Multi-Document Aggregation Strategy

### Approach 1: Concatenated Context with Document Markers (Recommended)

**Format**:
```
═══════════════════════════════════════════════════════════════
DOCUMENT 1: Assessment_Task_BSBWHS211.pdf
Type: Assessment Task
═══════════════════════════════════════════════════════════════

[PAGE 1]
{text content from page 1}

[PAGE 2]
{text content from page 2}

═══════════════════════════════════════════════════════════════
DOCUMENT 2: Marking_Guide_BSBWHS211.pdf
Type: Marking Guide
═══════════════════════════════════════════════════════════════

[PAGE 1]
{text content from page 1}

...
```

**Benefits**:
- Clear document boundaries
- Easy for AI to reference specific documents
- Maintains page number context
- Single context window (efficient)
- Natural language citations

**Implementation**:
```javascript
// Aggregate with clear document separation
const elements = await fetchElements(validationDetailId);

let aggregatedText = '';
let currentDocument = '';

for (const element of elements) {
  // New document section
  if (element.document_name !== currentDocument) {
    if (currentDocument !== '') {
      aggregatedText += '\n\n';
    }
    
    aggregatedText += '═'.repeat(63) + '\n';
    aggregatedText += `DOCUMENT: ${element.document_name}\n`;
    aggregatedText += `Type: ${element.document_type}\n`;
    aggregatedText += `File: ${element.file_name}\n`;
    aggregatedText += '═'.repeat(63) + '\n\n';
    
    currentDocument = element.document_name;
  }
  
  // Page marker
  if (element.page_number) {
    aggregatedText += `\n[PAGE ${element.page_number}]\n`;
  }
  
  // Content
  aggregatedText += element.text + '\n';
}
```

### Approach 2: Structured JSON Context (Alternative)

**Format**:
```json
{
  "documents": [
    {
      "id": 1,
      "name": "Assessment_Task_BSBWHS211.pdf",
      "type": "Assessment Task",
      "pages": [
        {
          "page_number": 1,
          "content": "text content..."
        }
      ]
    }
  ]
}
```

**Benefits**:
- Structured data
- Easier programmatic parsing
- Clear document metadata

**Drawbacks**:
- More verbose (uses more tokens)
- Harder for AI to read naturally
- Requires JSON parsing in prompt

## Updated n8n Flow: Document Text Aggregation

### SQL Query with Document Metadata

```sql
SELECT 
  e.text,
  e.filename,
  e.page_number,
  e.type as element_type,
  d.file_name as document_name,
  d.document_type,
  d.storage_path,
  d.id as document_id
FROM documents d
JOIN elements e ON e.url = d.storage_path
WHERE d.validation_detail_id = $1
ORDER BY d.file_name, e.page_number;
```

### JavaScript Aggregation Code

```javascript
// Enhanced aggregation with document separation
const elements = $input.all().map(item => item.json);

let aggregatedText = '';
let currentDocumentId = null;
const documentSeparator = '═'.repeat(63);

for (const element of elements) {
  // New document section
  if (element.document_id !== currentDocumentId) {
    if (currentDocumentId !== null) {
      aggregatedText += '\n\n';
    }
    
    aggregatedText += documentSeparator + '\n';
    aggregatedText += `DOCUMENT: ${element.document_name}\n`;
    aggregatedText += `Type: ${element.document_type || 'N/A'}\n`;
    aggregatedText += `Source: ${element.filename}\n`;
    aggregatedText += documentSeparator + '\n\n';
    
    currentDocumentId = element.document_id;
  }
  
  // Page marker
  if (element.page_number) {
    aggregatedText += `[PAGE ${element.page_number}]\n`;
  }
  
  // Element type marker (optional, for debugging)
  if (element.element_type && element.element_type !== 'NarrativeText') {
    aggregatedText += `[${element.element_type}]\n`;
  }
  
  // Content
  if (element.text) {
    aggregatedText += element.text + '\n\n';
  }
}

return {
  json: {
    aggregated_text: aggregatedText,
    total_elements: elements.length,
    document_count: new Set(elements.map(e => e.document_id)).size
  }
};
```

## AI Prompt Instructions for Multi-Document Context

### System Prompt Addition

```
**MULTI-DOCUMENT CONTEXT**

You have access to multiple assessment documents separated by document markers (═══).
Each document section includes:
- Document name
- Document type (Assessment Task, Marking Guide, etc.)
- Page numbers within that document

When citing evidence:
1. ALWAYS reference the specific document name
2. Include page numbers relative to that document
3. Format citations as: "Document: [name], Page: [number]"
4. Consider evidence across ALL documents in the validation

Example citation:
"The assessment addresses this requirement in the Assessment Task (Page 3, Question 5) 
and is supported by the Marking Guide (Page 2, Rubric criteria)."
```

### Validation Response Format with Document Citations

```json
{
  "requirementValidations": [
    {
      "requirementId": 123,
      "status": "met",
      "reasoning": "...",
      "evidenceFound": [
        {
          "document": "Assessment_Task_BSBWHS211.pdf",
          "location": "Page 3, Question 5",
          "content": "Excerpt of relevant content",
          "relevance": "This question directly tests the required knowledge"
        },
        {
          "document": "Marking_Guide_BSBWHS211.pdf",
          "location": "Page 2, Rubric",
          "content": "Assessment criteria excerpt",
          "relevance": "Marking criteria confirms knowledge assessment"
        }
      ]
    }
  ]
}
```

## Context Window Management

### Token Estimation

**Per Document**:
- Average page: ~500 tokens
- 50-page document: ~25,000 tokens
- Document markers/metadata: ~100 tokens per document

**Multi-Document Scenarios**:
- 3 documents × 50 pages = ~75,000 tokens
- Requirements JSON: ~5,000 tokens
- System prompt: ~2,000 tokens
- Response buffer: ~8,000 tokens
- **Total: ~90,000 tokens** (well within 1M limit)

**Large Document Handling** (1000+ pages):
- Still fits in 1M context window (~500K tokens)
- If needed, can chunk by requirement type
- Prioritize relevant sections based on requirement type

## Database Queries for Each Flow

### 1. Document Processing Flow
```sql
-- After Unstructured.io processing, verify elements
SELECT COUNT(*) as element_count, 
       COUNT(DISTINCT filename) as file_count
FROM elements 
WHERE url IN (:storage_paths);
```

### 2. AI Validation Flow
```sql
-- Fetch all documents with their elements
SELECT 
  d.id as document_id,
  d.file_name as document_name,
  d.document_type,
  d.storage_path,
  e.text,
  e.filename,
  e.page_number,
  e.type as element_type
FROM documents d
JOIN elements e ON e.url = d.storage_path
WHERE d.validation_detail_id = :validation_detail_id
ORDER BY d.created_at, d.file_name, e.page_number;
```

### 3. Single Requirement Revalidation
```sql
-- Same as validation flow - fetch all documents for context
SELECT 
  d.id as document_id,
  d.file_name as document_name,
  d.document_type,
  e.text,
  e.filename,
  e.page_number
FROM validation_results vr
JOIN validation_detail vd ON vd.id = vr.validation_detail_id
JOIN documents d ON d.validation_detail_id = vd.id
JOIN elements e ON e.url = d.storage_path
WHERE vr.id = :validation_result_id
ORDER BY d.file_name, e.page_number;
```

### 4. AI Chat Flow
```sql
-- Same multi-document query with document metadata
SELECT 
  d.file_name as document_name,
  d.document_type,
  e.text,
  e.page_number
FROM documents d
JOIN elements e ON e.url = d.storage_path
WHERE d.validation_detail_id = :validation_detail_id
ORDER BY d.file_name, e.page_number;
```

## Citation Storage Enhancement

### Enhanced validation_results.citations Structure

```json
{
  "citations": [
    {
      "document_id": 123,
      "document_name": "Assessment_Task_BSBWHS211.pdf",
      "document_type": "Assessment Task",
      "page_numbers": [3, 5],
      "location": "Page 3, Question 5; Page 5, Question 8",
      "content": "Relevant excerpt from the document",
      "relevance": "How this evidence supports the requirement"
    }
  ]
}
```

### Benefits
- Traceable back to specific documents
- Clear multi-document citations
- Supports UI rendering with document filters
- Enables "show me evidence" feature in Results Explorer

## UI Considerations

### Results Explorer Features

1. **Document Filter**
   - Filter validation results by document
   - Show which requirements are covered by which documents
   - Highlight cross-document validations

2. **Citation Display**
   - Click citation → open document at specific page
   - Highlight text in document viewer
   - Show all citations for a requirement

3. **Multi-Document View**
   - Side-by-side document comparison
   - Show requirement → document mapping
   - Visual indicator of document coverage

## Testing Strategy

### Test Cases

1. **Single Document Validation**
   - Upload 1 document
   - Verify correct aggregation
   - Check citations reference correct document

2. **Multi-Document Validation**
   - Upload 3 documents (Assessment Task, Marking Guide, Student Instructions)
   - Verify document separation in aggregated text
   - Check citations span multiple documents
   - Verify page numbers are document-relative

3. **Large Document Validation**
   - Upload 500-page document
   - Verify token count < 1M
   - Check performance and response time

4. **Context Isolation**
   - Create 2 validations with different documents
   - Verify no cross-contamination
   - Check elements table filtering by URL

## Implementation Checklist

- [x] Update SQL queries to include document metadata
- [x] Implement enhanced aggregation with document separators
- [x] Update AI prompts with multi-document instructions
- [x] Enhance citation format to include document references
- [ ] Update UI to display document-specific citations
- [ ] Add document filter to Results Explorer
- [ ] Implement document viewer with citation highlighting
- [ ] Add tests for multi-document scenarios

## Conclusion

The multi-document strategy maintains clear context boundaries while enabling comprehensive validation across all uploaded documents. Key principles:

1. **Clear Separation**: Document markers prevent confusion
2. **Traceable Citations**: Every evidence reference includes document name and page
3. **Efficient Context**: Single aggregated text within 1M token limit
4. **Scalable**: Handles 1000+ page documents across multiple files
5. **Isolated**: Each validation maintains its own document context via `validation_detail_id`
