/**
 * Phase 2 Generation - Generate smart questions/tasks for unmet requirements
 * 
 * This module handles the Phase 2 generation step of the split validation architecture:
 * - Only runs when validation status is "Partially Met" or "Not Met"
 * - Generates smart questions/tasks and benchmark answers
 * - Updates validation_results with the generated content
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGenerationPromptV2, formatPrompt, shouldRunGeneration } from './prompts-v2.ts';
import type { GeminiClient } from './gemini.ts';

export interface Phase2GenerationInput {
  requirementNumber: string;
  requirementText: string;
  status: string;
  unmappedContent: string;
  reasoning: string;
}

export interface Phase2GenerationOutput {
  smartQuestion?: string;
  smartTask?: string;
  benchmarkAnswer: string;
  recommendations: string;
}

/**
 * Run Phase 2 generation for a single requirement
 * 
 * @param supabase - Supabase client
 * @param gemini - Gemini client
 * @param validationType - The validation type
 * @param documentType - The document type
 * @param input - Phase 2 generation input
 * @param fileSearchStoreResourceName - File Search store resource name
 * @returns Phase 2 generation output or null if generation not needed
 */
export async function runPhase2Generation(
  supabase: SupabaseClient,
  gemini: GeminiClient,
  validationType: string,
  documentType: 'unit' | 'learner_guide',
  input: Phase2GenerationInput,
  fileSearchStoreResourceName: string
): Promise<Phase2GenerationOutput | null> {
  // Check if generation is needed
  if (!shouldRunGeneration(input.status)) {
    console.log(`[Phase 2] Skipping generation for requirement ${input.requirementNumber} - status is Met`);
    return null;
  }

  console.log(`[Phase 2] Running generation for requirement ${input.requirementNumber} - status: ${input.status}`);

  // Fetch Phase 2 generation prompt
  const generationPrompt = await getGenerationPromptV2(supabase, validationType, documentType);
  
  if (!generationPrompt) {
    console.log(`[Phase 2] No generation prompt found for ${validationType}/${documentType} - skipping`);
    return null;
  }

  console.log(`[Phase 2] Using generation prompt: ${generationPrompt.name} (v${generationPrompt.version})`);

  // Format the prompt with placeholders
  const formattedPrompt = formatPrompt(generationPrompt.prompt_text, {
    requirement_number: input.requirementNumber,
    requirement_text: input.requirementText,
    status: input.status,
    unmapped_content: input.unmappedContent,
    reasoning: input.reasoning,
  });

  // Call Gemini with File Search
  console.log(`[Phase 2] Calling Gemini for requirement ${input.requirementNumber}...`);
  const response = await gemini.generateContentWithFileSearch(
    formattedPrompt,
    [fileSearchStoreResourceName],
    undefined // No filter
  );

  console.log(`[Phase 2] Gemini response received for requirement ${input.requirementNumber}`);
  console.log(`[Phase 2] Response length: ${response.text.length} characters`);

  // Parse the response
  try {
    const parsed = parsePhase2Response(response.text);
    console.log(`[Phase 2] Successfully parsed generation output for requirement ${input.requirementNumber}`);
    return parsed;
  } catch (error) {
    console.error(`[Phase 2] Error parsing generation response for requirement ${input.requirementNumber}:`, error);
    return null;
  }
}

/**
 * Parse Phase 2 generation response
 * 
 * @param responseText - The AI response text
 * @returns Parsed Phase 2 generation output
 */
function parsePhase2Response(responseText: string): Phase2GenerationOutput {
  // Try to extract JSON from the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    smartQuestion: parsed.smart_question || parsed.smartQuestion,
    smartTask: parsed.smart_task || parsed.smartTask,
    benchmarkAnswer: parsed.benchmark_answer || parsed.benchmarkAnswer || '',
    recommendations: parsed.recommendations || '',
  };
}

/**
 * Update validation_results with Phase 2 generation output
 * 
 * @param supabase - Supabase client
 * @param validationDetailId - The validation detail ID
 * @param requirementId - The requirement ID
 * @param output - Phase 2 generation output
 * @returns Success status
 */
export async function updateValidationWithPhase2(
  supabase: SupabaseClient,
  validationDetailId: number,
  requirementId: number,
  output: Phase2GenerationOutput
): Promise<boolean> {
  console.log(`[Phase 2] Updating validation_results for requirement ${requirementId}...`);

  const updateData: any = {
    benchmark_answer: output.benchmarkAnswer || '',
    recommendations: output.recommendations || '',
  };

  // Add smart_question or smart_task depending on which is present
  if (output.smartQuestion) {
    updateData.smart_questions = output.smartQuestion;
  } else if (output.smartTask) {
    updateData.smart_questions = output.smartTask;
  }

  const { error } = await supabase
    .from('validation_results')
    .update(updateData)
    .eq('val_detail_id', validationDetailId)
    .eq('requirement_id', requirementId);

  if (error) {
    console.error(`[Phase 2] Error updating validation_results:`, error);
    return false;
  }

  console.log(`[Phase 2] Successfully updated validation_results for requirement ${requirementId}`);
  return true;
}
