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
 * Circuit Breaker for n8n webhook calls
 * Prevents cascade failures when n8n is unavailable
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeout: number = 60000 // 1 minute
  ) {}

  private isOpen(): boolean {
    if (this.state === 'open') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'half-open';
        console.log('[CircuitBreaker] State changed to half-open, allowing one request');
        return false;
      }
      return true;
    }
    return false;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.warn(`[CircuitBreaker] Circuit opened after ${this.failures} failures. Will retry after ${this.resetTimeout / 1000}s`);
    }
  }

  private reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  async execute<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    if (this.isOpen()) {
      throw new Error(
        `n8n service temporarily unavailable. Circuit breaker is open due to repeated failures. ` +
        `Please try again in ${Math.ceil((this.resetTimeout - (Date.now() - this.lastFailure)) / 1000)} seconds.`
      );
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      console.error(`[CircuitBreaker] ${operationName} failed (${this.failures}/${this.threshold}):`, error);
      throw error;
    }
  }

  getState(): { state: string; failures: number; threshold: number } {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
    };
  }
}

// Global circuit breaker instance for n8n webhooks
const n8nCircuitBreaker = new CircuitBreaker(5, 60000);

/**
 * Get the current circuit breaker state (for debugging/monitoring)
 */
export function getCircuitBreakerState() {
  return n8nCircuitBreaker.getState();
}

/**
 * Default timeout for n8n webhook calls (2 minutes)
 */
const N8N_DEFAULT_TIMEOUT = 120000;

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = N8N_DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

  return n8nCircuitBreaker.execute(async () => {
    const response = await fetchWithTimeout(
      n8nUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validation_detail_id: validationDetailId,
          storage_paths: storagePaths,
        }),
      },
      N8N_DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Document processing trigger failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    console.log('[n8nApi] ✅ n8n response:', result);

    // Wrap n8n response to match N8nResponse interface
    // n8n returns {message: 'Workflow was started'} on success
    return {
      success: true,
      data: result,
    };
  }, 'triggerDocumentProcessing');
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
  validationDetailId: number,
  validationResultId: number,
  userGuidance: string,
  requirementText?: string,
  existingSmartQuestion?: string
): Promise<{
  validation_detail_id: number;
  questions: Array<{
    question: string;
    question_type: string;
    difficulty_level: string;
    focus_area: string;
    expected_document_sections?: string[];
    rationale?: string;
  }>;
  summary?: string;
  response_timestamp: string;
}> {
  // Use Supabase Edge Function proxy to avoid CORS
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/regenerate-questions-proxy`;
  
  console.log('[n8nApi] Regenerate Questions via Edge Function:', {
    url: edgeFunctionUrl,
    validationDetailId,
    validationResultId,
    userGuidanceLength: userGuidance?.length,
    hasRequirementText: !!requirementText,
    hasExistingQuestion: !!existingSmartQuestion,
  });

  const payload: any = {
    validation_detail_id: validationDetailId,
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
  documentProcessing: boolean;
  validation: boolean;
  report: boolean;
  revalidate: boolean;
  regenerateQuestions: boolean;
  aiChat: boolean;
  allConfigured: boolean;
  criticalConfigured: boolean;
  missingCritical: string[];
  missingOptional: string[];
} {
  const config = {
    documentProcessing: !!import.meta.env.VITE_N8N_DOCUMENT_PROCESSING_URL,
    validation: !!import.meta.env.VITE_N8N_VALIDATION_URL,
    report: !!import.meta.env.VITE_N8N_REPORT_URL,
    revalidate: !!import.meta.env.VITE_N8N_REVALIDATE_URL,
    regenerateQuestions: !!import.meta.env.VITE_N8N_REGENERATE_QUESTIONS_URL,
    aiChat: !!import.meta.env.VITE_N8N_AI_CHAT_URL,
  };

  // Critical URLs required for basic functionality
  const criticalKeys = ['documentProcessing'] as const;
  const optionalKeys = ['validation', 'report', 'revalidate', 'regenerateQuestions', 'aiChat'] as const;

  const missingCritical = criticalKeys.filter(key => !config[key]).map(key => {
    const envVarMap: Record<string, string> = {
      documentProcessing: 'VITE_N8N_DOCUMENT_PROCESSING_URL',
    };
    return envVarMap[key] || key;
  });

  const missingOptional = optionalKeys.filter(key => !config[key]).map(key => {
    const envVarMap: Record<string, string> = {
      validation: 'VITE_N8N_VALIDATION_URL',
      report: 'VITE_N8N_REPORT_URL',
      revalidate: 'VITE_N8N_REVALIDATE_URL',
      regenerateQuestions: 'VITE_N8N_REGENERATE_QUESTIONS_URL',
      aiChat: 'VITE_N8N_AI_CHAT_URL',
    };
    return envVarMap[key] || key;
  });

  return {
    ...config,
    allConfigured: Object.values(config).every(v => v),
    criticalConfigured: missingCritical.length === 0,
    missingCritical,
    missingOptional,
  };
}

/**
 * Validate all required environment variables on startup
 * Logs warnings for missing optional configs
 */
export function validateEnvironment(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Supabase config
  if (!import.meta.env.VITE_SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is required');
  }
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }

  // Check n8n config
  const n8nConfig = checkN8nConfiguration();

  if (!n8nConfig.criticalConfigured) {
    errors.push(`Missing critical n8n URLs: ${n8nConfig.missingCritical.join(', ')}`);
  }

  if (n8nConfig.missingOptional.length > 0) {
    warnings.push(`Missing optional n8n URLs (some features may be unavailable): ${n8nConfig.missingOptional.join(', ')}`);
  }

  // Log validation results
  if (errors.length > 0) {
    console.error('[Environment] ❌ Configuration errors:', errors);
  }
  if (warnings.length > 0) {
    console.warn('[Environment] ⚠️ Configuration warnings:', warnings);
  }
  if (errors.length === 0 && warnings.length === 0) {
    console.log('[Environment] ✅ All environment variables configured');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
