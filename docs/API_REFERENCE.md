# API Reference - Curl Commands

## Overview

This document provides complete curl command examples for all Gemini API and Supabase Storage operations used in NytroAI.

---

## Environment Variables

Set these variables for easier command execution:

```bash
# Gemini API
export GEMINI_API_KEY="your_gemini_api_key"

# Supabase
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
export SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"

# n8n
export N8N_URL="https://your-n8n.com"
```

---

## Gemini File API

### 1. Upload File to Gemini

**Endpoint**: `POST /upload/v1beta/files`

**Simple Upload** (< 20 MB):

```bash
curl -X POST "https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: multipart" \
  -H "Content-Type: multipart/related; boundary=boundary123" \
  --data-binary @- << EOF
--boundary123
Content-Disposition: form-data; name="file"; filename="assessment.pdf"
Content-Type: application/pdf

$(cat assessment.pdf)
--boundary123--
EOF
```

**Better: Using form data**:

```bash
curl -X POST "https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -F "file=@assessment.pdf" \
  -H "X-Goog-Upload-Protocol: multipart"
```

**Response**:
```json
{
  "file": {
    "name": "files/abc123def456",
    "displayName": "assessment.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": "1048576",
    "createTime": "2025-01-28T10:30:00Z",
    "updateTime": "2025-01-28T10:30:00Z",
    "expirationTime": "2025-01-30T10:30:00Z",
    "sha256Hash": "abc123...",
    "uri": "https://generativelanguage.googleapis.com/v1beta/files/abc123def456"
  }
}
```

**Resumable Upload** (> 20 MB, recommended for large files):

```bash
# Step 1: Start resumable upload
curl -X POST "https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: $(wc -c < assessment.pdf)" \
  -H "X-Goog-Upload-Header-Content-Type: application/pdf" \
  -H "Content-Type: application/json" \
  -d '{
    "file": {
      "displayName": "assessment.pdf"
    }
  }'

# Response includes X-Goog-Upload-URL header
# X-Goog-Upload-URL: https://generativelanguage.googleapis.com/upload/v1beta/files/xyz789

# Step 2: Upload file content
UPLOAD_URL="https://generativelanguage.googleapis.com/upload/v1beta/files/xyz789"

curl -X POST "${UPLOAD_URL}" \
  -H "Content-Length: $(wc -c < assessment.pdf)" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary @assessment.pdf
```

---

### 2. List Uploaded Files

**Endpoint**: `GET /v1beta/files`

```bash
curl -X GET "https://generativelanguage.googleapis.com/v1beta/files?key=${GEMINI_API_KEY}"
```

**Response**:
```json
{
  "files": [
    {
      "name": "files/abc123",
      "displayName": "assessment.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": "1048576",
      "createTime": "2025-01-28T10:30:00Z",
      "expirationTime": "2025-01-30T10:30:00Z"
    }
  ]
}
```

---

### 3. Get File Metadata

**Endpoint**: `GET /v1beta/files/{file_id}`

```bash
FILE_ID="abc123def456"

curl -X GET "https://generativelanguage.googleapis.com/v1beta/files/${FILE_ID}?key=${GEMINI_API_KEY}"
```

**Response**:
```json
{
  "name": "files/abc123def456",
  "displayName": "assessment.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": "1048576",
  "createTime": "2025-01-28T10:30:00Z",
  "updateTime": "2025-01-28T10:30:00Z",
  "expirationTime": "2025-01-30T10:30:00Z",
  "sha256Hash": "abc123...",
  "uri": "https://generativelanguage.googleapis.com/v1beta/files/abc123def456",
  "state": "ACTIVE"
}
```

---

### 4. Delete File

**Endpoint**: `DELETE /v1beta/files/{file_id}`

```bash
FILE_ID="abc123def456"

curl -X DELETE "https://generativelanguage.googleapis.com/v1beta/files/${FILE_ID}?key=${GEMINI_API_KEY}"
```

**Response**: Empty (204 No Content)

---

### 5. Generate Content with File

**Endpoint**: `POST /v1beta/models/{model}:generateContent`

**Single File**:

