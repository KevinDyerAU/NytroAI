# upload-to-gemini Edge Function

## Purpose

Handles uploading files from Supabase Storage to Gemini File API with proper multipart formatting.

This edge function solves the problem of n8n's HTTP Request node not correctly formatting multipart/related requests for Gemini's File API.

---

## What It Does

1. **Downloads file** from Supabase Storage
2. **Uploads to Gemini File API** with proper multipart/related format
3. **Updates database** with Gemini file URI and expiry timestamp

---

## Input

```json
{
  "storage_path": "7148/TLIF0025/1706400000_assessment.pdf",
  "validation_detail_id": 123
}
```

**Parameters**:
- `storage_path` - Path to file in Supabase Storage `documents` bucket
- `validation_detail_id` - ID of the validation session

---

## Output

### Success

```json
{
  "success": true,
  "file": {
    "uri": "files/abc123xyz",
    "name": "abc123xyz",
    "displayName": "assessment.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": "143000",
    "createTime": "2025-01-28T10:30:00.123456Z",
    "updateTime": "2025-01-28T10:30:00.123456Z",
    "expirationTime": "2025-01-30T10:30:00.123456Z",
    "sha256Hash": "...",
    "state": "ACTIVE"
  },
  "storage_path": "7148/TLIF0025/1706400000_assessment.pdf",
  "gemini_file_uri": "files/abc123xyz",
  "gemini_expiry_timestamp": "2025-01-30T10:30:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "error": "Failed to download file: File not found"
}
```

---

## Database Updates

Updates the `documents` table:

```sql
UPDATE documents
SET 
  gemini_file_uri = 'files/abc123xyz',
  gemini_file_name = 'abc123xyz',
  gemini_upload_timestamp = '2025-01-28T10:30:00.000Z',
  gemini_expiry_timestamp = '2025-01-30T10:30:00.000Z'
WHERE 
  storage_path = '7148/TLIF0025/1706400000_assessment.pdf'
  AND validation_detail_id = 123;
```

---

## Environment Variables

Must be set in Supabase Edge Function environment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

**Set in Supabase Dashboard**:
1. Go to Edge Functions → Settings
2. Add environment variables
3. Redeploy function

---

## Deployment

### Deploy to Supabase

```bash
# Deploy function
supabase functions deploy upload-to-gemini

# Set environment variable
supabase secrets set GEMINI_API_KEY=your_gemini_api_key
```

### Test Locally

```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve upload-to-gemini --env-file .env.local

# Test with curl
curl -X POST 'http://localhost:54321/functions/v1/upload-to-gemini' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "storage_path": "test/file.pdf",
    "validation_detail_id": 1
  }'
```

---

## Usage from n8n

### HTTP Request Node Configuration

**Method**: POST  
**URL**: `{{ $env.SUPABASE_URL }}/functions/v1/upload-to-gemini`  
**Authentication**: Predefined Credential Type → Supabase API  

**Headers**:
```
Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
```

**Body** (JSON):
```json
{
  "storage_path": "={{ $('Split Storage Paths').item.json.storage_paths }}",
  "validation_detail_id": "={{ $('Prepare Loop Data').first().json.validation_detail_id }}"
}
```

**Response**:
- Success: `$json.success === true`
- File URI: `$json.gemini_file_uri`
- Expiry: `$json.gemini_expiry_timestamp`

---

## Error Handling

### Common Errors

**1. File not found in storage**
```json
{
  "success": false,
  "error": "Failed to download file: The resource was not found"
}
```

**Solution**: Check storage_path is correct and file exists

**2. Gemini API error**
```json
{
  "success": false,
  "error": "Gemini upload failed: 400 - Invalid file format"
}
```

**Solution**: Check file is a valid PDF and < 50 MB

**3. Database update error**
```json
{
  "success": false,
  "error": "Failed to update document record: ..."
}
```

**Solution**: Check documents table has matching record

---

## Multipart Format Details

The function creates a proper `multipart/related` request:

```
Content-Type: multipart/related; boundary=----WebKitFormBoundary...
X-Goog-Upload-Protocol: multipart
X-Goog-Api-Key: ...

----WebKitFormBoundary...
Content-Disposition: form-data; name="metadata"
Content-Type: application/json; charset=UTF-8

{"displayName": "assessment.pdf"}

----WebKitFormBoundary...
Content-Disposition: form-data; name="file"; filename="assessment.pdf"
Content-Type: application/pdf

[BINARY FILE DATA]

----WebKitFormBoundary...--
```

**Key Requirements**:
- Must use `multipart/related` (not `multipart/form-data`)
- Must have exactly 2 parts: metadata + file
- Must use `\r\n` line endings
- Must include `X-Goog-Upload-Protocol: multipart` header

---

## Performance

**Typical execution time**:
- Small file (< 1 MB): 1-2 seconds
- Medium file (1-10 MB): 2-5 seconds
- Large file (10-50 MB): 5-15 seconds

**Timeout**: 60 seconds (Supabase Edge Function default)

---

## Monitoring

### Check Logs

```bash
# View function logs
supabase functions logs upload-to-gemini

# Follow logs in real-time
supabase functions logs upload-to-gemini --follow
```

### Log Format

```
[upload-to-gemini] Processing: { storage_path: "...", validation_detail_id: 123 }
[upload-to-gemini] Downloading from Supabase Storage: ...
[upload-to-gemini] File downloaded, size: 143000
[upload-to-gemini] Uploading to Gemini File API, size: 145234
[upload-to-gemini] Upload successful: { file: { uri: "files/abc123", ... } }
[upload-to-gemini] Document record updated successfully
```

---

## Security

✅ **API Key Protection** - Gemini API key stored in Supabase secrets  
✅ **Service Role Key** - Uses Supabase service role for database access  
✅ **CORS Enabled** - Allows cross-origin requests  
✅ **Input Validation** - Validates storage_path and validation_detail_id  

---

## Troubleshooting

### Function not found

**Error**: `404 Not Found`

**Solution**: Deploy function
```bash
supabase functions deploy upload-to-gemini
```

### Unauthorized

**Error**: `401 Unauthorized`

**Solution**: Check Authorization header includes service role key

### File too large

**Error**: `Gemini upload failed: 413 Payload Too Large`

**Solution**: Gemini File API limit is 50 MB (free) or 2 GB (paid)

### Timeout

**Error**: Function timeout after 60 seconds

**Solution**: File is too large or network is slow. Consider:
- Compressing PDF before upload
- Using resumable upload for files > 20 MB
- Increasing Edge Function timeout (requires Supabase Pro)

---

## Future Enhancements

Potential improvements:

1. **Resumable Upload** - For files > 20 MB
2. **Retry Logic** - Automatic retry on transient errors
3. **Progress Tracking** - Real-time upload progress
4. **Batch Upload** - Upload multiple files in one call
5. **File Validation** - Check file type and size before upload

---

## Related

- **n8n Workflow**: `DocumentProcessingFlow_Gemini.json`
- **Database Migration**: `20250128_add_gemini_file_columns.sql`
- **Gemini File API Docs**: https://ai.google.dev/gemini-api/docs/files
