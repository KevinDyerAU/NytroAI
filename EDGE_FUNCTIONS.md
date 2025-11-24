# Edge Functions

Active edge functions in NytroAI platform.

## Core Validation Flow

### upload-document
**Purpose:** Creates document record and starts Gemini indexing

**Endpoint:** `POST /upload-document`

**Request:**
```json
{
  "rtoCode": "string",
  "unitCode": "string",
  "documentType": "string",
  "fileName": "string",
  "storagePath": "string"
}
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": number,
    "fileName": "string",
    "fileSearchStoreId": "string",
    "fileSearchDocumentId": "string"
  }
}
```

**Logging:** `[upload-document]` START/SUCCESS/ERROR

---

### trigger-validation
**Purpose:** Fetches requirements and triggers validation (LEGACY - Manual/Debug use only)

**Status:** 🔴 **LEGACY** - Automatic flow uses `process-pending-indexing` → `validate-assessment` directly

**Access:** Dashboard → Maintenance → Trigger Validation (manual tool)

**Endpoint:** `POST /trigger-validation`

**Request:**
```json
{
  "validationDetailId": number
}
```

**Response:**
```json
{
  "success": true,
  "validationDetailId": number,
  "result": object
}
```

**Logging:** `[trigger-validation]` START/SUCCESS/ERROR

**Triggered by:** DB trigger `auto_trigger_validation` on `gemini_operations` table

---

### validate-assessment
**Purpose:** AI validation with JSON requirements

**Endpoint:** `POST /validate-assessment`

**Request:**
```json
{
  "documentId": number,
  "unitCode": "string",
  "validationType": "knowledge_evidence" | "performance_evidence" | "foundation_skills" | "elements_performance_criteria" | "full_validation",
  "validationDetailId": number
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "status": "string",
    "results": array
  }
}
```

**Logging:** `[validate-assessment]` START/SUCCESS/ERROR

---

### check-operation-status
**Purpose:** Polls Gemini operation status

**Endpoint:** `POST /check-operation-status`

**Request:**
```json
{
  "operationId": number
}
```

**Response:**
```json
{
  "operation": {
    "id": number,
    "status": "pending" | "running" | "completed" | "failed",
    "progress": number,
    "elapsedTime": number
  }
}
```

**Logging:** `[check-operation-status]` START/SUCCESS/ERROR

---

### generate-smart-questions-v2
**Purpose:** Generates questions with JSON requirements

**Endpoint:** `POST /generate-smart-questions-v2`

**Request:**
```json
{
  "unitCode": "string",
  "validationType": "string",
  "gapDescription": "string"
}
```

**Response:**
```json
{
  "success": true,
  "questions": array
}
```

---

## Utility Functions

### fetch-units-of-competency
**Purpose:** Fetches UOC data from training.gov.au

**Endpoint:** `POST /fetch-units-of-competency`

**Use case:** Data management, importing training packages

---

### scrape-training-gov-au
**Purpose:** Scrapes training package data

**Endpoint:** `POST /scrape-training-gov-au`

**Use case:** Data management, updating requirements

---

### generate-validation-report
**Purpose:** Generates PDF validation reports

**Endpoint:** `POST /generate-validation-report`

**Use case:** Export functionality

---

### get-dashboard-metrics
**Purpose:** Dashboard statistics and metrics

**Endpoint:** `GET /get-dashboard-metrics`

**Use case:** Dashboard analytics

---

## Deployment

### Deploy All Functions
```bash
supabase functions deploy
```

### Deploy Specific Function
```bash
supabase functions deploy upload-document
supabase functions deploy trigger-validation
supabase functions deploy validate-assessment
supabase functions deploy check-operation-status
supabase functions deploy generate-smart-questions-v2
```

### Delete Unused Functions from Supabase
```bash
# Delete deprecated functions
supabase functions delete generate-smart-questions
supabase functions delete create-validation-record
supabase functions delete get-gemini-operation-status
supabase functions delete upload-files-to-storage

# Delete unimplemented features
supabase functions delete create-checkout-session
supabase functions delete stripe-webhook
supabase functions delete get-ai-credits
supabase functions delete get-validation-credits

# Delete unused utilities
supabase functions delete query-document
```

## Monitoring

View logs in Supabase Dashboard:
- Functions → Select function → Logs
- Filter by `[function-name]` prefix
- Check START/SUCCESS/ERROR messages
- Monitor duration metrics

## Environment Variables

Required in Supabase project settings:
- `GEMINI_API_KEY` - Google Gemini API key
- `SUPABASE_URL` - Supabase project URL (auto-provided)
- `SUPABASE_ANON_KEY` - Supabase anon key (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-provided)

## Function Count

- **Active:** 9 functions
- **Removed:** 9 functions
- **Reduction:** 50%
