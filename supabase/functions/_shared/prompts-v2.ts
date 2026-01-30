/**
 * Prompts V2 - Fetch prompts from the new prompts table
 * 
 * This module supports the split validation architecture:
 * - Phase 1: Validation only prompts (always run)
 * - Phase 2: Generation prompts (only run when status != "Met")
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface PromptV2 {
  id: number;
  prompt_type: 'validation' | 'generation';
  requirement_type: string;
  document_type: string;
  name: string;
  prompt_text: string;
  system_instruction: string | null;
  output_schema: Record<string, any> | null;
  version: string;
}

/**
 * Map validation type to requirement_type in the prompts table
 */
const validationTypeToRequirementType: Record<string, string> = {
  'knowledge_evidence': 'knowledge_evidence',
  'performance_evidence': 'performance_evidence',
  'foundation_skills': 'foundation_skills',
  'elements_criteria': 'performance_criteria',
  'elements_performance_criteria': 'performance_criteria',
  'assessment_conditions': 'assessment_conditions',
  'assessment_instructions': 'assessment_instructions',
};

/**
 * Fetch the default validation prompt (Phase 1) from the prompts table
 * 
 * @param supabase - Supabase client
 * @param validationType - The type of validation (e.g., 'knowledge_evidence')
 * @param documentType - The document type ('unit' or 'learner_guide')
 * @returns The prompt or null if not found
 */
export async function getValidationPromptV2(
  supabase: SupabaseClient,
  validationType: string,
  documentType: 'unit' | 'learner_guide' = 'unit'
): Promise<PromptV2 | null> {
  const requirementType = validationTypeToRequirementType[validationType] || validationType;
  
  console.log(`[Prompts V2] Fetching validation prompt for ${requirementType}/${documentType}`);
  
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('prompt_type', 'validation')
    .eq('requirement_type', requirementType)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (error || !data) {
    console.log(`[Prompts V2] No default validation prompt found for ${requirementType}/${documentType}:`, error?.message);
    return null;
  }

  console.log(`[Prompts V2] Found validation prompt: ${data.name} (v${data.version})`);
  return data as PromptV2;
}

/**
 * Fetch the default generation prompt (Phase 2) from the prompts table
 * 
 * @param supabase - Supabase client
 * @param validationType - The type of validation (e.g., 'knowledge_evidence')
 * @param documentType - The document type ('unit' or 'learner_guide')
 * @returns The prompt or null if not found
 */
export async function getGenerationPromptV2(
  supabase: SupabaseClient,
  validationType: string,
  documentType: 'unit' | 'learner_guide' = 'unit'
): Promise<PromptV2 | null> {
  const requirementType = validationTypeToRequirementType[validationType] || validationType;
  
  console.log(`[Prompts V2] Fetching generation prompt for ${requirementType}/${documentType}`);
  
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('prompt_type', 'generation')
    .eq('requirement_type', requirementType)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (error || !data) {
    console.log(`[Prompts V2] No default generation prompt found for ${requirementType}/${documentType}:`, error?.message);
    return null;
  }

  console.log(`[Prompts V2] Found generation prompt: ${data.name} (v${data.version})`);
  return data as PromptV2;
}

/**
 * Fetch both validation and generation prompts for a validation type
 * 
 * @param supabase - Supabase client
 * @param validationType - The type of validation
 * @param documentType - The document type
 * @returns Object containing both prompts (either may be null)
 */
export async function getSplitPromptsV2(
  supabase: SupabaseClient,
  validationType: string,
  documentType: 'unit' | 'learner_guide' = 'unit'
): Promise<{ validation: PromptV2 | null; generation: PromptV2 | null }> {
  const [validation, generation] = await Promise.all([
    getValidationPromptV2(supabase, validationType, documentType),
    getGenerationPromptV2(supabase, validationType, documentType),
  ]);

  return { validation, generation };
}

/**
 * Format a prompt with placeholders replaced by actual values
 * 
 * @param promptText - The prompt text with placeholders
 * @param replacements - Key-value pairs for placeholder replacement
 * @returns Formatted prompt text
 */
export function formatPrompt(
  promptText: string,
  replacements: Record<string, string>
): string {
  let formatted = promptText;
  
  for (const [key, value] of Object.entries(replacements)) {
    // Support both {{key}} and {key} placeholder formats
    formatted = formatted.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  
  return formatted;
}

/**
 * Check if a validation status requires generation (Phase 2)
 * 
 * @param status - The validation status
 * @returns true if generation should be run
 */
export function shouldRunGeneration(status: string): boolean {
  const normalizedStatus = status.toLowerCase().replace(/[\s_-]/g, '');
  
  // Only run generation for "Partially Met" or "Not Met"
  // Do NOT run for "Met"
  return normalizedStatus !== 'met';
}

/**
 * Parse validation status from various formats to normalized form
 * 
 * @param status - Raw status string
 * @returns Normalized status: 'met', 'partial', or 'not_met'
 */
export function normalizeStatus(status: string): 'met' | 'partial' | 'not_met' {
  const lower = status.toLowerCase().replace(/[\s_-]/g, '');
  
  if (lower === 'met') return 'met';
  if (lower.includes('partial')) return 'partial';
  return 'not_met';
}
