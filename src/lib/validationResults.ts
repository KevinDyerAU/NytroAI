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
    const { data, error } = await supabase
      .from('validation_detail')
      .select('extractStatus, validationStatus, validationCount, validationTotal')
      .eq('id', validationDetailId)
      .single();

    if (error) {
      console.error('[checkValidationStatus] Database error:', error);
      return {
        isReady: false,
        status: 'error',
        message: 'Failed to check validation status',
      };
    }

    if (!data) {
      return {
        isReady: false,
        status: 'not_found',
        message: 'Validation not found',
      };
    }

    // Check if still processing
    const processingStatuses = ['pending', 'DocumentProcessing', 'Uploading', 'ProcessingInBackground'];
    if (processingStatuses.includes(data.extractStatus)) {
      return {
        isReady: false,
        status: data.extractStatus,
        message: 'Validation is still processing. Please check back in a moment.',
      };
    }

    // Check if validation has results
    if (data.validationCount === 0) {
      return {
        isReady: false,
        status: 'no_results',
        message: 'No validation results available yet.',
      };
    }

    return {
      isReady: true,
      status: data.validationStatus || 'completed',
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

    // Fetch validation results using RPC function
    // Explicitly convert to bigint to avoid signature ambiguity
    const { data, error } = await supabase.rpc('get_validation_results', {
      p_val_detail_id: BigInt(valDetailId),
    });

    if (error) {
      console.error('[getValidationResults] RPC error:', error);
      
      // Categorize error
      let errorCode: ValidationResultsError['code'] = 'DATABASE_ERROR';
      let retryable = true;
      
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        errorCode = 'DATABASE_ERROR';
        retryable = false;
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorCode = 'NETWORK_ERROR';
        retryable = true;
      }
      
      return {
        data: [],
        error: {
          code: errorCode,
          message: `Failed to fetch validation results: ${error.message}`,
          details: error,
          retryable,
        },
        isEmpty: true,
        isProcessing: false,
      };
    }

    // Check if data is empty
    if (!data || data.length === 0) {
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

    // Success
    return {
      data: data as ValidationEvidenceRecord[],
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
