/**
 * Standardized database utilities for edge functions
 * Phase 2: Database Schema Consolidation
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Standard Supabase client initialization for all edge functions
 */
export function createSupabaseClient(req?: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Execute a database query with timeout and error handling
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number = 30000
): Promise<{ data: T | null; error: any }> {
  const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([queryFn(), timeoutPromise]);
    return result;
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Get RTO by code with error handling
 */
export async function getRTOByCode(
  supabase: SupabaseClient,
  rtoCode: string
): Promise<{ data: any; error: any }> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('RTO')
      .select('*')
      .eq('code', rtoCode)
      .single();

    if (error) {
      return { data: null, error: new Error(`RTO not found: ${error.message}`) };
    }

    return { data, error: null };
  });
}

/**
 * Get document by ID with error handling
 */
export async function getDocumentById(
  supabase: SupabaseClient,
  documentId: number
): Promise<{ data: any; error: any }> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      return { data: null, error: new Error(`Document not found: ${error.message}`) };
    }

    return { data, error: null };
  });
}

/**
 * Get validation detail by ID with error handling
 */
export async function getValidationDetailById(
  supabase: SupabaseClient,
  validationDetailId: number
): Promise<{ data: any; error: any }> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('validation_detail')
      .select('*')
      .eq('id', validationDetailId)
      .single();

    if (error) {
      return { data: null, error: new Error(`Validation detail not found: ${error.message}`) };
    }

    return { data, error: null };
  });
}

/**
 * Update validation detail status
 */
export async function updateValidationDetailStatus(
  supabase: SupabaseClient,
  validationDetailId: number,
  status: string,
  additionalFields?: Record<string, any>
): Promise<{ data: any; error: any }> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('validation_detail')
      .update({
        status,
        ...additionalFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validationDetailId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(`Failed to update validation detail: ${error.message}`) };
    }

    return { data, error: null };
  });
}
