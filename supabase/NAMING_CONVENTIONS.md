# Database Naming Conventions

## Overview

This document outlines the standardized naming conventions applied to the NytroAI database schema, particularly for the consolidated `validation_results` table.

## General Principles

### 1. **snake_case for All Identifiers**
- All table names, column names, and database objects use `snake_case`
- Example: `validation_detail_id`, not `valDetailId` or `ValidationDetailId`

### 2. **Descriptive Names**
- Names should clearly indicate their purpose
- Avoid abbreviations unless widely understood
- Example: `requirement_text` instead of `req_txt`

### 3. **Consistent Suffixes**
- `_id` for foreign key columns
- `_at` for timestamp columns
- `_count` for counter columns
- `_url` for URL columns

### 4. **Plural for Arrays**
- JSONB arrays use plural names
- Example: `smart_questions` not `smart_question`

## Specific Conventions

### Foreign Keys
```sql
validation_detail_id  -- References validation_detail(id)
validation_type_id    -- References validation_type(id)
requirement_id        -- References requirement tables
rto_id                -- References RTO(id)
```

**Old (Inconsistent):**
- `valDetail_id` (camelCase)
- `requirementId` (camelCase)

**New (Consistent):**
- `validation_detail_id` (snake_case)
- `requirement_id` (snake_case)

### Requirement Columns

All requirement-related columns now use generic names instead of type-specific names:

| Old Column Names | New Column Name | Description |
|-----------------|----------------|-------------|
| `ke_number`, `pe_number`, `fs_number`, `epc_number`, `ac_number` | `requirement_number` | Requirement identifier |
| `ke_requirement`, `pe_requirement`, `fs_requirement`, `performance_criteria`, `ac_point`, `condition_point`, `knowled_point`, `skill_point` | `requirement_text` | Full text of requirement |

### Content Columns

Standardized names for validation content:

| Old Column Names | New Column Name | Description |
|-----------------|----------------|-------------|
| `mapped_questions`, `mapped_content` | `mapped_content` | Content that maps to requirement |
| `unmappedContent`, `unmappedContentExplanation` | `unmapped_content` | Missing or unmapped content |
| `unmappedRecommendations`, `unmappedContentRecommendation`, `recommendation` | `recommendations` | Improvement recommendations |
| `docReferences` | `doc_references` | Document references |

### Smart Questions

**Old Structure (Separate Columns):**
```sql
smart_question TEXT
benchmarkAnswer TEXT
```

**New Structure (JSONB Array):**
```sql
smart_questions JSONB DEFAULT '[]'
-- Format: [{"question": "...", "benchmark_answer": "...", "type": "smart"}]
```

### Timestamps

All timestamp columns use the `_at` suffix:

```sql
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
completed_at TIMESTAMP
started_at TIMESTAMP
uploaded_at TIMESTAMP
```

### Status and State Columns

```sql
status TEXT  -- Current state (met, not-met, partial, pending)
embedding_status TEXT  -- Document embedding state
extract_status TEXT  -- Extraction state
```

### Boolean Columns

Use `is_` prefix for boolean columns:

```sql
is_learner_guide BOOLEAN
is_active BOOLEAN
is_current BOOLEAN
```

## Migration Mapping

### validation_results Table

Complete mapping from old validation tables to new consolidated table:

#### Knowledge Evidence Validations
```sql
-- Old Table: knowledge_evidence_validations
valDetail_id          → validation_detail_id
requirementId         → requirement_id
ke_number             → requirement_number
ke_requirement        → requirement_text
mapped_questions      → mapped_content
unmappedContent       → unmapped_content
unmappedRecommendations → recommendations
docReferences         → doc_references
smart_question        → smart_questions[0].question
benchmarkAnswer       → smart_questions[0].benchmark_answer
```

#### Performance Evidence Validations
```sql
-- Old Table: performance_evidence_validations
valDetail_id          → validation_detail_id
requirementId         → requirement_id
pe_number             → requirement_number
pe_requirement        → requirement_text
mapped_questions      → mapped_content
unmappedContent       → unmapped_content
unmappedRecommendations → recommendations
docReferences         → doc_references
smart_question        → smart_questions[0].question
benchmarkAnswer       → smart_questions[0].benchmark_answer
```

#### Foundation Skills Validations
```sql
-- Old Table: foundation_skills_validations
valDetail_id          → validation_detail_id
requirementId         → requirement_id
fs_number             → requirement_number
fs_requirement        → requirement_text
mapped_questions      → mapped_content
unmappedContent       → unmapped_content
unmappedRecommendations → recommendations
docReferences         → doc_references
```

#### Elements and Performance Criteria Validations
```sql
-- Old Table: elements_performance_criteria_validations
valDetail_id                  → validation_detail_id
requirementId                 → requirement_id
epc_number                    → requirement_number
performance_criteria          → requirement_text
mapped_questions              → mapped_content
unmappedContentExplanation    → unmapped_content
unmappedContentRecommendation → recommendations
docReferences                 → doc_references
```

#### Assessment Conditions Validations
```sql
-- Old Table: assessment_conditions_validations
valDetail_id          → validation_detail_id
requirementId         → requirement_id
(generated)           → requirement_number ('AC-' + id)
ac_point              → requirement_text
reasoning             → reasoning
recommendation        → recommendations
```

## Backward Compatibility

A legacy view is provided for backward compatibility:

```sql
CREATE VIEW validation_results_legacy AS
SELECT 
  id,
  validation_detail_id as "valDetail_id",
  requirement_id as "requirementId",
  mapped_content as mapped_questions,
  unmapped_content as "unmappedContent",
  recommendations as "unmappedRecommendations",
  doc_references as "docReferences",
  ...
FROM validation_results;
```

This view allows old queries to continue working during the migration period.

## Benefits of Consistent Naming

1. **Easier to Read**: snake_case is more readable than camelCase in SQL
2. **Predictable**: Developers can guess column names without checking schema
3. **Maintainable**: Consistent patterns make code easier to maintain
4. **Portable**: snake_case is standard across most SQL databases
5. **Tooling**: Better support in database tools and ORMs

## Enforcement

- All new tables MUST follow these conventions
- All new columns MUST follow these conventions
- Migrations SHOULD update old tables to follow conventions
- Legacy views MAY be provided for backward compatibility

## Examples

### Good Examples ✅
```sql
CREATE TABLE validation_results (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT,
  requirement_text TEXT,
  created_at TIMESTAMP,
  smart_questions JSONB
);
```

### Bad Examples ❌
```sql
CREATE TABLE ValidationResults (  -- PascalCase table name
  ID BIGSERIAL PRIMARY KEY,       -- UPPERCASE column
  valDetailId BIGINT,             -- camelCase column
  reqTxt TEXT,                    -- Abbreviated name
  CreatedAt TIMESTAMP,            -- PascalCase column
  smartQuestion TEXT              -- Singular for array data
);
```

## References

- PostgreSQL Naming Conventions: https://www.postgresql.org/docs/current/sql-syntax-lexical.html
- SQL Style Guide: https://www.sqlstyle.guide/