```bash
FILE_URI="files/abc123def456"

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "fileData": {
              "mimeType": "application/pdf",
              "fileUri": "'"${FILE_URI}"'"
            }
          }
        ]
      },
      {
        "parts": [
          {
            "text": "Summarize this document."
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.1,
      "maxOutputTokens": 8192
    }
  }'
```

**Multiple Files**:

```bash
FILE_URI_1="files/abc123"
FILE_URI_2="files/def456"
FILE_URI_3="files/ghi789"

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "fileData": {
              "mimeType": "application/pdf",
              "fileUri": "'"${FILE_URI_1}"'"
            }
          }
        ]
      },
      {
        "parts": [
          {
            "fileData": {
              "mimeType": "application/pdf",
              "fileUri": "'"${FILE_URI_2}"'"
            }
          }
        ]
      },
      {
        "parts": [
          {
            "fileData": {
              "mimeType": "application/pdf",
              "fileUri": "'"${FILE_URI_3}"'"
            }
          }
        ]
      },
      {
        "parts": [
          {
            "text": "Validate the assessment against requirements."
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.1,
      "maxOutputTokens": 8192
    }
  }'
```

**Response**:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Summary of the document..."
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "safetyRatings": [...]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 50000,
    "candidatesTokenCount": 2000,
    "totalTokenCount": 52000
  }
}
```

---

### 6. Generate Content with JSON Response

**Endpoint**: `POST /v1beta/models/{model}:generateContent`

```bash
FILE_URI="files/abc123def456"

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "fileData": {
              "mimeType": "application/pdf",
              "fileUri": "'"${FILE_URI}"'"
            }
          }
        ]
      },
      {
        "parts": [
          {
            "text": "Validate requirements and return JSON with status, reasoning, and evidence."
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.1,
      "maxOutputTokens": 8192,
      "responseMimeType": "application/json"
    }
  }'
```

**Response**:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "{\"status\":\"met\",\"reasoning\":\"...\",\"evidence\":[...]}"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 50000,
    "candidatesTokenCount": 1500,
    "totalTokenCount": 51500
  }
}
```

---

### 7. Count Tokens

**Endpoint**: `POST /v1beta/models/{model}:countTokens`

```bash
FILE_URI="files/abc123def456"

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:countTokens?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "fileData": {
              "mimeType": "application/pdf",
              "fileUri": "'"${FILE_URI}"'"
            }
          }
        ]
      },
      {
        "parts": [
          {
            "text": "Validate requirements."
          }
        ]
      }
    ]
  }'
```

**Response**:
```json
{
  "totalTokens": 50123
}
```

---

## Supabase Storage API

### 1. Upload File to Storage

**Endpoint**: `POST /storage/v1/object/{bucket}/{path}`

**Upload with anon key** (authenticated user):

```bash
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

curl -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE_PATH}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/pdf" \
  --data-binary @assessment.pdf
```

**Upload with service role key** (bypass RLS):

```bash
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

curl -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE_PATH}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/pdf" \
  --data-binary @assessment.pdf
```

**Response**:
```json
{
  "Key": "7148/TLIF0025/validation123/assessment.pdf"
}
```

---

### 2. Download File from Storage

**Endpoint**: `GET /storage/v1/object/{bucket}/{path}`

```bash
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

curl -X GET "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE_PATH}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -o downloaded_assessment.pdf
```

**Response**: Binary file content

---

### 3. Get Public URL (if bucket is public)

**Endpoint**: `GET /storage/v1/object/public/{bucket}/{path}`

```bash
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

# Direct URL (no authentication needed if bucket is public)
curl -X GET "${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${FILE_PATH}" \
  -o downloaded_assessment.pdf
```

---

### 4. Create Signed URL (for private buckets)

**Endpoint**: `POST /storage/v1/object/sign/{bucket}/{path}`

```bash
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

curl -X POST "${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${FILE_PATH}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "expiresIn": 3600
  }'
```

**Response**:
```json
{
  "signedURL": "/storage/v1/object/sign/documents/7148/TLIF0025/validation123/assessment.pdf?token=abc123..."
}
```

**Use signed URL**:
```bash
SIGNED_URL="/storage/v1/object/sign/documents/7148/TLIF0025/validation123/assessment.pdf?token=abc123..."

curl -X GET "${SUPABASE_URL}${SIGNED_URL}" \
  -o downloaded_assessment.pdf
```

---

### 5. List Files in Bucket

**Endpoint**: `POST /storage/v1/object/list/{bucket}`

```bash
BUCKET="documents"
PREFIX="7148/TLIF0025/validation123"

curl -X POST "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "'"${PREFIX}"'",
    "limit": 100,
    "offset": 0,
    "sortBy": {
      "column": "name",
      "order": "asc"
    }
  }'
```

**Response**:
```json
[
  {
    "name": "assessment.pdf",
    "id": "abc123",
    "updated_at": "2025-01-28T10:30:00Z",
    "created_at": "2025-01-28T10:30:00Z",
    "last_accessed_at": "2025-01-28T10:30:00Z",
    "metadata": {
      "eTag": "\"abc123\"",
      "size": 1048576,
      "mimetype": "application/pdf",
      "cacheControl": "max-age=3600"
    }
  }
]
```

---

### 6. Delete File from Storage

**Endpoint**: `DELETE /storage/v1/object/{bucket}/{path}`

```bash
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

curl -X DELETE "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE_PATH}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

**Response**:
```json
{
  "message": "Successfully deleted"
}
```

---

### 7. Move/Rename File

**Endpoint**: `POST /storage/v1/object/move`

```bash
BUCKET="documents"
OLD_PATH="7148/TLIF0025/validation123/assessment.pdf"
NEW_PATH="7148/TLIF0025/validation123/assessment_v2.pdf"

curl -X POST "${SUPABASE_URL}/storage/v1/object/move" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "bucketId": "'"${BUCKET}"'",
    "sourceKey": "'"${OLD_PATH}"'",
    "destinationKey": "'"${NEW_PATH}"'"
  }'
