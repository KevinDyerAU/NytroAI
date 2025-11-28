# n8n UI Components Guide

This guide shows how to use the new n8n-integrated UI components in your frontend.

---

## Components Overview

### 1. **ValidationStatusBadge**
Display validation status with color-coded badges

**Location**: `src/components/ValidationStatusBadge.tsx`

**Usage**:
```tsx
import { ValidationStatusBadge } from '../components/ValidationStatusBadge';

function MyComponent() {
  const status = {
    extractStatus: 'In Progress',
    validationStatus: 'Pending'
  };

  return <ValidationStatusBadge status={status} />;
}
```

**Status Stages**:
- **Document Upload** (Pending) - Blue badge
- **AI Learning** (In Progress - Extract) - Yellow badge
- **Under Review** (In Progress - Validation) - Orange badge
- **Finalised** (Completed) - Green badge
- **Failed** - Red badge

---

### 2. **ValidationTriggerButton**
Trigger validation processing via n8n

**Location**: `src/components/ValidationTriggerButton.tsx`

**Usage**:
```tsx
import { ValidationTriggerButton } from '../components/ValidationTriggerButton';

function UploadComplete() {
  return (
    <ValidationTriggerButton
      validationDetailId={123}
      onSuccess={() => console.log('Validation started!')}
    />
  );
}
```

**With Card Layout**:
```tsx
import { ValidationTriggerCard } from '../components/ValidationTriggerButton';

function UploadProgress() {
  return (
    <ValidationTriggerCard
      validationDetailId={123}
      uploadedCount={3}
      totalCount={5}
      onSuccess={() => navigateToDashboard()}
    />
  );
}
```

---

### 3. **ResultsExplorerActions**
Action buttons for Results Explorer

**Location**: `src/components/ResultsExplorerActions.tsx`

**Generate Report**:
```tsx
import { ResultsExplorerActions } from '../components/ResultsExplorerActions';

function ValidationResults() {
  return (
    <ResultsExplorerActions
      validationDetailId={123}
      onRefresh={() => refetchResults()}
    />
  );
}
```

**Revalidate Requirement**:
```tsx
import { RequirementActions } from '../components/ResultsExplorerActions';

function RequirementRow() {
  return (
    <RequirementActions
      validationResultId={456}
      onRefresh={() => refetchResults()}
    />
  );
}
```

**Regenerate Questions**:
```tsx
import { RegenerateQuestionsDialog } from '../components/ResultsExplorerActions';

function SmartQuestions() {
  const currentQuestions = [
    { id: 1, question_text: 'How is WHS implemented?' }
  ];

  return (
    <RegenerateQuestionsDialog
      validationResultId={456}
      currentQuestions={currentQuestions}
      onQuestionsRegenerated={(newQuestions) => {
        console.log('New questions:', newQuestions);
      }}
      onRefresh={() => refetchResults()}
    />
  );
}
```

---

### 4. **AIChat**
AI Chat component using n8n webhook

**Location**: `src/components/AIChat.tsx`

**Usage**:
```tsx
import { AIChat } from '../components/AIChat';

function ValidationDetail() {
  return (
    <AIChat
      validationDetailId={123}
      selectedRTOId="rto-7148"
      context="Unit BSBWHS521"
      onCreditConsumed={(newBalance) => {
        console.log('New AI credit balance:', newBalance);
      }}
    />
  );
}
```

---

## Hooks

### 1. **useValidationTrigger**
Hook for triggering validation

**Location**: `src/hooks/useValidationTrigger.ts`

**Usage**:
```tsx
import { useValidationTrigger } from '../hooks/useValidationTrigger';

function MyComponent() {
  const { trigger, isTriggering, error } = useValidationTrigger();

  const handleStart = async () => {
    await trigger(validationDetailId);
  };

  return (
    <button onClick={handleStart} disabled={isTriggering}>
      {isTriggering ? 'Starting...' : 'Start Validation'}
    </button>
  );
}
```

---

### 2. **useResultsActions**
Hook for Results Explorer actions

**Location**: `src/hooks/useResultsActions.ts`

**Usage**:
```tsx
import { useResultsActions } from '../hooks/useResultsActions';

function ResultsPage() {
  const {
    generateAndDownloadReport,
    revalidate,
    regenerateSmartQuestions,
    isGeneratingReport,
    isRevalidating,
    isRegeneratingQuestions,
  } = useResultsActions(() => {
    console.log('Action completed, refreshing...');
  });

  return (
    <div>
      <button
        onClick={() => generateAndDownloadReport(123)}
        disabled={isGeneratingReport}
      >
        Download Report
      </button>

      <button
        onClick={() => revalidate(456)}
        disabled={isRevalidating}
      >
        Revalidate
      </button>

      <button
        onClick={() => regenerateSmartQuestions(456, 'Focus on safety')}
        disabled={isRegeneratingQuestions}
      >
        Regenerate Questions
      </button>
    </div>
  );
}
```

---

### 3. **useValidationStatus**
Hook for polling validation status

**Location**: `src/hooks/useValidationStatus.ts`

**Usage**:
```tsx
import { useValidationStatus } from '../hooks/useValidationStatus';

function ValidationMonitor() {
  const { status, isLoading, error, refresh } = useValidationStatus(123);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Extract: {status?.extract_status}</p>
      <p>Validation: {status?.validation_status}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

---

## API Utilities

### n8nApi
Low-level API functions for n8n webhooks

**Location**: `src/lib/n8nApi.ts`

**Functions**:
```tsx
import {
  triggerValidation,
  generateReport,
  downloadReport,
  revalidateRequirement,
  regenerateQuestions,
  sendAIChatMessage,
  checkN8nConfiguration,
} from '../lib/n8nApi';

