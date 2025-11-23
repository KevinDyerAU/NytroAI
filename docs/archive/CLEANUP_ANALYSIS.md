# Comprehensive Cleanup Analysis

## Overview

This document outlines all cleanup actions to be performed on the NytroAI repository to improve maintainability, reduce complexity, and enhance user experience.

## Current State

**Branch:** comprehensive-cleanup  
**Base:** main  
**Status:** In progress

## Cleanup Categories

### 1. Duplicate Component Versions

**Components with version suffixes:**
- `Dashboard_v2.tsx` (unused)
- `Dashboard_v3.tsx` (active - used in dashboard.tsx)
- `ResultsExplorer_v2.tsx` (active - used in dashboard.tsx)
- `DocumentUploadRefactored_v2.tsx` (unused - v1 is used via adapter)

**Action:**
- Remove unused versions: Dashboard_v2, DocumentUploadRefactored_v2
- Rename active versions to remove version suffixes:
  - Dashboard_v3.tsx → Dashboard.tsx
  - ResultsExplorer_v2.tsx → ResultsExplorer.tsx
- Update imports in dashboard.tsx

### 2. Technical Documentation

**Files to archive:**
- AUTO_TRIGGER_IMPLEMENTATION_SUMMARY.md
- COLUMN_NAMING_FIX.md
- DOCUMENT_UPLOAD_STUCK_FIX.md
- IMPLEMENTATION_CHECKLIST.md
- MIGRATION_COLUMN_FIX_NOTES.md

**Action:**
- Move to docs/archive/technical/
- Keep README.md, CONTRIBUTING.md, CHANGELOG.md, QUICK_START.md in root

### 3. Migration Files

**Already cleaned up:**
- Deprecated migrations moved to supabase/migrations/archive/
- Consolidated schema in 20250123_consolidated_schema.sql

**Status:** ✅ Complete

### 4. Edge Functions

**Current functions (19 total):**
- check-operation-status
- create-checkout-session
- create-validation-record
- fetch-units-of-competency
- generate-smart-questions
- generate-validation-report
- get-ai-credits
- get-dashboard-metrics
- get-gemini-operation-status
- get-validation-credits
- query-document
- scrape-training-gov-au
- stripe-webhook
- trigger-validation
- upload-document
- upload-files-to-storage
- validate-assessment

**Analysis needed:**
- Check for duplicate or deprecated functions
- Verify all are actively used
- Review _shared utilities for consolidation opportunities

### 5. Visual Improvements

**New assets created:**
- docs/architecture.mmd + architecture.png
- docs/validation-flow.mmd + validation-flow.png
- Updated README.md with visual diagrams

**Status:** ✅ Complete

## Implementation Plan

### Phase 1: Component Cleanup
1. Remove Dashboard_v2.tsx
2. Remove DocumentUploadRefactored_v2.tsx
3. Rename Dashboard_v3.tsx → Dashboard.tsx
4. Rename ResultsExplorer_v2.tsx → ResultsExplorer.tsx
5. Update imports in src/pages/dashboard.tsx

### Phase 2: Documentation Cleanup
1. Create docs/archive/technical/ directory
2. Move technical docs to archive
3. Update any references in remaining docs

### Phase 3: Edge Function Review
1. Audit all edge functions for usage
2. Check for deprecated or duplicate functions
3. Review _shared utilities
4. Document findings

### Phase 4: Final Verification
1. Test application builds successfully
2. Verify no broken imports
3. Run basic functionality tests
4. Update CHANGELOG.md

### Phase 5: Create Pull Request
1. Stage all changes
2. Write comprehensive commit message
3. Push to comprehensive-cleanup branch
4. Create PR with detailed description

## Success Criteria

- ✅ No duplicate component versions
- ✅ Clean, professional root directory
- ✅ Technical docs archived appropriately
- ✅ All imports working correctly
- ✅ Application builds and runs
- ✅ Visual diagrams integrated
- ✅ Comprehensive PR created

## Risk Assessment

**Low Risk:**
- Removing unused components (not imported anywhere)
- Moving technical docs (not referenced in code)
- Adding visual diagrams

**Medium Risk:**
- Renaming active components (requires import updates)
- Must verify all import paths are updated

**Mitigation:**
- Test build after each major change
- Use grep to find all import references
- Keep git history for easy rollback
