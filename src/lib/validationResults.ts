/**
 * Validation Results Data Layer - Phase 3.2
 * Comprehensive error handling for validation results fetching
 */

import { supabase } from './supabase';

export interface ValidationEvidenceRecord {
  id: string;
  requirement_number: string;
  requirement_text: string;
  status: string;
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

export interface ValidationResultsError {
  code: 'NOT_FOUND' | 'PROCESSING' | 'DATABASE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ValidationResultsResponse {
  data: ValidationEvidenceRecord[];
  error: ValidationResultsError | null;
  isEmpty: boolean;
  isProcessing: boolean;
}

/**
 * Check if validation is ready for results
 */
export async function checkValidationStatus(validationDetailId: number): Promise<{
  isReady: boolean;
  status: string;
  message: string;
}> {
  try {
    console.log('[checkValidationStatus] Checking validation status for ID:', validationDetailId);
    
    // Query validation_detail
    const { data, error } = await supabase
      .from('validation_detail')
      .select('*')
      .eq('id', validationDetailId)
      .single();

    if (error) {
      console.error('[checkValidationStatus] Database error: Query failed');
      return {
        isReady: false,
        status: 'error',
        message: 'Failed to check validation status',
      };
    }

    console.log('[checkValidationStatus] Query successful, ID:', validationDetailId);

    if (!data) {
      console.log('[checkValidationStatus] No data returned for validation ID:', validationDetailId);
      return {
        isReady: false,
        status: 'not_found',
        message: 'Validation not found',
      };
    }

    // Always return ready - no processing state checks
    const validationStatus = data.validation_status;

    console.log('[checkValidationStatus] Validation status:', validationStatus, '- always returning ready');

    return {
      isReady: true,
      status: validationStatus || 'ready',
      message: 'Validation results are ready',
    };
  } catch (error) {
    console.error('[checkValidationStatus] Unexpected error:', error);
    return {
      isReady: false,
      status: 'error',
      message: 'An unexpected error occurred',
    };
  }
}

/**
 * Get validation results with comprehensive error handling
 */
export async function getValidationResults(
  validationId: string,
  valDetailId?: number
): Promise<ValidationResultsResponse> {
  // Validate inputs
  if (!valDetailId) {
    return {
      data: [],
      error: {
        code: 'NOT_FOUND',
        message: 'Validation detail ID is required',
        retryable: false,
      },
      isEmpty: true,
      isProcessing: false,
    };
  }

  try {
    // First, check if validation is ready
    const statusCheck = await checkValidationStatus(valDetailId);
    
    if (!statusCheck.isReady) {
      const isProcessing = ['pending', 'DocumentProcessing', 'Uploading', 'ProcessingInBackground']
        .includes(statusCheck.status);
      
      return {
        data: [],
        error: {
          code: isProcessing ? 'PROCESSING' : 'NOT_FOUND',
          message: statusCheck.message,
          details: { status: statusCheck.status },
          retryable: isProcessing,
        },
        isEmpty: true,
        isProcessing,
      };
    }

    // Fetch validation results directly from validation_results table
    const numericId = typeof valDetailId === 'string' ? parseInt(valDetailId, 10) : valDetailId;
    console.log('[getValidationResults] Querying with ID:', numericId, 'type:', typeof numericId);

    const { data, error } = await supabase
      .from('validation_results')
      .select('*')
      .eq('validation_detail_id', numericId);

    console.log('[getValidationResults] Query returned:', data?.length || 0, 'records');

    if (error) {
      console.error('[getValidationResults] Database error:', error);

      return {
        data: [],
        error: {
          code: 'DATABASE_ERROR',
          message: `Failed to fetch validation results`,
          details: error,
          retryable: true,
        },
        isEmpty: true,
        isProcessing: false,
      };
    }

    // Check if data is empty
    if (!data || data.length === 0) {
      console.log('[getValidationResults] No records returned for ID:', numericId);
      return {
        data: [],
        error: {
          code: 'NOT_FOUND',
          message: 'No validation results found. The validation may still be processing.',
          retryable: true,
        },
        isEmpty: true,
        isProcessing: false,
      };
    }

    // Map database records to ValidationEvidenceRecord interface
    const mappedData: ValidationEvidenceRecord[] = data.map((record: any) => ({
      id: record.id?.toString() || '',
      requirement_number: record.requirement_number || '',
      requirement_text: record.requirement_text || '',
      status: record.status || 'not_met',
      reasoning: record.reasoning || '',
      mapped_questions: record.mapped_questions || '',
      unmapped_reasoning: record.unmapped_reasoning || '',
      document_references: record.document_references || '',
      smart_question: record.smart_question || '',
      benchmark_answer: record.benchmark_answer || '',
      recommendations: record.recommendations || '',
      table_source: record.table_source || 'validation_results',
      type: record.type || 'evidence',
    }));

    console.log('[getValidationResults] Successfully mapped', mappedData.length, 'records');

    // Success
    return {
      data: mappedData,
      error: null,
      isEmpty: false,
      isProcessing: false,
    };

  } catch (error) {
    console.error('[getValidationResults] Unexpected error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred while fetching validation results';
    
    return {
      data: [],
      error: {
        code: 'UNKNOWN',
        message: errorMessage,
        details: error,
        retryable: true,
      },
      isEmpty: true,
      isProcessing: false,
    };
  }
}

/**
 * Get validation results with retry logic
 */
export async function getValidationResultsWithRetry(
  validationId: string,
  valDetailId?: number,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<ValidationResultsResponse> {
  let lastResponse: ValidationResultsResponse | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    lastResponse = await getValidationResults(validationId, valDetailId);
    
    // If successful or non-retryable error, return immediately
    if (!lastResponse.error || !lastResponse.error.retryable) {
      return lastResponse;
    }
    
    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }
  
  // Return last response after all retries exhausted
  return lastResponse || {
    data: [],
    error: {
      code: 'UNKNOWN',
      message: 'Failed after multiple retries',
      retryable: false,
    },
    isEmpty: true,
    isProcessing: false,
  };
}

/**
 * Subscribe to validation results updates
 */
export function subscribeToValidationResults(
  validationDetailId: number,
  onUpdate: (results: ValidationEvidenceRecord[]) => void,
  onError: (error: ValidationResultsError) => void
) {
  const channel = supabase
    .channel(`validation-results-${validationDetailId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'validation_results',
        filter: `validation_detail_id=eq.${validationDetailId}`,
      },
      async (payload) => {
        console.log('[subscribeToValidationResults] Update received:', payload);
        
        // Fetch updated results
        const response = await getValidationResults(
          validationDetailId.toString(),
          validationDetailId
        );
        
        if (response.error) {
          onError(response.error);
        } else {
          onUpdate(response.data);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