```

**Response**:
```json
{
  "message": "Successfully moved"
}
```

---

### 8. Copy File

**Endpoint**: `POST /storage/v1/object/copy`

```bash
BUCKET="documents"
SOURCE_PATH="7148/TLIF0025/validation123/assessment.pdf"
DEST_PATH="7148/TLIF0025/validation124/assessment.pdf"

curl -X POST "${SUPABASE_URL}/storage/v1/object/copy" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "bucketId": "'"${BUCKET}"'",
    "sourceKey": "'"${SOURCE_PATH}"'",
    "destinationKey": "'"${DEST_PATH}"'"
  }'
```

**Response**:
```json
{
  "Key": "7148/TLIF0025/validation124/assessment.pdf"
}
```

---

## Supabase Database API (PostgREST)

### 1. Insert Document Record

**Endpoint**: `POST /rest/v1/{table}`

```bash
curl -X POST "${SUPABASE_URL}/rest/v1/documents" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "validation_detail_id": 123,
    "file_name": "assessment.pdf",
    "document_type": "assessment",
    "storage_path": "7148/TLIF0025/validation123/assessment.pdf",
    "gemini_file_uri": "files/abc123def456",
    "gemini_file_name": "assessment.pdf",
    "gemini_upload_timestamp": "2025-01-28T10:30:00Z",
    "gemini_expiry_timestamp": "2025-01-30T10:30:00Z"
  }'
```

**Response**:
```json
[
  {
    "id": 456,
    "created_at": "2025-01-28T10:30:00Z",
    "validation_detail_id": 123,
    "file_name": "assessment.pdf",
    "document_type": "assessment",
    "storage_path": "7148/TLIF0025/validation123/assessment.pdf",
    "gemini_file_uri": "files/abc123def456",
    "gemini_file_name": "assessment.pdf",
    "gemini_upload_timestamp": "2025-01-28T10:30:00Z",
    "gemini_expiry_timestamp": "2025-01-30T10:30:00Z"
  }
]
```

---

### 2. Query Documents

**Endpoint**: `GET /rest/v1/{table}`

```bash
VALIDATION_DETAIL_ID=123

