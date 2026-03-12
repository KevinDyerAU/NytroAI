-- Migration: AI Unit Validation Prompt v2.9 - Strengthen Trainer/Assessor Exclusion
-- Date: 2026-03-08
-- Description: Strengthens the trainer/assessor content exclusion rules in the AI
--   (Assessment Instructions) Unit Validation prompt. Replaces the old bottom-of-prompt
--   exclusion block with a principle-based + content-based + expanded title-based
--   exclusion approach. Also adds trainer/assessor exclusion to the system instruction.

-- =====================================================
-- Step 1: Deactivate current v2.8 prompt as default
-- =====================================================
UPDATE prompts
SET is_default = false, updated_at = NOW()
WHERE id = 235;

-- =====================================================
-- Step 2: Insert new v2.9 AI Unit Validation prompt
-- =====================================================
INSERT INTO prompts (
  name,
  prompt_type,
  requirement_type,
  document_type,
  prompt_text,
  system_instruction,
  output_schema,
  version,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'Assessment Instructions Validation v3.1',
  'validation',
  'assessment_instructions',
  'unit',
  'Your task is to analyse the assessment documents to validate that clear, comprehensive instructions are provided for candidates.
**Unit of Competency**: {unit_code} - {unit_title}
**Assessment Instructions to Validate**:
Assessment instructions only.
Definition
Assessment instructions are present if the document clearly tells the candidate what they must do and what they must submit or provide as evidence.

EXCLUDED CONTENT — MUST BE APPLIED BEFORE VALIDATION

PRINCIPLE: Any content whose primary audience is the trainer, assessor, or facilitator — rather than the candidate or learner — MUST be excluded entirely. Do not use it as evidence, cite it, or reference it in mapped_content. This exclusion applies regardless of how the section is titled. You must evaluate the PURPOSE and AUDIENCE of each section, not just its heading.

EXCLUDE content matching ANY of the following:

Title-based exclusions — Exclude sections with titles or headings containing any of these terms or close variations:
- Trainer Instructions, Instructor Instructions, Assessor Instructions, Instructions to Trainer, Instructions to Assessor, Instructions for the Assessor, Notes for Assessor, Notes for Trainer
- Trainer Guide, Facilitator Guide, Facilitator Notes, Facilitator Instructions, Assessor Guide, Trainer/Assessor Guide, Trainer and Assessor Guide, Trainer and Assessor Instructions, Delivery Guide
- Marking Guide, Marking Criteria, Marking Checklist, Marking Sheet, Marking Rubric
- Answer Guide, Answer Key, Benchmark Answers, Model Answers, Suggested Answers, Sample Answers, Expected Responses, Acceptable Answers
- Assessor Checklist, Assessor Observation, Assessor Observation Record, Assessor Observation Checklist, Assessor Feedback, Assessor Judgement, Assessor Record
- Assessor Use Only, For Assessor Use, For the Assessor, Assessor Copy, Assessor Version
- Assessment Record, Record of Assessment, Competency Record, Record of Outcome, Assessment Decision, Assessment Outcome Record, Assessment Judgement
- Training Record Book, Competency Map, Competency Mapping, Mapping Document, Mapping Matrix, Assessment Mapping
- Assessment Plan, Assessment Summary, Assessment Cover Sheet, Reasonable Adjustment

Content-based exclusions — Even if a section has no clear assessor-related title, exclude it if the content:
- Provides benchmark answers, model responses, or suggested answers for the assessor to compare against
- Instructs the assessor on what to look for, how to mark, or what constitutes satisfactory performance
- Records assessment outcomes, decisions, or judgements (e.g., Satisfactory/Not Yet Satisfactory checkboxes for the assessor to complete)
- Contains phrases directed at the assessor such as: "the assessor should", "the assessor must", "look for evidence of", "satisfactory performance includes", "the trainer will", "assessor to complete", "for assessor use"
- Is a compliance, mapping, or administrative document not requiring candidate action

Document-level exclusion — If a document is primarily an assessor guide, marking guide, or benchmark answer document (i.e., the majority of its content is directed at the assessor), the ENTIRE document must be excluded. Do not extract individual sentences from an assessor-facing document to use as candidate evidence.

If assessment instructions are ONLY found within assessor/trainer-facing content and nowhere in candidate-facing assessment content, the requirement MUST be marked as "Not Met". Only candidate-facing assessment tasks, questions, instructions, and activities count as valid evidence.

Leniency rule
Be very lenient. If a reasonable candidate can understand what to do and what to submit, mark Met.
Scope control
Only assess whether candidate-facing instructions are clear. Do not assess assessment validity, mapping, compliance, answer keys, or assessment design. Ignore all content not directly related to what the candidate must do and what they must submit. If candidate-facing instructions are present, the requirement must be marked Met regardless of other issues within the document.
Decision process
Identify candidate instructions or task directions.
Confirm whether both requirements are present. What to do and what to submit.
Assign a status of Met, Partially Met, or Not Met.
Recommendations rule
Only include recommendations if the status is Partially Met or Not Met.
Recommendations must be brief and practical.
Output rules
Return only the user provided JSON schema.
Use plain text only in all fields.
Reasoning must be one or two sentences maximum.
Return only the JSON structure with plain text values.',

  'You are an expert RTO validator. Return all text as PLAIN TEXT ONLY - no HTML, no markdown, no tables, no formatting tags. Keep responses concise.

CRITICAL RULE: TRAINER/ASSESSOR CONTENT EXCLUSION

Content directed at the trainer, assessor, or facilitator is NEVER valid evidence that candidate-facing instructions exist. This applies to:
- Sections titled or headed with assessor/trainer/facilitator-related terms (e.g., Assessor Guide, Marking Guide, Trainer Instructions, Benchmark Answers, Assessor Checklist, Assessor Observation Record, Marking Criteria, Model Answers, Answer Key, and all variations)
- Content that provides benchmark answers, model responses, or marking criteria for the assessor
- Content that instructs the assessor what to look for or how to judge performance
- Assessment outcome records, competency records, and assessment decision forms
- Mapping documents, compliance documents, and administrative forms

You must evaluate the PURPOSE and AUDIENCE of content, not just the section title. If the content is written FOR the assessor rather than FOR the candidate, it must be excluded regardless of how it is labelled.

Instructions found only in trainer/assessor-facing sections do not count as candidate-facing instructions.',

  NULL,
  'v2.9',
  true,
  true,
  NOW(),
  NOW()
);
