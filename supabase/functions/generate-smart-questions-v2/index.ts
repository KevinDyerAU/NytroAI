/**
 * Generate Smart Questions V2 Edge Function
 *
 * Updated to work with requirements arrays from the requirements-fetcher utility.
 * Generates SMART assessment questions for multiple requirements in a single call.
 * Uses Google Gemini File Search API for document-aware question generation.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';
import { fetchRequirements, formatRequirementsAsJSON, type Requirement } from '../_shared/requirements-fetcher.ts';
import { storeSmartQuestionsV2 } from '../_shared/store-validation-results-v2.ts';

interface GenerateSmartQuestionsRequest {
  documentId: number;
  unitCode: string;
  validationType: 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 'elements_criteria' | 'assessment_conditions';
  validationDetailId?: number;
  namespace?: string;
  requirementIds?: number[]; // Optional: only generate for specific requirements
  questionsPerRequirement?: number; // Default: 3
}

interface SmartQuestion {
  requirementId: number;
  requirementType: string;
  requirementText: string;
  question: string;
  benchmarkAnswer: string;
  questionType: 'knowledge' | 'practical' | 'scenario' | 'case_study';
  difficultyLevel: 'basic' | 'intermediate' | 'advanced';
  assessmentCategory: string;
  rationale: string;
  docReferences?: Array<{
    documentName: string;
    pageNumbers: number[];
    relevance: string;
  }>;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: GenerateSmartQuestionsRequest = await req.json();
    const {
      documentId,
      unitCode,
      validationType,
      validationDetailId,
      namespace,
      requirementIds,
      questionsPerRequirement = 3,
    } = requestData;

    if (!documentId || !unitCode || !validationType) {
      return createErrorResponse(
        'Missing required fields: documentId, unitCode, validationType'
      );
    }

    const supabase = createSupabaseClient(req);

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return createErrorResponse(`Document not found: ${documentId}`);
    }

    // Get unit
    const { data: unit, error: unitError } = await supabase
      .from('UnitOfCompetency')
      .select('*')
      .eq('unitCode', unitCode)
      .single();

    if (unitError || !unit) {
      return createErrorResponse(`Unit not found: ${unitCode}`);
    }

    // Fetch requirements using the new requirements fetcher
    console.log(`[Smart Questions V2] Fetching requirements for ${unitCode}, type: ${validationType}`);
    let requirements: Requirement[] = await fetchRequirements(supabase, unitCode, validationType, null, validationDetailId);

    // Filter to specific requirements if requested
    if (requirementIds && requirementIds.length > 0) {
      requirements = requirements.filter(r => requirementIds.includes(r.id));
      console.log(`[Smart Questions V2] Filtered to ${requirements.length} specific requirements`);
    }

    if (requirements.length === 0) {
      return createErrorResponse(`No requirements found for ${unitCode} - ${validationType}`);
    }

    console.log(`[Smart Questions V2] Generating questions for ${requirements.length} requirements`);

    // Format requirements as JSON for prompt
    const requirementsJSON = formatRequirementsAsJSON(requirements);

    // Build prompt for smart question generation
    const prompt = buildSmartQuestionPrompt(
      unit,
      validationType,
      requirementsJSON,
      questionsPerRequirement
    );

    // Determine document type and build metadata filter
    const documentType = 'assessment';
    let metadataFilter: string | undefined;
    if (namespace) {
      metadataFilter = `namespace="${namespace}" AND document-type="${documentType}"`;
      console.log(`[Smart Questions V2] Using namespace filter: ${namespace}`);
    } else if (unitCode) {
      metadataFilter = `unit-code="${unitCode}" AND document-type="${documentType}"`;
      console.log(`[Smart Questions V2] Using unit-code filter: ${unitCode}`);
    }

    // Generate questions using Gemini with File Search
    const gemini = createDefaultGeminiClient();
    const response = await gemini.generateContentWithFileSearch(
      prompt,
      [document.file_search_store_id],
      metadataFilter
    );

    console.log(`[Smart Questions V2] Gemini response received`);

    // Parse the response
    const smartQuestions = parseSmartQuestionsResponse(response.text, requirements);

    console.log(`[Smart Questions V2] Parsed ${smartQuestions.length} questions`);

    // Store questions using V2 storage function
    // This stores in both SmartQuestion table and updates validation_results
    const storeResult = await storeSmartQuestionsV2(
      supabase,
      validationDetailId || 0,
      unitCode,
      documentId,
      smartQuestions
    );

    if (!storeResult.success) {
      console.error('[Smart Questions V2] Error storing questions:', storeResult.error);
      return createErrorResponse(
        `Failed to store smart questions: ${storeResult.error?.message || 'Unknown error'}`
      );
    }

    console.log(`[Smart Questions V2] Saved ${storeResult.insertedCount} questions to database`);

    // Fetch the saved questions to return to client
    const { data: savedQuestions, error: fetchError } = await supabase
      .from('SmartQuestion')
      .select('*')
      .eq('unit_code', unitCode)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(smartQuestions.length);

    if (fetchError) {
      console.error('[Smart Questions V2] Error fetching saved questions:', fetchError);
    }

    return createSuccessResponse({
      success: true,
      questions: savedQuestions,
      count: savedQuestions.length,
      requirementsProcessed: requirements.length,
      message: `Generated ${savedQuestions.length} smart questions for ${requirements.length} requirements`,
    });
  } catch (error) {
    console.error('[Smart Questions V2] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
});

/**
 * Build prompt for smart question generation with JSON requirements
 */
