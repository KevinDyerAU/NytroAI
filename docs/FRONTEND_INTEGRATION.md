# Frontend Integration Guide

## Overview

This guide explains how to integrate the simplified n8n validation architecture into the NytroAI frontend.

---

## Changes Summary

### What's New

1. **New Upload Service** - `DocumentUploadService_n8n.ts`
   - Uploads to Supabase Storage (unchanged)
   - Creates document records (unchanged)
   - Calls n8n webhook for processing (new)
   - No more edge function calls

2. **Environment Variables** - n8n webhook URLs
   - `VITE_N8N_DOCUMENT_PROCESSING_URL`
   - `VITE_N8N_VALIDATION_URL`
   - `VITE_N8N_REPORT_URL`
   - `VITE_N8N_REVALIDATE_URL`
   - `VITE_N8N_REGENERATE_QUESTIONS_URL`
   - `VITE_N8N_AI_CHAT_URL`

3. **Simplified Flow**
   - Upload → Supabase Storage → Create Record → n8n Webhook → Done
   - No more: Edge functions, database triggers, operation polling

---

## Step-by-Step Integration

### Step 1: Update Environment Variables

**File**: `.env.local`

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# n8n Webhook URLs
VITE_N8N_DOCUMENT_PROCESSING_URL=https://your-n8n.com/webhook/document-processing-gemini
VITE_N8N_VALIDATION_URL=https://your-n8n.com/webhook/validation-processing-gemini
VITE_N8N_REPORT_URL=https://your-n8n.com/webhook/generate-report
VITE_N8N_REVALIDATE_URL=https://your-n8n.com/webhook/revalidate-requirement
VITE_N8N_REGENERATE_QUESTIONS_URL=https://your-n8n.com/webhook/regenerate-questions
VITE_N8N_AI_CHAT_URL=https://your-n8n.com/webhook/ai-chat
```

**For Netlify Deployment**:
1. Go to Netlify Dashboard → Site settings → Environment variables
2. Add all `VITE_N8N_*` variables
3. Redeploy site

---

### Step 2: Update Upload Component

**File**: `src/components/upload/DocumentUploadRefactored_v2.tsx`

Replace the import:

```typescript
// Old
import { documentUploadService } from '../../services/DocumentUploadServiceSimplified';

// New
import { documentUploadServiceN8n } from '../../services/DocumentUploadService_n8n';
```

Replace the service call:

```typescript
// Old
const result = await documentUploadService.uploadDocument(
  file,
  rtoCode,
  unitCode,
  documentType,
  validationDetailId,
  onProgress
);

// New
const result = await documentUploadServiceN8n.uploadDocument(
  file,
  rtoCode,
  unitCode,
  documentType,
  validationDetailId,
  onProgress,
  abortSignal // Optional: for cancellation support
);
```

---

### Step 3: Update Validation Trigger

**File**: `src/pages/ValidationDashboard.tsx` (or wherever validation is triggered)

Add validation trigger function:

```typescript
import { supabase } from '../lib/supabase';

