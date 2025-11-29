# UI Integration Guide: Aligning with the New Prompt System

**Date**: November 30, 2025
**Author**: Manus AI

## 1. Introduction

This guide provides step-by-step instructions for updating all relevant UI components to align with the new, flexible prompt system. The key is to ensure that the `document_type` (`unit` or `learner_guide`) is captured during the upload process and passed correctly to the n8n workflow.

---

## 2. Key Changes Required

1.  **Update Prompt Maintenance UI**: Replace the old component with the new one.
2.  **Update Document Upload UI**: Capture `document_type`.
3.  **Update Validation Trigger Logic**: Pass `document_type` to the n8n workflow.
4.  **Update Validation Dashboard**: Display `document_type` for context.

---

## 3. Step 1: Update Prompt Maintenance UI

This is the most critical step. The old `PromptMaintenance.tsx` component is completely incompatible with the new `prompts` table schema.

### Action: Replace the Component

1.  **Backup the old component**:

    ```bash
    mv src/components/maintenance/PromptMaintenance.tsx src/components/maintenance/PromptMaintenance.tsx.bak
    ```

2.  **Use the new component**:

    ```bash
    mv src/components/maintenance/PromptMaintenanceNew.tsx src/components/maintenance/PromptMaintenance.tsx
    ```