// Check if n8n is configured
const config = checkN8nConfiguration();
console.log('All webhooks configured:', config.allConfigured);

// Trigger validation
const result = await triggerValidation(123);

// Generate and download report
const reportResult = await generateReport(123);
if (reportResult.success && reportResult.report) {
  downloadReport(reportResult.report, reportResult.filename || 'report.md');
}

// Revalidate requirement
await revalidateRequirement(456);

// Regenerate questions
const questions = await regenerateQuestions(456, 'Focus on practical skills');

// AI Chat
const chatResult = await sendAIChatMessage(
  123,
  'What is WHS?',
  [{ role: 'user', content: 'Previous message' }]
);
```

---

## Integration Examples

### Example 1: Upload Flow with Validation Trigger

```tsx
import { useState } from 'react';
import { ValidationTriggerCard } from '../components/ValidationTriggerButton';

function DocumentUpload() {
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(5);
  const validationDetailId = 123;

  return (
    <div>
      {/* Upload UI */}
      <FileUploader onUploadComplete={() => setUploadedCount(prev => prev + 1)} />

      {/* Validation Trigger */}
      <ValidationTriggerCard
        validationDetailId={validationDetailId}
        uploadedCount={uploadedCount}
        totalCount={totalCount}
        onSuccess={() => {
          // Navigate to dashboard
          window.location.href = '/dashboard';
        }}
      />
    </div>
  );
}
```

---

### Example 2: Results Explorer with Actions

```tsx
import { ResultsExplorerActions, RequirementActions } from '../components/ResultsExplorerActions';
import { ValidationStatusBadge } from '../components/ValidationStatusBadge';
import { useValidationStatus } from '../hooks/useValidationStatus';

function ResultsExplorer({ validationDetailId }) {
  const { status, refresh } = useValidationStatus(validationDetailId);

  return (
    <div>
      {/* Status Badge */}
      {status && <ValidationStatusBadge status={status} />}

      {/* Download Report */}
      <ResultsExplorerActions
        validationDetailId={validationDetailId}
        onRefresh={refresh}
      />

      {/* Requirements List */}
      {requirements.map(req => (
        <div key={req.id}>
          <p>{req.requirement_text}</p>
          <RequirementActions
            validationResultId={req.id}
            onRefresh={refresh}
          />
        </div>
      ))}
    </div>
  );
}
```

---

### Example 3: AI Chat Integration

```tsx
import { AIChat } from '../components/AIChat';

function ValidationDetail({ validationDetailId, rtoId }) {
  const [aiCredits, setAiCredits] = useState(100);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Validation Results */}
      <div>
        <h2>Validation Results</h2>
        {/* Results UI */}
      </div>

      {/* Right: AI Chat */}
      <div>
        <AIChat
          validationDetailId={validationDetailId}
          selectedRTOId={rtoId}
          context="Unit BSBWHS521 Validation"
          onCreditConsumed={(newBalance) => setAiCredits(newBalance)}
        />
        <p className="text-sm text-gray-500 mt-2">
          AI Credits Remaining: {aiCredits}
        </p>
      </div>
    </div>
  );
}
```

---

## Environment Setup

1. Copy `.env.local.example` to `.env.local`
2. Fill in your n8n webhook URLs
3. Restart dev server

**Required Variables**:
```bash
VITE_N8N_VALIDATION_URL=https://your-n8n.com/webhook/validation-processing-gemini
VITE_N8N_REPORT_URL=https://your-n8n.com/webhook/generate-report
VITE_N8N_REVALIDATE_URL=https://your-n8n.com/webhook/revalidate-requirement
VITE_N8N_REGENERATE_QUESTIONS_URL=https://your-n8n.com/webhook/regenerate-questions
VITE_N8N_AI_CHAT_URL=https://your-n8n.com/webhook/ai-chat
```

---

## Troubleshooting

### "n8n URL not configured" Error

**Solution**: Add missing webhook URL to `.env.local`

### Validation doesn't start

**Check**:
1. n8n workflow is active
2. Webhook URL is correct
3. `validationDetailId` exists in database
4. Documents have been uploaded

### Report generation fails

**Check**:
1. Validation is completed (`validationStatus = 'Finalised'`)
2. n8n report workflow is active
3. Check browser console for errors

### AI Chat not responding

**Check**:
1. `VITE_N8N_AI_CHAT_URL` is set
2. `validationDetailId` is provided
3. AI credits are available
4. n8n AI chat workflow is active

---

## Best Practices

1. **Always provide onRefresh callbacks** - Ensures UI updates after actions
2. **Check configuration first** - Use `checkN8nConfiguration()` on app start
3. **Handle loading states** - All hooks provide loading flags
4. **Show user feedback** - Components use toast notifications automatically
5. **Error boundaries** - Wrap components in error boundaries for graceful failures

---

## Migration Checklist

- [ ] Add n8n webhook URLs to `.env.local`
- [ ] Replace old validation trigger with `ValidationTriggerButton`
- [ ] Update Results Explorer with `ResultsExplorerActions`
- [ ] Update AI Chat with new `validationDetailId` prop
- [ ] Test all actions end-to-end
- [ ] Deploy with new environment variables

---

## Summary

All UI components are ready to use with n8n backend:

✅ **ValidationStatusBadge** - Visual status display  
✅ **ValidationTriggerButton** - Start validation  
✅ **ResultsExplorerActions** - Report, revalidate, regenerate  
✅ **AIChat** - AI assistant with n8n backend  
✅ **Hooks** - Reusable logic for all actions  
✅ **API Utilities** - Low-level n8n calls  

The UI stays the same, backend is now n8n! 🎉
