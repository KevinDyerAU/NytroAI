# Archived Shared Utilities

This directory contains shared utility modules that are no longer actively used in the current edge functions but are preserved for historical reference.

## Archived Files

### Prompt Modules

- **enhanced-validation-prompts.ts** - Earlier version of validation prompts, superseded by validation-prompts.ts
- **full-unit-validation-prompt.ts** - Full unit validation prompt, replaced by modular approach
- **question-prompts.ts** - Question generation prompts, functionality integrated into main validation flow

## Currently Active Modules

The following modules in the parent directory are actively used:

- **validation-prompts.ts** - Current validation prompt system (used by validate-assessment)
- **learner-guide-validation-prompt.ts** - Learner guide specific validation (used by validate-assessment)
- **gemini.ts** - Gemini API integration utilities
- **database.ts** - Database helper functions
- **supabase.ts** - Supabase client configuration
- **cors.ts** - CORS handling utilities
- **errors.ts** - Error handling utilities
- **types.ts** - Shared TypeScript types
- **validation-results.ts** - Validation result processing
- **store-validation-results.ts** - Database storage for validation results

## Note

These archived files may reference deprecated APIs or patterns. Refer to the active modules for current implementation patterns.