curl -X GET "${SUPABASE_URL}/rest/v1/documents?validation_detail_id=eq.${VALIDATION_DETAIL_ID}&select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

**Response**:
```json
[
  {
    "id": 456,
    "created_at": "2025-01-28T10:30:00Z",
    "validation_detail_id": 123,
    "file_name": "assessment.pdf",
    "storage_path": "7148/TLIF0025/validation123/assessment.pdf",
    "gemini_file_uri": "files/abc123def456"
  }
]
```

---

### 3. Update Document Record

**Endpoint**: `PATCH /rest/v1/{table}`

```bash
DOCUMENT_ID=456

curl -X PATCH "${SUPABASE_URL}/rest/v1/documents?id=eq.${DOCUMENT_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "gemini_file_uri": "files/new123",
    "gemini_upload_timestamp": "2025-01-28T11:00:00Z"
  }'
```

---

## Supabase Edge Functions

### 1. Call get-requirements Edge Function

**Endpoint**: `POST /functions/v1/{function_name}`

```bash
UNIT_LINK="https://training.gov.au/Training/Details/BSBWHS211"

curl -X POST "${SUPABASE_URL}/functions/v1/get-requirements" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "unitLink": "'"${UNIT_LINK}"'"
  }'
```

**Response**:
```json
{
  "success": true,
  "requirements": {
    "knowledge_evidence": [
      {
        "id": 1,
        "requirement_number": "KE-1",
        "requirement_text": "Hazard identification procedures..."
      }
    ],
    "performance_evidence": [...],
    "foundation_skills": [...],
    "elements_performance_criteria": [...],
    "assessment_conditions": [...]
  }
}
```

---

## n8n Webhook Calls

### 1. Trigger Document Processing

```bash
VALIDATION_DETAIL_ID=123
STORAGE_PATHS='["7148/TLIF0025/validation123/assessment.pdf","7148/TLIF0025/validation123/marking_guide.pdf"]'

curl -X POST "${N8N_URL}/webhook/document-processing-gemini" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": '"${VALIDATION_DETAIL_ID}"',
    "storage_paths": '"${STORAGE_PATHS}"'
  }'
```

**Response**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "processed_files": [
    {
      "storage_path": "7148/TLIF0025/validation123/assessment.pdf",
      "gemini_file_uri": "files/abc123",
      "success": true
    }
  ]
}
```

---

### 2. Trigger AI Validation

```bash
VALIDATION_DETAIL_ID=123

curl -X POST "${N8N_URL}/webhook/validation-processing-gemini" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": '"${VALIDATION_DETAIL_ID}"'
  }'
```

**Response**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "total_results": 45,
  "message": "Validation completed successfully"
}
```

---

### 3. Generate Report

```bash
VALIDATION_DETAIL_ID=123

curl -X POST "${N8N_URL}/webhook/generate-report" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": '"${VALIDATION_DETAIL_ID}"'
  }'
```

**Response**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "report": "# Validation Report\n\n...",
  "filename": "validation_report_BSBWHS211_1706400000000.md"
}
```

---

### 4. Revalidate Single Requirement

```bash
VALIDATION_RESULT_ID=456

curl -X POST "${N8N_URL}/webhook/revalidate-requirement" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_result_id": '"${VALIDATION_RESULT_ID}"'
  }'
```

**Response**:
```json
{
  "success": true,
  "validation_result_id": 456,
  "status": "met",
  "message": "Requirement revalidated successfully"
}
```

---

### 5. Regenerate Smart Questions

```bash
VALIDATION_RESULT_ID=456
USER_GUIDANCE="Focus on practical workplace scenarios"

curl -X POST "${N8N_URL}/webhook/regenerate-questions" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_result_id": '"${VALIDATION_RESULT_ID}"',
    "user_guidance": "'"${USER_GUIDANCE}"'"
  }'
```

**Response**:
```json
{
  "success": true,
  "validation_result_id": 456,
  "questions": [
    {
      "question": "Describe a situation where...",
      "rationale": "This addresses the gap in...",
      "assessmentType": "written",
      "bloomsLevel": "application"
    }
  ]
}
```

---

### 6. AI Chat

```bash
VALIDATION_DETAIL_ID=123
MESSAGE="Why was requirement KE-1 marked as partial?"

