# NytroAI Prompt System: Architecture & Setup Guide

**Date**: November 30, 2025
**Author**: Manus AI

## 1. Introduction

NytroAI uses a powerful, database-driven prompt management system to ensure flexibility, version control, and high-quality AI responses. Instead of hardcoding prompts into the application logic, all prompts are stored in a dedicated `prompts` table in the Supabase PostgreSQL database. This allows for easy updates, A/B testing, and adaptation to new requirements without changing any application code.

This guide provides a comprehensive overview of the prompt system architecture, the database schema, and step-by-step instructions for setting up and managing your own prompts.

---

## 2. Prompt System Architecture

The core of the system is a dynamic lookup process performed by the **AI Validation Flow** in n8n. Before calling the Gemini API for each requirement, the workflow queries the `prompts` table to find the most appropriate prompt template.

### Lookup Logic

The workflow fetches the active, default prompt based on a combination of three key factors:

1.  **`prompt_type`**: The kind of task to be performed. For validation, this is always `'validation'`.
2.  **`requirement_type`**: The type of evidence being assessed (e.g., `'knowledge_evidence'`, `'performance_evidence'`).
3.  **`document_type`**: The type of document being analyzed (e.g., `'unit'` for assessment tools, `'learner_guide'` for content coverage).

The SQL query executed by the n8n workflow looks like this:

```sql
SELECT * 
FROM prompts 
WHERE 
  prompt_type = 'validation' AND
  requirement_type = '{{ $json.requirement_type }}' AND
  document_type = '{{ $json.document_type }}' AND
  is_active = true AND
  is_default = true
LIMIT 1;
```

This ensures that for any given validation task, the system retrieves the precise, version-controlled prompt designed for that specific context.

---

## 3. Database Schema: The `prompts` Table

The `prompts` table is the heart of the system. Each row represents a unique prompt template with all its associated configuration.

| Column | Type | Description |
| :--- | :--- | :--- |
| **`id`** | `BIGSERIAL` | Unique identifier for the prompt. |
| **`prompt_type`** | `TEXT` | **Primary Key 1**: The task type (e.g., `validation`, `smart_question`). |
| **`requirement_type`** | `TEXT` | **Primary Key 2**: The evidence type (e.g., `knowledge_evidence`, `all`). |
| **`document_type`** | `TEXT` | **Primary Key 3**: The document context (e.g., `unit`, `learner_guide`). |
| `name` | `TEXT` | A human-readable name for the prompt (e.g., "KE Unit Validation v1.1"). |
| `description` | `TEXT` | A brief explanation of what the prompt does. |
| **`prompt_text`** | `TEXT` | The main body of the prompt, with `{{variable}}` placeholders. |
| **`system_instruction`** | `TEXT` | The persona and high-level instructions for the AI model. |
| **`output_schema`** | `JSONB` | A JSON schema that defines the required structure of the AI's response. |
| `generation_config` | `JSONB` | Gemini API parameters (temperature, topP, max tokens, etc.). |
| `version` | `TEXT` | The version of the prompt (e.g., `v1.0`, `v1.1`). |
| `is_active` | `BOOLEAN` | If `true`, this prompt is available for use. Allows for soft-deleting. |
| `is_default` | `BOOLEAN` | If `true`, this is the default prompt for its key combination. |

---

## 4. Prompt Structure: A Deep Dive

A prompt in NytroAI is more than just a question; it's a complete configuration package for the AI. Let's break down an example.

### Example: Knowledge Evidence (KE) Prompt

Here are the four key components of the default prompt for validating **Knowledge Evidence** in a **Unit Assessment** document.

#### 1. System Instruction (`system_instruction`)
This sets the persona and overall goal for the AI.

> You are an expert RTO assessor validating Knowledge Evidence requirements against Unit assessment documents. You understand Australian VET standards and assessment principles. Provide accurate, evidence-based assessments with specific citations.

#### 2. Prompt Text (`prompt_text`)
This is the core task, with placeholders that the n8n workflow will replace with actual data from the validation session.

> Validate the following Knowledge Evidence requirement against the provided Unit assessment documents.
> 
> Requirement Number: {{requirement_number}}
> Requirement Text: {{requirement_text}}
> 
> Analyze the documents thoroughly and determine:
> 1. **Status**: Is this requirement Met, Partially Met, or Not Met?
> 2. **Reasoning**: Explain your assessment in detail.
> 3. **Mapped Content**: What specific questions, tasks, or content address this requirement?
> ... and so on.

#### 3. Output Schema (`output_schema`)
This is a critical component that forces the Gemini model to return a clean, structured JSON object. This makes the data easy to parse and save to the database.

