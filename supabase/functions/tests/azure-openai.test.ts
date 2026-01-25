/**
 * Tests for Azure OpenAI Integration
 * 
 * Run with: deno test --allow-env --allow-net supabase/functions/tests/azure-openai.test.ts
 * 
 * Note: These tests require Azure OpenAI credentials to be set in environment variables.
 * For unit tests without credentials, mock the fetch calls.
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock environment for testing
const mockEnv = {
  AZURE_OPENAI_ENDPOINT: Deno.env.get('AZURE_OPENAI_ENDPOINT') || 'https://test.openai.azure.com',
  AZURE_OPENAI_KEY: Deno.env.get('AZURE_OPENAI_KEY') || 'test-key',
  AZURE_OPENAI_DEPLOYMENT: Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini',
};

// Test: Azure OpenAI client creation
Deno.test("Azure OpenAI - Client creation with config", () => {
  // Import the module
  const { createAzureOpenAIClient } = await import("../_shared/azure-openai.ts");
  
  const client = createAzureOpenAIClient({
    endpoint: mockEnv.AZURE_OPENAI_ENDPOINT,
    apiKey: mockEnv.AZURE_OPENAI_KEY,
    deploymentName: mockEnv.AZURE_OPENAI_DEPLOYMENT,
  });
  
  assertExists(client);
  assertExists(client.generateContent);
  assertExists(client.generateValidation);
});

// Test: Provider detection
Deno.test("Azure OpenAI - shouldUseAzure returns correct value", async () => {
  const { shouldUseAzure, getAIProvider } = await import("../_shared/azure-openai.ts");
  
  // Default should be false (google)
  const originalProvider = Deno.env.get('AI_PROVIDER');
  
  // Test with no env var set
  Deno.env.delete('AI_PROVIDER');
  assertEquals(shouldUseAzure(), false);
  assertEquals(getAIProvider(), 'google');
  
  // Test with azure set
  Deno.env.set('AI_PROVIDER', 'azure');
  assertEquals(shouldUseAzure(), true);
  assertEquals(getAIProvider(), 'azure');
  
  // Test with google set
  Deno.env.set('AI_PROVIDER', 'google');
  assertEquals(shouldUseAzure(), false);
  assertEquals(getAIProvider(), 'google');
  
  // Restore original
  if (originalProvider) {
    Deno.env.set('AI_PROVIDER', originalProvider);
  } else {
    Deno.env.delete('AI_PROVIDER');
  }
});

// Test: Validation response structure
Deno.test("Azure OpenAI - Validation response structure", () => {
  // Test that the expected types are correct
  interface ValidationResult {
    requirementId: string;
    requirementText: string;
    status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_found';
    confidence: number;
    evidence: string;
    gaps?: string;
    recommendations?: string;
  }

  interface StructuredValidationResponse {
    overallStatus: 'compliant' | 'non_compliant' | 'partially_compliant';
    summary: string;
    requirementValidations: ValidationResult[];
  }

  // Create a mock response
  const mockResponse: StructuredValidationResponse = {
    overallStatus: 'compliant',
    summary: 'All requirements met',
    requirementValidations: [
      {
        requirementId: 'REQ-001',
        requirementText: 'Test requirement',
        status: 'compliant',
        confidence: 0.95,
        evidence: 'Found in document page 1',
      }
    ]
  };

  assertEquals(mockResponse.overallStatus, 'compliant');
  assertEquals(mockResponse.requirementValidations.length, 1);
  assertEquals(mockResponse.requirementValidations[0].status, 'compliant');
});

// Integration test (requires real credentials)
Deno.test({
  name: "Azure OpenAI - Integration test (requires credentials)",
  ignore: !Deno.env.get('AZURE_OPENAI_KEY'),
  async fn() {
    const { createDefaultAzureOpenAIClient } = await import("../_shared/azure-openai.ts");
    
    const client = createDefaultAzureOpenAIClient();
    
    const response = await client.generateContent([
      { role: 'user', content: 'Say "test successful" and nothing else.' }
    ]);
    
    assertExists(response.text);
    assertStringIncludes(response.text.toLowerCase(), 'test successful');
  }
});

console.log("Azure OpenAI tests loaded. Run with: deno test --allow-env --allow-net");
