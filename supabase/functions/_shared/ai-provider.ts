/**
 * AI Provider Abstraction Layer
 * 
 * This module provides a unified interface for AI operations, allowing
 * seamless switching between Google Gemini and Azure OpenAI.
 * 
 * Environment Variables:
 * - AI_PROVIDER: 'azure' | 'google' (default: 'google')
 * - ORCHESTRATION_MODE: 'direct' | 'n8n' (default: 'direct')
 * 
 * When AI_PROVIDER='google':
 *   - Uses Google Gemini for text generation
 *   - Uses Gemini File API for document processing
 * 
 * When AI_PROVIDER='azure':
 *   - Uses Azure OpenAI for text generation
 *   - Uses Azure Document Intelligence for document processing
 * 
 * When ORCHESTRATION_MODE='n8n':
 *   - Validation is triggered via n8n webhook
 *   - n8n handles polling and orchestration
 * 
 * When ORCHESTRATION_MODE='direct':
 *   - Validation is handled directly in Edge Functions
 *   - No external orchestration needed
 */

import { createDefaultGeminiClient, type GenerateContentResponse } from './gemini.ts';
import {
  createDefaultAzureOpenAIClient,
  shouldUseAzure,
  type StructuredValidationResponse,
  type AzureOpenAIMessage
} from './azure-openai.ts';
import { createDefaultAzureDocIntelClient, type ExtractedDocument } from './azure-document-intelligence.ts';

export interface AIProviderConfig {
  provider: 'azure' | 'google';
  orchestrationMode: 'direct' | 'n8n';
}

