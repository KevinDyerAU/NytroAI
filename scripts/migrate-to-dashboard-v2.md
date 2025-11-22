# Migrating to Dashboard_v2 - Quick Guide

## Current Status

**Old Dashboard:** Currently in use at `src/pages/dashboard.tsx` (line 3)  
**New Dashboard_v2:** Ready at `src/components/Dashboard_v2.tsx`

## Interface Differences

### Old Dashboard Props
```typescript
interface DashboardProps {
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  creditsRefreshTrigger?: number;
  showValidationSuccess?: boolean;        // ❌ Not in v2
  onValidationSuccessClose?: () => void; // ❌ Not in v2
}
```

### New Dashboard_v2 Props
```typescript
interface DashboardProps {
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  creditsRefreshTrigger?: number;
  // Removed success dialog props - handled differently in v2
}
```

## Migration Steps

### Option 1: Simple Swap (Recommended)

1. **Edit `src/pages/dashboard.tsx`**

Replace line 3:
```typescript
// OLD
import { Dashboard } from '../components/Dashboard';

// NEW
import { Dashboard } from '../components/Dashboard_v2';
```

2. **Update the Dashboard usage (lines 167 and 193)**

Remove the `showValidationSuccess` and `onValidationSuccessClose` props:

```typescript
// OLD (line 167)
<Dashboard
  onValidationDoubleClick={handleValidationDoubleClick}
  selectedRTOId={selectedRTOId}
  creditsRefreshTrigger={creditsRefreshTrigger}
  showValidationSuccess={showValidationSuccess}
  onValidationSuccessClose={() => setShowValidationSuccess(false)}
/>

// NEW
<Dashboard
  onValidationDoubleClick={handleValidationDoubleClick}
  selectedRTOId={selectedRTOId}
  creditsRefreshTrigger={creditsRefreshTrigger}
/>
```

Do the same for line 193.

3. **Optional: Remove unused state**

Since `showValidationSuccess` is no longer used, you can remove:
- Line 27: `const [showValidationSuccess, setShowValidationSuccess] = useState(false);`
- Lines 58-62: The `handleValidationSubmit` function can be simplified

### Option 2: Rename Files

1. **Backup old Dashboard**
```bash
mv src/components/Dashboard.tsx src/components/Dashboard_legacy.tsx
```

2. **Rename Dashboard_v2**
```bash
mv src/components/Dashboard_v2.tsx src/components/Dashboard.tsx
```

3. **Update the export name in Dashboard.tsx**

Change:
```typescript
export function Dashboard_v2({ ... }) {
```

To:
```typescript
export function Dashboard({ ... }) {
```

4. **No code changes needed in dashboard.tsx** - it will automatically use the new version

## Testing After Migration

1. Start dev server: `npm run dev`
2. Open dashboard
3. Verify:
   - ✅ Dashboard loads without errors
   - ✅ Validations list displays
   - ✅ Real-time updates work
   - ✅ Double-click navigation works
   - ✅ Pagination works
   - ✅ No polling in Network tab

## Rollback Plan

If issues occur:

**For Option 1:**
```typescript
// Change back to:
import { Dashboard } from '../components/Dashboard';

// And restore the removed props
```

**For Option 2:**
```bash
# Restore files
mv src/components/Dashboard.tsx src/components/Dashboard_v2.tsx
mv src/components/Dashboard_legacy.tsx src/components/Dashboard.tsx
```

## What Dashboard_v2 Changes

### New Features
- ✅ Real-time status updates (< 1 second)
- ✅ Uses new `validation_status` fields
- ✅ Automatic progress tracking
- ✅ No polling (80-90% fewer queries)
- ✅ Visual real-time indicator
- ✅ Better status badges with icons

### Removed Features
- ❌ Success dialog after validation submission
  - **Why:** Real-time updates make it redundant
  - **Alternative:** Watch dashboard for instant status updates

## Next Steps

1. Apply migration (Option 1 or 2)
2. Test thoroughly
3. After 1 week of stable operation:
   - Delete `src/components/Dashboard_legacy.tsx` (if using Option 2)
   - Or delete `src/components/Dashboard.tsx` (old version, if using Option 1)
4. Apply database migration if not already done
5. Celebrate improved performance! 🎉
