# Phase 4 Preparation: Validation Prompt Optimization

## Overview

Phase 4 will focus on optimizing the validation prompts for better accuracy and efficiency. This document provides the foundation and analysis needed for that work.

---

## Current Validation Workflow

### Complete Flow

```
1. User Uploads Documents
   ↓
2. Create Validation Record (create-validation-record edge function)
   - Creates validation_summary
   - Creates validation_type  
   - Creates validation_detail
   - Generates unique namespace
   ↓
3. Upload Documents to Gemini File API
   - Documents stored with validation_detail_id
   - Each document gets file_search_store_id
   - Indexing tracked in gemini_operations table
   ↓
4. Monitor Indexing (ValidationProgressTracker)
   - Polls gemini_operations for completion
   - Shows progress to user
   ↓
5. Trigger Validation (trigger-validation edge function)
   - Checks doc_extracted = true
   - Checks file_search_store_id exists
   - Calls validate-assessment edge function
   ↓
6. Validate Assessment (validate-assessment edge function)
   - Fetches prompt from database (or uses hardcoded fallback)
   - Calls Gemini API with File Search
   - Parses validation results
   - Stores in validation_results table
   ↓
7. Update Status
   - extract_status = 'Completed'
   - Results available in dashboard
```

---

## Current Prompt Architecture

### Prompt Sources

1. **Database Prompts** (Primary)
   - Stored in `prompt` table
   - Linked to `validation_type_id`
   - Only prompts with `current = true` are used
   - Allows dynamic prompt updates without code changes

2. **Hardcoded Prompts** (Fallback)
   - Located in `supabase/functions/_shared/`
   - Used when no active database prompt exists
   - Multiple files:
     - `validation-prompts.ts` - Original prompts
     - `enhanced-validation-prompts.ts` - Enhanced versions
     - `full-unit-validation-prompt.ts` - Full unit validation
     - `learner-guide-validation-prompt.ts` - Learner guide specific

### Validation Types

Current validation types supported:

1. `knowledge_evidence` - Knowledge Evidence validation
2. `performance_evidence` - Performance Evidence validation
3. `foundation_skills` - Foundation Skills validation
4. `elements_criteria` - Elements & Performance Criteria validation
5. `assessment_conditions` - Assessment Conditions validation
6. `full_validation` - Complete unit validation (all of the above)
7. `learner_guide_validation` - Learner Guide validation

---

## Current Prompt Structure

### Key Components

Based on `validate-assessment/index.ts`:

```typescript
// 1. Fetch prompt from database (if exists and current=true)
const dbPrompt = await getPromptFromDatabase(supabase, validationTypeId);

// 2. Fallback to hardcoded prompt
const prompt = dbPrompt || getValidationPrompt(validationType, unitCode);

// 3. Call Gemini API with File Search
const result = await geminiClient.models.generateContent({
  model: 'gemini-2.0-flash-exp',
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  tools: [{
    fileSearch: {
      dynamicRetrievalConfig: {
        mode: 'MODE_DYNAMIC',
        dynamicThreshold: 0.7,
      },
    },
  }],
  toolConfig: {
    fileSearch: {
      fileSearchStoreId: fileSearchStoreId,
    },
  },
});
```

### Prompt Features

1. **File Search Integration**
   - Uses Gemini File Search API
   - Dynamic retrieval with 0.7 threshold
   - Searches across all uploaded documents

2. **Namespace Filtering**
   - Each validation session has unique namespace
   - Ensures only relevant documents are searched
   - Prevents cross-validation contamination

3. **Citation Support**
   - Gemini returns document references
   - Citations stored with validation results
   - Enables traceability

---

## Current Issues & Opportunities

### Issue 1: Single Comprehensive Prompt

**Current Approach:**
- One large prompt validates entire unit
- Includes all validation types in single call
- Generates smart questions in same prompt

**Problems:**
- Long prompts may reduce accuracy
- Harder to debug specific validation failures
- Combines validation with question generation
- Higher token usage
- Longer processing time

**Opportunity:**
- Separate validation from smart question generation
- Use individual requirement validation prompts
- Parallel processing of requirements
- Better error isolation

