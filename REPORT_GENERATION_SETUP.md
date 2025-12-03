# Report Generation Service - Setup and Integration Guide

## Overview

This document provides complete setup and integration instructions for the report generation service in NytroAI.

## What's New

The report generation service adds the ability to generate Assessment and Learner Guide reports directly from the Results Explorer. Reports are automatically stored in Supabase storage and can be downloaded at any time.

### Key Features

- **Two Report Types**: Assessment Report and Learner Guide Report
- **Automatic Storage**: Reports uploaded to Supabase storage
- **Button State Management**: Generate button disabled after successful generation
- **Report Retrieval**: View and download previously generated reports
- **Excel Format**: Formatted Excel files with color-coded status indicators
- **Data Integration**: Reports pull from validation_results table

## Files Added

### Core Services
- `src/lib/assessmentReportGeneratorWithStorage.ts` - Main report generation service
- `src/lib/reportStorageService.ts` - Supabase storage operations
- `src/lib/initializeReportStorage.ts` - Storage initialization utility

### React Hooks
- `src/hooks/useReportGenerationWithStorage.ts` - Report generation state management

### UI Components
- `src/components/ReportGenerationPopupWithStorage.tsx` - Report generation popup
- `src/components/ResultsExplorerWithReports.tsx` - Integration helper

### Modified Files
- `ResultsExplorer.tsx` - Added report button and popup integration

## Setup Instructions

### 1. Initialize Report Storage in App Startup

Add this to your main app component (e.g., `App.tsx` or `main.tsx`):

```typescript
import { useEffect } from 'react';
import { initializeReportStorage } from './lib/initializeReportStorage';

export function App() {
  useEffect(() => {
    // Initialize report storage on app startup
    initializeReportStorage();
  }, []);

  // ... rest of your app
}
```

### 2. Configure Supabase Storage Policies

Create the following policies in your Supabase dashboard for the `validation-reports` bucket:

**Public Read Policy:**
```sql
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'validation-reports');
```

**Authenticated Write Policy:**
```sql
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'validation-reports' 
  AND auth.role() = 'authenticated'
);
```

**Authenticated Delete Policy:**
```sql
CREATE POLICY "Allow authenticated users to delete own reports"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'validation-reports'
  AND auth.role() = 'authenticated'
);
```

### 3. Verify Environment Variables

Ensure your `.env` file contains:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Usage

### For Users

1. **Select a validation** in the Results Explorer
2. **Click "Generate Report"** button
3. **Choose report type**:
   - Assessment Report: Comprehensive validation with all evidence types
   - Learner Guide Report: Learner-focused with practical guidance
4. **Click "Generate & Store"**
5. **Report is generated and stored** automatically
6. **Download button appears** for previously generated reports

### For Developers

#### Generate a Report Programmatically

```typescript
import { generateAndStoreAssessmentReport } from './lib/assessmentReportGeneratorWithStorage';
import { ValidationEvidenceRecord } from './types/rto';

const result = await generateAndStoreAssessmentReport({
  validationDetailId: 123,
  unitCode: 'BSBOPS304',
  unitTitle: 'Manage Customer Relationships',
  rtoName: 'Example RTO',
  rtoCode: 'RTO123',
  validationType: 'assessment',
  validationResults: validationEvidenceData,
  createdDate: new Date().toISOString().split('T')[0],
});

if (result.success && result.report) {
  console.log('Report stored:', result.report.url);
}
```

#### Retrieve Stored Reports

```typescript
import { getReportsForValidation } from './lib/reportStorageService';

const reports = await getReportsForValidation('RTO123', 123);
reports.forEach(report => {
  console.log(`${report.filename}: ${report.url}`);
});
```

#### Download a Report

```typescript
import { downloadReportFromStorage } from './lib/reportStorageService';

downloadReportFromStorage(reportUrl, 'BSBOPS304_Assessment_Report.xlsx');
```

## Report Structure

### Assessment Report Sheets

1. **Cover** - Title page with validation metadata
2. **Summary** - Overall validation status and compliance statistics
3. **Knowledge Evidence** - KE requirements with mapping status
4. **Performance Evidence** - PE requirements with mapping status

### Learner Guide Report Sheets

1. **Cover** - Title page with validation metadata
2. **Summary** - Learner-focused validation summary
3. **Performance Evidence** - PE requirements (listed first)
4. **Knowledge Evidence** - KE requirements

## Data Mapping

Reports use the following data from `ValidationEvidenceRecord`:

| Field | Excel Column | Description |
|-------|--------------|-------------|
| `requirement_number` | Number | KE 1, PE 1, etc. |
| `requirement_text` | Requirement | Full requirement description |
| `status` | Mapping Status | Met / Not Met / Partial |
| `mapped_content` | Mapped Content | Evidence showing requirement is met |
| `reasoning` | Unmapped Content Reasoning | Explanation of gaps |
| `benchmark_answer` | Recommendations | Suggestions for improvement |
| `doc_references` | Document Reference | Source document references |

## Storage Structure

Reports are organized in Supabase storage as follows:

```
validation-reports/
  {rtoCode}/
    {validationDetailId}/
      {unitCode}_Assessment_Report_{date}.xlsx
      {unitCode}_Learner-Guide_Report_{date}.xlsx
```

Example:
```
validation-reports/
  RTO123/
    456/
      BSBOPS304_Assessment_Report_2024-12-03.xlsx
      BSBOPS304_Learner-Guide_Report_2024-12-03.xlsx
```

## Error Handling

The service includes comprehensive error handling:

- **Upload Failures**: Toast notification with error message
- **Storage Access Issues**: Logged to console with fallback
- **Network Errors**: Graceful error messages to user
- **File Size Limits**: Enforced at 50MB per file
- **Missing Data**: Validation before generation

## Troubleshooting

### Reports Not Uploading

1. Check Supabase credentials in `.env`
2. Verify bucket exists: Check Supabase dashboard Storage section
3. Verify storage policies are configured correctly
4. Check browser console for error messages

### Button Not Disabling After Generation

1. Verify `generatedReports` Map is updating in hook
2. Check that report generation returns success status
3. Ensure component re-renders after state change

### Missing Data in Reports

1. Verify `ValidationEvidenceRecord` data is complete
2. Check that requirement types are correctly identified (KE vs PE)
3. Ensure validation results are properly filtered

## Performance Considerations

- Reports are generated client-side using ExcelJS
- Large reports (100+ requirements) may take 2-3 seconds
- Storage uploads are asynchronous and don't block UI
- Previously generated reports are cached in component state

## Testing Checklist

- [ ] Report generation completes without errors
- [ ] Excel files are properly formatted with correct sheets
- [ ] Color-coding applied correctly to status cells
- [ ] Reports uploaded to Supabase storage
- [ ] Generate button disabled after successful generation
- [ ] Previously generated reports displayed in popup
- [ ] Download button works for stored reports
- [ ] Both Assessment and Learner Guide reports generate correctly
- [ ] Performance Evidence appears first in Learner Guide
- [ ] Knowledge Evidence included in both report types

## Support and Issues

For issues or questions:

1. Check the browser console for error messages
2. Review the troubleshooting section above
3. Verify all configuration steps were completed
4. Check Supabase dashboard for storage bucket and policies

## Future Enhancements

- Batch report generation
- Report scheduling
- Email delivery of reports
- Report templates for different assessment types
- Report version history
- Report signing/approval workflow
