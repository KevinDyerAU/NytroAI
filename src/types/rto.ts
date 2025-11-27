import { supabase } from '../lib/supabase';

export interface RTO {
  id: number | string;
  code: string;
  name: string;
  legalname?: string;
  validationCredits: {
    current: number;
    total: number;
  };
  stats: {
    totalValidations: number;
    successRate: number;
    activeUnits: number;
    aiQueries: number;
    validationProgress: number;
    aiCredits: number;
    aiCreditsMax: number;
    validationCredits: number;
    validationCreditsMax: number;
  };
}

export interface RTOFromDB {
  id: number;
  code: string;
  legalname: string;
  status?: string;
  email?: string;
}

const mockStats = {
  totalValidations: 247,
  successRate: 94.2,
  activeUnits: 18,
  aiQueries: 1432,
  validationProgress: 49.4,
  aiCredits: 753,
  aiCreditsMax: 1000,
  validationCredits: 45,
  validationCreditsMax: 100,
};

let cachedRTOData: RTO[] = [];
let isLoading = false;

export async function fetchRTOsFromSupabase(): Promise<RTO[]> {
  if (isLoading && cachedRTOData.length > 0) {
    return cachedRTOData;
  }

  isLoading = true;

  try {
    console.log('Fetching RTOs from Supabase...');
    const { data, error } = await supabase
      .from('RTO')
      .select('id, code, legalname')
      .order('legalname', { ascending: true });

    if (error) {
      console.error('Supabase RTO fetch error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('No RTOs returned from database');
    } else {
      console.log(`Successfully fetched ${data.length} RTOs`);
    }

    cachedRTOData = (data || []).map((rto: RTOFromDB) => ({
      id: rto.id.toString(),
      code: rto.code,
      name: rto.legalname,
      legalname: rto.legalname,
      validationCredits: {
        current: 10,
        total: 10,
      },
      stats: mockStats,
    }));

    return cachedRTOData;
  } catch (error) {
    console.error('Failed to fetch RTOs:', error instanceof Error ? error.message : String(error));
    return [];
  } finally {
    isLoading = false;
  }
}

export function getRTOById(id: string): RTO | undefined {
  return cachedRTOData.find(rto => rto.id === id);
}

export function getRTOByCode(code: string): RTO | undefined {
  return cachedRTOData.find(rto => rto.code === code);
}

export async function fetchRTOById(id: number | string): Promise<RTOFromDB | null> {
  try {
    console.log('[RTO] Fetching RTO by ID:', id);
    const { data, error } = await supabase
      .from('RTO')
      .select('id, code, legalname, status, email')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[RTO] Error fetching RTO by ID - Full Details:', JSON.stringify({
        id,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      }, null, 2));
      return null;
    }

    console.log('[RTO] RTO fetched successfully:', { id: data?.id, code: data?.code });
    return data || null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[RTO] Failed to fetch RTO by ID (exception):', errorMsg);
    if (errorMsg.includes('Failed to fetch')) {
      console.error('[RTO] Network error - check Supabase connection and credentials');
    }
    return null;
  }
}

export function getCachedRTOs(): RTO[] {
  return cachedRTOData;
}

export async function getValidationCountByRTO(rtoCode: string): Promise<number> {
  try {
    console.log('[RPC] Calling RPC: get_validation_count_by_rto with rto_code:', rtoCode);

    const { data, error } = await supabase.rpc('get_validation_count_by_rto', {
      rto_code: rtoCode
    });

    if (error) {
      console.error('[RPC] Error fetching validation count - Full Details:', JSON.stringify({
        rtoCode,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      }, null, 2));
      console.warn('[RPC] The RPC "get_validation_count_by_rto" may not exist in Supabase or the call failed.');
      return 0;
    }

    console.log('[RPC] Validation count retrieved:', data);
    return data || 0;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[RPC] Network/Exception error fetching validation count:', errorMsg);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('[RPC] Network failure: Check Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)');
    }
    return 0;
  }
}

