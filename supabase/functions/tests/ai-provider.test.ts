/**
 * Tests for AI Provider Abstraction Layer
 * 
 * Run with: deno test --allow-env --allow-net supabase/functions/tests/ai-provider.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Test: Provider configuration detection
Deno.test("AI Provider - getAIProviderConfig returns correct defaults", async () => {
  const { getAIProviderConfig } = await import("../_shared/ai-provider.ts");
  
  // Save original env vars
  const originalProvider = Deno.env.get('AI_PROVIDER');
  const originalOrchestration = Deno.env.get('ORCHESTRATION_MODE');
  
  // Clear env vars
  Deno.env.delete('AI_PROVIDER');
  Deno.env.delete('ORCHESTRATION_MODE');
  
  // Test defaults
  const config = getAIProviderConfig();
  assertEquals(config.provider, 'google');
  assertEquals(config.orchestrationMode, 'direct');
  
  // Restore env vars
  if (originalProvider) Deno.env.set('AI_PROVIDER', originalProvider);
  if (originalOrchestration) Deno.env.set('ORCHESTRATION_MODE', originalOrchestration);
});

// Test: Azure provider configuration
Deno.test("AI Provider - Azure configuration", async () => {
  const { getAIProviderConfig } = await import("../_shared/ai-provider.ts");
  
  // Save original env vars
  const originalProvider = Deno.env.get('AI_PROVIDER');
  const originalOrchestration = Deno.env.get('ORCHESTRATION_MODE');
  
  // Set Azure config
  Deno.env.set('AI_PROVIDER', 'azure');
  Deno.env.set('ORCHESTRATION_MODE', 'direct');
  
  const config = getAIProviderConfig();
  assertEquals(config.provider, 'azure');
  assertEquals(config.orchestrationMode, 'direct');
  
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

// Test: n8n orchestration detection
Deno.test("AI Provider - shouldUseN8n detection", async () => {
  const { shouldUseN8n } = await import("../_shared/ai-provider.ts");
  
  // Save original env var
  const originalOrchestration = Deno.env.get('ORCHESTRATION_MODE');
  
  // Test direct mode
  Deno.env.set('ORCHESTRATION_MODE', 'direct');
  assertEquals(shouldUseN8n(), false);
  
  // Test n8n mode
  Deno.env.set('ORCHESTRATION_MODE', 'n8n');
  assertEquals(shouldUseN8n(), true);
  
  // Restore env var
  if (originalOrchestration) {
    Deno.env.set('ORCHESTRATION_MODE', originalOrchestration);
  } else {
    Deno.env.delete('ORCHESTRATION_MODE');
  }
});

// Test: N8n webhook URL
Deno.test("AI Provider - getN8nWebhookUrl", async () => {
  const { getN8nWebhookUrl } = await import("../_shared/ai-provider.ts");
  
  // Save original env var
  const originalUrl = Deno.env.get('N8N_WEBHOOK_URL');
  
  // Test default URL
  Deno.env.delete('N8N_WEBHOOK_URL');
  const defaultUrl = getN8nWebhookUrl();
  assertEquals(defaultUrl, 'https://n8n-gtoa.onrender.com/webhook/validate-document');
  
  // Test custom URL
  const customUrl = 'https://custom-n8n.example.com/webhook';
  Deno.env.set('N8N_WEBHOOK_URL', customUrl);
  assertEquals(getN8nWebhookUrl(), customUrl);
  
  // Restore env var
  if (originalUrl) {
    Deno.env.set('N8N_WEBHOOK_URL', originalUrl);
  } else {
    Deno.env.delete('N8N_WEBHOOK_URL');
  }
});

// Test: AI client creation for Google
Deno.test({
  name: "AI Provider - createAIClient for Google",
  ignore: !Deno.env.get('GEMINI_API_KEY'),
  async fn() {
    const { createAIClient } = await import("../_shared/ai-provider.ts");
    
    // Save original env var
    const originalProvider = Deno.env.get('AI_PROVIDER');
    
    // Set Google provider
    Deno.env.set('AI_PROVIDER', 'google');
    
    const client = createAIClient();
    assertExists(client);
    assertEquals(client.provider, 'google');
    assertExists(client.generateValidation);
    assertExists(client.generateContent);
    
    // Restore env var
    if (originalProvider) {
      Deno.env.set('AI_PROVIDER', originalProvider);
    } else {
      Deno.env.delete('AI_PROVIDER');
    }
  }
});

// Test: AI client creation for Azure
Deno.test({
  name: "AI Provider - createAIClient for Azure",
  ignore: !Deno.env.get('AZURE_OPENAI_KEY'),
  async fn() {
    const { createAIClient } = await import("../_shared/ai-provider.ts");
    
    // Save original env var
    const originalProvider = Deno.env.get('AI_PROVIDER');
    
    // Set Azure provider
    Deno.env.set('AI_PROVIDER', 'azure');
    
    const client = createAIClient();
    assertExists(client);
    assertEquals(client.provider, 'azure');
    assertExists(client.generateValidation);
    assertExists(client.generateContent);
    assertExists(client.extractDocument);
    
    // Restore env var
    if (originalProvider) {
      Deno.env.set('AI_PROVIDER', originalProvider);
    } else {
      Deno.env.delete('AI_PROVIDER');
    }
  }
});

console.log("AI Provider tests loaded. Run with: deno test --allow-env --allow-net");
