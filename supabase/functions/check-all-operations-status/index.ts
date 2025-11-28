import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createGeminiClient } from '../_shared/gemini.ts';

interface CheckAllOperationsRequest {
  validationDetailId: number;
}

/**
 * Check All Operations Status Edge Function
 * 
 * This function checks the status of ALL Gemini operations for a validation
 * and returns aggregated status. Used by n8n to poll until all operations complete.
 */
serve(async (req) => {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('[check-all-operations-status] START', new Date().toISOString());
  console.log('[check-all-operations-status] Method:', req.method);
  
  const corsResponse = handleCors(req);
  if (corsResponse) {
    console.log('[check-all-operations-status] CORS preflight handled');
    return corsResponse;
  }

  try {
    // Handle both GET (query params) and POST (JSON body)
    let validationDetailId: number | undefined;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const idParam = url.searchParams.get('validationDetailId');
      validationDetailId = idParam ? parseInt(idParam, 10) : undefined;
      console.log('[check-all-operations-status] GET request, query params:', { validationDetailId });
    } else {
      const requestData: CheckAllOperationsRequest = await req.json();
      validationDetailId = requestData.validationDetailId;
      console.log('[check-all-operations-status] POST request, body:', { validationDetailId });
    }

    if (!validationDetailId) {
      return createErrorResponse('Must provide validationDetailId');
    }

    const supabase = createSupabaseClient(req);

    // Get all operations for this validation
    const { data: operations, error: opsError } = await supabase
      .from('gemini_operations')
      .select('*')
      .eq('validation_detail_id', validationDetailId)
      .order('created_at', { ascending: true });

    if (opsError) {
      console.error('[check-all-operations-status] Error fetching operations:', opsError);
      return createErrorResponse('Failed to fetch operations: ' + opsError.message);
    }

    if (!operations || operations.length === 0) {
      console.log('[check-all-operations-status] No operations found for validation', validationDetailId);
      return createErrorResponse('No operations found for this validation');
    }

    console.log(`[check-all-operations-status] Found ${operations.length} operations`);

    // Initialize Gemini client
    const gemini = createGeminiClient({
      apiKey: Deno.env.get('GEMINI_API_KEY') || '',
      model: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
      supabaseClient: supabase,
    });

    // Check status of each operation
    const operationStatuses = [];
    let completedCount = 0;
    let failedCount = 0;
    let timeoutCount = 0;
    let processingCount = 0;

    for (const operation of operations) {
      let status = operation.status;
      let progress = operation.progress_percentage || 0;
      let errorMessage = operation.error_message;

      // If not already completed/failed/timeout, check with Gemini
      if (status !== 'completed' && status !== 'failed' && status !== 'timeout') {
        try {
          // Strip /upload from operation name for status check
          const operationNameForStatus = operation.operation_name.replace('/upload/operations/', '/operations/');
          console.log(`[check-all-operations-status] Checking operation ${operation.id}: ${operationNameForStatus}`);

          const geminiOperation = await gemini.getOperation(operationNameForStatus);
          
          const now = new Date();
          const startedAt = new Date(operation.started_at);
          const elapsedTime = now.getTime() - startedAt.getTime();

          if (geminiOperation.done) {
            status = 'completed';
            progress = 100;
            console.log(`[check-all-operations-status] Operation ${operation.id} completed`);

            // Update database
            await supabase
              .from('gemini_operations')
              .update({
                status: 'completed',
                progress_percentage: 100,
                completed_at: now.toISOString(),
                elapsed_time_ms: elapsedTime,
                updated_at: now.toISOString(),
                check_count: (operation.check_count || 0) + 1,
                last_check_at: now.toISOString(),
              })
              .eq('id', operation.id);

          } else if (elapsedTime > (operation.max_wait_time_ms || 60000)) {
            status = 'timeout';
            errorMessage = `Operation exceeded maximum wait time`;
            console.log(`[check-all-operations-status] Operation ${operation.id} timeout`);

            // Update database
            await supabase
              .from('gemini_operations')
              .update({
                status: 'timeout',
                error_message: errorMessage,
                elapsed_time_ms: elapsedTime,
                updated_at: now.toISOString(),
                check_count: (operation.check_count || 0) + 1,
                last_check_at: now.toISOString(),
              })
              .eq('id', operation.id);

          } else {
            // Still processing
            status = 'processing';
            const progressRatio = Math.min(elapsedTime / (operation.max_wait_time_ms || 60000), 0.9);
            progress = Math.floor(10 + (progressRatio * 80));
            console.log(`[check-all-operations-status] Operation ${operation.id} still processing: ${progress}%`);

            // Update database
            await supabase
              .from('gemini_operations')
              .update({
                status: 'processing',
                progress_percentage: progress,
                elapsed_time_ms: elapsedTime,
                updated_at: now.toISOString(),
                check_count: (operation.check_count || 0) + 1,
                last_check_at: now.toISOString(),
              })
              .eq('id', operation.id);
          }

        } catch (error) {
          console.error(`[check-all-operations-status] Error checking operation ${operation.id}:`, error);
          status = 'failed';
          errorMessage = error.message;

          // Update database
          await supabase
            .from('gemini_operations')
            .update({
              status: 'failed',
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
              check_count: (operation.check_count || 0) + 1,
              last_check_at: new Date().toISOString(),
            })
            .eq('id', operation.id);
        }
      }

      // Count statuses
      if (status === 'completed') completedCount++;
      else if (status === 'failed') failedCount++;
      else if (status === 'timeout') timeoutCount++;
      else processingCount++;

      operationStatuses.push({
        id: operation.id,
        documentId: operation.document_id,
        operationName: operation.operation_name,
        status,
        progress,
        error: errorMessage,
      });
    }

    const allCompleted = completedCount === operations.length;
    const anyFailed = failedCount > 0 || timeoutCount > 0;

    console.log('[check-all-operations-status] Status summary:', {
      total: operations.length,
      completed: completedCount,
      processing: processingCount,
      failed: failedCount,
      timeout: timeoutCount,
      allCompleted,
      anyFailed,
    });

    const duration = Date.now() - startTime;
    console.log('[check-all-operations-status] SUCCESS - Duration:', duration, 'ms');
    console.log('[check-all-operations-status] END', new Date().toISOString());
    console.log('='.repeat(80));

    return createSuccessResponse({
      validationDetailId,
      allCompleted,
      anyFailed,
      totalCount: operations.length,
      completedCount,
      processingCount,
      failedCount,
      timeoutCount,
      operations: operationStatuses,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[check-all-operations-status] ERROR:', error);
    console.error('[check-all-operations-status] Stack:', error.stack);
    console.log('[check-all-operations-status] FAILED - Duration:', duration, 'ms');
    console.log('[check-all-operations-status] END', new Date().toISOString());
    console.log('='.repeat(80));
    
    return createErrorResponse(error.message || 'Unknown error');
  }
});
