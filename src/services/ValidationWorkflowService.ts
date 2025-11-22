/**
 * Validation Workflow Service
 * 
 * Manages the complete validation workflow:
 * 1. Create validation record
 * 2. Upload documents with validation_detail_id
 * 3. Monitor indexing completion
 * 4. Trigger validation when ready
 */

import { supabase } from '../lib/supabase';

export interface CreateValidationParams {
  rtoCode: string;
  unitCode: string;
  validationType: string;
}

export interface ValidationRecord {
  summaryId: number;
  typeId: number;
  detailId: number;
}

export interface IndexingStatus {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  allCompleted: boolean;
}

export class ValidationWorkflowService {
  private supabase = supabase;
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentNamespace: string | null = null; // Store namespace for reuse across uploads

  /**
   * Create a validation record before uploading documents
   */
  async createValidationRecord(params: CreateValidationParams): Promise<ValidationRecord> {
    console.log('[ValidationWorkflow] Creating validation record:', params);

    // Generate unique namespace with timestamp for this validation session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.currentNamespace = `${params.rtoCode}-${params.unitCode}-${timestamp}`;
    console.log('[ValidationWorkflow] Generated namespace:', this.currentNamespace);

    try {
      // Add timeout wrapper with increased timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('⏱️ Request timed out. The server may be slow or the edge function is not deployed. Please check Supabase dashboard or try again.'));
        }, 45000); // Increased to 45 seconds
      });

      // Try the deployed function first (create-validation-record)
      console.log('[ValidationWorkflow] Calling edge function: create-validation-record');
      const startTime = Date.now();
      const requestPromise = supabase.functions.invoke('create-validation-record', {
        body: {
          rtoCode: params.rtoCode,
          unitCode: params.unitCode,
          qualificationCode: null,
          validationType: params.validationType,
          pineconeNamespace: this.currentNamespace,
        },
      });

      console.log('[ValidationWorkflow] Waiting for edge function response...');
      const { data, error } = await Promise.race([requestPromise, timeoutPromise]) as any;
      const duration = Date.now() - startTime;
      console.log(`[ValidationWorkflow] Response received in ${duration}ms`);

      if (error) {
        console.error('[ValidationWorkflow] Error creating validation record:', error);
        
        // Provide specific error messages based on error type
        let userMessage = 'Failed to create validation record';
        
        if (error.message?.includes('fetch')) {
          userMessage = '🌐 Network error: Unable to reach Supabase. Please check your internet connection.';
        } else if (error.message?.includes('timeout')) {
          userMessage = '⏱️ Request timed out: The edge function may not be deployed. Please contact support.';
        } else if (error.message?.includes('404') || error.message?.includes('not found')) {
          userMessage = '❌ Edge function not found: The "create-validation-record" function needs to be deployed to Supabase.';
        } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
          userMessage = '🔒 Authorization error: Please refresh the page and try again.';
        } else if (error.message) {
          userMessage = `❌ ${error.message}`;
        }
        
        throw new Error(userMessage);
      }

      console.log('[ValidationWorkflow] Edge function response:', data);

      if (!data) {
        throw new Error('⚠️ No response from edge function. The function may not be deployed correctly.');
      }

      if (!data.success) {
        const errorMsg = data.error || 'Edge function returned success=false';
        console.error('[ValidationWorkflow] Edge function error:', errorMsg);
        console.error('[ValidationWorkflow] Full response data:', data);
        
        // Provide user-friendly error message
        let userMessage = `❌ ${errorMsg}`;
        if (errorMsg.includes('validation_summary')) {
          userMessage = '🗃️ Database error: Unable to create validation summary. Please try again.';
        } else if (errorMsg.includes('validation_type')) {
          userMessage = '🗃️ Database error: Unable to create validation type. Please try again.';
        } else if (errorMsg.includes('validation_detail')) {
          userMessage = '🗃️ Database error: Unable to create validation detail. Please try again.';
        }
        
        throw new Error(userMessage);
      }

      // Handle both response formats (older and newer functions)
      const detailId = data.detailId || data.validationDetailId;
      const summaryId = data.summaryId || data.validationSummaryId;
      const typeId = data.typeId || data.validationTypeId;

      if (!detailId) {
        console.error('[ValidationWorkflow] Missing detailId in response:', data);
        console.error('[ValidationWorkflow] Response structure:', JSON.stringify(data, null, 2));
        throw new Error('⚠️ Invalid response: The validation record was created but no ID was returned. Please contact support.');
      }

      console.log('[ValidationWorkflow] Validation record created successfully:', {
        summaryId,
        typeId,
        detailId,
      });

      return {
        summaryId,
        typeId,
        detailId,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[ValidationWorkflow] Exception creating validation record:', errorMsg);
      console.error('[ValidationWorkflow] Full error:', err);
      console.error('[ValidationWorkflow] Stack trace:', err instanceof Error ? err.stack : 'No stack trace');
      
      // If error already has a user-friendly message (starts with emoji), use it
      if (errorMsg.match(/^[🌐⏱️❌🔒⚠️🗃️]/)) {
        throw err;
      }
      
      // Otherwise, wrap it with a generic message
      throw new Error(`❌ Failed to create validation record: ${errorMsg}`);
    }
  }

  /**
   * Check indexing status for all documents in a validation
   */
  async getIndexingStatus(validationDetailId: number): Promise<IndexingStatus> {
    console.log('[ValidationWorkflow] Checking indexing status for validation:', validationDetailId);

    // Query gemini_operations for this validation
    const { data, error } = await supabase
      .from('gemini_operations')
      .select('status')
      .eq('validation_detail_id', validationDetailId);

    if (error) {
      console.error('[ValidationWorkflow] Error checking indexing status:', error);
      throw new Error(`Failed to check indexing status: ${error.message}`);
    }

    const operations = data || [];
    const total = operations.length;
    const completed = operations.filter(op => op.status === 'completed').length;
    const failed = operations.filter(op => op.status === 'failed').length;
    const processing = operations.filter(op => 
      op.status === 'processing' || op.status === 'pending'
    ).length;

    const allCompleted = total > 0 && completed === total && failed === 0;

    console.log('[ValidationWorkflow] Indexing status:', {
      total,
      completed,
      failed,
      processing,
      allCompleted,
    });

    return {
      total,
      completed,
      failed,
      processing,
      allCompleted,
    };
  }

  /**
   * Trigger validation once all documents are indexed
   */
  async triggerValidation(validationDetailId: number): Promise<void> {
    console.log('[ValidationWorkflow] Triggering validation for:', validationDetailId);

    try {
      // First, get the file_search_store_id from any document in this validation
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('file_search_store_id')
        .eq('validation_detail_id', validationDetailId)
        .limit(1)
        .single();

      if (docsError) {
        console.error('[ValidationWorkflow] Error fetching documents:', docsError);
        throw new Error(`📄 Unable to fetch uploaded documents: ${docsError.message}`);
      }
      
      if (!documents?.file_search_store_id) {
        console.error('[ValidationWorkflow] No file_search_store_id found');
        throw new Error('📄 No documents found for this validation. Please ensure files were uploaded successfully.');
      }

      // Update validation_detail with required fields and set status to processing
      const { error: updateError } = await supabase
        .from('validation_detail')
        .update({
          doc_extracted: true,  // ✅ Fixed: Use snake_case to match database schema
          file_search_store_id: documents.file_search_store_id,
          extract_status: 'ProcessingInBackground', // ✅ Fixed: Use snake_case to match database schema
        })
        .eq('id', validationDetailId);

      if (updateError) {
        console.error('[ValidationWorkflow] Error updating validation_detail:', updateError);
        throw new Error(`🗃️ Failed to update validation status: ${updateError.message}`);
      }

      console.log('[ValidationWorkflow] Updated validation_detail with doc_extracted and file_search_store_id');

      // Now trigger validation with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('⏱️ Validation trigger timed out. The process may be taking longer than expected.'));
        }, 60000); // 60 second timeout for validation trigger
      });
      
      const validationPromise = supabase.functions.invoke('trigger-validation', {
        body: {
          validationDetailId,
        },
      });
      
      const { data, error } = await Promise.race([validationPromise, timeoutPromise]) as any;

      console.log('[ValidationWorkflow] Raw response data:', data);
      console.log('[ValidationWorkflow] Raw response error:', error);

      if (error) {
        console.error('[ValidationWorkflow] Error triggering validation:', error);
        
        // Extract actual error from Response body
        let actualError = error.message;
        
        if (error.context && error.context instanceof Response) {
          try {
            const responseText = await error.context.text();
            console.error('[ValidationWorkflow] Edge function response body:', responseText);
            
            try {
              const responseJson = JSON.parse(responseText);
              actualError = responseJson.error || responseJson.message || responseText;
              console.error('[ValidationWorkflow] Parsed error:', actualError);
            } catch {
              actualError = responseText;
            }
          } catch (e) {
            console.error('[ValidationWorkflow] Could not read response body:', e);
          }
        }
        
        // Provide user-friendly error messages
        if (actualError.includes('404') || actualError.includes('not found')) {
          throw new Error('❌ Validation function not found. Please ensure "trigger-validation" is deployed.');
        } else if (actualError.includes('timeout')) {
          throw new Error('⏱️ Validation trigger timed out. Please try again or contact support.');
        }
        
        throw new Error(`❌ Failed to trigger validation: ${actualError}`);
      }

      if (!data?.success) {
        console.error('[ValidationWorkflow] Validation failed:', data);
        const failureMsg = data?.message || data?.error || 'Unknown error';
        throw new Error(`❌ Validation failed: ${failureMsg}`);
      }

      console.log('[ValidationWorkflow] Validation triggered successfully:', data);
    } catch (err) {
      // Re-throw user-friendly errors
      if (err instanceof Error && err.message.match(/^[📄🗃️⏱️❌]/)) {
        throw err;
      }
      
      // Wrap unexpected errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[ValidationWorkflow] Unexpected error in triggerValidation:', err);
      throw new Error(`❌ Unexpected error triggering validation: ${errorMsg}`);
    }
  }

  /**
   * Poll for indexing completion and auto-trigger validation
   * Returns a cleanup function to stop polling
   */
  startPolling(
    validationDetailId: number,
    onStatusUpdate: (status: IndexingStatus) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): () => void {
    console.log('[ValidationWorkflow] Starting polling for validation:', validationDetailId);

    let isActive = true;

    const poll = async () => {
      if (!isActive) return;

      try {
        const status = await this.getIndexingStatus(validationDetailId);
        onStatusUpdate(status);

        if (status.allCompleted) {
          console.log('[ValidationWorkflow] All documents indexed, waiting for user confirmation...');
          isActive = false;
          onComplete();
        } else if (status.failed > 0) {
          console.warn('[ValidationWorkflow] Some documents failed to index');
          isActive = false;
          onError(new Error(`${status.failed} document(s) failed to index`));
        } else {
          // Continue polling
          setTimeout(poll, 3000); // Poll every 3 seconds
        }
      } catch (error) {
        console.error('[ValidationWorkflow] Polling error:', error);
        isActive = false;
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Start polling
    poll();

    // Return cleanup function
    return () => {
      console.log('[ValidationWorkflow] Stopping polling');
      isActive = false;
    };
  }

  /**
   * Get the current namespace for this validation session
   * All documents uploaded for the same validation will share this namespace
   */
  getCurrentNamespace(): string | null {
    return this.currentNamespace;
  }

  /**
   * Reset namespace when starting a new validation
   * This ensures each validation session has a unique namespace
   */
  resetNamespace(): void {
    console.log('[ValidationWorkflow] Resetting namespace');
    this.currentNamespace = null;
  }

  /**
   * Mark validation_detail record with error status
   * This allows the Dashboard UI to display the error
   */
  async markValidationError(validationDetailId: number, errorMessage: string): Promise<void> {
    console.log('[ValidationWorkflow] Marking validation error:', { validationDetailId, errorMessage });

    try {
      const { error } = await supabase
        .from('validation_detail')
        .update({
          extractStatus: 'Failed',
          error_message: errorMessage,
        })
        .eq('id', validationDetailId);

      if (error) {
        console.error('[ValidationWorkflow] Error updating validation_detail with error status:', error);
      } else {
        console.log('[ValidationWorkflow] Validation marked as failed in database');
      }
    } catch (err) {
      console.error('[ValidationWorkflow] Exception marking validation error:', err);
    }
  }

  /**
   * Update validation status to show current stage
   */
  async updateValidationStatus(validationDetailId: number, status: string): Promise<void> {
    console.log('[ValidationWorkflow] Updating validation status:', { validationDetailId, status });

    try {
      const { error } = await supabase
        .from('validation_detail')
        .update({
          extractStatus: status,
        })
        .eq('id', validationDetailId);

      if (error) {
        console.error('[ValidationWorkflow] Error updating validation status:', error);
      } else {
        console.log('[ValidationWorkflow] Validation status updated to:', status);
      }
    } catch (err) {
      console.error('[ValidationWorkflow] Exception updating validation status:', err);
    }
  }
}

export const validationWorkflowService = new ValidationWorkflowService();
