# Individual Validation Architecture

## Design Decision: Individual > Batch

**Priority**: Accuracy > Speed > Cost

**Rationale**:
- Legacy system proves individual validation works
- No risk of cross-contamination between requirements
- Clear, focused reasoning per requirement
- Easy to debug and verify
- Modern context windows still allow all documents in each call

---

## Architecture Overview

```
UI Trigger
  ↓
n8n Webhook (AIValidationFlow_Individual)
  ↓
Get Requirements (Edge Function) → Returns 50 requirements
  ↓
Loop: For Each Requirement (with rate limiting)
  ├─ Check Rate Limit (delay if needed)
  ├─ Fetch Prompt Template
  ├─ Build Request (ALL documents + ONE requirement)
  ├─ Call Gemini API (with retry logic)
  ├─ Parse Response + Extract Citations
  ├─ Save to validation_results
  ├─ Update Progress (WebSocket/Database)
  └─ Handle Errors (log, continue)
  ↓
Update Validation Detail (aggregate counts)
  ↓
Trigger Report Generation
  ↓
Respond Success
```

---

## Rate Limiting Strategy

### Gemini API Limits

**Gemini 2.0 Flash (Free Tier)**:
- 15 RPM (requests per minute)
- 1M TPM (tokens per minute)
- 1,500 RPD (requests per day)

**Gemini 2.0 Flash (Paid Tier)**:
- 1,000 RPM
- 4M TPM
- No daily limit

### Implementation

**For Free Tier** (15 RPM):
```
Delay between requests: 4 seconds (15 requests / 60 seconds)
50 requirements × 4 seconds = 200 seconds (~3.3 minutes)
```

**For Paid Tier** (1,000 RPM):
```
Delay between requests: 0.06 seconds (negligible)
50 requirements × 2 seconds per call = 100 seconds (~1.7 minutes)
```

### n8n Implementation

**Node**: "Rate Limit Delay"
```javascript
// Calculate delay based on tier
const tier = $env.GEMINI_TIER || 'free';  // 'free' or 'paid'
const rpm = tier === 'paid' ? 1000 : 15;
const delayMs = (60 / rpm) * 1000;

// Add jitter to prevent thundering herd
const jitter = Math.random() * 1000;
const totalDelay = delayMs + jitter;

// Sleep
await new Promise(resolve => setTimeout(resolve, totalDelay));

return {
  json: {
    delayed_ms: totalDelay,
    tier,
    rpm
  }
};
```

---

## Retry Logic

### Exponential Backoff

**Strategy**:
1. Initial attempt
2. If 429 (rate limit) or 503 (service unavailable):
   - Wait: 2^attempt seconds (2s, 4s, 8s, 16s, 32s)
   - Max attempts: 5
   - Max wait: 32 seconds
3. If other error:
   - Log error
   - Mark requirement as "error"
   - Continue to next requirement

### n8n Implementation

**Node**: "Call Gemini with Retry"
```javascript
const maxAttempts = 5;
let attempt = 0;
let lastError = null;

while (attempt < maxAttempts) {
  try {
    attempt++;
    
    // Make API call
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    
    // Success
    if (response.ok) {
      return await response.json();
    }
    
    // Rate limit or service error - retry
    if (response.status === 429 || response.status === 503) {
      const waitSeconds = Math.pow(2, attempt);
      console.log(`Attempt ${attempt} failed with ${response.status}, waiting ${waitSeconds}s`);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }
    
    // Other error - don't retry
    throw new Error(`API error: ${response.status} ${response.statusText}`);
    
  } catch (error) {
    lastError = error;
    if (attempt >= maxAttempts) {
      throw error;
    }
  }
}

throw lastError;
```

---

## Multi-User Support

### Queue System

**Problem**: Multiple users triggering validations simultaneously could hit rate limits.

**Solution**: Use database-backed queue with locking.

### Implementation

**Table**: `validation_queue`
```sql
CREATE TABLE validation_queue (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT NOT NULL REFERENCES validation_detail(id),
  requirement_id BIGINT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(validation_detail_id, requirement_id)
);

CREATE INDEX idx_queue_status ON validation_queue(status, created_at);
```

