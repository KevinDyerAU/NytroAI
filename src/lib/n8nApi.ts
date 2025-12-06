/**
 * n8n API Integration Utilities
 * 
 * Provides functions for various validation operations:
 * - Document processing (via n8n webhook)
 * - Validation processing (via n8n webhook)
 * - Report generation (direct database query → Excel templates)
 * - Requirement revalidation (via n8n webhook)
 * - Question regeneration (via n8n webhook)
 * - AI chat (via n8n webhook)
 */

interface N8nResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Trigger document processing via n8n (uploads to Gemini File API)
 * This should be called FIRST after files are uploaded to Supabase Storage
 * Sends validation_detail_id + storage_paths directly to n8n for processing
 */
export async function triggerDocumentProcessing(validationDetailId: number, storagePaths: string[]): Promise<N8nResponse> {
  const n8nUrl = import.meta.env.VITE_N8N_DOCUMENT_PROCESSING_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N document processing URL not configured. Please set VITE_N8N_DOCUMENT_PROCESSING_URL in environment variables.');
  }

  if (!storagePaths || storagePaths.length === 0) {
    throw new Error('No storage paths provided. Please upload files first.');
  }

  console.log('[n8nApi] 📤 Calling n8n webhook:', {
    url: n8nUrl,
    validation_detail_id: validationDetailId,
    storage_paths: storagePaths,
    document_count: storagePaths.length,
  });

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
      storage_paths: storagePaths,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Document processing trigger failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  console.log('[n8nApi] ✅ n8n response:', result);

  return result;
}

/**
 * Trigger validation processing via n8n
 * @deprecated This is called automatically by n8n after document processing completes
 */
export async function triggerValidation(validationDetailId: number): Promise<N8nResponse> {
  const n8nUrl = import.meta.env.VITE_N8N_VALIDATION_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N validation URL not configured. Please set VITE_N8N_VALIDATION_URL in environment variables.');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Validation trigger failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Generate validation report via n8n webhook (deprecated - use ReportGenerationPopup instead)
 * Kept for backward compatibility
 */
export async function generateReport(validationDetailId: number): Promise<{
  success: boolean;
  report?: string;
  filename?: string;
  error?: string;
}> {
  console.warn('[n8nApi] generateReport is deprecated. Use ReportGenerationPopup component instead.');
  return {
    success: false,
    error: 'This function is deprecated. Please use the Report Generation popup.',
  };
}

/**
 * Download report as file
 */
export function downloadReport(reportContent: string, filename: string): void {
  const blob = new Blob([reportContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'validation_report.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Revalidate a single requirement via Supabase Edge Function proxy
 * Uses edge function to avoid CORS issues with n8n
 * Sends the complete validation result object
 */
export async function revalidateRequirement(validationResult: any): Promise<N8nResponse> {
  // Use Supabase Edge Function proxy to avoid CORS
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/revalidate-proxy`;
  
  console.log('[n8nApi] Revalidate via Edge Function:', {
    url: edgeFunctionUrl,
    validationResultId: validationResult.id,
    validationDetailId: validationResult.validation_detail_id,
  });

  // Send the complete validation_result object
  const payload = {
    validation_result: validationResult,
  };

  console.log('[n8nApi] Revalidate payload:', payload);

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('[n8nApi] Revalidate response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[n8nApi] Revalidate error response:', errorText);
    throw new Error(`Revalidation failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('[n8nApi] Revalidate response:', result);

  return result;
}

/**
 * Regenerate smart questions for a requirement via Supabase Edge Function proxy
 * Uses edge function to avoid CORS issues with n8n
 */
export async function regenerateQuestions(
  validationResultId: number,
  userGuidance: string,
  requirementText?: string,
  existingSmartQuestion?: string
): Promise<{
  success: boolean;
  questions?: Array<{
    id: number;
    question_text: string;
    context: string;
  }>;
  error?: string;
}> {
  // Use Supabase Edge Function proxy to avoid CORS
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/regenerate-questions-proxy`;
  
  console.log('[n8nApi] Regenerate Questions via Edge Function:', {
    url: edgeFunctionUrl,
    validationResultId,
    userGuidanceLength: userGuidance?.length,
    hasRequirementText: !!requirementText,
    hasExistingQuestion: !!existingSmartQuestion,
  });

  const payload: any = {
    validation_result_id: validationResultId,
    user_guidance: userGuidance,
  };

  // Include requirement context if provided
  if (requirementText) {
    payload.requirement_text = requirementText;
  }
  
  // Include existing SMART question if provided
  if (existingSmartQuestion) {
    payload.existing_smart_question = existingSmartQuestion;
  }

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('[n8nApi] Regenerate Questions response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[n8nApi] Regenerate Questions error response:', errorText);
    throw new Error(`Question regeneration failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('[n8nApi] Regenerate Questions response:', result);

  return result;
}

/**
 * Send message to AI chat via Supabase Edge Function proxy
 * Uses edge function to avoid CORS issues with n8n
 */
export async function sendAIChatMessage(
  validationDetailId: number,
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  // Use Supabase Edge Function proxy to avoid CORS
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/ai-chat-proxy`;
  
  console.log('[n8nApi] AI Chat via Edge Function:', {
    url: edgeFunctionUrl,
    validationDetailId,
    messageLength: message?.length,
    historyLength: conversationHistory?.length,
  });

  const payload = {
    validation_detail_id: validationDetailId,
    message: message,
    conversation_history: conversationHistory,
  };

  console.log('[n8nApi] Sending AI chat request:', payload);

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  console.log('[n8nApi] AI chat response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[n8nApi] AI chat error response:', errorText);
    throw new Error(`AI Chat failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('[n8nApi] AI chat response:', result);

  return result;
}

/**
 * Check if n8n webhooks are configured
 */
export function checkN8nConfiguration(): {
  validation: boolean;
  report: boolean;
  revalidate: boolean;
  regenerateQuestions: boolean;
  aiChat: boolean;
  allConfigured: boolean;
} {
  const config = {
    validation: !!import.meta.env.VITE_N8N_VALIDATION_URL,
    report: !!import.meta.env.VITE_N8N_REPORT_URL,
    revalidate: !!import.meta.env.VITE_N8N_REVALIDATE_URL,
    regenerateQuestions: !!import.meta.env.VITE_N8N_REGENERATE_QUESTIONS_URL,
    aiChat: !!import.meta.env.VITE_N8N_AI_CHAT_URL,
  };

  return {
    ...config,
    allConfigured: Object.values(config).every(v => v),
  };
}