### Issue 2: Prompt Versioning

**Current Approach:**
- Database prompts with `current = true` flag
- No version history
- No A/B testing capability

**Opportunity:**
- Add prompt versioning
- Track performance metrics per prompt
- A/B testing framework
- Rollback capability

### Issue 3: No Prompt Performance Metrics

**Current Approach:**
- No tracking of prompt effectiveness
- No token usage monitoring
- No accuracy metrics

**Opportunity:**
- Add performance tracking
- Monitor token usage
- Track validation accuracy
- Optimize based on data

---

## Phase 4 Optimization Strategies

### Strategy 1: Separate Validation from Smart Questions

**Current:**
```
Single Prompt:
1. Validate all requirements
2. Generate smart questions
3. Generate benchmark answers
4. Provide recommendations
```

**Proposed:**
```
Validation Prompt (Fast):
1. Validate requirements only
2. Determine met/not-met/partial
3. Identify gaps

Smart Question Prompt (On-Demand):
1. Generate questions only when needed
2. Run separately after validation
3. User can trigger manually
```

**Benefits:**
- Faster validation
- Lower token usage
- Better accuracy (focused prompts)
- Questions generated only when needed

### Strategy 2: Individual Requirement Validation

**Current:**
```
One prompt validates all requirements at once
```

**Proposed:**
```
For each requirement:
  - Focused prompt
  - Specific validation criteria
  - Parallel processing
  - Better error handling
```

**Benefits:**
- Higher accuracy per requirement
- Parallel processing (faster)
- Better error isolation
- Easier debugging

### Strategy 3: Prompt Optimization

**Areas to Optimize:**

1. **Prompt Length**
   - Remove redundant instructions
   - Use more concise language
   - Focus on essential criteria

2. **Prompt Structure**
   - Clear sections
   - Numbered steps
   - Explicit output format

3. **Context Relevance**
   - Only include relevant validation criteria
   - Remove generic instructions
   - Add specific examples

4. **Output Format**
   - Structured JSON output
   - Consistent schema
   - Easy parsing

### Strategy 4: Prompt Performance Tracking

**Metrics to Track:**

1. **Accuracy Metrics**
   - Validation correctness
   - False positive rate
   - False negative rate

2. **Performance Metrics**
   - Token usage
   - Processing time
   - API call count

3. **User Metrics**
   - User corrections
   - Validation overrides
   - Satisfaction ratings

---

## Recommended Phase 4 Approach

### Phase 4.1: Analysis & Baseline

1. **Review Current Prompts**
   - Analyze all hardcoded prompts
   - Review database prompts
   - Identify redundancies

2. **Establish Baseline**
   - Current token usage
   - Current processing time
   - Current accuracy (if measurable)

3. **Define Success Criteria**
   - Target token reduction
   - Target speed improvement
   - Target accuracy improvement

### Phase 4.2: Separate Validation & Questions

1. **Create Validation-Only Prompts**
   - Remove smart question generation
   - Focus on requirement validation
   - Optimize for speed and accuracy

2. **Create Smart Question Prompts**
   - Separate prompts for question generation
   - On-demand execution
   - User-triggered or automatic

3. **Update Edge Functions**
   - Modify validate-assessment
   - Create generate-smart-questions
   - Update database schema if needed

### Phase 4.3: Optimize Prompts

1. **Reduce Prompt Length**
   - Remove redundancy
   - Concise instructions
   - Essential criteria only

2. **Improve Structure**
   - Clear sections
   - Explicit format
   - Examples where helpful

3. **Test & Iterate**
   - A/B testing
   - Compare results
   - Refine based on data

### Phase 4.4: Add Performance Tracking

1. **Create Metrics Tables**
   - prompt_performance
   - validation_metrics
   - token_usage_log

2. **Add Tracking Code**
   - Log token usage
   - Track processing time
   - Record accuracy metrics

3. **Create Dashboard**
   - Visualize metrics
   - Compare prompts
   - Identify optimization opportunities

---

## Database Schema Additions for Phase 4

### prompt_version Table

```sql
CREATE TABLE prompt_version (
  id BIGSERIAL PRIMARY KEY,
  validation_type_id BIGINT REFERENCES validation_type(id),
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(validation_type_id, version)
);
```

