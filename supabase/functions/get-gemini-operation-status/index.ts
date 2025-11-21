import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface GetOperationStatusRequest {
  operationName?: string;
  operationId?: number;
  documentId?: number;
  validationDetailId?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body
    const requestData: GetOperationStatusRequest = await req.json();
    const { operationName, operationId, documentId, validationDetailId } = requestData;

    // Validate request
    if (!operationName && !operationId && !documentId && !validationDetailId) {
      return createErrorResponse(
        'Must provide one of: operationName, operationId, documentId, or validationDetailId'
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient(req);

    // Build query
    let query = supabase.from('gemini_operations').select('*');

    if (operationName) {
      query = query.eq('operation_name', operationName);
    } else if (operationId) {
      query = query.eq('id', operationId);
    } else if (documentId) {
      query = query.eq('document_id', documentId);
    } else if (validationDetailId) {
      query = query.eq('validation_detail_id', validationDetailId).order('created_at', { ascending: false });
    }

    const { data: operations, error: queryError } = await query;

    if (queryError) {
      console.error('Error querying operations:', queryError);
      return createErrorResponse('Failed to query operation status', 500);
    }

    if (!operations || operations.length === 0) {
      return createSuccessResponse({
        success: true,
        found: false,
        message: 'No operation found',
      });
    }

    // Return the most recent operation if multiple
    const operation = operations[0];

    // Calculate derived metrics
    const elapsedSeconds = Math.floor((operation.elapsed_time_ms || 0) / 1000);
    const maxWaitSeconds = Math.floor((operation.max_wait_time_ms || 300000) / 1000);
    const isComplete = operation.status === 'completed';
    const isFailed = operation.status === 'failed' || operation.status === 'timeout';
    const isProcessing = operation.status === 'processing' || operation.status === 'pending';

    // Estimate time remaining (rough estimate)
    let estimatedTimeRemaining = null;
    if (isProcessing && operation.elapsed_time_ms && operation.max_wait_time_ms) {
      const remainingMs = operation.max_wait_time_ms - operation.elapsed_time_ms;
      estimatedTimeRemaining = Math.max(0, Math.floor(remainingMs / 1000));
    }

    return createSuccessResponse({
      success: true,
      found: true,
      operation: {
        id: operation.id,
        operationName: operation.operation_name,
        operationType: operation.operation_type,
        status: operation.status,
        progressPercentage: operation.progress_percentage || 0,
        
        // Timing
        elapsedSeconds,
        maxWaitSeconds,
        estimatedTimeRemaining,
        
        // Metadata
        checkCount: operation.check_count || 0,
        lastCheckAt: operation.last_check_at,
        
        // Status booleans for easy frontend logic
        isComplete,
        isFailed,
        isProcessing,
        
        // Error info if failed
        errorMessage: operation.error_message,
        
        // Timestamps
        startedAt: operation.started_at,
        completedAt: operation.completed_at,
        updatedAt: operation.updated_at,
      },
    });
  } catch (error) {
    console.error('Error getting operation status:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