3.  **Update Imports** (if you didn't rename):

    If you choose to keep both files, update the import in your maintenance page (`src/pages/maintenance.tsx` or similar):

    ```typescript
    // Old
    // import { PromptMaintenance } from "../../components/maintenance/PromptMaintenance";

    // New
    import { PromptMaintenanceNew as PromptMaintenance } from "../../components/maintenance/PromptMaintenanceNew";
    ```

### What This Fixes

-   **Correct Table**: Queries the `prompts` table instead of `prompt`.
-   **Correct Columns**: Uses `prompt_type`, `requirement_type`, `document_type`, `is_active`, `is_default`, etc.
-   **3-Key System**: UI now allows managing prompts based on the 3-key lookup system.
-   **JSON Support**: Allows viewing/editing `output_schema` and `generation_config`.
-   **Better UX**: Inline toggles for active/default status, duplicate detection, and dropdowns for enum fields.

---

## 4. Step 2: Update Document Upload UI

The `DocumentUpload.tsx` component needs to be updated to correctly capture and pass the `document_type`.

### Current State

The component already has a state for this, but it uses `'unit' | 'learner'`:

```typescript
// src/components/DocumentUpload.tsx:82
const [validationType, setValidationType] = useState<
'unit' | 'learner'
>(
'unit'
);
```

And it passes a different string to the backend:

```typescript
// src/components/DocumentUpload.tsx:413
const validationTypeString = validationType === 'unit' ? 'UnitOfCompetency' : 'LearnerGuide';
```

### Action: Align `document_type`

1.  **Update State to Match Schema**:

    Change the state to use the exact `document_type` enum values from the database (`unit` or `learner_guide`).

    ```typescript
    // src/components/DocumentUpload.tsx
    const [documentType, setDocumentType] = useState<
'unit' | 'learner_guide'
>(
'unit'
);
    ```

2.  **Update Tabs Component**:

    The `Tabs` component should use these values directly.

    ```tsx
    // src/components/DocumentUpload.tsx
    <Tabs value={documentType} onValueChange={(v) => setDocumentType(v as 'unit' | 'learner_guide')}>
      <TabsList>
        <TabsTrigger value="unit">Unit Assessment</TabsTrigger>
        <TabsTrigger value="learner_guide">Learner Guide</TabsTrigger>
      </TabsList>
    </Tabs>
    ```

3.  **Update Validation Trigger Logic**:

    When calling the n8n workflow, pass the `documentType` state directly. The `validation_detail` table needs a column to store this.

    **Add `document_type` to `validation_detail` table**:

    ```sql
    -- Add to your migration script (or run in SQL Editor)
    ALTER TABLE validation_detail
    ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('unit', 'learner_guide', 'both'));
    ```

    **Update the `startValidationWithGemini` call**:

    ```typescript
    // src/components/DocumentUpload.tsx
    const validationData = {
      rtoId: selectedRTO.id,
      unitCode: selectedUnit.code,
      userId: user.id,
      files: uploadedFiles.map(f => f.name),
      document_type: documentType, // Pass the new state value
      // ... other data
    };

    const { validationDetailId } = await startValidationWithGemini(validationData);
    ```

---

## 5. Step 3: Update Validation Trigger Logic

The `startValidationWithGemini` function (in `src/lib/supabase-validation.ts`) and the n8n webhook need to handle the new `document_type` field.

### Action: Update Supabase Function & n8n Webhook

1.  **Update `create-validation-record` Edge Function**:

    This function needs to accept `document_type` and save it to the `validation_detail` table.

    ```typescript
    // supabase/functions/create-validation-record/index.ts
    const { rtoId, unitCode, userId, files, document_type } = await req.json();

    // ...

    const { data: detail, error: detailError } = await supabase
      .from('validation_detail')
      .insert({
        rto_id: rtoId,
        unit_code: unitCode,
        user_id: userId,
        document_type: document_type, // Save to new column
        status: 'pending',
      })
      .select()
      .single();
    ```

2.  **Update n8n Webhook Payload**:

    The n8n webhook that triggers the validation flow will now receive `document_type` in its payload. No changes are needed in the n8n workflow itself, as it's already designed to use this field in the "Fetch Prompt Template" node.

    **Webhook Payload Example**:

    ```json
    {
      "validationDetailId": 123,
      "document_type": "unit",
      // ... other data
    }
    ```

---

## 6. Step 4: Update Validation Dashboard

To provide better context, display the `document_type` on the validation dashboard.

### Action: Display `document_type`

1.  **Fetch `document_type` in `useValidationProgress`**:

    Update the hook to fetch `document_type` from the `validation_detail` table.

    ```typescript
    // src/hooks/useValidationProgress.ts
    const { data, error } = await supabase
      .from('validation_detail')
      .select('*, document_type') // Add document_type
      .eq('id', validationId)
      .single();
    ```

2.  **Display in `ValidationDashboard.tsx`**:

    Add the `document_type` to the header.

    ```tsx
    // src/components/validation/ValidationDashboard.tsx
    <p className="text-[#64748b]">
      {documentName} • {unitCode} • <span className="capitalize">{validationProgress.document_type.replace('_', ' ')}</span>
    </p>
    ```

---

## 7. Summary of Changes

| File | Change |
| :--- | :--- |
| **`src/components/maintenance/PromptMaintenance.tsx`** | Replace with `PromptMaintenanceNew.tsx` |
| **`src/components/DocumentUpload.tsx`** | - Update state to `documentType` (`unit` or `learner_guide`)
- Pass `documentType` to validation trigger |
| **`supabase/migrations/...`** | Add `document_type` column to `validation_detail` table |
| **`supabase/functions/create-validation-record/index.ts`** | Accept `document_type` and save to database |
| **`src/hooks/useValidationProgress.ts`** | Fetch `document_type` from `validation_detail` |
| **`src/components/validation/ValidationDashboard.tsx`** | Display `document_type` in header |

---

## 8. Verification Checklist

-   [ ] **Prompt UI**: Can you create, edit, and delete prompts using the new UI?
-   [ ] **Upload UI**: Does the "Unit Assessment" vs "Learner Guide" tab work correctly?
-   [ ] **Database**: Is the `document_type` correctly saved in the `validation_detail` table after triggering a validation?
-   [ ] **n8n Workflow**: Check the logs to ensure the correct prompt is fetched based on the selected `document_type`.
-   [ ] **Dashboard UI**: Does the validation dashboard correctly display "Unit" or "Learner Guide"?

---

**Completing these steps will fully align the UI with the new, powerful prompt system!** ✅
