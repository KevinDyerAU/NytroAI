/**
 * Shared utilities for working with the consolidated validation_results table
 * Phase 2: Database Schema Consolidation
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ValidationResult {
  id: number;
  validation_detail_id: number;
  validation_type_id: number | null;
  requirement_id: number | null;
  requirement_type: 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'ai' | 'learner';
  requirement_number: string | null;
  requirement_text: string | null;
  status: 'met' | 'not-met' | 'partial' | 'pending';
  reasoning: string | null;
  mapped_content: string | null;
  unmapped_content: string | null;
  recommendations: string | null;
  doc_references: string | null;
  smart_questions: SmartQuestion[];
  confidence_score: number | null;
  validation_method: 'single_prompt' | 'individual_prompt' | 'hybrid';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SmartQuestion {
  question: string;
  benchmark_answer?: string;
  type: 'smart' | 'mapped' | 'unmapped';
}

export interface CreateValidationResultInput {
  validation_detail_id: number;
  validation_type_id?: number;
  requirement_id?: number;
  requirement_type: 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'ai' | 'learner';
  requirement_number?: string;
  requirement_text?: string;
  status: 'met' | 'not-met' | 'partial' | 'pending';
  reasoning?: string;
  mapped_content?: string;
  unmapped_content?: string;
  recommendations?: string;
  doc_references?: string;
  smart_questions?: SmartQuestion[];
  confidence_score?: number;
  validation_method?: 'single_prompt' | 'individual_prompt' | 'hybrid';
  metadata?: Record<string, any>;
}

/**
 * Insert a new validation result
 */
export async function insertValidationResult(
  supabase: SupabaseClient,
  result: CreateValidationResultInput
): Promise<{ data: ValidationResult | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('validation_results')
      .insert({
        ...result,
        smart_questions: result.smart_questions || [],
        metadata: result.metadata || {},
        validation_method: result.validation_method || 'single_prompt',
      })
      .select()
      .single();

    if (error) {
      console.error('[insertValidationResult] Error:', error);
      return { data: null, error };
    }

    return { data: data as ValidationResult, error: null };
  } catch (error) {
    console.error('[insertValidationResult] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Insert multiple validation results in a single transaction
 */
export async function insertValidationResults(
  supabase: SupabaseClient,
  results: CreateValidationResultInput[]
): Promise<{ data: ValidationResult[] | null; error: any }> {
  try {
    const preparedResults = results.map(result => ({
      ...result,
      smart_questions: result.smart_questions || [],
      metadata: result.metadata || {},
      validation_method: result.validation_method || 'single_prompt',
    }));

    const { data, error } = await supabase
      .from('validation_results')
      .insert(preparedResults)
      .select();

    if (error) {
      console.error('[insertValidationResults] Error:', error);
      return { data: null, error };
    }

    return { data: data as ValidationResult[], error: null };
  } catch (error) {
    console.error('[insertValidationResults] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Get all validation results for a validation detail
 */
export async function getValidationResults(
  supabase: SupabaseClient,
  validationDetailId: number
): Promise<{ data: ValidationResult[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('validation_results')
      .select('*')
      .eq('validation_detail_id', validationDetailId)
      .order('requirement_number', { ascending: true });

    if (error) {
      console.error('[getValidationResults] Error:', error);
      return { data: null, error };
    }

    return { data: data as ValidationResult[], error: null };
  } catch (error) {
    console.error('[getValidationResults] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Get validation results by type
 */
export async function getValidationResultsByType(
  supabase: SupabaseClient,
  validationDetailId: number,
  requirementType: 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'ai' | 'learner'
): Promise<{ data: ValidationResult[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('validation_results')
      .select('*')
      .eq('validation_detail_id', validationDetailId)
      .eq('requirement_type', requirementType)
      .order('requirement_number', { ascending: true });

    if (error) {
      console.error('[getValidationResultsByType] Error:', error);
      return { data: null, error };
    }

    return { data: data as ValidationResult[], error: null };
  } catch (error) {
    console.error('[getValidationResultsByType] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Update a validation result
 */
export async function updateValidationResult(
  supabase: SupabaseClient,
  id: number,
  updates: Partial<CreateValidationResultInput>
): Promise<{ data: ValidationResult | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('validation_results')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateValidationResult] Error:', error);
      return { data: null, error };
    }

    return { data: data as ValidationResult, error: null };
  } catch (error) {
    console.error('[updateValidationResult] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Add smart questions to a validation result
 */
export async function addSmartQuestions(
  supabase: SupabaseClient,
  id: number,
  questions: SmartQuestion[]
): Promise<{ data: ValidationResult | null; error: any }> {
  try {
    // Get current smart questions
    const { data: current, error: fetchError } = await supabase
      .from('validation_results')
      .select('smart_questions')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[addSmartQuestions] Fetch error:', fetchError);
      return { data: null, error: fetchError };
    }

    const existingQuestions = (current?.smart_questions as SmartQuestion[]) || [];
    const updatedQuestions = [...existingQuestions, ...questions];

    return await updateValidationResult(supabase, id, {
      smart_questions: updatedQuestions,
    });
  } catch (error) {
    console.error('[addSmartQuestions] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Get validation summary statistics
 */
export async function getValidationSummary(
  supabase: SupabaseClient,
  validationDetailId: number
): Promise<{
  data: {
    total: number;
    met: number;
    not_met: number;
    partial: number;
    pending: number;
    by_type: Record<string, { total: number; met: number; not_met: number; partial: number }>;
  } | null;
  error: any;
}> {
  try {
    const { data, error } = await getValidationResults(supabase, validationDetailId);

    if (error || !data) {
      return { data: null, error };
    }

    const summary = {
      total: data.length,
      met: data.filter(r => r.status === 'met').length,
      not_met: data.filter(r => r.status === 'not-met').length,
      partial: data.filter(r => r.status === 'partial').length,
      pending: data.filter(r => r.status === 'pending').length,
      by_type: {} as Record<string, { total: number; met: number; not_met: number; partial: number }>,
    };

    // Group by requirement type
    const types = ['ke', 'pe', 'fs', 'epc', 'ac'] as const;
    types.forEach(type => {
      const typeResults = data.filter(r => r.requirement_type === type);
      summary.by_type[type] = {
        total: typeResults.length,
        met: typeResults.filter(r => r.status === 'met').length,
        not_met: typeResults.filter(r => r.status === 'not-met').length,
        partial: typeResults.filter(r => r.status === 'partial').length,
      };
    });

    return { data: summary, error: null };
  } catch (error) {
    console.error('[getValidationSummary] Exception:', error);
    return { data: null, error };
  }
}

/**
 * Delete validation results for a validation detail
 */
export async function deleteValidationResults(
  supabase: SupabaseClient,
  validationDetailId: number
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('validation_results')
      .delete()
      .eq('validation_detail_id', validationDetailId);

    if (error) {
      console.error('[deleteValidationResults] Error:', error);
    }

    return { error };
  } catch (error) {
    console.error('[deleteValidationResults] Exception:', error);
    return { error };
  }
}
