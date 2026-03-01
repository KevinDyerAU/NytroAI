# Split Validation Prompts v2

This directory contains the refactored validation prompts that split the validation logic from smart question/task generation into two phases.

## Architecture Overview

### Phase 1: Validation Only
Located in `/validation/` directory. These prompts focus solely on determining validation status.

**Output Structure:**
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

### Phase 2: Generation (Conditional)
Located in `/generation/` directory. These prompts are **only triggered when status is "Partially Met" or "Not Met"**.

**Output Structure:**
```json
{
  "requirement_number": "string",
  "requirement_text": "string",
  "smart_question": "string" or "smart_task": "string",
  "benchmark_answer": "string",
  "recommendations": "string"
}
```

## Prompt Files

### Validation Prompts (Phase 1)
| File | Purpose |
|------|---------|
| `performance_criteria_validation.md` | Validate PC against Unit assessment documents |
| `knowledge_evidence_validation.md` | Validate KE against Unit assessment documents |
| `performance_evidence_validation.md` | Validate PE against Unit assessment documents |
| `foundation_skills_validation.md` | Validate FS against Unit assessment documents |
| `assessment_instructions_validation.md` | Validate AI against Unit assessment documents |
| `learner_guide_knowledge_validation.md` | Validate KE against Learner Guide documents |
| `learner_guide_performance_validation.md` | Validate PE against Learner Guide documents |
| `learner_guide_performance_criteria_validation.md` | Validate PC against Learner Guide documents |

### Generation Prompts (Phase 2)
| File | Purpose |
|------|---------|
| `performance_criteria_generation.md` | Generate smart task + benchmark for PC |
| `knowledge_evidence_generation.md` | Generate smart question + benchmark for KE |
| `performance_evidence_generation.md` | Generate smart task + benchmark for PE |
| `foundation_skills_generation.md` | Generate smart question + benchmark for FS |
| `learner_guide_knowledge_generation.md` | Generate smart question + benchmark for LG KE |
| `learner_guide_performance_generation.md` | Generate smart question + benchmark for LG PE |
| `learner_guide_performance_criteria_generation.md` | Generate smart question + benchmark for LG PC |

## Benefits

1. **Efficiency**: Phase 2 only runs when needed (status != "Met")
2. **Simplicity**: Each prompt has a single, focused purpose
3. **Token Savings**: ~50% reduction in prompt size per call
4. **Maintainability**: Easier to update validation logic or generation logic independently
5. **Flexibility**: Can adjust generation logic without affecting validation accuracy

## Usage Flow

```
┌─────────────────────┐
│  Phase 1: Validate  │
│  (Always runs)      │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Status = Met │──────► Done (no generation needed)
    └──────────────┘
           │ No
           ▼
┌─────────────────────┐
│ Phase 2: Generate   │
│ (Only if needed)    │
└─────────────────────┘
           │
           ▼
    Merge Results
```

## Template Variables

### Phase 1 Variables
- `{{requirement_number}}` - The requirement identifier
- `{{requirement_text}}` - The requirement text
- `{{element_text}}` - Element text (for Performance Criteria only)

### Phase 2 Variables (in addition to Phase 1)
- `{{status}}` - Validation status from Phase 1
- `{{unmapped_content}}` - Unmapped content from Phase 1 (provides context for generation)

## Combining Results

When merging Phase 1 and Phase 2 results, the final output maintains the same structure as the original prompts:

```json
{
  "requirement_number": "from Phase 1",
  "requirement_text": "from Phase 1",
  "status": "from Phase 1",
  "reasoning": "from Phase 1",
  "mapped_content": "from Phase 1",
  "citations": "from Phase 1",
  "unmapped_content": "from Phase 1",
  "smart_question": "from Phase 2 (if applicable)",
  "benchmark_answer": "from Phase 2 (if applicable)",
  "recommendations": "from Phase 2 (if applicable)"
}
```

## Compatibility

These prompts are designed to be compatible with:
- GPT models (GPT-4, GPT-4-turbo, GPT-4o)
- Google models (Gemini Pro, Gemini Flash)
- Claude models
- Other OpenAI-compatible APIs
