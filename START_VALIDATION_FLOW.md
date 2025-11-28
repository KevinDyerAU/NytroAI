# Start Validation Flow - Updated

## ✅ Changes Complete

The upload and validation flow now requires **explicit user action** to start processing.

---

## 🔄 New Upload → Validation Flow

### **Step 1: Select Unit & Upload Files**
- User selects unit of competency
- User uploads files (drag & drop or select)
- Files upload to **Supabase Storage** (instant)
- `ValidationTriggerCard` appears at bottom

### **Step 2: Wait for All Uploads**
- Progress shows: "Upload in progress: X/Y documents"
- Toast notification: "Upload complete! Click 'Start Validation' below to begin AI processing."
- **"Start Validation"** button is DISABLED until all files complete

### **Step 3: User Clicks "Start Validation"**
- Button enabled once `uploadedCount >= totalCount`
- Clicking the button:
  1. Calls `triggerDocumentProcessing()` → n8n webhook
  2. n8n uploads files to **Gemini File API** (Stage 2: AI Learning)
  3. n8n automatically triggers validation after Gemini upload completes
  4. Shows success message: "Processing started! Files are being uploaded to AI..."
  5. **After 1.5 seconds**, navigates to dashboard

### **Step 4: Dashboard Monitoring**
- Dashboard shows validation in Stage 2 (AI Learning)
- Status badge: Yellow "AI Learning"
- Real-time progress tracking via `ValidationProgressTracker`

---

## 🛠️ Technical Changes

### **1. Removed Auto-Navigation**
**File**: `DocumentUploadAdapterSimplified.tsx`

**Before**:
```typescript
// Auto-navigate to dashboard after 2 seconds
setTimeout(() => {
  if (onValidationSubmit) {
    onValidationSubmit({ ... });
  }
}, 2000);
```

**After**:
```typescript
// NO AUTO-NAVIGATION - User must click "Start Validation" button
// Navigation happens in ValidationTriggerCard onSuccess callback
```

### **2. Updated n8n API Call**
**File**: `lib/n8nApi.ts`

**New Function**:
```typescript
export async function triggerDocumentProcessing(validationDetailId: number)
```
- Calls `VITE_N8N_DOCUMENT_PROCESSING_URL`
- Uploads files from Supabase Storage to Gemini File API
- n8n handles the rest of the workflow

**Deprecated**:
```typescript
export async function triggerValidation(validationDetailId: number)
```
- Marked as deprecated
- n8n calls this automatically after document processing

### **3. Updated Hook**
**File**: `hooks/useValidationTrigger.ts`

**Changed**:
```typescript
// Old: triggerValidation (validation webhook)
// New: triggerDocumentProcessing (document processing webhook)
const result = await triggerDocumentProcessing(validationDetailId);
```

### **4. Added Navigation Delay**
**File**: `ValidationTriggerButton.tsx`

**Updated**:
```typescript
const handleTrigger = async () => {
  try {
    await trigger(validationDetailId);
    setIsTriggered(true);
    
    // Wait 1.5s to show success message, then navigate
    setTimeout(() => {
      if (onSuccess) {
        onSuccess();
      }
    }, 1500);
  } catch (error) {
    // Don't navigate on error
  }
};
```

---

## 📋 Environment Variables

Ensure this is set in `.env.local`:

```bash
# Document processing webhook (uploads to Gemini)
VITE_N8N_DOCUMENT_PROCESSING_URL=https://your-n8n.com/webhook/document-processing-gemini

# Validation webhook (called automatically by n8n)
VITE_N8N_VALIDATION_URL=https://your-n8n.com/webhook/validation-processing-gemini
```

---

## 🎯 User Experience

### **Before** (Auto-navigation)
1. Upload files ✅
2. **Immediately redirected to dashboard** ❌
3. No control over when processing starts

### **After** (Manual trigger)
1. Upload files ✅
2. See "Ready to Validate" card
3. **Click "Start Validation"** button ✅
4. See "Processing started!" message
5. Navigate to dashboard after 1.5s ✅

---

## 🧪 Testing Checklist

- [ ] Upload 1 file → "Start Validation" button appears
- [ ] Button is DISABLED until upload completes
- [ ] Button is ENABLED once upload complete
- [ ] Click button → Toast shows "Validation started!"
- [ ] Success message appears: "Processing started! Files are being uploaded to AI..."
- [ ] After 1.5 seconds → Navigate to dashboard automatically
- [ ] Dashboard shows validation in "AI Learning" stage (yellow badge)
- [ ] If error occurs → Stay on upload page, show error toast

---

## 📝 n8n Workflow Integration

### **n8n Workflow Steps**

1. **Webhook receives**: `validation_detail_id`
2. **Query database**: Get all documents for this validation
3. **Download from Supabase Storage**: For each document
4. **Upload to Gemini File API**: Create File Search store, upload files
5. **Poll Gemini operations**: Wait for indexing to complete
6. **Update database**: Set `extractStatus = 'Completed'`
7. **Trigger validation webhook**: Automatically call `VITE_N8N_VALIDATION_URL`
8. **Run AI validation**: Compare against requirements
9. **Save results**: To `validation_results` table
10. **Update status**: Set `validationStatus = 'Finalised'`

### **Database Status Updates**

```sql
-- Step 1: Files uploaded to Supabase
extractStatus = 'Pending'
validationStatus = 'Pending'

-- Step 2-5: n8n processing (user clicked "Start Validation")
extractStatus = 'In Progress'  -- AI Learning stage

-- Step 6-8: n8n validation
extractStatus = 'Completed'
validationStatus = 'In Progress'  -- Under Review stage

-- Step 10: Complete
validationStatus = 'Finalised'  -- Results ready
```

---

## ✅ Summary

**User now has full control:**
1. Upload files (instant to Supabase)
2. Review what's uploaded
3. **Click "Start Validation"** when ready
4. Processing starts via n8n
5. Navigate to dashboard to monitor progress

**No more auto-navigation!** User must explicitly click the button. 🎉