**Workflow**:
1. **Enqueue**: Insert all requirements into queue with status='pending'
2. **Process**: n8n workflow picks up pending items (with SKIP LOCKED)
3. **Update**: Mark as 'processing', then 'completed' or 'failed'
4. **Retry**: Failed items can be retried (check attempt_count)

**n8n Node**: "Get Next Requirement"
```sql
UPDATE validation_queue
SET status = 'processing',
    started_at = NOW(),
    attempt_count = attempt_count + 1
WHERE id = (
  SELECT id
  FROM validation_queue
  WHERE status = 'pending'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

---

## Real-Time Progress Tracking

### Option 1: Database Polling (Simple)

**UI polls validation_detail every 2 seconds**:
```sql
SELECT 
  validation_count,
  validation_total,
  validation_progress,
  validation_status
FROM validation_detail
WHERE id = $1;
```

**Pros**:
- ✅ Simple to implement
- ✅ No additional infrastructure

**Cons**:
- ❌ Not truly real-time (2s delay)
- ❌ Extra database load

### Option 2: Supabase Realtime (Recommended)

**Subscribe to validation_detail changes**:
```typescript
const channel = supabase
  .channel('validation-progress')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'validation_detail',
      filter: `id=eq.${validationDetailId}`
    },
    (payload) => {
      // Update UI with new progress
      setProgress(payload.new.validation_progress);
      setStatus(payload.new.validation_status);
    }
  )
  .subscribe();
```

**Pros**:
- ✅ True real-time updates
- ✅ No polling overhead
- ✅ Built into Supabase

**Cons**:
- ⚠️ Requires Supabase Realtime enabled

### Option 3: n8n Webhook Callbacks

**n8n calls UI webhook after each requirement**:
```javascript
// In n8n workflow after saving result
await fetch(`${UI_URL}/api/validation-progress`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    validation_detail_id,
    requirement_number,
    status: 'completed',
    progress: (completed / total) * 100
  })
});
```

**Pros**:
- ✅ Immediate updates
- ✅ Can include detailed info

**Cons**:
- ❌ Requires UI endpoint
- ❌ Extra network calls

**Recommendation**: Use **Option 2 (Supabase Realtime)** for simplicity and performance.

---

## Progress Tracking Implementation

### Update validation_detail After Each Requirement

**n8n Node**: "Update Progress"
```sql
UPDATE validation_detail
SET 
  validation_count = validation_count + 1,
  validation_progress = (validation_count::numeric / validation_total::numeric) * 100,
  validation_status = CASE
    WHEN validation_count >= validation_total THEN 'completed'
    ELSE 'processing'
  END,
  updated_at = NOW()
WHERE id = $1
RETURNING *;
```

### UI Display

```typescript
// Subscribe to progress
useEffect(() => {
  const channel = supabase
    .channel('validation-progress')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'validation_detail',
      filter: `id=eq.${validationDetailId}`
    }, (payload) => {
      setProgress(payload.new.validation_progress);
      setCount(payload.new.validation_count);
      setTotal(payload.new.validation_total);
      setStatus(payload.new.validation_status);
    })
    .subscribe();
  
  return () => {
    channel.unsubscribe();
  };
}, [validationDetailId]);

// Render
<ProgressBar value={progress} max={100} />
<Text>{count} / {total} requirements validated</Text>
<Text>Status: {status}</Text>
```

---

## Error Handling

### Requirement-Level Errors

**Strategy**: Continue processing even if individual requirements fail.

**Implementation**:
```javascript
try {
  // Validate requirement
  const result = await validateRequirement(requirement);
  
  // Save success
  await saveValidationResult(result);
  
} catch (error) {
  console.error(`Failed to validate ${requirement.number}:`, error);
  
  // Save error result
  await saveValidationResult({
    requirement_id: requirement.id,
    requirement_number: requirement.number,
    requirement_text: requirement.text,
    status: 'error',
    reasoning: `Validation failed: ${error.message}`,
    metadata: {
      error: error.message,
      error_type: error.name,
      timestamp: new Date().toISOString()
    }
  });
  
  // Continue to next requirement
}
```

### Validation-Level Errors

**Strategy**: If too many requirements fail, mark entire validation as failed.

**Implementation**:
```javascript
const errorThreshold = 0.1;  // 10% error rate acceptable

const totalRequirements = requirements.length;
const errorCount = results.filter(r => r.status === 'error').length;
const errorRate = errorCount / totalRequirements;