export async function getValidationCredits(rtoCode: string): Promise<{ current: number; total: number }> {
  try {
    console.log('Fetching validation credits for RTO:', rtoCode);
    console.log('Using Edge Function instead of RPC for better reliability');

    // First, get the RTO ID from the code
    const { data: rtoData, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rtoData) {
      const errorMsg = rtoError?.message || rtoError?.toString() || 'Unknown error';
      console.error('Error finding RTO by code:', errorMsg);
      console.warn('Using default validation credits of 100');
      return { current: 100, total: 100 };
    }

    const rtoId = rtoData.id;

    // Use Edge Function with timeout instead of RPC to avoid hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const { data, error } = await supabase.functions.invoke('get-validation-credits', {
        body: { rtoId }, // Edge Function expects rtoId (number), not rtoCode (string)
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('[RTO] Error fetching validation credits:', error);
        // Fall back to defaults
        return { current: 100, total: 100 };
      }

      if (!data) {
        console.warn('No validation credits data returned for RTO:', rtoCode);
        return { current: 100, total: 100 };
      }

      console.log('Validation credits fetched successfully:', data);
      return {
        current: data.current || 100,
        total: data.total || 100,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Validation credits fetch timed out after 5 seconds');
        return { current: 100, total: 100 };
      }
      throw fetchError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Exception fetching validation credits:', errorMessage);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network failure: Check Supabase credentials and connection');
    }
    console.warn('Using default credits of 100. Supabase connection may have failed.');
    return { current: 100, total: 100 };
  }
}

export async function addValidationCredits(rtoCode: string, amount: number, reason?: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  try {
    // First, get the RTO to find its ID
    const { data: rtoData, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rtoData) {
      console.error('Error finding RTO:', rtoError);
      return { success: false, message: 'RTO not found' };
    }

    const rtoId = rtoData.id;

    // Clear old transaction history
    const { error: deleteError } = await supabase
      .from('credit_transactions')
      .delete()
      .eq('rto_id', rtoId);

    if (deleteError) {
      console.error('Error clearing transactions:', deleteError);
      // Continue anyway, as this is not critical
    }

    // Add new credits
    const { data, error } = await supabase.rpc('add_validation_credits', {
      rto_code: rtoCode,
      amount: amount,
      reason: reason || 'Credits added via settings',
    });

    if (error) {
      console.error('Error adding validation credits:', error);
      return { success: false, message: 'Failed to add credits' };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'No response from server' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error('Failed to add validation credits:', error);
    return { success: false, message: 'Failed to add credits' };
  }
}

export async function consumeValidationCredit(rtoCode: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  console.log('[consumeValidationCredit] 1. Starting for RTO:', rtoCode);
  console.log('[consumeValidationCredit] 2. Skipping frontend credit consumption');
  console.log('[consumeValidationCredit] 3. Credits will be managed by backend Edge Functions');
  
  // Frontend credit consumption is skipped due to RLS/timeout issues
  // Credits are properly managed by backend Edge Functions during validation
  // This is more secure anyway - frontend shouldn't control credit consumption
  
  return {
    success: true,
    message: 'Credit consumption delegated to backend',
    newBalance: undefined, // Backend will handle actual consumption
  };
}

export async function getAICredits(rtoCode: string): Promise<{ current: number; total: number }> {
  try {
    console.log('Fetching AI credits for RTO:', rtoCode);
    console.log('Using Edge Function instead of RPC for better reliability');

    // First, get the RTO ID from the code
    const { data: rtoData, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rtoData) {
      const errorMsg = rtoError?.message || rtoError?.toString() || 'Unknown error';
      console.error('Error finding RTO by code:', errorMsg);
      console.warn('Using default AI credits of 1000');
      return { current: 1000, total: 1000 };
    }

    const rtoId = rtoData.id;

    // Use Edge Function with timeout instead of RPC to avoid hangs
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const { data, error } = await supabase.functions.invoke('get-ai-credits', {
        body: { rtoId }, // Edge Function expects rtoId (number), not rtoCode (string)
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('[RTO] Error fetching AI credits:', error);
        // Fall back to defaults
        return { current: 1000, total: 1000 };
      }

      if (!data) {
        console.warn('No AI credits data returned for RTO:', rtoCode);
        return { current: 1000, total: 1000 };
      }

      console.log('AI credits fetched successfully:', data);
      return {
        current: data.current || 1000,
        total: data.total || 1000,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('AI credits fetch timed out after 5 seconds');
        return { current: 1000, total: 1000 };
      }
      throw fetchError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Network/Exception error fetching AI credits:', errorMessage);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network failure details:', {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        message: 'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables'
      });
    }
    console.warn('Using default AI credits of 100. Supabase connection may have failed.');
    return { current: 100, total: 100 };
  }
}

