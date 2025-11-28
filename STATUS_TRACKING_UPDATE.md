# Dashboard Status Tracking Update

## ✅ Changes Complete

The dashboard now perfectly tracks the n8n 4-stage validation flow with the **same UI** but updated status logic.

---

## 📊 4-Stage Status Flow

### Stage 1: Document Upload
- **Database**: `extractStatus = 'Pending'`, `validationStatus = 'Pending'`
- **Badge**: Blue - "Document Upload"
- **Description**: Files uploaded to Supabase Storage

### Stage 2: AI Learning
- **Database**: `extractStatus = 'In Progress'`
- **Badge**: Yellow - "AI Learning"
- **Description**: Files being processed by Gemini File API via n8n
- **Progress**: Shows "Processing..." with 0% bar

### Stage 3: Under Review
- **Database**: `extractStatus = 'Completed'`, `validationStatus = 'In Progress'`
- **Badge**: Orange - "Under Review"
- **Description**: AI validation running against requirements
- **Progress**: Shows "X / Y" requirements validated with progress bar

### Stage 4: Finalised
- **Database**: `validationStatus = 'Finalised'`
- **Badge**: Green - "Finalised"
- **Description**: Results ready in `validation_results` table
- **Progress**: Shows 100% complete

---

## 🔧 Files Modified

### 1. **ValidationRecord Interface** (`src/types/rto.ts`)
**Added**:
```typescript
validation_status?: string; // n8n: Pending, In Progress, Finalised
```

**Updated Mapping**:
```typescript
validation_status: record.validation_status || 'Pending', // n8n status tracking
```

### 2. **ValidationStatusBadge Component** (`src/components/ValidationStatusBadge.tsx`)
**Enhanced**:
- ✅ Normalizes status values (handles legacy + new formats)
- ✅ Checks both `extractStatus` and `validationStatus`
- ✅ Maps old status names (e.g., "DocumentProcessing") to new flow
- ✅ Follows exact 4-stage priority order

**Status Mapping Logic**:
```typescript
// Stage 4 (highest priority)
validationStatus === 'finalised' || 'completed'

// Stage 3
(extractStatus === 'completed' && validationStatus === 'in progress') ||
validationStatus === 'in progress' ||
extractStatus === 'processinginbackground'

// Stage 2
extractStatus === 'in progress' ||
extractStatus === 'documentprocessing' ||
extractStatus === 'processing'

// Stage 1 (default)
extractStatus === 'pending' || validationStatus === 'pending'
```

### 3. **Dashboard_v3 Component** (`src/components/Dashboard_v3.tsx`)
**Updated**:
- ✅ Imported `ValidationStatusBadge`
- ✅ Replaced hard-coded status badge with `ValidationStatusBadge`
- ✅ Added status flow documentation comments
- ✅ Updated info banner to explain 4 stages
- ✅ Updated progress tracker conditions to check both statuses
- ✅ Updated progress labels ("AI Learning" vs "Validation Progress")

**Key Changes**:
```typescript
// Old: Hard-coded status mapping
<span className={...}>
  {validation.extract_status === 'DocumentProcessing' ? 'Stage 2' : ...}
</span>

// New: ValidationStatusBadge component
<ValidationStatusBadge
  status={{
    extractStatus: validation.extract_status || 'Pending',
    validationStatus: validation.validation_status || 'Pending',
  }}
/>
```

---

## 🎯 Status Detection Logic

The `ValidationStatusBadge` component uses this **priority order**:

1. **Check Finalised** (Stage 4) - Highest priority
2. **Check Under Review** (Stage 3) - Validation in progress
3. **Check AI Learning** (Stage 2) - Extraction in progress
4. **Check Failed** - Error state
5. **Default to Document Upload** (Stage 1) - Pending state

This ensures:
- ✅ Completed validations always show "Finalised"
- ✅ Active validation shows "Under Review" even if extraction is done
- ✅ Active processing shows "AI Learning"
- ✅ New validations show "Document Upload"

