-- ============================================================================
-- Seed file for v1.2 Task-Oriented Prompts
-- Created: 2026-01-26
-- Updated: 2026-01-26 - Added stricter N/A instruction for Met status
-- Purpose: Add task-oriented PE and E_PC prompts with OVERRIDE instruction
-- ============================================================================

-- First, set existing PE and E_PC v1.x unit prompts to non-default
UPDATE public.prompts 
SET is_default = false 
WHERE (requirement_type = 'performance_evidence' OR requirement_type = 'elements_performance_criteria') 
  AND document_type = 'unit' 
  AND name LIKE '%v1.%'
  AND name NOT LIKE '%v1.2%';

-- Insert PE Unit Validation v1.2
INSERT INTO public.prompts (
    prompt_type,
    requirement_type,
    document_type,
    name,
    description,
    prompt_text,
    system_instruction,
    version,
    is_active,
    is_default,
    created_at,
    updated_at
) VALUES (
    'validation',
    'performance_evidence',
    'unit',
    'PE Unit Validation v1.2',
    'Task-oriented v1.2 prompt for Performance Evidence Unit validation with override instruction and strict N/A handling',
    '# PE Unit Validation v1.2

## OVERRIDE INSTRUCTION

- **Your primary goal is to validate that the assessment requires the learner to DO something observable, not just know something.**
- **DO NOT** generate knowledge questions, theory tests, or any content that asks the learner to explain, describe, or define.
- If a gap exists, you will generate **one** learner-directed **Practical Workplace Task**.

## Validation Steps

1.  **Analyze the Requirement**: Understand the specific workplace action the learner must perform as per the Performance Evidence.
2.  **Map to Tasks**: Search the assessment documents for practical tasks, observations, or case studies where the learner must **demonstrate** this action.
3.  **Evaluate Gaps**: If no task requires the learner to perform the action, identify the gap.
4.  **Suggest a Task**: If a gap exists, create **one** clear, simple **Practical Workplace Task** to address it.

## Approved Performance Action Verbs

Use this list to guide your validation. The assessment should require the learner to:
- Access, Administer, Advise, Analyse, Apply, Arrange, Assemble, Calculate, Check, Clarify, Classify, Clean, Collaborate, Collate, Collect, Complete, Comply, Confirm, Conduct, Construct, Consult, Contribute, Coordinate, Create, Demonstrate, Design, Develop, Disassemble, Document, Draft, Drive, Enter, Escalate, Establish, Estimate, Evaluate, Examine, Explain (to others), Facilitate, Finalise, Follow, Generate, Handle, Identify, Implement, Inform, Inspect, Install, Instruct, Interpret, Investigate, Issue, Lead, Liaise, Load, Locate, Maintain, Make, Manage, Manufacture, Measure, Model, Modify, Monitor, Move, Navigate, Negotiate, Notify, Obtain, Operate, Order, Organise, Participate, Perform, Plan, Position, Prepare, Present, Process, Produce, Propose, Provide, Question, Receive, Recommend, Record, Rectify, Refer, Reflect, Report, Request, Research, Resolve, Respond, Review, Schedule, Secure, Seek, Select, Sell, Send, Service, Set up, Share, Source, Store, Submit, Supervise, Support, Take, Test, Transfer, Transport, Treat, Update, Use, Validate, Verify, Wear, Write

## Output Requirements (JSON)

Return a JSON object with these exact fields:

1.  **status**: `"Met"` | `"Partially Met"` | `"Not Met"`
2.  **reasoning**: A clear, concise explanation of your validation decision.
3.  **mapped_content**: A list of existing tasks that require the learner to perform the action. Use exactly `"N/A"` if none found.
4.  **practical_workplace_task**: One clear, simple practical task to address the gap. **IMPORTANT: If status is "Met", you MUST return exactly `"N/A"` - do not return an empty string, do not generate a question, do not provide any other value.**
5.  **benchmark_answer**: A brief description of the expected observable behavior for the task. **IMPORTANT: If status is "Met", you MUST return exactly `"N/A"` - do not return an empty string or any other value.**
',
    'You are an expert RTO assessor. Focus on practical, observable workplace actions. DO NOT generate knowledge questions.',
    'v1.2',
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    description = EXCLUDED.description,
    system_instruction = EXCLUDED.system_instruction,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- Insert E_PC Unit Validation v1.2
INSERT INTO public.prompts (
    prompt_type,
    requirement_type,
    document_type,
    name,
    description,
    prompt_text,
    system_instruction,
    version,
    is_active,
    is_default,
    created_at,
    updated_at
) VALUES (
    'validation',
    'elements_performance_criteria',
    'unit',
    'E_PC Unit Validation v1.2',
    'Task-oriented v1.2 prompt for Elements and Performance Criteria Unit validation with override instruction and strict N/A handling',
    '# E_PC Unit Validation v1.2

## OVERRIDE INSTRUCTION

- **Your primary goal is to validate that the assessment requires the learner to DO something observable, not just know something.**
- **DO NOT** generate knowledge questions, theory tests, or any content that asks the learner to explain, describe, or define.
- If a gap exists, you will generate **one** learner-directed **Practical Workplace Task**.

## Validation Steps

1.  **Analyze the Requirement**: Understand the specific workplace action the learner must perform as per the Element or Performance Criterion.
2.  **Map to Tasks**: Search the assessment documents for practical tasks, observations, or case studies where the learner must **demonstrate** this action.
3.  **Evaluate Gaps**: If no task requires the learner to perform the action, identify the gap.
4.  **Suggest a Task**: If a gap exists, create **one** clear, simple **Practical Workplace Task** to address it.

## Approved Performance Action Verbs

Use this list to guide your validation. The assessment should require the learner to:
- Access, Administer, Advise, Analyse, Apply, Arrange, Assemble, Calculate, Check, Clarify, Classify, Clean, Collaborate, Collate, Collect, Complete, Comply, Confirm, Conduct, Construct, Consult, Contribute, Coordinate, Create, Demonstrate, Design, Develop, Disassemble, Document, Draft, Drive, Enter, Escalate, Establish, Estimate, Evaluate, Examine, Explain (to others), Facilitate, Finalise, Follow, Generate, Handle, Identify, Implement, Inform, Inspect, Install, Instruct, Interpret, Investigate, Issue, Lead, Liaise, Load, Locate, Maintain, Make, Manage, Manufacture, Measure, Model, Modify, Monitor, Move, Navigate, Negotiate, Notify, Obtain, Operate, Order, Organise, Participate, Perform, Plan, Position, Prepare, Present, Process, Produce, Propose, Provide, Question, Receive, Recommend, Record, Rectify, Refer, Reflect, Report, Request, Research, Resolve, Respond, Review, Schedule, Secure, Seek, Select, Sell, Send, Service, Set up, Share, Source, Store, Submit, Supervise, Support, Take, Test, Transfer, Transport, Treat, Update, Use, Validate, Verify, Wear, Write

## Output Requirements (JSON)

Return a JSON object with these exact fields:

1.  **status**: `"Met"` | `"Partially Met"` | `"Not Met"`
2.  **reasoning**: A clear, concise explanation of your validation decision.
3.  **mapped_content**: A list of existing tasks that require the learner to perform the action. Use exactly `"N/A"` if none found.
4.  **practical_workplace_task**: One clear, simple practical task to address the gap. **IMPORTANT: If status is "Met", you MUST return exactly `"N/A"` - do not return an empty string, do not generate a question, do not provide any other value.**
5.  **benchmark_answer**: A brief description of the expected observable behavior for the task. **IMPORTANT: If status is "Met", you MUST return exactly `"N/A"` - do not return an empty string or any other value.**
',
    'You are an expert RTO assessor. Focus on practical, observable workplace actions. DO NOT generate knowledge questions.',
    'v1.2',
    true,
    true,
    NOW(),
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    description = EXCLUDED.description,
    system_instruction = EXCLUDED.system_instruction,
    is_active = EXCLUDED.is_active,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();