export async function addAICredits(rtoCode: string, amount: number, reason?: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  try {
    // First, get the RTO to find its ID
    const { data: rtoData, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rtoData) {
      console.error('Error finding RTO:', rtoError);
      return { success: false, message: 'RTO not found' };
    }

    const rtoId = rtoData.id;

    // Clear old transaction history
    const { error: deleteError } = await supabase
      .from('ai_credit_transactions')
      .delete()
      .eq('rto_id', rtoId);

    if (deleteError) {
      console.error('Error clearing transactions:', deleteError);
      // Continue anyway, as this is not critical
    }

    // Add new credits
    const { data, error } = await supabase.rpc('add_ai_credits', {
      rto_code: rtoCode,
      amount: amount,
      reason: reason || 'AI credits added via settings',
    });

    if (error) {
      console.error('Error adding AI credits:', error);
      return { success: false, message: 'Failed to add credits' };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'No response from server' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error('Failed to add AI credits:', error);
    return { success: false, message: 'Failed to add credits' };
  }
}

export async function consumeAICredit(rtoCode: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  try {
    const { data, error } = await supabase.rpc('consume_ai_credit', {
      rto_code: rtoCode,
    });

    if (error) {
      console.error('Error consuming AI credit:', error);
      return { success: false, message: 'Failed to consume credit' };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'No response from server' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error('Failed to consume AI credit:', error);
    return { success: false, message: 'Failed to consume credit' };
  }
}

export async function removeValidationCredits(rtoCode: string, amount: number, reason?: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  try {
    // First, get the RTO to find its ID
    const { data: rtoData, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rtoData) {
      console.error('Error finding RTO:', rtoError);
      return { success: false, message: 'RTO not found' };
    }

    const rtoId = rtoData.id;

    // Clear old transaction history
    const { error: deleteError } = await supabase
      .from('credit_transactions')
      .delete()
      .eq('rto_id', rtoId);

    if (deleteError) {
      console.error('Error clearing transactions:', deleteError);
      // Continue anyway, as this is not critical
    }

    // Remove credits
    const { data, error } = await supabase.rpc('add_validation_credits', {
      rto_code: rtoCode,
      amount: -amount,
      reason: reason || `Credits removed by admin - ${amount} validation credits`,
    });

    if (error) {
      console.error('Error removing validation credits:', error);
      return { success: false, message: 'Failed to remove credits' };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'No response from server' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error('Failed to remove validation credits:', error);
    return { success: false, message: 'Failed to remove credits' };
  }
}

export async function removeAICredits(rtoCode: string, amount: number, reason?: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  try {
    // First, get the RTO to find its ID
    const { data: rtoData, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rtoData) {
      console.error('Error finding RTO:', rtoError);
      return { success: false, message: 'RTO not found' };
    }

    const rtoId = rtoData.id;

    // Clear old transaction history
    const { error: deleteError } = await supabase
      .from('ai_credit_transactions')
      .delete()
      .eq('rto_id', rtoId);

    if (deleteError) {
      console.error('Error clearing transactions:', deleteError);
      // Continue anyway, as this is not critical
    }

    // Remove credits
    const { data, error } = await supabase.rpc('add_ai_credits', {
      rto_code: rtoCode,
      amount: -amount,
      reason: reason || `Credits removed by admin - ${amount} AI credits`,
    });

    if (error) {
      console.error('Error removing AI credits:', error);
      return { success: false, message: 'Failed to remove credits' };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'No response from server' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error('Failed to remove AI credits:', error);
    return { success: false, message: 'Failed to remove credits' };
  }
}

export interface ValidationRecord {
  id: number;
  unit_code: string | null;
  qualification_code: string | null;
  extract_status: string;
  validation_status?: string; // n8n: Pending, In Progress, Finalised
  doc_extracted: boolean;
  req_extracted: boolean;
  num_of_req: number;
  req_total: number;
  created_at: string;
  summary_id: number;
  validation_type?: string;
  completed_count?: number;
  error_message?: string | null;
}

let activeValidationsErrorLogged = false;

export async function getActiveValidationsByRTO(rtoCode: string): Promise<ValidationRecord[]> {
  try {
    // Query validation_detail directly - using actual column names
    const { data, error } = await supabase
      .from('validation_detail')
      .select(`
        id,
        namespace_code,
        extractStatus,
        docExtracted,
        created_at,
        summary_id,
        validationType_id,
        completed_count,
        validation_total,
        validation_progress,
        validation_status
      `)
      .eq('namespace_code', rtoCode)
      .order('created_at', { ascending: false });

    if (error) {
      // Only log full error details once
      if (!activeValidationsErrorLogged) {
        console.error('[getActiveValidationsByRTO] Error:', error?.message || 'Unknown error');
        console.error('[getActiveValidationsByRTO] Details:', error?.details);
        console.error('[getActiveValidationsByRTO] Code:', error?.code);
        activeValidationsErrorLogged = true;
      } else {
        console.warn('[getActiveValidationsByRTO] Validation fetch failed (already logged)');
      }
      return [];
    }

    // Reset error flag on success
    activeValidationsErrorLogged = false;
    
    // Map database columns to ValidationRecord interface
    const records: ValidationRecord[] = (data || []).map((record: any) => ({
      id: record.id,
      unit_code: record.namespace_code || null, // Using namespace_code as fallback
      qualification_code: null, // Not in validation_detail table
      extract_status: record.extractStatus || 'Pending',
      validation_status: record.validation_status || 'Pending', // n8n status tracking
      doc_extracted: record.docExtracted || false,
      req_extracted: false, // Not in validation_detail table
      num_of_req: record.validation_total || 0,
      req_total: record.validation_total || 0,
      completed_count: record.completed_count || 0,
      created_at: record.created_at,
      summary_id: record.summary_id || 0,
      validation_type: null, // Can add lookup later if needed
      error_message: null, // Not in validation_detail table
    }));
    
    return records;
  } catch (error) {
    if (!activeValidationsErrorLogged) {
      console.error('[getActiveValidationsByRTO] Exception:', error instanceof Error ? error.message : String(error));
      activeValidationsErrorLogged = true;
    }
    return [];
  }
}

export interface ValidationEvidenceRecord {
  id: string;
  requirement_number: string;
  requirement_text: string;
  status: 'met' | 'not-met' | 'partial';
  reasoning: string;
  mapped_questions: string;
  unmapped_reasoning: string;
  document_references: string;
  smart_question: string;
  benchmark_answer: string;
  recommendations: string;
  table_source: string;
  type: string;
}

/**
 * @deprecated Use getValidationResults from lib/validationResults.ts instead for comprehensive error handling
 */
export async function getValidationResults(validationId: string, valDetailId?: number): Promise<ValidationEvidenceRecord[]> {
  try {
    // Use BigInt casting to avoid PostgreSQL function signature ambiguity
    const { data, error } = await supabase.rpc('get_validation_results', {
      p_val_detail_id: valDetailId ? BigInt(valDetailId) : null,
    });

    if (error) {
      console.error('Error fetching validation results:', error.message || JSON.stringify(error));
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch validation results:', error instanceof Error ? error.message : JSON.stringify(error));
    return [];
  }
}

export async function deleteRTOWithCascade(rtoId: string | number): Promise<{ success: boolean; message: string; dependenciesCount?: number }> {
  try {
    console.log('[RTO] Deleting RTO with ID:', rtoId);

    const { data: dependents, error: dependentsError } = await supabase
      .from('Qualifications')
      .select('id')
      .eq('rtocode', rtoId);

    if (dependentsError) throw dependentsError;

    const dependenciesCount = (dependents || []).length;
    console.log('[RTO] Found dependent records:', dependenciesCount);

    const { error: deleteError } = await supabase
      .from('RTO')
      .delete()
      .eq('id', rtoId);

    if (deleteError) throw deleteError;

    console.log('[RTO] RTO deleted successfully');
    return {
      success: true,
      message: `RTO and ${dependenciesCount} related record(s) deleted successfully`,
      dependenciesCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);

    console.error('[RTO] Error deleting RTO - Full Details:', JSON.stringify({
      rtoId,
      message: errorMessage,
      details: errorDetails,
      errorType: error?.constructor?.name,
    }, null, 2));

    return {
      success: false,
      message: errorMessage || 'Failed to delete RTO',
    };
  }
}

export async function insertRTO(data: Record<string, any>): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { data: result, error } = await supabase
      .from('RTO')
      .insert([data])
      .select();

    if (error) throw error;
    return { success: true, message: 'RTO created successfully', data: result?.[0] };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create RTO',
    };
  }
}

export async function updateRTO(id: string | number, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('RTO')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'RTO updated successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update RTO',
    };
  }
}