if (errorRate > errorThreshold) {
  await updateValidationDetail({
    id: validationDetailId,
    validation_status: 'failed',
    error_message: `Too many errors: ${errorCount}/${totalRequirements} requirements failed`
  });
} else {
  await updateValidationDetail({
    id: validationDetailId,
    validation_status: 'completed'
  });
}
```

---

## Performance Estimates

### Free Tier (15 RPM)

| Metric | Value |
|--------|-------|
| Requirements | 50 |
| Delay per request | 4 seconds |
| API call time | 2 seconds |
| Total time per requirement | 6 seconds |
| **Total validation time** | **5 minutes** |
| Token usage | ~350K tokens |
| **Cost** | **~$0.50** |

### Paid Tier (1,000 RPM)

| Metric | Value |
|--------|-------|
| Requirements | 50 |
| Delay per request | 0.06 seconds |
| API call time | 2 seconds |
| Total time per requirement | 2.06 seconds |
| **Total validation time** | **1.7 minutes** |
| Token usage | ~350K tokens |
| **Cost** | **~$0.50** |

---

## Workflow Structure

### AIValidationFlow_Individual.json

**Nodes** (20 total):

1. **Webhook - Start Validation**
2. **Fetch Validation Context**
3. **Fetch Documents** (gemini_file_uri)
4. **Get Requirements** (Edge Function)
5. **Initialize Validation Detail** (set total count)
6. **Loop: For Each Requirement**
   - 7. **Check Rate Limit** (calculate delay)
   - 8. **Rate Limit Delay** (sleep)
   - 9. **Fetch Prompt Template**
   - 10. **Build Gemini Request**
   - 11. **Call Gemini API** (with retry)
   - 12. **Parse Response**
   - 13. **Extract Citations**
   - 14. **Save Validation Result**
   - 15. **Update Progress**
   - 16. **Handle Error** (if failed)
17. **Aggregate Results**
18. **Update Final Status**
19. **Trigger Report Generation**
20. **Respond Success**

---

## Database Schema

### No changes needed!

The existing `validation_results` table already supports individual validation:

```sql
CREATE TABLE IF NOT EXISTS validation_results (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_number TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  status TEXT NOT NULL,
  reasoning TEXT,
  citations JSONB DEFAULT '[]'::jsonb,
  smart_questions JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Optional: Add validation_queue table

For advanced multi-user support (can be added later if needed).

---

## Prompt Structure

### Individual Validation Prompt

```
You are validating a single requirement against assessment documents.

Requirement to validate:
Type: {{requirement_type}}
Number: {{requirement_number}}
Text: {{requirement_text}}

Documents provided:
{{#each documents}}
- {{this.filename}} ({{this.gemini_file_uri}})
{{/each}}

Provide a detailed validation including:
1. Status: Met, Partially Met, or Not Met
2. Reasoning: Explain your assessment
3. Mapped Content: What in the documents addresses this requirement
4. Unmapped Content: What's missing (if not Met)
5. Recommendations: How to address gaps
6. Smart Question: Generate an assessment question for this requirement
7. Benchmark Answer: Expected learner response
8. Document References: Specific pages and sections

Be thorough and cite specific evidence from the documents.
```

---

## Next Steps

1. ✅ Create prompts table migration
2. ✅ Seed individual validation prompts
3. ✅ Create AIValidationFlow_Individual.json
4. ✅ Test with TLIF0006 (small sample first)
5. ✅ Verify accuracy vs legacy
6. ✅ Test rate limiting
7. ✅ Test multi-user scenario
8. ✅ Create report generation
9. ✅ Create comprehensive PR

---

## Success Criteria

✅ **Accuracy**:
- Individual requirement validation
- Clear, focused reasoning
- Accurate citations
- Quality smart questions

✅ **Reliability**:
- Handles rate limits gracefully
- Retries failed requests
- Continues on individual errors
- Completes even with partial failures

✅ **Performance**:
- Free tier: ~5 minutes for 50 requirements
- Paid tier: ~1.7 minutes for 50 requirements
- Real-time progress updates
- Multi-user support

✅ **Cost**:
- ~$0.50 per validation (50 requirements)
- Acceptable for quality results
- Predictable and scalable
