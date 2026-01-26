# Changelog

All notable changes to the NytroAI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Task-Oriented Prompts v1.2 (2026-01-26)

#### Added
- **v1.2 Task-Oriented Prompts**: New PE and E_PC Unit validation prompts with explicit OVERRIDE instruction
  - `PE Unit Validation v1.2`: Task-oriented prompt for Performance Evidence validation
  - `E_PC Unit Validation v1.2`: Task-oriented prompt for Elements and Performance Criteria validation
  - Both prompts include approved performance action verbs list
  - Both prompts focus on observable workplace actions, not knowledge questions
- SQL seed file: `supabase/seed/seed_prompts_v1.2.sql`

#### Changed
- Set v1.1 PE and E_PC Unit prompts to non-default (preserved for rollback)
- Deactivated all v0.1 and v0.2 prompts (preserved for reference)

#### Fixed
- Addressed issue where validation was generating knowledge-based questions instead of practical workplace tasks

### Documentation Overhaul (2025-11-29)

#### Added
- New simplified architecture diagrams (Mermaid + PNG)
  - `docs/diagrams/simplified-architecture.mmd` and `.png`
  - `docs/diagrams/document-processing-flow.mmd` and `.png`
  - `docs/diagrams/validation-flow.mmd` and `.png`
- Comprehensive new README with costs, rate limits, and validation strategy

#### Changed
- **README.md** - Complete rewrite focusing on:
  - Simplified Gemini File API architecture (not File Search Stores)
  - Individual requirement validation strategy
  - Clear costs ($35-85/month) and rate limits (15-1000 RPM)
  - Session context isolation
  - Removed Google AI Studio references (now Gemini API)
  - Removed outdated upload pipeline documentation

#### Removed
- **37 outdated documentation files** including:
  - Root level: ARCHITECTURE.md, DEVELOPER_GUIDE.md, EDGE_FUNCTIONS.md, MIGRATION_GUIDE.md, PER_VALIDATION_STORES.md, PR_DESCRIPTION.md, QUICK_START.md, README_N8N.md, README_OLD.md, and 12 more
  - docs/: ARCHITECTURE.md, MIGRATION_GUIDE.md, N8N_*.md files, TROUBLESHOOTING.md, UPLOAD_FLOW.md, USER_GUIDE.md, and 10 more
  - docs/migration/: Entire directory removed
  - Outdated guides, archive folders, and migration scripts

### Enhanced Validation System (2025-11-28)

#### Added
- Individual requirement validation workflow
- Rate limiting and retry logic
- Session context isolation
- Database-driven prompts system
- Real-time progress tracking
- Enhanced workflow: `AIValidationFlow_Gemini_Enhanced.json`
- Comprehensive prompts documentation (77KB)

#### Changed
- Validation strategy from batch to individual (accuracy priority)
- Architecture from 5 platforms to 3 platforms
- Cost from $150-210/month to $35-85/month (78-85% reduction)

### Planned
- Phase 4: AI prompt optimization
- Performance tracking and metrics
- Prompt versioning system
- A/B testing framework

## [1.0.0] - 2025-01-22

### Added
- Complete migration from Nytro to NytroAI
- Beautiful landing page with 3D visualizations
- Integrated authentication system
- AI-powered validation using Gemini 2.0
- Document processing with Gemini File Search API
- Real-time status updates via Supabase subscriptions
- Comprehensive error handling with user-friendly messages
- Consolidated validation_results table
- Database triggers for automatic status updates
- Smart question generation
- Detailed compliance reporting
- Citation support for traceability

### Changed
- Consolidated 9 validation tables into single validation_results table
- Standardized all database columns to snake_case naming
- Improved validation workflow with proper status tracking
- Enhanced error messages with actionable solutions
- Optimized database queries with computed columns

### Fixed
- Critical column name mismatch preventing validation trigger
- Database function signature ambiguity errors
- Silent update failures in validation_detail table
- UI error handling and timeout issues
- Status not updating correctly through validation stages

## Phase History

### Phase 3.3 - Validation Kickoff Fixes (2025-01-22)
**Critical Fix:** Resolved column name mismatches that prevented validation from triggering

- Fixed snake_case vs camelCase column name issues
- Updated ValidationWorkflowService.ts
- Updated trigger-validation edge function
- Updated ValidationProgressTracker component
- Validation now triggers correctly after document processing

### Phase 3.2 - UI Error Handling (2025-01-22)
**Focus:** Comprehensive error handling and user experience improvements

- Fixed database function signature ambiguity
- Added ValidationStatusMessage component
- Created ResultsExplorer_v2 with robust error handling
- Implemented retry logic and timeout indicators
- Categorized errors with clear user-friendly messages

### Phase 3.1 - Dashboard Status Consistency (2025-01-22)
**Focus:** Real-time status updates and dashboard improvements

- Implemented real-time Supabase subscriptions
- Added computed columns with database triggers
- Created ValidationStatusCard component
- Built Dashboard_v2 with live status indicators
- Eliminated polling-based status checks

### Phase 2 - Database Schema Consolidation (2025-01-21)
**Focus:** Database optimization and standardization

- Consolidated 9 validation tables into one
- Standardized column naming to snake_case
- Created data migration scripts
- Built shared database utilities
- Migrated 1,746 validation records successfully

### Phase 1 - Component Migration (2025-01-20)
**Focus:** Initial migration from Nytro to NytroAI

- Migrated all 132 TypeScript files
- Integrated landing page with authentication
- Configured React Router with protected routes
- Ensured Google AI Studio compatibility
- Set up project structure and dependencies

## Migration Statistics

- **Files Migrated:** 132 TypeScript files
- **Database Records Migrated:** 1,746 validation results
- **Tables Consolidated:** 9 → 1
- **Edge Functions Created:** 15+
- **Documentation Pages:** 25+
- **Lines of Code:** ~15,000+

## Contributors

- Kevin Dyer (@KevinDyerAU) - Project Owner
- Manus AI - Migration and Development

---

[Unreleased]: https://github.com/KevinDyerAU/NytroAI/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/KevinDyerAU/NytroAI/releases/tag/v1.0.0