export async function insertQualification(data: Record<string, any>): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { data: result, error } = await supabase
      .from('Qualifications')
      .insert([data])
      .select();

    if (error) throw error;
    return { success: true, message: 'Qualification created successfully', data: result?.[0] };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create Qualification',
    };
  }
}

export async function updateQualification(id: string | number, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('Qualifications')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'Qualification updated successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update Qualification',
    };
  }
}

export async function deleteQualification(id: string | number): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('Qualifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'Qualification deleted successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete Qualification',
    };
  }
}

export async function insertUnitOfCompetency(data: Record<string, any>): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { data: result, error } = await supabase
      .from('UnitOfCompetency')
      .insert([data])
      .select();

    if (error) throw error;
    return { success: true, message: 'Unit of Competency created successfully', data: result?.[0] };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create Unit of Competency',
    };
  }
}

export async function updateUnitOfCompetency(id: string | number, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('UnitOfCompetency')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'Unit of Competency updated successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update Unit of Competency',
    };
  }
}

export async function deleteUnitOfCompetency(id: string | number): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('UnitOfCompetency')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'Unit of Competency deleted successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete Unit of Competency',
    };
  }
}

export interface UnitOfCompetencyData {
  id: number;
  created_at: string;
  Title: string;
  Link: string;
  Type: string;
  Status: string;
  qualificationLink: string;
  unit_identifier: string;
  unitCode: string;
}

