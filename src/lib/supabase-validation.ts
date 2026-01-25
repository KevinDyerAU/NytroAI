/**
 * Supabase Validation Service
 * 
 * This module provides validation functionality using Supabase Edge Functions.
 * It supports multiple AI providers (Azure OpenAI and Google Gemini) with a
 * unified interface.
 * 
 * The AI provider is configured via environment variables in Supabase:
 * - AI_PROVIDER: 'azure' | 'google' (default: 'google')
 * - ORCHESTRATION_MODE: 'direct' | 'n8n' (default: 'direct')
 */

import { supabase } from './supabase';

/**
 * Interface for uploaded file data
 */
export interface UploadedFileData {
  name: string;
  path: string;
  size: number;
  type: string;
}

/**
 * Interface for validation trigger response
 */
export interface ValidationTriggerResponse {
  success: boolean;
  message?: string;
  provider?: 'azure' | 'google';
  orchestration?: 'direct' | 'n8n';
  validationDetailId?: number;
  overallStatus?: string;
  requirementCount?: number;
  elapsedMs?: number;
  error?: string;
}

/**
 * Creates a folder name for storing documents
 * Format: {unitCode}_{timestamp}
 */
export function createFolderName(unitCode: string): string {
  const timestamp = Date.now();
  const sanitizedUnitCode = unitCode.replace(/[^a-zA-Z0-9]/g, '_');
  return `${sanitizedUnitCode}_${timestamp}`;
}

/**
 * Creates a Pinecone namespace (legacy - kept for compatibility)
 * Format: {rtoCode}_{unitCode}_{timestamp}
 */
export function createPineconeNamespace(rtoCode: string, unitCode: string): string {
  const timestamp = Date.now();
  const sanitizedRtoCode = rtoCode.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedUnitCode = unitCode.replace(/[^a-zA-Z0-9]/g, '_');
  return `${sanitizedRtoCode}_${sanitizedUnitCode}_${timestamp}`;
}

/**
 * Uploads files to Supabase Storage
 * 
 * @param files - Array of File objects to upload
 * @param rtoCode - RTO code for the organization
 * @param unitCode - Unit code for the validation
 * @param validationDetailId - ID of the validation detail record
 * @param onProgress - Optional callback for upload progress
 * @returns Array of uploaded file data
 */
export async function uploadFilesToSupabase(
  files: File[],
  rtoCode: string,
  unitCode: string,
  validationDetailId: number,
  onProgress?: (fileName: string, progress: number) => void
): Promise<UploadedFileData[]> {
  const uploadedFiles: UploadedFileData[] = [];
  const folderPath = `${rtoCode}/${unitCode}/${validationDetailId}`;

  for (const file of files) {
    try {
      // Report initial progress
      onProgress?.(file.name, 0);

      const filePath = `${folderPath}/${file.name}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('assessment-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error(`[uploadFilesToSupabase] Failed to upload ${file.name}:`, error);
        throw error;
      }

      // Report completion
      onProgress?.(file.name, 100);

      uploadedFiles.push({
        name: file.name,
        path: data.path,
        size: file.size,
        type: file.type,
      });

      console.log(`[uploadFilesToSupabase] Successfully uploaded: ${file.name}`);
    } catch (error) {
      console.error(`[uploadFilesToSupabase] Error uploading ${file.name}:`, error);
      throw error;
    }
  }

  return uploadedFiles;
}

/**
 * Starts validation using the unified Edge Function
 * 
 * This function triggers the validation process using the configured AI provider.
 * The provider is determined by environment variables in Supabase:
 * - AI_PROVIDER=azure → Uses Azure OpenAI + Document Intelligence
 * - AI_PROVIDER=google + ORCHESTRATION_MODE=n8n → Uses n8n webhook
 * - AI_PROVIDER=google + ORCHESTRATION_MODE=direct → Uses direct Gemini
 * 
 * @param validationDetailId - ID of the validation detail record
 * @param rtoCode - RTO code for the organization
 * @param unitCode - Unit code for the validation
 * @param validationType - Type of validation (e.g., 'full', 'quick')
 * @param uploadedFiles - Array of uploaded file data
 * @returns Validation trigger response
 */
export async function startValidationWithGemini(
  validationDetailId: number,
  rtoCode: string,
  unitCode: string,
  validationType: string,
  uploadedFiles: UploadedFileData[]
): Promise<ValidationTriggerResponse> {
  console.log('[startValidationWithGemini] Starting validation with unified trigger...');
  console.log('[startValidationWithGemini] Params:', {
    validationDetailId,
    rtoCode,
    unitCode,
    validationType,
    fileCount: uploadedFiles.length,
  });

  try {
    // Call the unified validation trigger Edge Function
    const { data, error } = await supabase.functions.invoke('trigger-validation-unified', {
      body: {
        validationDetailId,
        rtoCode,
        unitCode,
        validationType,
        files: uploadedFiles,
      },
    });

    if (error) {
      console.error('[startValidationWithGemini] Edge Function error:', error);
      throw new Error(error.message || 'Failed to trigger validation');
    }

    console.log('[startValidationWithGemini] Response:', data);

    if (!data.success) {
      throw new Error(data.error || 'Validation failed');
    }

    return {
      success: true,
      message: data.message,
      provider: data.provider,
      orchestration: data.orchestration,
      validationDetailId: data.validationDetailId,
      overallStatus: data.overallStatus,
      requirementCount: data.requirementCount,
      elapsedMs: data.elapsedMs,
    };
  } catch (error) {
    console.error('[startValidationWithGemini] Error:', error);
    
    // Return error response instead of throwing
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Starts validation using the legacy n8n trigger (for backward compatibility)
 * 
 * @deprecated Use startValidationWithGemini instead, which supports both providers
 */
export async function startValidationWithN8n(
  validationDetailId: number
): Promise<ValidationTriggerResponse> {
  console.log('[startValidationWithN8n] Starting validation via n8n trigger...');
  
  try {
    const { data, error } = await supabase.functions.invoke('trigger-validation-n8n', {
      body: { validationDetailId },
    });

    if (error) {
      console.error('[startValidationWithN8n] Edge Function error:', error);
      throw new Error(error.message || 'Failed to trigger n8n validation');
    }

    return {
      success: data.success,
      message: data.message,
      provider: 'google',
      orchestration: 'n8n',
      validationDetailId,
    };
  } catch (error) {
    console.error('[startValidationWithN8n] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Gets the current AI provider configuration
 * Note: This is for display purposes only. The actual provider is determined
 * by environment variables in the Edge Function.
 */
export function getProviderInfo(): { provider: string; description: string } {
  // The actual provider is configured in Supabase Edge Function secrets
  // This function provides information for the UI
  return {
    provider: 'unified',
    description: 'AI provider is configured via Supabase Edge Function secrets (AI_PROVIDER, ORCHESTRATION_MODE)',
  };
}
