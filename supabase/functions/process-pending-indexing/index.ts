import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';

/**
 * Process Pending Indexing Operations
 * 
 * This function should be called periodically (every 10-30 seconds) to:
 * 1. Find pending gemini_operations
 * 2. Process each operation (upload to Gemini File Search)
 * 3. Update statuses
 * 4. Trigger validation when indexing completes
 * 
 * Can be triggered by:
 * - Supabase Edge Functions Cron (recommended)
 * - Client-side polling
 * - External cron job
 */
serve(async (req) => {
  console.log('[process-pending-indexing] Starting...');
  
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseClient(req);
    const gemini = createDefaultGeminiClient();

    // Reset stuck operations (processing for > 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: stuckOps, error: resetError } = await supabase
      .from('gemini_operations')
      .update({
        status: 'failed',
        error_message: 'Timeout: Processing took longer than 2 minutes',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'processing')
      .lt('updated_at', twoMinutesAgo)
      .select('id, document_id');

    if (stuckOps && stuckOps.length > 0) {
      console.log(`[process-pending-indexing] Reset ${stuckOps.length} stuck operations:`, stuckOps.map(op => op.id));
      
      // Also update document status
      for (const op of stuckOps) {
        if (op.document_id) {
          await supabase
            .from('documents')
            .update({ embedding_status: 'failed' })
            .eq('id', op.document_id);
        }
      }
    }

    // Find pending operations (limit to 5 at a time to avoid timeouts)
    const { data: pendingOps, error: opsError } = await supabase
      .from('gemini_operations')
      .select('*, documents(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (opsError) {
      console.error('[process-pending-indexing] Failed to fetch operations:', opsError);
      return createErrorResponse('Failed to fetch pending operations', 500);
    }

    if (!pendingOps || pendingOps.length === 0) {
      console.log('[process-pending-indexing] No pending operations');
      return createSuccessResponse({
        processed: 0,
        message: 'No pending operations to process',
      });
    }

    console.log(`[process-pending-indexing] Found ${pendingOps.length} pending operations`);

    const results = [];

    for (const operation of pendingOps) {
      let indexingSucceeded = false; // Track if indexing completed successfully
      
      try {
        // Mark as processing
        await supabase
          .from('gemini_operations')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', operation.id);

        const document = operation.documents;
        if (!document) {
          throw new Error('No document found for operation');
        }

        console.log(`[process-pending-indexing] Processing document: ${document.file_name}`);

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(document.storage_path);

        if (downloadError) {
          throw new Error(`Failed to download file: ${downloadError.message}`);
        }

        const fileBytes = new Uint8Array(await fileData.arrayBuffer());
        console.log(`[process-pending-indexing] Downloaded ${fileBytes.length} bytes`);

        // Get or create File Search store
        const storeId = document.file_search_store_id;
        const stores = await gemini.listFileSearchStores();
        let fileSearchStore;
        
        // Check if storeId is already a resource name (fileSearchStores/...)
        if (storeId.startsWith('fileSearchStores/')) {
          // It's a resource name, find by resource name
          fileSearchStore = stores.find((s) => s.name === storeId);
          if (!fileSearchStore) {
            console.error(`[process-pending-indexing] Store not found by resource name: ${storeId}`);
            throw new Error(`File Search store not found: ${storeId}`);
          }
        } else {
          // It's a display name, find or create
          fileSearchStore = stores.find((s) => s.displayName === storeId);
          if (!fileSearchStore) {
            console.log(`[process-pending-indexing] Creating new File Search store: ${storeId}`);
            fileSearchStore = await gemini.createFileSearchStore(storeId);
          }
        }

        console.log(`[process-pending-indexing] Using File Search store: ${fileSearchStore.name}`);
        console.log(`[process-pending-indexing] Document metadata being uploaded:`, JSON.stringify(document.metadata));

        // Update document with actual store resource name (not display name)
        await supabase
          .from('documents')
          .update({
            file_search_store_id: fileSearchStore.name, // Update with resource name (fileSearchStores/abc123)
          })
          .eq('id', document.id);

        // Upload to Gemini File Search
        const uploadOperation = await gemini.uploadToFileSearchStore(
          fileBytes,
          document.file_name,
          fileSearchStore.name,
          document.display_name || document.file_name,
          document.metadata || {}
        );
        
        console.log(`[process-pending-indexing] File uploaded with metadata keys: ${Object.keys(document.metadata || {}).join(', ')}`);

        console.log(`[process-pending-indexing] Upload initiated: ${uploadOperation.name}`);

        // Update operation with Gemini operation name
        await supabase
          .from('gemini_operations')
          .update({
            operation_name: uploadOperation.name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', operation.id);

        // Wait for indexing to complete (with timeout)
        // Gemini indexing can take 2-5 minutes during peak times, even for small files
        const completedOp = await gemini.waitForOperation(
          uploadOperation.name,
          180000, // 180 seconds (3 minutes)
          operation.id
        );

        console.log(`[process-pending-indexing] Indexing completed for: ${document.file_name}`);

        // Update document status to completed
        await supabase
          .from('documents')
          .update({
            embedding_status: 'completed',
            file_search_document_id: completedOp.name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', document.id);

        // Update operation status to completed
        await supabase
          .from('gemini_operations')
          .update({
            status: 'completed',
            progress_percentage: 100,
            updated_at: new Date().toISOString(),
          })
          .eq('id', operation.id);

        indexingSucceeded = true; // Mark as successful for validation trigger
        
        results.push({
          documentId: document.id,
          status: 'success',
          fileName: document.file_name,
        });

      } catch (error) {
        console.error(`[process-pending-indexing] Error processing operation ${operation.id}:`, error);

        // Update operation status to failed
        await supabase
          .from('gemini_operations')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', operation.id);

        // Update document status to failed
        if (operation.documents) {
          await supabase
            .from('documents')
            .update({
              embedding_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', operation.documents.id);
        }

        results.push({
          documentId: operation.documents?.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Trigger validation AFTER marking indexing as complete (or failed)
      // This ensures validation errors don't affect the embedding status
      try {
        const document = operation.documents;
        if (indexingSucceeded && document && document.validation_detail_id) {
          console.log(`[process-pending-indexing] Triggering validation for detail: ${document.validation_detail_id}`);
          console.log(`[process-pending-indexing] Waiting 15 seconds for Gemini File Search index to update...`);
          
          // IMPORTANT: Wait for Gemini's File Search index to update with the uploaded file's metadata
          // Without this delay, File Search queries with metadata filters will not find the newly uploaded document
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          console.log(`[process-pending-indexing] Proceeding with validation trigger`);
          
          // Extract unit_code from document metadata
          const unitCode = document.metadata?.unit_code;
          
          if (!unitCode) {
            console.error(`[process-pending-indexing] Cannot trigger validation: unit_code missing in document metadata`);
          } else {
            // Extract namespace from document metadata for proper document filtering
            const namespace = document.metadata?.namespace;
            
            // Call validate-assessment edge function
            const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-assessment', {
              body: {
                validationDetailId: document.validation_detail_id,
                documentId: document.id,
                unitCode: unitCode,
                validationType: 'full_validation', // Default to full validation
                ...(namespace && { namespace }), // Include namespace if available for proper document filtering
              },
            });

            if (validationError) {
              console.error(`[process-pending-indexing] Validation trigger failed:`, validationError);
            } else {
              console.log(`[process-pending-indexing] Validation triggered successfully for detail: ${document.validation_detail_id}`);
            }
          }
        }
      } catch (validationErr) {
        // Validation errors are logged but don't affect the embedding status
        console.error(`[process-pending-indexing] Exception triggering validation:`, validationErr);
      }
    }

    console.log(`[process-pending-indexing] Processed ${results.length} operations`);

    return createSuccessResponse({
      processed: results.length,
      results,
    });

  } catch (error) {
    console.error('[process-pending-indexing] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