curl -X POST "${N8N_URL}/webhook/ai-chat" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": '"${VALIDATION_DETAIL_ID}"',
    "message": "'"${MESSAGE}"'",
    "conversation_history": []
  }'
```

**Response**:
```json
{
  "success": true,
  "validation_detail_id": 123,
  "response": "Requirement KE-1 was marked as partial because...",
  "role": "assistant"
}
```

---

## Complete End-to-End Example

### Scenario: Upload and Validate Assessment

```bash
#!/bin/bash

# Set environment variables
export GEMINI_API_KEY="your_gemini_api_key"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
export N8N_URL="https://your-n8n.com"

# 1. Upload file to Supabase Storage
echo "1. Uploading file to Supabase Storage..."
BUCKET="documents"
FILE_PATH="7148/TLIF0025/validation123/assessment.pdf"

curl -X POST "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE_PATH}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/pdf" \
  --data-binary @assessment.pdf

# 2. Create validation_detail record
echo "2. Creating validation_detail record..."
VALIDATION_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/validation_detail" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "validation_summary_id": 1,
    "status": "pending"
  }')

VALIDATION_DETAIL_ID=$(echo $VALIDATION_RESPONSE | jq -r '.[0].id')
echo "Created validation_detail_id: ${VALIDATION_DETAIL_ID}"

# 3. Trigger document processing
echo "3. Triggering document processing..."
curl -X POST "${N8N_URL}/webhook/document-processing-gemini" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": '"${VALIDATION_DETAIL_ID}"',
    "storage_paths": ["'"${FILE_PATH}"'"]
  }'

# 4. Wait for processing to complete
echo "4. Waiting for processing..."
sleep 30

# 5. Check status
echo "5. Checking status..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/validation_detail?id=eq.${VALIDATION_DETAIL_ID}&select=extractStatus,validationStatus" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

# 6. Get validation results
echo "6. Getting validation results..."
curl -s -X GET "${SUPABASE_URL}/rest/v1/validation_results?validation_detail_id=eq.${VALIDATION_DETAIL_ID}&select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | jq '.'

# 7. Generate report
echo "7. Generating report..."
curl -X POST "${N8N_URL}/webhook/generate-report" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_detail_id": '"${VALIDATION_DETAIL_ID}"'
  }' | jq -r '.report' > validation_report.md

echo "Done! Report saved to validation_report.md"
```

---

## Error Handling

### Common Errors

**Gemini API - 400 Bad Request**:
```json
{
  "error": {
    "code": 400,
    "message": "Invalid file format",
    "status": "INVALID_ARGUMENT"
  }
}
```

**Gemini API - 429 Rate Limit**:
```json
{
  "error": {
    "code": 429,
    "message": "Resource has been exhausted",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

**Supabase Storage - 403 Forbidden**:
```json
{
  "statusCode": "403",
  "error": "Forbidden",
  "message": "new row violates row-level security policy"
}
```

**Supabase Storage - 413 Payload Too Large**:
```json
{
  "statusCode": "413",
  "error": "Payload too large",
  "message": "File size exceeds limit"
}
```

---

## Rate Limits

### Gemini API

**Free Tier**:
- 15 requests per minute (RPM)
- 1 million tokens per minute (TPM)
- 1,500 requests per day (RPD)

**Paid Tier**:
- 1,000 RPM
- 4 million TPM
- No daily limit

### Supabase Storage

**Free Tier**:
- 2 GB bandwidth per month
- 1 GB storage

**Pro Tier**:
- 200 GB bandwidth per month
- 100 GB storage

---

## Summary

This reference provides all curl commands for:

✅ **Gemini File API** - Upload, list, get, delete, generate content  
✅ **Supabase Storage** - Upload, download, list, delete, move, copy  
✅ **Supabase Database** - Insert, query, update documents  
✅ **Supabase Edge Functions** - Call get-requirements  
✅ **n8n Webhooks** - Trigger all 6 workflows  
✅ **End-to-End Example** - Complete validation flow  

All commands are ready to use with environment variables!