---

## 🔄 Legacy Status Compatibility

The badge handles **legacy status values** from old system:

| Legacy Value | Maps To | Stage |
|--------------|---------|-------|
| `DocumentProcessing` | `In Progress` | Stage 2: AI Learning |
| `ProcessingInBackground` | `In Progress` (validation) | Stage 3: Under Review |
| `Uploading` | `Pending` | Stage 1: Document Upload |
| `Completed` | `Finalised` | Stage 4: Finalised |

---

## 📱 UI Appearance

**Same visual design**, updated status logic:

```
┌─────────────────────────────────────────┐
│ TLIF0025 • Assessment                   │
│ Status: [AI Learning]  🟡               │ ← Badge changes color/text
│ Created: 28 Nov 2024, 08:00            │
│                                         │
│ AI Learning                             │
│ Processing...                           │
│ ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  0%       │
└─────────────────────────────────────────┘
```

**Badge Colors**:
- 🔵 Blue = Stage 1 (Document Upload)
- 🟡 Yellow = Stage 2 (AI Learning)
- 🟠 Orange = Stage 3 (Under Review)
- 🟢 Green = Stage 4 (Finalised)
- 🔴 Red = Failed

---

## 🧪 Testing

### Test Scenarios

1. **New Validation Created**
   - Database: `extractStatus='Pending'`, `validationStatus='Pending'`
   - Expected: Blue "Document Upload" badge

2. **Files Uploaded to Gemini**
   - Database: `extractStatus='In Progress'`
   - Expected: Yellow "AI Learning" badge, "Processing..." progress

3. **Extraction Complete, Validation Running**
   - Database: `extractStatus='Completed'`, `validationStatus='In Progress'`
   - Expected: Orange "Under Review" badge, "X / Y" progress

4. **Validation Complete**
   - Database: `validationStatus='Finalised'`
   - Expected: Green "Finalised" badge, 100% progress

5. **Error Occurred**
   - Database: `extractStatus='Failed'` or `validationStatus='Failed'`
   - Expected: Red "Failed" badge

---

## 📝 Database Schema Reference

**`validation_detail` table columns used**:
- `extractStatus` - Controls Stage 1 → Stage 2 → Stage 3
- `validationStatus` - Controls Stage 3 → Stage 4
- `completed_count` - Number of requirements validated
- `validation_total` - Total requirements

**Status Values**:
```sql
-- Stage 1
extractStatus = 'Pending'
validationStatus = 'Pending'

-- Stage 2
extractStatus = 'In Progress'

-- Stage 3
extractStatus = 'Completed'
validationStatus = 'In Progress'

-- Stage 4
validationStatus = 'Finalised'
```

---

## ✨ Benefits

1. **Accurate Status Tracking** - Follows exact n8n workflow
2. **Legacy Compatibility** - Works with old status values
3. **Same UI** - No visual changes for users
4. **Clear Stages** - Users understand exactly where validation is
5. **Real-time Updates** - Dashboard polls and shows current stage
6. **Fail-safe** - Unknown statuses default to "Document Upload"

---

## 🚀 Next Steps

1. **Test end-to-end**: Upload → AI Learning → Under Review → Finalised
2. **Monitor database**: Verify n8n is setting `validation_status` correctly
3. **Check dashboard**: Ensure badges update in real-time as status changes

---

## 📚 Related Documentation

- `INTEGRATION_SUMMARY.md` - n8n component integration
- `docs/N8N_UI_COMPONENTS.md` - Component usage guide
- `.env.local.example` - Required environment variables

---

## ✅ Summary

**Status tracking is now perfectly aligned with the n8n 4-stage flow:**

✅ Stage 1: Document Upload (Pending)  
✅ Stage 2: AI Learning (In Progress - Extract)  
✅ Stage 3: Under Review (In Progress - Validation)  
✅ Stage 4: Finalised (Completed)  

**The UI stays the same, but now accurately reflects the backend n8n workflow!** 🎉
