/**
 * Validation Service v2 - Phase 4.2 Implementation
 * 
 * Uses the new independent validation and smart question generation system
 * with improved error handling and robust retry mechanisms
 */

import { supabase } from '../lib/supabase';

export interface ValidationResult {
  id: string;
  requirement_number: string;
  requirement_type: string;
  requirement_text: string;
  validation_status: 'met' | 'not-met' | 'partial';
  validation_reasoning: string;
  evidence_data?: any;
  smart_questions?: any[];
}

export interface ValidationRequest {
  documentId: string;
  unitCode: string;
  validationType?: string;
  options?: {
    includeSmartQuestions?: boolean;
    difficultyLevel?: 'basic' | 'intermediate' | 'advanced';
    enableRegeneration?: boolean;
  };
}

export interface RegenerateRequest {
  validationResultId: string;
  userContext?: string;
  currentQuestion?: string;
  currentAnswer?: string;
  options?: {
    difficultyLevel?: 'basic' | 'intermediate' | 'advanced';
    questionCount?: number;
  };
}

/**
 * Validate assessment using the new v2 edge function
 * Implements robust error handling and retry logic
 */
export async function validateAssessmentV2(request: ValidationRequest): Promise<{
  success: boolean;
  validationId?: string;
  message: string;
  error?: string;
}> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  console.log('[ValidationService v2] Starting validation with request:', request);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ValidationService v2] Attempt ${attempt}/${maxRetries}`);

      const { data, error } = await supabase.functions.invoke('validate-assessment-v2', {
        body: {
          documentId: request.documentId,
          unitCode: request.unitCode,
          validationType: request.validationType || 'full_validation',
          options: {
            includeSmartQuestions: request.options?.includeSmartQuestions ?? true,
            difficultyLevel: request.options?.difficultyLevel || 'intermediate',
            enableRegeneration: request.options?.enableRegeneration ?? true,
            ...request.options
          }
        },
      });

      if (error) {
        console.error(`[ValidationService v2] Attempt ${attempt} error:`, error);
        
        // Extract detailed error information
        let errorMessage = error.message;
        
        if (error.context && error.context instanceof Response) {
          try {
            const responseText = await error.context.text();
            console.error(`[ValidationService v2] Edge function response body:`, responseText);
            
            try {
              const responseJson = JSON.parse(responseText);
              errorMessage = responseJson.error || responseJson.message || responseText;
            } catch {
              errorMessage = responseText;
            }
          } catch (e) {
            console.error(`[ValidationService v2] Could not read response body:`, e);
          }
        }

        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(errorMessage)) {
          console.log(`[ValidationService v2] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // If we've exhausted retries, return max retries message for retryable errors
        if (attempt >= maxRetries && isRetryableError(errorMessage)) {
          return {
            success: false,
            message: 'Validation failed after multiple attempts',
            error: 'Max retries exceeded'
          };
        }

        // Provide user-friendly error messages for non-retryable errors
        const userError = getErrorMessage(errorMessage);
        return {
          success: false,
          message: userError,
          error: errorMessage
        };
      }

      console.log('[ValidationService v2] Validation triggered successfully:', data);
      
      return {
        success: true,
        validationId: data?.validationId,
        message: 'Validation started successfully'
      };

    } catch (error) {
      console.error(`[ValidationService v2] Attempt ${attempt} unexpected error:`, error);
      
      if (attempt < maxRetries) {
        console.log(`[ValidationService v2] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      return {
        success: false,
        message: 'Validation failed due to an unexpected error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  return {
    success: false,
    message: 'Validation failed after multiple attempts',
    error: 'Max retries exceeded'
  };
}

/**
 * Regenerate smart questions using the dedicated edge function
 * Implements robust error handling and retry logic
 */
export async function regenerateSmartQuestions(request: RegenerateRequest): Promise<{
  success: boolean;
  question?: any;
  message: string;
  error?: string;
}> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  console.log('[ValidationService v2] Regenerating smart questions with request:', request);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ValidationService v2] Regeneration attempt ${attempt}/${maxRetries}`);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-smart-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          validationResultId: request.validationResultId,
          userContext: request.userContext,
          currentQuestion: request.currentQuestion,
          currentAnswer: request.currentAnswer,
          options: {
            difficultyLevel: request.options?.difficultyLevel || 'intermediate',
            questionCount: request.options?.questionCount || 1,
            ...request.options
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ValidationService v2] Regeneration attempt ${attempt} error:`, errorText);
        
        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(errorText)) {
          console.log(`[ValidationService v2] Retrying regeneration in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // If we've exhausted retries, return max retries message for retryable errors
        if (attempt >= maxRetries && isRetryableError(errorText)) {
          return {
            success: false,
            message: 'Smart question regeneration failed after multiple attempts',
            error: 'Max retries exceeded'
          };
        }

        const userError = getErrorMessage(errorText);
        return {
          success: false,
          message: userError,
          error: errorText
        };
      }

      const data = await response.json();
      console.log('[ValidationService v2] Smart questions regenerated successfully:', data);

      if (!data.success) {
        return {
          success: false,
          message: data.error || 'Failed to regenerate smart questions',
          error: data.error
        };
      }

      return {
        success: true,
        question: data.question,
        message: data.message || 'Smart questions regenerated successfully'
      };

    } catch (error) {
      console.error(`[ValidationService v2] Regeneration attempt ${attempt} unexpected error:`, error);
      
      if (attempt < maxRetries) {
        console.log(`[ValidationService v2] Retrying regeneration in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      return {
        success: false,
        message: 'Smart question regeneration failed due to an unexpected error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  return {
    success: false,
    message: 'Smart question regeneration failed after multiple attempts',
    error: 'Max retries exceeded'
  };
}

/**
 * Get validation results with error handling
 */
export async function getValidationResults(validationId: string): Promise<{
  success: boolean;
  results?: ValidationResult[];
  message: string;
  error?: string;
}> {
  try {
    console.log('[ValidationService v2] Fetching validation results for:', validationId);

    const { data, error } = await supabase
      .from('validation_results')
      .select('*')
      .eq('validation_detail_id', validationId)
      .order('requirement_number');

    if (error) {
      console.error('[ValidationService v2] Error fetching validation results:', error);
      return {
        success: false,
        message: 'Failed to fetch validation results',
        error: error.message
      };
    }

    console.log(`[ValidationService v2] Retrieved ${data?.length || 0} validation results`);
    
    return {
      success: true,
      results: data || [],
      message: `Retrieved ${data?.length || 0} validation results`
    };

  } catch (error) {
    console.error('[ValidationService v2] Unexpected error fetching results:', error);
    return {
      success: false,
      message: 'Failed to fetch validation results due to an unexpected error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if an error is retryable
 */
function isRetryableError(errorMessage: string): boolean {
  const retryableErrors = [
    'timeout',
    'network',
    'connection',
    'rate limit',
    'temporary',
    'service unavailable',
    '503',
    '502',
    '429'
  ];

  const lowerError = errorMessage.toLowerCase();
  return retryableErrors.some(error => lowerError.includes(error));
}

/**
 * Convert technical error messages to user-friendly messages
 */
function getErrorMessage(errorMessage: string): string {
  const lowerError = errorMessage.toLowerCase();

  // Check for specific document errors first
  if (lowerError.includes('document not found')) {
    return '📄 Document not found. Please ensure the document was uploaded successfully.';
  } else if (lowerError.includes('404') || lowerError.includes('not found')) {
    return '❌ Validation function not found. Please ensure the edge functions are deployed.';
  } else if (lowerError.includes('timeout')) {
    return '⏱️ Validation timed out. The process is taking longer than expected. Please try again.';
  } else if (lowerError.includes('rate limit') || lowerError.includes('429')) {
    return '⚠️ Too many requests. Please wait a moment and try again.';
  } else if (lowerError.includes('unauthorized') || lowerError.includes('401')) {
    return '🔒 Authentication failed. Please log in and try again.';
  } else if (lowerError.includes('forbidden') || lowerError.includes('403')) {
    return '🚫 Permission denied. You do not have access to this function.';
  } else if (lowerError.includes('validation failed')) {
    return '❌ Validation process failed. Please check your document and try again.';
  } else if (lowerError.includes('ai') || lowerError.includes('gemini')) {
    return '🤖 AI service temporarily unavailable. Please try again in a few moments.';
  } else if (lowerError.includes('credits') || lowerError.includes('insufficient')) {
    return '💳 Insufficient credits. Please top up your account and try again.';
  } else {
    return '❌ An error occurred during validation. Please try again or contact support.';
  }
}

/**
 * Validate request parameters
 */
export function validateValidationRequest(request: ValidationRequest): {
  isValid: boolean;
  error?: string;
} {
  if (!request.documentId) {
    return { isValid: false, error: 'Document ID is required' };
  }

  if (!request.unitCode) {
    return { isValid: false, error: 'Unit code is required' };
  }

  if (request.options?.difficultyLevel && 
      !['basic', 'intermediate', 'advanced'].includes(request.options.difficultyLevel)) {
    return { isValid: false, error: 'Invalid difficulty level. Must be basic, intermediate, or advanced' };
  }

  return { isValid: true };
}

/**
 * Validate regeneration request parameters
 */
export function validateRegenerationRequest(request: RegenerateRequest): {
  isValid: boolean;
  error?: string;
} {
  if (!request.validationResultId) {
    return { isValid: false, error: 'Validation result ID is required' };
  }

  if (request.options?.difficultyLevel && 
      !['basic', 'intermediate', 'advanced'].includes(request.options.difficultyLevel)) {
    return { isValid: false, error: 'Invalid difficulty level. Must be basic, intermediate, or advanced' };
  }

  if (request.options?.questionCount !== undefined && (request.options.questionCount < 1 || request.options.questionCount > 10)) {
    return { isValid: false, error: 'Question count must be between 1 and 10' };
  }

  return { isValid: true };
}
