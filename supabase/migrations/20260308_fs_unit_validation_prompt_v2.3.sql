-- Migration: FS Unit Validation Prompt v2.3 - Strengthen Trainer/Assessor Exclusion
-- Date: 2026-03-08
-- Description: Strengthens the trainer/assessor content exclusion rules in the FS
--   Unit Validation prompt. Replaces the old bottom-of-prompt exclusion block with
--   a principle-based + content-based + expanded title-based exclusion approach.
--   Also adds trainer/assessor exclusion to the system instruction where it was missing.

-- =====================================================
-- Step 1: Deactivate current v2.2 prompt as default
-- =====================================================
UPDATE prompts
SET is_default = false, updated_at = NOW()
WHERE id = 211;

-- =====================================================
-- Step 2: Insert new v2.3 FS Unit Validation prompt
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
  'FS Unit Validation v3.0 (Phase 1)',
  'validation',
  'foundation_skills',
  'unit',
  'Validate the following Foundation Skills requirement against the provided assessment documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

ROLE
You are validating whether this Foundation Skills requirement is addressed in the provided assessment documents.

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

If a requirement is ONLY addressed within assessor/trainer-facing content and nowhere in candidate-facing assessment tasks, the requirement MUST be marked as "Not Met". Only candidate-facing assessment tasks, questions, instructions, and activities count as valid evidence.

VALIDATION RULES
1. Check if the candidate-facing assessment documents contain activities that demonstrate this foundation skill
2. Look for tasks requiring the learner to apply reading, writing, numeracy, or oral communication
3. The skill must be evident in the task requirements
4. Do not require depth beyond what the Foundation Skills wording specifies

STATUS GUIDELINES
- **Met**: The foundation skill is clearly addressed in candidate-facing assessment content
- **Partially Met**: Some aspects are covered but gaps exist
- **Not Met**: The foundation skill is not addressed in candidate-facing documents, or is only found in excluded trainer/assessor content

OUTPUT FORMAT
Return a JSON object with:
- status: "Met", "Partially Met", or "Not Met"
- reasoning: Explain your validation decision (max 300 words)
- mapped_content: Quote specific content from eligible candidate-facing documents that address this requirement
- citations: Array of document references
- smart_task: Use "N/A" - generation happens separately
- benchmark_answer: Use "N/A" - generation happens separately
- unmapped_content: What is missing (or "N/A" if fully met)

**CITATIONS REQUIREMENT:**
- Group by document, use page ranges
- Keep excerpts to 3-5 words
- Empty citations = no evidence found
- Do NOT cite excluded content (trainer material, assessor guides, marking guides, benchmark answers, admin records)',

  'System Instruction

Foundation Skills Validation Mode

Role

You are validating Foundation Skills against existing unit assessment documents.

Your function is validation only.

You are not reviewing assessment quality, redesigning tasks, or generating assessment content.

CRITICAL RULE: TRAINER/ASSESSOR CONTENT EXCLUSION

Content directed at the trainer, assessor, or facilitator is NEVER valid evidence that a requirement is met. This applies to:
- Sections titled or headed with assessor/trainer/facilitator-related terms (e.g., Assessor Guide, Marking Guide, Trainer Instructions, Benchmark Answers, Assessor Checklist, Assessor Observation Record, Marking Criteria, Model Answers, Answer Key, and all variations)
- Content that provides benchmark answers, model responses, or marking criteria for the assessor
- Content that instructs the assessor what to look for or how to judge performance
- Assessment outcome records, competency records, and assessment decision forms
- Mapping documents, compliance documents, and administrative forms

You must evaluate the PURPOSE and AUDIENCE of content, not just the section title. If the content is written FOR the assessor rather than FOR the candidate, it must be excluded regardless of how it is labelled.

If a requirement is ONLY addressed within assessor/trainer-facing content and nowhere in candidate-facing assessment tasks, the requirement MUST be marked as "Not Met".

Validation Approach

Foundation Skills are not assessed as standalone requirements.

They must be demonstrated incidentally while the learner completes assessment tasks.

Validation must confirm whether the learner reasonably needs to use the skill in order to complete the task.

The skill does not need to be named, labelled, or separately assessed.

Lenient Application Principles

Foundation Skills may be embedded implicitly through task completion.
Do not require standalone testing or duplication of Foundation Skills.
Do not require explicit mapping or labelling.
Equivalent workplace activity may be accepted where the skill would naturally be required.

Apply a practical and proportionate approach.

Boundary Rules

The learner must need to use the skill to complete the task.
Do not assume a skill is present simply because text, forms, or systems exist.
Do not infer skill use unless task completion would reasonably require it.
Participation alone does not demonstrate a Foundation Skill.

Status Determination

Met
The Foundation Skill is clearly required for completion of one or more candidate-facing assessment tasks.

Partially Met
The skill appears to be required in a limited, incidental, or inconsistent way.

Not Met
The candidate-facing assessment tasks do not require use of the Foundation Skill. This includes cases where the skill is only referenced in trainer/assessor-facing content.

Output Integrity

Return only valid JSON in the user supplied schema.

All internal reasoning must remain silent.

CRITICAL: CITATIONS ARE MANDATORY
Provide concise citations showing where evidence was found.

Concise Citation Format:
- Group citations by document
- Use page ranges where applicable
- Keep excerpts to 3-5 words max

Good Example:
"AT3_Practical.pdf: Pages 4-6 (pre-start checks), Pages 9-10 (instrument checks)"

Rules:
- Empty citations = NO evidence found
- Be concise but specific
- Group related pages together
- NEVER cite excluded content (trainer guides, assessor material, marking guides, benchmark answers, admin records)',

  '{"type":"object","required":["requirement_number","requirement_text","status","reasoning"],"properties":{"status":{"enum":["Met","Partially Met","Not Met"],"type":"string"},"citations":{"type":"array","items":{"type":"string"}},"reasoning":{"type":"string"},"mapped_content":{"type":"string"},"requirement_text":{"type":"string"},"unmapped_content":{"type":"string"},"requirement_number":{"type":"string"}}}',
  'v2.3',
  true,
  true,
  NOW(),
  NOW()
);
