# Phase 3.1: Dashboard Status Consistency Analysis

## Current Issues

### 1. Inconsistent Status Tracking

The current dashboard relies on multiple disconnected fields to determine validation status:

**Fields Used:**
- `extract_status` - Text field with values like 'pending', 'DocumentProcessing', 'ProcessingInBackground', 'Failed'
- `doc_extracted` - Boolean flag
- `req_extracted` - Boolean flag  
- `num_of_req` - Count of validated requirements (unclear source)
- `req_total` - Total requirements count
- `completed_count` - Another count field (inconsistent with num_of_req)

**Problems:**
- Multiple count fields (`num_of_req` vs `completed_count`) that may not match
- `extract_status` is a free-text field with no enum constraint
- No direct link to actual validation results in `validation_results` table
- Status is calculated on-the-fly using complex logic in `getValidationStage()`
- Polling every 5 seconds as fallback (inefficient)
- Real-time subscription exists but doesn't leverage new schema

### 2. Status Calculation Logic Issues

Current logic in `getValidationStage()`:

```typescript
export function getValidationStage(
  extractStatus: string,
  docExtracted: boolean,
  reqExtracted: boolean,
  numOfReq: number,
  reqTotal: number
): ValidationStage {
  // Stage 4: Fully validated
  if (numOfReq === reqTotal && reqTotal > 0) {
    return 'validated';
  }

  // Stage 3: Documents extracted
  if (docExtracted) {
    return 'documents';
  }

  // Stage 2: Document Processing
  if (extractStatus === 'DocumentProcessing') {
    return 'requirements';
  }

  // Stage 1: Pending
  return 'pending';
}
```

**Issues:**
- Relies on `numOfReq` which is not automatically updated
- No validation that `numOfReq` matches actual records in `validation_results`
- `docExtracted` flag may not reflect actual document processing status
- No error state handling
- No partial completion tracking

### 3. Real-time Updates Not Leveraging New Schema

Current subscription:

```typescript
const subscription = supabase
  .channel('validation_detail_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'validation_detail',
  }, (payload) => {
    // Just reloads everything
    loadActiveValidations();
  })
  .subscribe();
```

**Problems:**
- Doesn't subscribe to `validation_results` table
- Reloads entire validation list on any change
- No granular updates for individual validation progress
- Doesn't track when validation results are inserted

## Proposed Solutions

### 1. Add Computed Columns to validation_detail

Add database-level computed fields that automatically stay in sync:

```sql
ALTER TABLE validation_detail
ADD COLUMN IF NOT EXISTS validation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_progress DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';
```

### 2. Create Database Trigger for Auto-Updates

Create trigger that updates `validation_detail` when `validation_results` changes:

```sql
CREATE OR REPLACE FUNCTION update_validation_detail_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update counts and progress for the affected validation_detail
  UPDATE validation_detail vd
  SET 
    validation_count = (
      SELECT COUNT(*) 
      FROM validation_results vr 
      WHERE vr.validation_detail_id = vd.id
    ),
    validation_progress = (
      SELECT 
        CASE 
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status = 'met')::DECIMAL / COUNT(*)) * 100, 2)
        END
      FROM validation_results vr 
      WHERE vr.validation_detail_id = vd.id
    ),
    validation_status = (
      SELECT 
        CASE
          WHEN COUNT(*) = 0 THEN 'pending'
          WHEN COUNT(*) FILTER (WHERE status = 'not-met') > 0 THEN 'partial'
          WHEN COUNT(*) = COUNT(*) FILTER (WHERE status = 'met') THEN 'completed'
          ELSE 'in_progress'
        END
      FROM validation_results vr 
      WHERE vr.validation_detail_id = vd.id
    )
  WHERE vd.id = COALESCE(NEW.validation_detail_id, OLD.validation_detail_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validation_results_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON validation_results
FOR EACH ROW
EXECUTE FUNCTION update_validation_detail_counts();
```

### 3. Enhanced Real-time Subscriptions

Subscribe to both tables with granular updates:

```typescript
// Subscribe to validation_detail for status changes
const detailSubscription = supabase
  .channel(`validation-detail-${rtoCode}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'validation_detail',
    filter: `rto_code=eq.${rtoCode}`,
  }, (payload) => {
    // Update specific validation in state
    updateValidationInState(payload.new);
  })
  .subscribe();