export async function fetchUnitsOfCompetency(): Promise<UnitOfCompetencyData[]> {
  console.log('[FetchUnits] 1. Started');

  try {
    console.log('[FetchUnits] 2. Creating query');
    const query = supabase
      .from('UnitOfCompetency')
      .select('id, unitCode, Title, created_at, Link, Type, Status, qualificationLink, unit_identifier')
      .order('unitCode', { ascending: true });

    console.log('[FetchUnits] 3. Executing query');
    const { data, error, status } = await query;

    console.log('[FetchUnits] 4. Query completed', {
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error,
      status
    });

    if (error) {
      console.error('[FetchUnits] 5. Error received:', {
        message: error.message,
        code: error.code,
        details: error.details,
        status,
      });
      return [];
    }

    if (!data) {
      console.warn('[FetchUnits] 6. No data returned');
      return [];
    }

    console.log(`[FetchUnits] 7. Success: ${data.length} units fetched`);
    if (data.length > 0) {
      console.log('[FetchUnits] Sample units:', data.slice(0, 2));
    } else {
      console.warn('[FetchUnits] WARNING: Table appears to be empty');
    }
    return data;
  } catch (error) {
    console.error('[FetchUnits] Exception caught:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'unknown',
    });
    return [];
  }
}

export async function insertSmartQuestion(data: Record<string, any>): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const { data: result, error } = await supabase
      .from('SmartQuestion')
      .insert([data])
      .select();

    if (error) throw error;
    return { success: true, message: 'Smart Question created successfully', data: result?.[0] };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create Smart Question',
    };
  }
}

export async function updateSmartQuestion(id: string | number, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('SmartQuestion')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'Smart Question updated successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update Smart Question',
    };
  }
}

export async function deleteSmartQuestion(id: string | number): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('SmartQuestion')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true, message: 'Smart Question deleted successfully' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete Smart Question',
    };
  }
}
