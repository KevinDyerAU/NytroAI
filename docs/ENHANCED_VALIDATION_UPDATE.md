# Trigger Validation Unified - Enhanced Update Summary

## Overview

Updated the `trigger-validation-unified` Edge Function to replicate the n8n "AI Validation Flow - Enhanced (Individual + Session Context)" logic.

## Key Changes Made

### 1. `supabase/functions/trigger-validation-unified/index.ts`

Complete rewrite to match n8n enhanced flow:

#### New Features:
- **Per-Requirement Validation**: Loops over each requirement individually instead of batching
- **DB-Driven Prompts**: Fetches prompt templates from `prompts` table based on `requirement_type` and `document_type`
- **Session Context**: Builds session context header with validation session info
- **Template Variable Replacement**: Replaces `{{requirement_number}}`, `{{requirement_text}}`, etc.
- **Saves to `validation_results`**: Uses the same table as n8n (not legacy tables)
- **Progress Tracking**: Updates `validation_count` and `validation_progress` in real-time

#### Prompt Fetch Query:
```sql
SELECT * FROM prompts 
WHERE prompt_type = 'validation'
  AND requirement_type = '{{ requirement_type }}'
  AND document_type = '{{ document_type }}'
  AND is_active = true
  AND is_default = true
LIMIT 1
```

#### Session Context Format:
```
**VALIDATION SESSION CONTEXT**
────────────────────────────────────────────────────────────────────
Session ID: {id}
Session Created: {date}
Unit Code: {unit_code}
RTO Code: {rto_code}
Requirement Type: {requirement_type}
Requirement {current} of {total}
────────────────────────────────────────────────────────────────────
```

### 2. `supabase/functions/_shared/ai-provider.ts`

Extended `ValidationRequest` interface:
```typescript
export interface ValidationRequest {
  prompt: string;
  documentContent?: string;
  fileSearchStoreName?: string;
  systemInstruction?: string;      // NEW: From DB prompts
  outputSchema?: any;               // NEW: From DB prompts
  generationConfig?: {              // NEW: From DB prompts
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}
```

### 3. `supabase/functions/_shared/gemini.ts`

Added new method `generateContentWithFileSearchEnhanced()`:
- Supports system instruction from DB
- Supports output schema from DB  
- Supports generation config from DB
- Matches n8n workflow behavior

## Validation Flow Comparison

| Aspect | Before | After (Enhanced) |
|--------|--------|------------------|
| Prompt Source | Hardcoded in code | DB `prompts` table |
| Processing | Batch all requirements | Per-requirement loop |
| Session Context | None | Full session header |
| Template Variables | None | `{{requirement_number}}`, etc. |
| Output Storage | Legacy validation tables | `validation_results` table |
| Progress Tracking | None | Real-time updates |

## Database Tables Used

### Input:
- `prompts` - Fetches prompt templates
- `validation_detail` - Gets validation context
- `documents` - Gets uploaded documents
- `UnitOfCompetency` - Gets requirements

### Output:
- `validation_results` - Stores validation results (same as n8n)
- `validation_detail` - Updates progress and status

## Environment Variables

The Edge Function respects these environment variables:

| Variable | Values | Description |
|----------|--------|-------------|
| `AI_PROVIDER` | `azure` \| `google` | Which AI provider to use |
| `ORCHESTRATION_MODE` | `direct` \| `n8n` | Direct validation or n8n webhook |
| `AZURE_OPENAI_ENDPOINT` | URL | Azure OpenAI endpoint |
| `AZURE_OPENAI_KEY` | Key | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Name | Azure deployment name |
| `GEMINI_API_KEY` | Key | Google Gemini API key |

## Testing

To test the enhanced validation:

1. Ensure prompts exist in DB for each requirement type:
   - `knowledge_evidence` / `unit`
   - `knowledge_evidence` / `learner_guide`
   - `performance_evidence` / `unit`
   - `performance_evidence` / `learner_guide`
   - `foundation_skills` / `unit`
   - `elements_performance_criteria` / `unit`
   - `elements_performance_criteria` / `learner_guide`
   - `assessment_conditions` / `unit`

2. Deploy the Edge Function:
   ```bash
   supabase functions deploy trigger-validation-unified
   ```

3. Trigger validation via the frontend or API:
   ```typescript
   const { data, error } = await supabase.functions.invoke('trigger-validation-unified', {
     body: { validationDetailId: 123 }
   });
   ```

## Next Steps

1. **Deploy Edge Functions** to Supabase
2. **Test** with a sample validation
3. **Verify** results in `validation_results` table
4. **Compare** output with n8n workflow output