async function triggerValidation(validationDetailId: number) {
  const n8nUrl = import.meta.env.VITE_N8N_VALIDATION_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N validation URL not configured');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Validation trigger failed: ${response.status}`);
  }

  return await response.json();
}
```

Call this function after all documents are uploaded:

```typescript
// After all files uploaded
try {
  await triggerValidation(validationDetailId);
  toast.success('Validation started!');
} catch (error) {
  toast.error('Failed to start validation');
  console.error(error);
}
```

---

### Step 4: Update Results Explorer

#### 4.1 Generate Report

**File**: `src/components/ResultsExplorer.tsx`

```typescript
async function generateReport(validationDetailId: number) {
  const n8nUrl = import.meta.env.VITE_N8N_REPORT_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N report URL not configured');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Report generation failed: ${response.status}`);
  }

  const result = await response.json();
  
  // Download report
  const blob = new Blob([result.report], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename || 'validation_report.md';
  a.click();
  URL.revokeObjectURL(url);
}
```

#### 4.2 Revalidate Single Requirement

```typescript
async function revalidateRequirement(validationResultId: number) {
  const n8nUrl = import.meta.env.VITE_N8N_REVALIDATE_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N revalidate URL not configured');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_result_id: validationResultId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Revalidation failed: ${response.status}`);
  }

  const result = await response.json();
  
  // Refresh validation results
  await refreshValidationResults();
  
  toast.success('Requirement revalidated!');
  return result;
}
```

#### 4.3 Regenerate Smart Questions

```typescript
async function regenerateQuestions(
  validationResultId: number,
  userGuidance: string
) {
  const n8nUrl = import.meta.env.VITE_N8N_REGENERATE_QUESTIONS_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N regenerate questions URL not configured');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_result_id: validationResultId,
      user_guidance: userGuidance,
    }),
  });

  if (!response.ok) {
    throw new Error(`Question regeneration failed: ${response.status}`);
  }

  const result = await response.json();
  
  // Update UI with new questions
  setSmartQuestions(result.questions);
  
  toast.success('Questions regenerated!');
  return result;
}
```

#### 4.4 AI Chat

```typescript
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function AIChat({ validationDetailId }: { validationDetailId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const n8nUrl = import.meta.env.VITE_N8N_AI_CHAT_URL;
    
    if (!n8nUrl) {
      toast.error('AI Chat not configured');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validation_detail_id: validationDetailId,
          message: input,
          conversation_history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Chat failed: ${response.status}`);
      }

      const result = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: result.response,
      };
      
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('AI Chat error:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-chat">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about validation results..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

---

### Step 5: Update Status Polling

**File**: `src/hooks/useValidationStatus.ts`

The status polling logic remains the same - poll `validation_detail` table for status updates:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ValidationStatus {
  extractStatus: string;
  validationStatus: string;
}

export function useValidationStatus(validationDetailId: number) {
  const [status, setStatus] = useState<ValidationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!validationDetailId) return;

    // Initial fetch
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, [validationDetailId]);

  async function fetchStatus() {
    const { data, error } = await supabase
      .from('validation_detail')
      .select('extractStatus, validationStatus')
      .eq('id', validationDetailId)
      .single();

    if (error) {
      console.error('Failed to fetch status:', error);
      return;
    }

    setStatus(data);
    setLoading(false);

    // Stop polling if completed or failed
    if (data.validationStatus === 'Finalised' || data.validationStatus === 'Failed') {
      clearInterval(interval);
    }
  }

  return { status, loading, refresh: fetchStatus };
}
```

---

## UI Status Flow

### 4 Simple Stages

1. **Document Upload** - Files uploaded to Supabase Storage
   - `validation_detail.extractStatus = 'Pending'`
   - `validation_detail.validationStatus = 'Pending'`

2. **AI Learning** - Files being processed by Gemini
   - `validation_detail.extractStatus = 'In Progress'`
   - n8n uploads files to Gemini File API

3. **Under Review** - AI validation running
   - `validation_detail.extractStatus = 'Completed'`
   - `validation_detail.validationStatus = 'In Progress'`

4. **Finalised** - Results ready
   - `validation_detail.validationStatus = 'Finalised'`
   - Results in `validation_results` table

### Status Display Component

```typescript
function ValidationStatusBadge({ status }: { status: ValidationStatus }) {
  const getStage = () => {
    if (status.extractStatus === 'Pending') {
      return { label: 'Document Upload', color: 'blue' };
    }
    if (status.extractStatus === 'In Progress') {
      return { label: 'AI Learning', color: 'yellow' };
    }
    if (status.validationStatus === 'In Progress') {
      return { label: 'Under Review', color: 'orange' };
    }
    if (status.validationStatus === 'Finalised') {
      return { label: 'Finalised', color: 'green' };
    }
    if (status.validationStatus === 'Failed') {
      return { label: 'Failed', color: 'red' };
    }
    return { label: 'Unknown', color: 'gray' };
  };

  const stage = getStage();

  return (
    <span className={`badge badge-${stage.color}`}>
      {stage.label}
    </span>
  );
}
```

---

## Testing

### Test Upload Flow

1. Upload a test PDF
2. Check Supabase Storage - file should be there
3. Check `documents` table - record should exist
4. Check n8n execution - should show success
5. Check `documents` table - `gemini_file_uri` should be populated
6. Check `validation_detail` - `extractStatus` should be 'Completed'

### Test Validation Flow

1. Trigger validation
2. Check n8n execution - should show success
3. Check `validation_results` table - results should appear
4. Check `validation_detail` - `validationStatus` should be 'Finalised'

### Test Results Explorer

1. Generate report - should download Markdown file
2. Revalidate requirement - should update result
3. Regenerate questions - should show new questions
4. AI chat - should respond to questions

---

## Migration Checklist

- [ ] Update `.env.local` with n8n webhook URLs
- [ ] Update upload component to use `DocumentUploadService_n8n`
- [ ] Add validation trigger function
- [ ] Add report generation function
- [ ] Add revalidate requirement function
- [ ] Add regenerate questions function
- [ ] Add AI chat component
- [ ] Test upload flow end-to-end
- [ ] Test validation flow end-to-end
- [ ] Test all Results Explorer features
- [ ] Deploy to Netlify with new environment variables

---

## Troubleshooting

### Upload Fails

**Check**:
1. Supabase Storage bucket exists (`documents`)
2. RLS policies allow authenticated users to upload
3. File size < 50 MB (Free) or 5 GB (Pro)
4. n8n webhook URL is correct

### n8n Processing Fails

**Check**:
1. n8n workflow is active
2. n8n credentials are configured (Supabase, Gemini)
3. Check n8n execution logs for errors
4. Verify Gemini API key is valid

### Validation Doesn't Start

**Check**:
1. `documents` table has `gemini_file_uri` populated
2. n8n validation workflow is active
3. Check n8n execution logs
4. Verify validation_detail_id exists

### Results Not Appearing

**Check**:
1. Validation completed successfully (check n8n logs)
2. `validation_results` table has records
3. `validation_detail.validationStatus = 'Finalised'`
4. Frontend is polling correct validation_detail_id

---

## Summary

The frontend integration is straightforward:

✅ **Upload** - Same Supabase Storage upload, new n8n webhook call  
✅ **Validation** - Call n8n webhook instead of edge function  
✅ **Status** - Poll validation_detail table (unchanged)  
✅ **Results** - Call n8n webhooks for all Results Explorer features  

**Key Benefits**:
- Simpler code (no edge function complexity)
- Easier debugging (check n8n execution logs)
- More reliable (fewer failure points)
- Faster (no operation polling)

**Migration Time**: 1-2 hours for experienced developer
