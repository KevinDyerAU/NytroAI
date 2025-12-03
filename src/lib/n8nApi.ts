/**
 * n8n API Integration Utilities
 * 
 * Provides functions to call n8n webhooks for various operations:
 * - Document processing
 * - Validation processing
 * - Report generation
 * - Requirement revalidation
 * - Question regeneration
 * - AI chat
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
 * Generate validation report by querying database directly
 */
export async function generateReport(validationDetailId: number): Promise<{
  success: boolean;
  report?: string;
  filename?: string;
  error?: string;
}> {
  console.log('[n8nApi] Generating report for validation:', validationDetailId);

  try {
    // Import supabase dynamically to avoid circular dependencies
    const { supabase } = await import('./supabase');
    
    // Fetch validation detail with relationships
    const { data: validationDetail, error: validationError } = await supabase
      .from('validation_detail')
      .select(`
        *,
        validation_summary:summary_id(unitCode, qualificationCode),
        validation_type:validationType_id(code)
      `)
      .eq('id', validationDetailId)
      .single();

    if (validationError) {
      throw new Error(`Failed to fetch validation details: ${validationError.message}`);
    }

    // Fetch all validation results
    const { data: results, error: resultsError } = await supabase
      .from('validation_results')
      .select('*')
      .eq('validation_detail_id', validationDetailId)
      .order('requirement_number');

    if (resultsError) {
      throw new Error(`Failed to fetch validation results: ${resultsError.message}`);
    }

    if (!results || results.length === 0) {
      throw new Error('No validation results found');
    }

    // Generate report content
    const report = formatValidationReport(validationDetail, results);
    
    // Generate filename
    const unitCode = validationDetail.validation_summary?.unitCode || 'unknown';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${unitCode}_validation_report_${timestamp}.md`;

    console.log('[n8nApi] Report generated successfully:', { resultCount: results.length, filename });

    return {
      success: true,
      report,
      filename,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[n8nApi] Report generation error:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Format validation results into markdown report
 */
function formatValidationReport(validationDetail: any, results: any[]): string {
  const unitCode = validationDetail.validation_summary?.unitCode || 'N/A';
  const unitTitle = validationDetail.validation_summary?.qualificationCode || 'N/A';
  const validationType = validationDetail.validation_type?.code || 'N/A';
  const createdAt = new Date(validationDetail.created_at).toLocaleDateString();
  
  // Calculate statistics
  const total = results.length;
  const met = results.filter(r => r.status?.toLowerCase() === 'met').length;
  const notMet = results.filter(r => r.status?.toLowerCase().includes('not')).length;
  const partial = results.filter(r => r.status?.toLowerCase() === 'partial').length;
  const complianceScore = total > 0 ? Math.round((met / total) * 100) : 0;

  let report = `# Validation Report\n\n`;
  report += `**Unit Code:** ${unitCode}\n`;
  report += `**Unit Title:** ${unitTitle}\n`;
  report += `**Validation Type:** ${validationType}\n`;
  report += `**Date Generated:** ${createdAt}\n\n`;
  
  report += `---\n\n`;
  
  report += `## Summary\n\n`;
  report += `- **Total Requirements:** ${total}\n`;
  report += `- **Met:** ${met} (${total > 0 ? Math.round((met / total) * 100) : 0}%)\n`;
  report += `- **Not Met:** ${notMet} (${total > 0 ? Math.round((notMet / total) * 100) : 0}%)\n`;
  report += `- **Partial:** ${partial} (${total > 0 ? Math.round((partial / total) * 100) : 0}%)\n`;
  report += `- **Compliance Score:** ${complianceScore}%\n\n`;
  
  report += `---\n\n`;
  
  report += `## Detailed Results\n\n`;
  
  results.forEach((result, index) => {
    report += `### ${result.requirement_number || `Requirement ${index + 1}`}\n\n`;
    report += `**Type:** ${result.requirement_type || 'N/A'}\n\n`;
    report += `**Requirement:** ${result.requirement_text || 'N/A'}\n\n`;
    report += `**Status:** ${result.status || 'N/A'}\n\n`;
    
    if (result.reasoning) {
      report += `**Reasoning:**\n${result.reasoning}\n\n`;
    }
    
    // Smart questions (JSONB array)
    if (result.smart_questions && Array.isArray(result.smart_questions) && result.smart_questions.length > 0) {
      report += `**Smart Questions:**\n`;
      result.smart_questions.forEach((q: any) => {
        const questionText = typeof q === 'string' ? q : q.question || q.text || JSON.stringify(q);
        report += `- ${questionText}\n`;
      });
      report += `\n`;
    }
    
    // Benchmark answer
    if (result.benchmark_answer) {
      report += `**Benchmark Answer:**\n${result.benchmark_answer}\n\n`;
    }
    
    // Document references (from citations JSONB array)
    if (result.citations && Array.isArray(result.citations) && result.citations.length > 0) {
      report += `**Document References:**\n`;
      result.citations.forEach((citation: any, idx: number) => {
        if (typeof citation === 'string') {
          report += `${idx + 1}. ${citation}\n`;
        } else {
          report += `${idx + 1}. ${citation.text || citation.reference || JSON.stringify(citation)}\n`;
        }
      });
      report += `\n`;
    }
    
    // Document namespace (for multi-document validations)
    if (result.document_namespace) {
      report += `**Document:** ${result.document_namespace}\n\n`;
    }
    
    report += `---\n\n`;
  });
  
  return report;
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
 * Revalidate a single requirement via n8n
 */
export async function revalidateRequirement(validationResultId: number): Promise<N8nResponse> {
  const n8nUrl = import.meta.env.VITE_N8N_REVALIDATE_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N revalidate URL not configured. Please set VITE_N8N_REVALIDATE_URL in environment variables.');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_result_id: validationResultId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Revalidation failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Regenerate smart questions for a requirement via n8n
 */
export async function regenerateQuestions(
  validationResultId: number,
  userGuidance: string
): Promise<{
  success: boolean;
  questions?: Array<{
    id: number;
    question_text: string;
    context: string;
  }>;
  error?: string;
}> {
  const n8nUrl = import.meta.env.VITE_N8N_REGENERATE_QUESTIONS_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N regenerate questions URL not configured. Please set VITE_N8N_REGENERATE_QUESTIONS_URL in environment variables.');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_result_id: validationResultId,
      user_guidance: userGuidance,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Question regeneration failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Send message to AI chat via n8n
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
  const n8nUrl = import.meta.env.VITE_N8N_AI_CHAT_URL;
  
  if (!n8nUrl) {
    throw new Error('N8N AI chat URL not configured. Please set VITE_N8N_AI_CHAT_URL in environment variables.');
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      validation_detail_id: validationDetailId,
      message: message,
      conversation_history: conversationHistory,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI Chat failed (${response.status}): ${errorText}`);
  }

  return await response.json();
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