### prompt_performance Table

```sql
CREATE TABLE prompt_performance (
  id BIGSERIAL PRIMARY KEY,
  prompt_version_id BIGINT REFERENCES prompt_version(id),
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  token_count INTEGER,
  processing_time_ms INTEGER,
  accuracy_score DECIMAL(3,2),
  user_corrections INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### validation_metrics Table

```sql
CREATE TABLE validation_metrics (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT REFERENCES validation_detail(id),
  total_requirements INTEGER,
  met_count INTEGER,
  not_met_count INTEGER,
  partial_count INTEGER,
  total_token_usage INTEGER,
  total_processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Edge Functions for Phase 4

### New Functions Needed

1. **`validate-requirements-batch`**
   - Validates multiple requirements in parallel
   - Uses focused prompts per requirement
   - Returns structured results

2. **`generate-smart-questions`**
   - Separate from validation
   - On-demand execution
   - Focused on question generation only

3. **`track-prompt-performance`**
   - Logs metrics
   - Updates performance tables
   - Calculates accuracy scores

### Modified Functions

1. **`validate-assessment`**
   - Remove smart question generation
   - Focus on validation only
   - Add performance tracking
   - Support new prompt structure

2. **`trigger-validation`**
   - Call new validation functions
   - Handle parallel processing
   - Track overall metrics

---

## Testing Strategy for Phase 4

### Unit Tests

1. **Prompt Parsing**
   - Test output parsing
   - Handle malformed responses
   - Validate schema compliance

2. **Performance Tracking**
   - Test metrics collection
   - Verify accuracy calculations
   - Check database inserts

### Integration Tests

1. **End-to-End Validation**
   - Upload documents
   - Trigger validation
   - Verify results
   - Check performance metrics

2. **Prompt Comparison**
   - Run same validation with different prompts
   - Compare results
   - Measure performance differences

### A/B Testing

1. **Prompt Variants**
   - Create multiple prompt versions
   - Randomly assign to validations
   - Compare performance
   - Select best performer

---

## Success Criteria for Phase 4

### Performance Improvements

- [ ] 30% reduction in token usage
- [ ] 40% reduction in processing time
- [ ] Maintain or improve accuracy

### Feature Improvements

- [ ] Validation separated from smart questions
- [ ] Smart questions generated on-demand
- [ ] Individual requirement validation available
- [ ] Prompt versioning implemented

### Tracking & Monitoring

- [ ] Token usage tracked per validation
- [ ] Processing time logged
- [ ] Accuracy metrics calculated
- [ ] Performance dashboard created

---

## Files to Review in Phase 4

### Prompt Files

- `supabase/functions/_shared/validation-prompts.ts`
- `supabase/functions/_shared/enhanced-validation-prompts.ts`
- `supabase/functions/_shared/full-unit-validation-prompt.ts`
- `supabase/functions/_shared/learner-guide-validation-prompt.ts`

### Edge Functions

- `supabase/functions/validate-assessment/index.ts`
- `supabase/functions/trigger-validation/index.ts`

### Frontend Components

- `src/components/Dashboard.tsx` - Validation trigger
- `src/components/ResultsExplorer.tsx` - Results display
- `src/services/ValidationWorkflowService.ts` - Workflow management

---

## Next Steps

1. **Complete Phase 3.3** - Fix validation kickoff issues
2. **Test End-to-End** - Verify validation works
3. **Baseline Metrics** - Measure current performance
4. **Start Phase 4.1** - Analyze current prompts
5. **Implement Phase 4.2** - Separate validation & questions
6. **Optimize Phase 4.3** - Improve prompt efficiency
7. **Track Phase 4.4** - Add performance monitoring

---

## Conclusion

Phase 3.3 has fixed the critical validation kickoff issues (column name mismatches). The system is now ready for Phase 4 prompt optimization, which will focus on:

1. **Separating validation from smart question generation**
2. **Optimizing prompt structure and length**
3. **Adding performance tracking**
4. **Implementing prompt versioning**

This will result in faster, more accurate, and more maintainable validation processes.
