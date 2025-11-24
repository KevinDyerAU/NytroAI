# AI Credit Consumption Policy

## Overview

AI Credits are consumed for specific AI-powered operations in NytroAI. This document outlines which operations consume credits and which do not.

## Operations That Consume AI Credits ✅

### 1. **Smart Question Regeneration** (1 credit per request)
- **Location**: Validation results cards
- **Function**: Regenerates SMART questions and benchmark answers for a single validation requirement
- **Edge Function**: `query-document`
- **Context**: `requirement_regeneration_single_*`
- **Triggered by**: User clicking "Generate with AI" button in ValidationCard component

### 2. **Single Validation Regeneration** (1 credit per request)
- **Location**: Validation results cards  
- **Function**: Re-validates a single requirement using AI
- **Edge Function**: `query-document`
- **Context**: `regeneration_single_*`
- **Triggered by**: User clicking "Revalidate" button for individual requirement

### 3. **AI Chat Queries** (1 credit per message)
- **Location**: AI Chat interface
- **Function**: Conversational queries about assessment documents
- **Edge Function**: `query-document`
- **Context**: `chat_*`
- **Triggered by**: User sending messages in AI Chat

## Operations That DO NOT Consume AI Credits ❌

### 1. **Initial Document Upload**
- Documents are uploaded to Supabase Storage
- File Search store indexing happens in background
- **No AI credits consumed**

### 2. **Bulk Validation (Full Assessment Validation)**
- Initial validation of all requirements in an assessment
- **Function**: `validate-assessment`
- Validation credits are consumed instead (1 credit per document)
- **No AI credits consumed**

### 3. **Viewing/Browsing Content**
- Viewing validation results
- Viewing reports
- Dashboard metrics
- **No AI credits consumed**

### 4. **Report Generation**
- Generating Excel reports
- Viewing validation summaries
- **No AI credits consumed**

## Credit Management

### Checking AI Credits

```typescript
// Edge Function
const { data } = await supabase.functions.invoke('get-ai-credits', {
  body: { rtoId }
});
// Returns: { current_credits, total_credits, subscription_credits }
```

### Consuming AI Credits

AI credits are automatically consumed by the `query-document` edge function:

```typescript
// Automatic consumption in query-document function
const { data, error } = await supabase.rpc('add_ai_credits', {
  rto_code: rtoCode,
  amount: -1, // Consume 1 credit
  reason: 'AI smart_question_regen query',
});
```

### Insufficient Credits Handling

When AI credits reach 0:
- **Status Code**: 402 Payment Required
- **Error Message**: "Insufficient AI credits"
- **UI Behavior**: Shows warning message to user
- **Solution**: Purchase additional AI credits

## Credit Purchase

AI credits can be purchased through:
- **Settings → AI Credits** page
- Stripe integration for secure payment
- Various credit packages available

## Monitoring

### Dashboard Metrics
- **AI Queries Card**: Shows usage (this month / all time)
- Tracked from `gemini_operations` table
- Includes all AI operations (queries, regenerations, chat)

### Credit Balance
- Real-time display on Dashboard
- Progress bar showing usage percentage
- Alerts when running low

## Database Tables

### `ai_credits`
```sql
- rto_id: Reference to RTO
- current_credits: Available credits
- total_credits: Total allocated credits
- subscription_credits: Base credits from subscription tier
```

### `ai_credit_transactions`
```sql
- rto_id: Reference to RTO
- amount: Credits added (+) or consumed (-)
- reason: Description of transaction
- balance_after: Credit balance after transaction
- created_at: Transaction timestamp
```

### `gemini_operations`
```sql
- operation_type: Type of AI operation
- status: Operation status (processing/completed/failed)
- document_id: Related document (if applicable)
- validation_detail_id: Related validation (if applicable)
- created_at: Operation timestamp
```

## Best Practices

1. **For Bulk Operations**: Use validation credits for initial full assessment validation
2. **For Refinements**: Use AI credits for individual requirement improvements
3. **For Chat**: Use AI credits for conversational document queries
4. **Monitor Usage**: Check dashboard regularly to avoid running out of credits
5. **Purchase in Advance**: Buy AI credit packages before running large chat sessions

## API Reference

### Edge Functions

| Function | Consumes AI Credits | Purpose |
|----------|-------------------|---------|
| `query-document` | ✅ Yes (1 credit) | AI chat, smart question regen, single validation regen |
| `validate-assessment` | ❌ No (uses validation credits) | Bulk validation of all requirements |
| `upload-document` | ❌ No | Document upload and indexing |
| `get-ai-credits` | ❌ No | Check credit balance |
| `consume-ai-credit` | ⚠️ Manual | Manually consume credits (admin use) |

## Support

For issues related to AI credit consumption:
1. Check `ai_credit_transactions` table for transaction history
2. Review `gemini_operations` table for AI operation logs
3. Check edge function logs in Supabase Dashboard
4. Contact support if credits were incorrectly consumed
