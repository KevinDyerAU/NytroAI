# Schema Compatibility Reference

This document demonstrates that the split prompts v2 maintain full compatibility with the existing validation_results data structures.

## Original Combined Output Schema

The original prompts produced a single JSON output with all fields:

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string",
  "mapped_content": "string or 'N/A'",
  "citations": ["array"] or "doc_references": "string",
  "unmapped_content": "string or 'N/A'",
  "smart_question": "string" or "smart_task": "string",
  "benchmark_answer": "string",
  "recommendations": "string or 'None'"
}
```

## Split v2 Output Schemas

### Phase 1: Validation Output

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "status": "Met | Partially Met | Not Met",
  "reasoning": "string",
  "mapped_content": "string or 'N/A'",
  "citations": ["array"] or "doc_references": "string",
  "unmapped_content": "string or 'N/A'"
}
```

### Phase 2: Generation Output (conditional)

```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string" or "smart_task": "string",
  "benchmark_answer": "string",
  "recommendations": "string"
}
```

## Merging Strategy

When combining Phase 1 and Phase 2 results:

```javascript
function mergeValidationResults(phase1Result, phase2Result) {
  // Phase 2 only exists if status != "Met"
  if (!phase2Result) {
    return {
      ...phase1Result,
      smart_question: null,  // or smart_task: null
      benchmark_answer: null,
      recommendations: "None"
    };
  }
  
  return {
    ...phase1Result,
    smart_question: phase2Result.smart_question,  // or smart_task
    benchmark_answer: phase2Result.benchmark_answer,
    recommendations: phase2Result.recommendations
  };
}
```

## Database Column Mapping

| Column Name | Phase 1 | Phase 2 | Notes |
|-------------|---------|---------|-------|
| requirement_number | ✓ | ✓ | Primary identifier |
| requirement_text | ✓ | ✓ | Requirement content |
| status | ✓ | - | Met/Partially Met/Not Met |
| reasoning | ✓ | - | Validation explanation |
| mapped_content | ✓ | - | Found content references |
| citations/doc_references | ✓ | - | Document citations |
| unmapped_content | ✓ | - | Missing content |
| smart_question/smart_task | - | ✓ | Generated question/task |
| benchmark_answer | - | ✓ | Expected answer |
| recommendations | - | ✓ | Improvement suggestions |

## Requirement Type Variations

### Knowledge Evidence (KE)
- Uses `citations` (array format)
- Uses `smart_question` for generation

### Performance Evidence (PE)
- Uses `citations` (array format)
- Uses `smart_task` for generation

### Performance Criteria (PC)
- Uses `doc_references` (string format)
- Uses `smart_task` for generation

### Foundation Skills (FS)
- Uses `citations` (array format)
- Uses `smart_question` for generation

### Assessment Instructions (AI)
- Uses `doc_references` (string format)
- No generation phase (validation only)

### Learner Guide variants
- Follow same patterns as their Unit counterparts

## Backward Compatibility

The split prompts maintain 100% backward compatibility:

1. **Same field names** - All output fields use identical names
2. **Same data types** - All fields maintain their original types
3. **Same constraints** - Word limits and format requirements preserved
4. **Same status values** - "Met", "Partially Met", "Not Met"

## Implementation Notes

### When to Run Phase 2

```javascript
const shouldRunPhase2 = (phase1Result) => {
  return phase1Result.status === "Partially Met" || 
         phase1Result.status === "Not Met";
};
```

### Passing Context to Phase 2

Phase 2 prompts receive context from Phase 1:
- `{{status}}` - The validation status
- `{{unmapped_content}}` - What was found missing

This ensures generated questions/tasks address the specific gaps identified.

## Token Efficiency Comparison

| Scenario | Original | Split v2 | Savings |
|----------|----------|----------|---------|
| Status = Met | ~2000 tokens | ~1000 tokens | 50% |
| Status = Partially Met | ~2000 tokens | ~1800 tokens | 10% |
| Status = Not Met | ~2000 tokens | ~1800 tokens | 10% |

**Average savings**: ~30-40% across typical validation workloads where 50-60% of requirements are "Met".