function buildSmartQuestionPrompt(
  unit: any,
  validationType: string,
  requirementsJSON: string,
  questionsPerRequirement: number
): string {
  return `You are an expert RTO (Registered Training Organisation) assessment designer. Your task is to generate SMART assessment questions that test specific requirements.

**Unit of Competency**: ${unit.code} - ${unit.title}

**Validation Type**: ${validationType}

**Requirements** (JSON Array):
\`\`\`json
${requirementsJSON}
\`\`\`

**Task**:

For EACH requirement in the JSON array above, generate ${questionsPerRequirement} SMART assessment questions that:

1. **Directly test the requirement** - The question must specifically assess what the requirement describes
2. **Are assessable** - Clear, measurable, and can be objectively marked
3. **Use document context** - Reference or build upon content found in the assessment documents
4. **Are appropriate for the requirement type**:
   - Knowledge Evidence: Written questions testing understanding
   - Performance Evidence: Practical tasks or scenarios
   - Foundation Skills: Questions that require skill application
   - Elements & Criteria: Questions testing specific performance criteria
   - Assessment Conditions: Questions about assessment context/conditions

5. **Include a benchmark answer** - A model answer that demonstrates competency

**Required JSON Response Format**:

\`\`\`json
{
  "questions": [
    {
      "requirementId": <id from JSON>,
      "requirementType": "<type from JSON>",
      "requirementText": "<text from JSON>",
      "question": "The assessment question text",
      "benchmarkAnswer": "A comprehensive model answer demonstrating competency",
      "questionType": "knowledge" | "practical" | "scenario" | "case_study",
      "difficultyLevel": "basic" | "intermediate" | "advanced",
      "assessmentCategory": "written" | "practical" | "oral" | "observation",
      "rationale": "Why this question effectively tests the requirement",
      "docReferences": [
        {
          "documentName": "filename.pdf",
          "pageNumbers": [1, 2],
          "relevance": "How this document section relates to the question"
        }
      ]
    }
  ]
}
\`\`\`

**Important Guidelines**:
- Generate ${questionsPerRequirement} questions for EACH requirement
- Each question must be unique and test a different aspect if possible
- Questions should be realistic and practical for RTO assessment
- Benchmark answers should demonstrate competency, not just correctness
- Use Australian RTO standards and terminology
- Reference specific document content where relevant
- Ensure questions are clear, unambiguous, and professionally written

**Example Question Formats**:

*Knowledge Evidence*: "Explain the process of [concept from requirement]. Your answer should include [specific elements]."

*Performance Evidence*: "Demonstrate [task from requirement] by [specific action]. You must show [specific outcomes]."

*Foundation Skills*: "Using the information provided, [task requiring skill]. Document your process and explain your reasoning."

*Elements & Criteria*: "Perform [task] according to [criterion]. Provide evidence that you have [specific performance]."

Generate the questions now in the JSON format specified above.`;
}

/**
 * Parse Gemini response into SmartQuestion objects
 */
function parseSmartQuestionsResponse(
  responseText: string,
  requirements: Requirement[]
): SmartQuestion[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Smart Questions V2] No JSON found in response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('[Smart Questions V2] Invalid response structure');
      return [];
    }

    return parsed.questions.map((q: any) => ({
      requirementId: q.requirementId,
      requirementType: q.requirementType,
      requirementText: q.requirementText,
      question: q.question,
      benchmarkAnswer: q.benchmarkAnswer,
      questionType: q.questionType || 'knowledge',
      difficultyLevel: q.difficultyLevel || 'intermediate',
      assessmentCategory: q.assessmentCategory || 'written',
      rationale: q.rationale || '',
      docReferences: q.docReferences || [],
    }));
  } catch (error) {
    console.error('[Smart Questions V2] Error parsing response:', error);
    console.error('[Smart Questions V2] Response text:', responseText);
    return [];
  }
}
