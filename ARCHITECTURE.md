# NytroAI Architecture

> **Simple, Fast, Reliable** - Upload documents instantly, validation happens in the background.

## Overview

NytroAI validates training assessments against Australian Training Package requirements using AI and a database trigger system.

## How It Works

```
Upload (instant) → Background Processing → Results
```

### 1. Upload Phase (<1 Second)

User uploads assessment PDF → File saved to storage → **Done!**

User can immediately:
- Close browser
- Upload more files  
- Check dashboard for progress

### 2. Background Processing (Automatic)

**What Happens:**
1. `upload-document` edge function creates document record
2. Gemini indexes document (RAG)
3. DB trigger detects completion
4. `trigger-validation` fetches requirements as JSON
5. `validate-assessment` validates each requirement
6. Results stored in `validation_results` table

### 3. Results (Real-time)

Dashboard polls database and shows:
- Indexing progress
- Validation progress  
- Compliance results
- Smart questions for gaps

## Key Components

### Frontend
- **DocumentUploadSimplified** - File upload UI
- **Dashboard_v3** - Status tracking and results
- **ResultsExplorer_v2** - Detailed validation view

### Edge Functions
- **upload-document** - Creates document + starts indexing
- **trigger-validation** - Fetches requirements, calls validation
- **validate-assessment** - AI validation with JSON requirements
- **check-operation-status** - Status polling

### Database
- **document** - Uploaded files
- **gemini_operations** - Indexing status
- **validation_results** - Validation outcomes
- **requirements tables** - Training package requirements

### DB Trigger

```sql
CREATE TRIGGER auto_trigger_validation
AFTER UPDATE ON gemini_operations
FOR EACH ROW
EXECUTE FUNCTION trigger_validation_on_indexing_complete();
```

**Trigger Logic:**
- Monitors `gemini_operations` table
- When ALL operations complete for a validation
- Automatically calls `trigger-validation` edge function
- Zero polling, 100% reliable

## Data Flow

### Upload Flow
```
User → Storage → upload-document → document table → gemini_operations
```

### Validation Flow  
```
DB Trigger → trigger-validation → fetch requirements → validate-assessment → validation_results
```

### Requirements Flow
```
Training Package → requirements tables → JSON → AI Prompt → Validation
```

## Key Features

### Instant Upload
- Completes in <1 second
- No waiting for processing
- Can close browser immediately

### Fire-and-Forget
- Edge function called async
- Processing continues in background
- Errors don't block user

### JSON Requirements
- Fetched from database tables
- Structured format for AI
- Individual requirement tracking

### DB Triggers
- Automatic validation start
- No polling needed
- Atomic and reliable

## Validation Types

1. **Knowledge Evidence** - Theory and understanding
2. **Performance Evidence** - Practical demonstration
3. **Foundation Skills** - Core competencies
4. **Elements & Criteria** - Specific performance standards
5. **Assessment Conditions** - Environment and resources

## Logging

All edge functions log:
- **START** - Timestamp, request data
- **SUCCESS** - Duration, result summary
- **ERROR** - Full details, stack trace

Format: `[function-name] MESSAGE`

## Diagrams

### Complete Flow
![Simplified Upload Flow](docs/simplified-upload-flow.png)

### DB Trigger Mechanism
![DB Trigger Mechanism](docs/db-trigger-mechanism.png)

### System Architecture
![Architecture](docs/architecture.png)

### Validation Sequence
![Validation Flow](docs/validation-flow.png)

## Performance

| Metric | Value |
|--------|-------|
| Upload Time | <1 second |
| Indexing Time | 30-60 seconds |
| Validation Time | 60-120 seconds |
| Total Time | ~2-3 minutes |

## Error Handling

### Upload Errors
- Shown immediately to user
- Can retry upload

### Indexing Errors
- Visible in Dashboard
- Can retry from Dashboard

### Validation Errors
- Logged to database
- Status shows "Failed"
- Can retry validation

## Monitoring

Check Supabase logs for:
- `[upload-document]` - Upload issues
- `[trigger-validation]` - Trigger issues
- `[validate-assessment]` - Validation issues
- `[check-operation-status]` - Status issues

## Development

### Local Setup
```bash
npm install
npm run dev
```

### Deploy Edge Functions
```bash
supabase functions deploy
```

### Run Migrations
```bash
supabase db push
```

## See Also

- [README.md](README.md) - User guide
- [SIMPLIFIED_UPLOAD_FLOW.md](SIMPLIFIED_UPLOAD_FLOW.md) - Detailed flow
- [docs/FAQ.md](docs/FAQ.md) - Common questions
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Problem solving
