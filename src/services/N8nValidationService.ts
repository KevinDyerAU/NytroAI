/**
 * N8n Validation Service
 * 
 * Handles all validation operations via n8n workflow
 * Replaces complex edge function orchestration with simple webhook calls
 */

const N8N_WEBHOOK_URL = 'https://n8n-gtoa.onrender.com/webhook/validate-document';

export interface N8nValidationRequest {
  validationDetailId: number;
  documentId: number;
  fileName: string;
  storagePath: string;
  validationType: string;
  fileSearchStore: string;
}

export interface N8nValidationResponse {
  success: boolean;
  validationDetailId: number;
  documentId: number;
  status: string;
  unitCode: string;
  unitLink: string;
  validationsCount: number;
  coveragePercentage: number;
  citations: {
    count: number;
    coverage: number;
    averageConfidence: number;
    quality: 'good' | 'needs_review';
  };
  error?: string;
}

/**
 * Trigger validation via n8n workflow
 * 
 * This replaces the old validate-assessment edge function
 * All validation logic (upload, indexing, requirements fetching, Gemini calls, citation extraction)
 * is now handled by the n8n workflow
 */
export async function triggerN8nValidation(
  request: N8nValidationRequest
): Promise<N8nValidationResponse> {
  console.log('[N8n Validation] Triggering validation:', {
    validationDetailId: request.validationDetailId,
    documentId: request.documentId,
    validationType: request.validationType
  });

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`N8n webhook failed: ${response.status} - ${errorText}`);
    }

    const result: N8nValidationResponse = await response.json();

    console.log('[N8n Validation] Success:', {
      validationDetailId: result.validationDetailId,
      status: result.status,
      validationsCount: result.validationsCount,
      citationCount: result.citations.count,
      citationQuality: result.citations.quality
    });

    return result;
  } catch (error) {
    console.error('[N8n Validation] Error:', error);
    throw error;
  }
}

/**
 * Trigger validation for a validation_detail record
 * 
 * Simplified version that fetches required data and calls n8n
 */
export async function triggerValidationByDetailId(
  validationDetailId: number,
  supabase: any
): Promise<N8nValidationResponse> {
  console.log('[N8n Validation] Fetching validation context for:', validationDetailId);

  // Fetch validation context from database
  const { data: validationDetail, error: detailError } = await supabase
    .from('validation_detail')
    .select(`
      id,
      summary_id,
      namespace_code,
      validation_type (code),
      validation_summary!inner (
        unitCode,
        unitLink,
        rtoCode
      )
    `)
    .eq('id', validationDetailId)
    .single();

  if (detailError || !validationDetail) {
    throw new Error(`Failed to fetch validation detail: ${detailError?.message || 'Not found'}`);
  }

  // Fetch documents for this validation
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, storage_path, file_search_store')
    .eq('validation_detail_id', validationDetailId)
    .order('created_at', { ascending: true });

  if (docsError || !documents || documents.length === 0) {
    throw new Error(`Failed to fetch documents: ${docsError?.message || 'No documents found'}`);
  }

  // Use first document (or could iterate for multiple)
  const document = documents[0];

  if (!document.file_search_store) {
    throw new Error('Document does not have a file_search_store assigned');
  }

  // Prepare n8n request
  const request: N8nValidationRequest = {
    validationDetailId: validationDetail.id,
    documentId: document.id,
    fileName: document.file_name,
    storagePath: document.storage_path,
    validationType: validationDetail.validation_type.code,
    fileSearchStore: document.file_search_store,
  };

  // Call n8n workflow
  return await triggerN8nValidation(request);
}

/**
 * Check if n8n webhook is available
 */
export async function checkN8nHealth(): Promise<boolean> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'OPTIONS',
    });
    return response.ok;
  } catch (error) {
    console.error('[N8n Health] Check failed:', error);
    return false;
  }
}

/**
 * Get n8n webhook URL (for debugging/monitoring)
 */
export function getN8nWebhookUrl(): string {
  return N8N_WEBHOOK_URL;
}