// Subscribe to validation_results for progress updates
const resultsSubscription = supabase
  .channel(`validation-results-${rtoCode}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'validation_results',
  }, (payload) => {
    // Update progress for affected validation
    const validationDetailId = payload.new.validation_detail_id;
    refreshValidationProgress(validationDetailId);
  })
  .subscribe();
```

### 4. Standardized Status Enum

Replace free-text `extract_status` with proper enum:

```sql
CREATE TYPE validation_status_enum AS ENUM (
  'pending',
  'uploading',
  'processing_documents',
  'extracting_requirements',
  'validating',
  'completed',
  'failed',
  'cancelled'
);

ALTER TABLE validation_detail
ALTER COLUMN extract_status TYPE validation_status_enum
USING extract_status::validation_status_enum;
```

### 5. Dashboard Status Component

Create dedicated status component with live updates:

```typescript
interface ValidationStatusProps {
  validationId: number;
  showProgress?: boolean;
}

export function ValidationStatus({ validationId, showProgress }: ValidationStatusProps) {
  const [status, setStatus] = useState<ValidationDetail | null>(null);
  
  useEffect(() => {
    // Fetch initial status
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('validation_detail')
        .select('*, validation_results(count)')
        .eq('id', validationId)
        .single();
      setStatus(data);
    };
    
    fetchStatus();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`validation-${validationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'validation_detail',
        filter: `id=eq.${validationId}`,
      }, (payload) => {
        setStatus(payload.new);
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [validationId]);
  
  return (
    <div>
      <StatusBadge status={status?.validation_status} />
      {showProgress && (
        <Progress 
          value={status?.validation_progress || 0} 
          max={100} 
        />
      )}
      <span>{status?.validation_count || 0} / {status?.validation_total || 0}</span>
    </div>
  );
}
```

## Benefits of Proposed Solution

### 1. Automatic Consistency
- Database triggers ensure counts are always accurate
- No manual updates needed in application code
- Single source of truth

### 2. Real-time Accuracy
- Status updates immediately when validation results are inserted
- Dashboard reflects current state without polling
- Granular updates instead of full reloads

### 3. Performance
- Computed columns are indexed and fast to query
- No complex joins needed in application code
- Reduced database queries

### 4. Maintainability
- Status logic centralized in database
- Enum constraints prevent invalid states
- Clear status progression

### 5. User Experience
- Instant feedback on validation progress
- Accurate completion percentages
- No stale data

## Implementation Plan

### Phase 3.1.1: Database Schema Updates
1. Add computed columns to `validation_detail`
2. Create database trigger for auto-updates
3. Add status enum type
4. Create indexes for performance

### Phase 3.1.2: Backend Updates
1. Update edge functions to set proper status values
2. Remove manual count updates
3. Rely on database triggers

### Phase 3.1.3: Frontend Updates
1. Create `ValidationStatus` component
2. Update dashboard to use new status fields
3. Implement granular real-time subscriptions
4. Remove polling fallback

### Phase 3.1.4: Testing
1. Test trigger updates work correctly
2. Test real-time subscriptions
3. Verify status accuracy
4. Performance testing

## Migration Strategy

### Step 1: Add New Columns (Non-breaking)
```sql
ALTER TABLE validation_detail
ADD COLUMN IF NOT EXISTS validation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_progress DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS validation_status_new TEXT DEFAULT 'pending';
```

### Step 2: Backfill Data
```sql
UPDATE validation_detail vd
SET 
  validation_count = (
    SELECT COUNT(*) 
    FROM validation_results vr 
    WHERE vr.validation_detail_id = vd.id
  ),
  validation_total = (
    SELECT COUNT(*) 
    FROM validation_results vr 
    WHERE vr.validation_detail_id = vd.id
  );
```

### Step 3: Install Trigger
```sql
CREATE TRIGGER validation_results_update_trigger...
```

### Step 4: Update Frontend
- Use new columns alongside old ones
- Verify accuracy

### Step 5: Remove Old Fields (After Verification)
```sql
ALTER TABLE validation_detail
DROP COLUMN num_of_req,
DROP COLUMN completed_count;
```

## Success Metrics

- [ ] Status updates within 1 second of validation result insertion
- [ ] No polling required for status updates
- [ ] 100% accuracy between validation_count and actual records
- [ ] Dashboard shows real-time progress
- [ ] No stale data in UI
- [ ] Reduced database queries by 80%

## Next Steps

1. Review and approve this analysis
2. Create database migration scripts
3. Implement database triggers
4. Update frontend components
5. Test thoroughly
6. Deploy to production
