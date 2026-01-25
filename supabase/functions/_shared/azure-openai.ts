/**
 * Azure OpenAI Client for Supabase Edge Functions
 * 
 * This module provides Azure OpenAI integration as an alternative to Google Gemini.
 * Use the AI_PROVIDER environment variable to switch between providers.
 * 
 * Environment Variables:
 * - AI_PROVIDER: 'azure' | 'google' (default: 'google')
 * - AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint URL
 * - AZURE_OPENAI_KEY: Azure OpenAI API key
 * - AZURE_OPENAI_DEPLOYMENT: Deployment name (e.g., 'gpt-4o-mini')
 */

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion?: string;
}

export interface AzureOpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AzureOpenAIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface ValidationResult {
  requirementId: string;
  requirementText: string;
  status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_found';
  confidence: number;
  evidence: string;
  gaps?: string;
  recommendations?: string;
}

export interface StructuredValidationResponse {
  overallStatus: 'compliant' | 'non_compliant' | 'partially_compliant';
  summary: string;
  requirementValidations: ValidationResult[];
}

/**
 * Create an Azure OpenAI client
 */
export function createAzureOpenAIClient(config: AzureOpenAIConfig) {
  const { endpoint, apiKey, deploymentName, apiVersion = '2024-08-01-preview' } = config;
  
  // Ensure endpoint doesn't have trailing slash
  const baseUrl = endpoint.replace(/\/$/, '');
  
  return {
    /**
     * Generate a chat completion
     */
    async generateContent(
      messages: AzureOpenAIMessage[],
      options?: {
        temperature?: number;
        maxTokens?: number;
        responseFormat?: 'text' | 'json_object';
      }
    ): Promise<AzureOpenAIResponse> {
      const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
      
      console.log('[Azure OpenAI] Calling API:', {
        deployment: deploymentName,
        messageCount: messages.length,
        temperature: options?.temperature ?? 0.3,
        responseFormat: options?.responseFormat ?? 'text'
      });
      
      const requestBody: any = {
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
      };
      
      // Add JSON response format if requested
      if (options?.responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Azure OpenAI] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      const result: AzureOpenAIResponse = {
        text: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: data.choices?.[0]?.finish_reason,
      };
      
      console.log('[Azure OpenAI] Response received:', {
        textLength: result.text.length,
        usage: result.usage,
        finishReason: result.finishReason
      });
      
      return result;
    },
    
    /**
     * Generate validation response with structured JSON output
     */
    async generateValidation(
      systemPrompt: string,
      userPrompt: string,
      options?: {
        temperature?: number;
        maxTokens?: number;
      }
    ): Promise<StructuredValidationResponse> {
      const messages: AzureOpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      const response = await this.generateContent(messages, {
        ...options,
        responseFormat: 'json_object'
      });
      
      try {
        const parsed = JSON.parse(response.text);
        return parsed as StructuredValidationResponse;
      } catch (parseError) {
        console.error('[Azure OpenAI] Failed to parse JSON response:', parseError);
        console.error('[Azure OpenAI] Raw response:', response.text.substring(0, 500));
        throw new Error('Failed to parse validation response as JSON');
      }
    }
  };
}

/**
 * Create a default Azure OpenAI client from environment variables
 */
export function createDefaultAzureOpenAIClient() {
  const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_OPENAI_KEY');
  const deploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini';
  
  if (!endpoint || !apiKey) {
    throw new Error('Missing Azure OpenAI configuration. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY environment variables.');
  }
  
  return createAzureOpenAIClient({
    endpoint,
    apiKey,
    deploymentName
  });
}

/**
 * Check if Azure OpenAI is configured and should be used
 */
export function shouldUseAzure(): boolean {
  const provider = Deno.env.get('AI_PROVIDER') || 'google';
  return provider.toLowerCase() === 'azure';
}

/**
 * Get the current AI provider name
 */
export function getAIProvider(): 'azure' | 'google' {
  return shouldUseAzure() ? 'azure' : 'google';
}