```json
{
  "type": "object",
  "properties": {
    "requirement_number": {"type": "string"},
    "status": {"type": "string", "enum": ["Met", "Partially Met", "Not Met"]},
    "reasoning": {"type": "string"},
    "mapped_content": {"type": "string"},
    "recommendations": {"type": "string"},
    "confidence_score": {"type": "number"}
  },
  "required": ["requirement_number", "status", "reasoning"]
}
```

#### 4. Generation Config (`generation_config`)
These are the specific settings passed to the Gemini API to control the creativity and length of the response.

```json
{
  "temperature": 0.2,
  "topP": 0.95,
  "topK": 40,
  "maxOutputTokens": 8192,
  "responseMimeType": "application/json"
}
```

---

## 5. How to Set Up & Manage Prompts

Adding or updating prompts is done by writing simple SQL `INSERT` statements. You can do this directly in the Supabase SQL Editor.

### Step 1: Define the Prompt's Purpose
First, determine the context for your new prompt. What combination of `prompt_type`, `requirement_type`, and `document_type` will it serve?

### Step 2: Write the SQL `INSERT` Statement
Use the following template to create your new prompt.

```sql
INSERT INTO prompts (
  -- Lookup Keys
  prompt_type, requirement_type, document_type, 
  
  -- Identification
  name, description, 
  
  -- Core Content
  prompt_text, system_instruction, output_schema, 
  
  -- Versioning
  version, is_active, is_default
) VALUES (
  -- Lookup Values
  'validation', 'your_requirement_type', 'your_document_type',
  
  -- Identification Values
  'Your Prompt Name v1.0', 'A clear description of your prompt.',
  
  -- Core Content Values
  'Your main prompt text with {{placeholders}}.', 
  'Your system instruction persona for the AI.',
  '{\"type\": \"object\", \"properties\": { ... }}'::jsonb, -- Your JSON output schema
  
  -- Versioning Values
  'v1.0', true, true
);
```

### Step 3: Example - Creating a New "Safety Evidence" Prompt

Imagine you want to add a new, highly specialized prompt for a new requirement type called `safety_evidence`.

1.  **Deactivate the Old Default**: First, you would set `is_default = false` for any existing prompt that might conflict.
2.  **Insert the New Prompt**: Run the following in your Supabase SQL Editor.

```sql
-- Deactivate any old default for this combination
UPDATE prompts
SET is_default = false
WHERE 
  prompt_type = 'validation' AND
  requirement_type = 'safety_evidence' AND
  document_type = 'unit';

-- Insert the new default prompt
INSERT INTO prompts (
  prompt_type, requirement_type, document_type, 
  name, description, 
  prompt_text, system_instruction, output_schema, 
  version, is_active, is_default
) VALUES (
  'validation', 'safety_evidence', 'unit',
  'Safety Evidence Unit Validation v1.0', 'Validates safety requirements against unit assessments, focusing on WHS compliance.',
  'Analyze the following Safety Evidence requirement with a focus on WHS compliance. Is there a practical task that assesses this safety procedure? Requirement: {{requirement_text}}',
  'You are a certified WHS officer specializing in RTO compliance. Your analysis must be strict and reference Australian safety standards.',
  '{\"type\": \"object\", \"properties\": {\"status\": {\"type\": \"string\"}, \"whs_compliance_rating\": {\"type\": \"number\"}}}'::jsonb,
  'v1.0', true, true
);
```

### Step 4: Versioning

When you want to update a prompt, **do not `UPDATE` the existing row**. Instead:

1.  Set `is_active = false` and `is_default = false` on the old version.
2.  `INSERT` a new row with the updated content and an incremented `version` (e.g., `v1.1`).

This preserves the history of your prompts and allows you to easily roll back if a new prompt underperforms.

---

## 6. Default Prompts Included

The system comes pre-seeded with a set of default prompts covering the most common requirement and document types.

| Prompt Name | Requirement Type | Document Type |
| :--- | :--- | :--- |
| KE Unit Validation v1.0 | `knowledge_evidence` | `unit` |
| KE Learner Guide Validation v1.0 | `knowledge_evidence` | `learner_guide` |
| PE Unit Validation v1.0 | `performance_evidence` | `unit` |
| PE Learner Guide Validation v1.0 | `performance_evidence` | `learner_guide` |
| FS Unit Validation v1.0 | `foundation_skills` | `unit` |
| FS Learner Guide Validation v1.0 | `foundation_skills` | `learner_guide` |
| AC Unit Validation v1.0 | `assessment_conditions` | `unit` |
| E/PC Unit Validation v1.0 | `elements_performance_criteria` | `unit` |
| Generic Validation v1.0 | `all` | `both` |

This database-driven approach provides a powerful and flexible foundation for managing the AI's behavior, ensuring NytroAI can adapt and evolve to meet any validation challenge.
