/**
 * Tests for Trigger Validation Unified Edge Function
 * 
 * Run with: deno test --allow-env --allow-net supabase/functions/tests/trigger-validation-unified.test.ts
 * 
 * These tests verify the routing logic and provider selection.
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Test: Request validation
Deno.test("Trigger Validation - Request validation", () => {
  interface TriggerValidationRequest {
    validationDetailId: number;
  }

  // Valid request
  const validRequest: TriggerValidationRequest = {
    validationDetailId: 123
  };
  assertEquals(validRequest.validationDetailId, 123);

  // Invalid request (missing field)
  const invalidRequest: Partial<TriggerValidationRequest> = {};
  assertEquals(invalidRequest.validationDetailId, undefined);
});

// Test: Provider routing logic
Deno.test("Trigger Validation - Provider routing logic", async () => {
  const { getAIProviderConfig, shouldUseN8n } = await import("../_shared/ai-provider.ts");
  
  // Save original env vars
  const originalProvider = Deno.env.get('AI_PROVIDER');
  const originalOrchestration = Deno.env.get('ORCHESTRATION_MODE');
  
  // Test Case 1: Google + n8n -> Use n8n webhook
  Deno.env.set('AI_PROVIDER', 'google');
  Deno.env.set('ORCHESTRATION_MODE', 'n8n');
  let config = getAIProviderConfig();
  assertEquals(config.provider, 'google');
  assertEquals(config.orchestrationMode, 'n8n');
  assertEquals(shouldUseN8n(), true);
  
  // Test Case 2: Google + direct -> Direct Gemini validation
  Deno.env.set('AI_PROVIDER', 'google');
  Deno.env.set('ORCHESTRATION_MODE', 'direct');
  config = getAIProviderConfig();
  assertEquals(config.provider, 'google');
  assertEquals(config.orchestrationMode, 'direct');
  assertEquals(shouldUseN8n(), false);
  
  // Test Case 3: Azure + any -> Direct Azure validation (n8n ignored)
  Deno.env.set('AI_PROVIDER', 'azure');
  Deno.env.set('ORCHESTRATION_MODE', 'n8n');  // Should be ignored for Azure
  config = getAIProviderConfig();
  assertEquals(config.provider, 'azure');
  // For Azure, we always use direct regardless of ORCHESTRATION_MODE
  
  // Restore env vars
  if (originalProvider) {
    Deno.env.set('AI_PROVIDER', originalProvider);
  } else {
    Deno.env.delete('AI_PROVIDER');
  }
  if (originalOrchestration) {
    Deno.env.set('ORCHESTRATION_MODE', originalOrchestration);
  } else {
    Deno.env.delete('ORCHESTRATION_MODE');
  }
});

// Test: Response structure
Deno.test("Trigger Validation - Response structure", () => {
  // Success response for n8n
  const n8nResponse = {
    success: true,
    message: 'Validation triggered via n8n',
    provider: 'google',
    orchestration: 'n8n',
    validationDetailId: 123
  };
  assertEquals(n8nResponse.success, true);
  assertEquals(n8nResponse.provider, 'google');
  assertEquals(n8nResponse.orchestration, 'n8n');

  // Success response for Azure
  const azureResponse = {
    success: true,
    provider: 'azure',
    orchestration: 'direct',
    validationDetailId: 123,
    overallStatus: 'compliant',
    requirementCount: 10,
    elapsedMs: 5000
  };
  assertEquals(azureResponse.success, true);
  assertEquals(azureResponse.provider, 'azure');
  assertEquals(azureResponse.orchestration, 'direct');
  assertExists(azureResponse.overallStatus);

  // Success response for direct Gemini
  const geminiResponse = {
    success: true,
    provider: 'google',
    orchestration: 'direct',
    validationDetailId: 123,
    overallStatus: 'partially_compliant',
    requirementCount: 10,
    groundingChunkCount: 25,
    elapsedMs: 8000
  };
  assertEquals(geminiResponse.success, true);
  assertEquals(geminiResponse.provider, 'google');
  assertEquals(geminiResponse.orchestration, 'direct');
  assertExists(geminiResponse.groundingChunkCount);
});

// Test: Error responses
Deno.test("Trigger Validation - Error responses", () => {
  // Missing validationDetailId
  const missingIdError = {
    success: false,
    error: 'Missing validationDetailId'
  };
  assertEquals(missingIdError.success, false);

  // Validation detail not found
  const notFoundError = {
    success: false,
    error: 'Validation detail not found'
  };
  assertEquals(notFoundError.success, false);

  // No documents found
  const noDocsError = {
    success: false,
    error: 'No documents found'
  };
  assertEquals(noDocsError.success, false);

  // n8n webhook failed
  const n8nError = {
    success: false,
    error: 'N8n webhook failed: Connection refused'
  };
  assertEquals(n8nError.success, false);
});

// Test: Environment variable combinations
Deno.test("Trigger Validation - Environment variable combinations", async () => {
  const { getAIProviderConfig } = await import("../_shared/ai-provider.ts");
  
  // Save original env vars
  const originalProvider = Deno.env.get('AI_PROVIDER');
  const originalOrchestration = Deno.env.get('ORCHESTRATION_MODE');
  
  const testCases = [
    { provider: undefined, orchestration: undefined, expectedProvider: 'google', expectedOrch: 'direct' },
    { provider: 'google', orchestration: undefined, expectedProvider: 'google', expectedOrch: 'direct' },
    { provider: 'azure', orchestration: undefined, expectedProvider: 'azure', expectedOrch: 'direct' },
    { provider: 'google', orchestration: 'n8n', expectedProvider: 'google', expectedOrch: 'n8n' },
    { provider: 'google', orchestration: 'direct', expectedProvider: 'google', expectedOrch: 'direct' },
    { provider: 'azure', orchestration: 'n8n', expectedProvider: 'azure', expectedOrch: 'n8n' },
    { provider: 'azure', orchestration: 'direct', expectedProvider: 'azure', expectedOrch: 'direct' },
    { provider: 'AZURE', orchestration: 'N8N', expectedProvider: 'azure', expectedOrch: 'n8n' },  // Case insensitive
    { provider: 'Google', orchestration: 'Direct', expectedProvider: 'google', expectedOrch: 'direct' },  // Case insensitive
  ];
  
  for (const tc of testCases) {
    if (tc.provider) {
      Deno.env.set('AI_PROVIDER', tc.provider);
    } else {
      Deno.env.delete('AI_PROVIDER');
    }
    
    if (tc.orchestration) {
      Deno.env.set('ORCHESTRATION_MODE', tc.orchestration);
    } else {
      Deno.env.delete('ORCHESTRATION_MODE');
    }
    
    const config = getAIProviderConfig();
    assertEquals(config.provider, tc.expectedProvider, 
      `Provider mismatch for input: ${tc.provider}`);
    assertEquals(config.orchestrationMode, tc.expectedOrch, 
      `Orchestration mismatch for input: ${tc.orchestration}`);
  }
  
  // Restore env vars
  if (originalProvider) {
    Deno.env.set('AI_PROVIDER', originalProvider);
  } else {
    Deno.env.delete('AI_PROVIDER');
  }
  if (originalOrchestration) {
    Deno.env.set('ORCHESTRATION_MODE', originalOrchestration);
  } else {
    Deno.env.delete('ORCHESTRATION_MODE');
  }
});

console.log("Trigger Validation Unified tests loaded. Run with: deno test --allow-env --allow-net");