export interface ValidationRequest {
  prompt: string;
  documentContent?: string;  // Pre-extracted document text (for Azure)
  fileSearchStoreName?: string;  // Gemini File Search store (for Google)
  systemInstruction?: string;  // System instruction from DB prompts
  outputSchema?: any;  // JSON schema for structured output from DB prompts
  generationConfig?: {  // Generation config from DB prompts
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

export interface ValidationResponse {
  text: string;
  provider: 'azure' | 'google';
  groundingChunks?: any[];  // Only available with Google Gemini
}

/**
 * Get the current AI provider configuration
 */
export function getAIProviderConfig(): AIProviderConfig {
  const provider = (Deno.env.get('AI_PROVIDER') || 'google').toLowerCase() as 'azure' | 'google';
  const orchestrationMode = (Deno.env.get('ORCHESTRATION_MODE') || 'direct').toLowerCase() as 'direct' | 'n8n';

  return { provider, orchestrationMode };
}

/**
 * Check if n8n orchestration should be used
 */
export function shouldUseN8n(): boolean {
  const config = getAIProviderConfig();
  return config.orchestrationMode === 'n8n';
}

/**
 * Create a unified AI client that works with both providers
 */
export function createAIClient() {
  const config = getAIProviderConfig();

  console.log('[AI Provider] Initializing:', {
    provider: config.provider,
    orchestrationMode: config.orchestrationMode
  });

  if (config.provider === 'azure') {
    const openaiClient = createDefaultAzureOpenAIClient();
    const docIntelClient = createDefaultAzureDocIntelClient();

    return {
      provider: 'azure' as const,

      /**
       * Generate validation response using Azure OpenAI
       */
      async generateValidation(request: ValidationRequest): Promise<ValidationResponse> {
        if (!request.documentContent) {
          throw new Error('Azure provider requires pre-extracted document content');
        }

        // Build the prompt with document content inline
        const fullPrompt = `${request.prompt}\n\n---\n\nDOCUMENT CONTENT:\n\n${request.documentContent}`;

        const messages: AzureOpenAIMessage[] = [
          {
            role: 'system',
            content: request.systemInstruction || 'You are an expert assessment validator. Analyze the provided document against the requirements and return a structured JSON response.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ];

        const response = await openaiClient.generateContent(messages, {
          temperature: request.generationConfig?.temperature ?? 0.1,
          maxTokens: request.generationConfig?.maxOutputTokens ?? 4096,
          responseFormat: 'json_object'
        });

        return {
          text: response.text,
          provider: 'azure'
        };
      },

      /**
       * Extract document content using Azure Document Intelligence
       */
      async extractDocument(documentContent: Uint8Array): Promise<ExtractedDocument> {
        return await docIntelClient.extractDocument(documentContent);
      },

      /**
       * Generate simple text response (non-validation)
       */
      async generateContent(prompt: string): Promise<string> {
        const messages: AzureOpenAIMessage[] = [
          { role: 'user', content: prompt }
        ];

        const response = await openaiClient.generateContent(messages);
        return response.text;
      }
    };
  } else {
    // Google Gemini provider
    const geminiClient = createDefaultGeminiClient();

    return {
      provider: 'google' as const,

      /**
       * Generate validation response using Google Gemini with File Search
       * Enhanced to support DB-driven prompts with system instruction and output schema
       */
      async generateValidation(request: ValidationRequest): Promise<ValidationResponse> {
        if (!request.fileSearchStoreName) {
          throw new Error('Google provider requires fileSearchStoreName for document grounding');
        }

        // Build enhanced request with system instruction and output schema if provided
        const response = await geminiClient.generateContentWithFileSearchEnhanced(
          request.prompt,
          [request.fileSearchStoreName],
          {
            systemInstruction: request.systemInstruction,
            outputSchema: request.outputSchema,
            generationConfig: {
              temperature: request.generationConfig?.temperature ?? 0.1,
              maxOutputTokens: request.generationConfig?.maxOutputTokens ?? 8192,
              responseMimeType: 'application/json'
            }
          }
        );

        return {
          text: response.text,
          provider: 'google',
          groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
        };
      },

      /**
       * Upload document to Gemini File Search (returns operation for polling)
       */
      async uploadDocument(
        documentContent: Uint8Array,
        fileName: string,
        fileSearchStoreName: string,
        metadata?: Record<string, string | number>
      ) {
        return await geminiClient.uploadToFileSearchStore(
          documentContent,
          fileName,
          fileSearchStoreName,
          fileName,
          metadata
        );
      },

      /**
       * Generate simple text response (non-validation)
       */
      async generateContent(prompt: string): Promise<string> {
        const response = await geminiClient.generateContent(prompt);
        return response.text;
      }
    };
  }
}

/**
 * Get the N8N webhook URL based on environment
 */
export function getN8nWebhookUrl(): string {
  return Deno.env.get('N8N_WEBHOOK_URL') || 'https://n8n-gtoa.onrender.com/webhook/validate-document';
}

/**
 * Log provider configuration for debugging
 */
export function logProviderConfig(): void {
  const config = getAIProviderConfig();

  console.log('╔════════════════════════════════════════════════════════════════════');
  console.log('║ AI PROVIDER CONFIGURATION');
  console.log('╠════════════════════════════════════════════════════════════════════');
  console.log('║ Provider:', config.provider.toUpperCase());
  console.log('║ Orchestration:', config.orchestrationMode.toUpperCase());

  if (config.provider === 'azure') {
    console.log('║ Azure OpenAI Endpoint:', Deno.env.get('AZURE_OPENAI_ENDPOINT') ? '✅ Configured' : '❌ Missing');
    console.log('║ Azure OpenAI Key:', Deno.env.get('AZURE_OPENAI_KEY') ? '✅ Configured' : '❌ Missing');
    console.log('║ Azure OpenAI Deployment:', Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4-1-mini (default)');
    console.log('║ Azure Doc Intel Endpoint:', Deno.env.get('AZURE_DOC_INTEL_ENDPOINT') ? '✅ Configured' : '❌ Missing');
    console.log('║ Azure Doc Intel Key:', Deno.env.get('AZURE_DOC_INTEL_KEY') ? '✅ Configured' : '❌ Missing');
  } else {
    console.log('║ Gemini API Key:', Deno.env.get('GEMINI_API_KEY') ? '✅ Configured' : '❌ Missing');
  }

  if (config.orchestrationMode === 'n8n') {
    console.log('║ N8N Webhook URL:', getN8nWebhookUrl());
  }

  console.log('╚════════════════════════════════════════════════════════════════════');
}
