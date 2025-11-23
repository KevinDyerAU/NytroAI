import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createGeminiClient } from '../_shared/gemini.ts';

interface CheckOperationRequest {
  operationId?: number;
  operationName?: string;
}

/**
 * Check Operation Status Edge Function
 * 
 * This function checks the status of a Gemini operation and updates the database.
 * Clients can poll this endpoint to get real-time progress updates.
 * 
 * Can be called with either:
 * - operationId (database ID from gemini_operations table)
 * - operationName (Gemini operation name)
 */
serve(async (req) => {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('[check-operation-status] START', new Date().toISOString());
  console.log('[check-operation-status] Method:', req.method);
  
  const corsResponse = handleCors(req);
  if (corsResponse) {
    console.log('[check-operation-status] CORS preflight handled');
    return corsResponse;
  }

  try {
    const requestData: CheckOperationRequest = await req.json();
    const { operationId, operationName } = requestData;
    console.log('[check-operation-status] Request data:', { operationId, operationName });

    if (!operationId && !operationName) {
      return createErrorResponse('Must provide either operationId or operationName');
    }

    const supabase = createSupabaseClient(req);

    // Get operation record from database
    let query = supabase
      .from('gemini_operations')
      .select('*');

    if (operationId) {
      query = query.eq('id', operationId);
    } else if (operationName) {
      query = query.eq('operation_name', operationName);
    }

    const { data: operation, error: opError } = await query.single();

    if (opError || !operation) {
      return createErrorResponse('Operation not found');
    }

    // If already completed or failed, return cached status
    if (operation.status === 'completed' || operation.status === 'failed' || operation.status === 'timeout') {
      const duration = Date.now() - startTime;
      console.log('[check-operation-status] Returning cached status:', operation.status);
      console.log('[check-operation-status] SUCCESS (cached) - Duration:', duration, 'ms');
      console.log('[check-operation-status] END', new Date().toISOString());
      console.log('='.repeat(80));
      
      return createSuccessResponse({
        operation: {
          id: operation.id,
          name: operation.operation_name,
          status: operation.status,
          progress: operation.progress_percentage,
          documentId: operation.document_id,
          elapsedTime: operation.elapsed_time_ms,
          completedAt: operation.completed_at,
          error: operation.error_message,
        },
      });
    }

    // Check with Gemini API for current status
    const gemini = createGeminiClient({
      apiKey: Deno.env.get('GEMINI_API_KEY') || '',
      model: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
      supabaseClient: supabase,
    });

    console.log(`[Check Operation] Checking Gemini status for: ${operation.operation_name}`);

    try {
      const geminiOperation = await gemini.getOperation(operation.operation_name);
      
      const now = new Date();
      const startedAt = new Date(operation.started_at);
      const elapsedTime = now.getTime() - startedAt.getTime();
      
      let status = 'processing';
      let progress = operation.progress_percentage || 10;
      let completedAt = null;
      let errorMessage = null;
      let fileSearchDocumentId = null;

      if (geminiOperation.done) {
        status = 'completed';
        progress = 100;
        completedAt = now.toISOString();
        
        // Extract file search document ID from response
        if (geminiOperation.response?.file) {
          fileSearchDocumentId = geminiOperation.response.file.name;
        }

        console.log(`[Check Operation] Operation completed: ${operation.operation_name}`);
      } else if (elapsedTime > operation.max_wait_time_ms) {
        status = 'timeout';
        errorMessage = `Operation exceeded maximum wait time of ${operation.max_wait_time_ms}ms`;
        console.log(`[Check Operation] Operation timeout: ${operation.operation_name}`);
      } else {
        // Still processing - estimate progress based on elapsed time
        const progressRatio = Math.min(elapsedTime / operation.max_wait_time_ms, 0.9);
        progress = Math.floor(10 + (progressRatio * 80)); // 10% to 90%
        console.log(`[Check Operation] Operation still processing: ${progress}%`);
      }

      // Update operation record
      const updateData: any = {
        status,
        progress_percentage: progress,
        elapsed_time_ms: elapsedTime,
        updated_at: now.toISOString(),
        check_count: (operation.check_count || 0) + 1,
        last_check_at: now.toISOString(),
      };

      if (completedAt) {
        updateData.completed_at = completedAt;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      await supabase
        .from('gemini_operations')
        .update(updateData)
        .eq('id', operation.id);

      // If completed, update document record
      if (status === 'completed' && operation.document_id) {
        const docUpdateData: any = {
          embedding_status: 'completed',
          updated_at: now.toISOString(),
        };

        if (fileSearchDocumentId) {
          docUpdateData.file_search_document_id = fileSearchDocumentId;
        }

        await supabase
          .from('documents')
          .update(docUpdateData)
          .eq('id', operation.document_id);

        console.log(`[Check Operation] Document ${operation.document_id} marked as completed`);
      }

      // If completed or timeout, update validation_detail if linked
      if ((status === 'completed' || status === 'timeout') && operation.validation_detail_id) {
        const extractStatus = status === 'completed' ? 'DocumentsUploaded' : 'Failed';
        
        await supabase
          .from('validation_detail')
          .update({
            docExtracted: status === 'completed',
            extractStatus: extractStatus,
          })
          .eq('id', operation.validation_detail_id);

        console.log(`[Check Operation] Validation detail ${operation.validation_detail_id} updated: ${extractStatus}`);
      }

      const duration = Date.now() - startTime;
      console.log('[check-operation-status] Operation status updated:', status);
      console.log('[check-operation-status] SUCCESS - Duration:', duration, 'ms');
      console.log('[check-operation-status] END', new Date().toISOString());
      console.log('='.repeat(80));
      
      return createSuccessResponse({
        operation: {
          id: operation.id,
          name: operation.operation_name,
          status,
          progress,
          documentId: operation.document_id,
          validationDetailId: operation.validation_detail_id,
          elapsedTime,
          completedAt,
          error: errorMessage,
          checkCount: updateData.check_count,
        },
      });
    } catch (geminiError) {
      console.error('[Check Operation] Error checking Gemini status:', geminiError);
      
      // Update operation as failed
      await supabase
        .from('gemini_operations')
        .update({
          status: 'failed',
          error_message: geminiError instanceof Error ? geminiError.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', operation.id);

      return createErrorResponse(
        `Failed to check operation status: ${geminiError instanceof Error ? geminiError.message : 'Unknown error'}`,
        500
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[check-operation-status] ERROR:', error);
    console.error('[check-operation-status] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: duration + 'ms'
    });
    console.log('[check-operation-status] END (with error)', new Date().toISOString());
    console.log('='.repeat(80));
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
