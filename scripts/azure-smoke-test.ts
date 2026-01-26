#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Azure Services Connectivity & Smoke Test
 * 
 * Tests connectivity to:
 * 1. Azure OpenAI (GPT-4o-mini)
 * 2. Azure Document Intelligence
 * 
 * Run locally with:
 *   deno run --allow-net --allow-env scripts/azure-smoke-test.ts
 * 
 * Or set environment variables first:
 *   $env:AZURE_OPENAI_ENDPOINT = "https://nytroai-openai-dev.openai.azure.com"
 *   $env:AZURE_OPENAI_KEY = "your-key"
 *   $env:AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini"
 *   $env:AZURE_DOC_INTEL_ENDPOINT = "https://nytroai-docintel-dev.cognitiveservices.azure.com"
 *   $env:AZURE_DOC_INTEL_KEY = "your-key"
 */

interface TestResult {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    message: string;
    latencyMs?: number;
    details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function printHeader(title: string): void {
    console.log('\n╔════════════════════════════════════════════════════════════════════');
    console.log(`║ ${title}`);
    console.log('╚════════════════════════════════════════════════════════════════════');
}

function printResult(result: TestResult): void {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
    console.log(`\n${icon} ${result.name}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Message: ${result.message}`);
    if (result.latencyMs) {
        console.log(`   Latency: ${result.latencyMs}ms`);
    }
    if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
}

async function testAzureOpenAI(): Promise<TestResult> {
    const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const apiKey = Deno.env.get('AZURE_OPENAI_KEY');
    const deploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini';
    const apiVersion = '2024-08-01-preview';

    if (!endpoint || !apiKey) {
        return {
            name: 'Azure OpenAI Connectivity',
            status: 'skip',
            message: 'Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_KEY environment variables'
        };
    }

    const startTime = Date.now();

    try {
        const baseUrl = endpoint.replace(/\/$/, '');
        const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

        console.log(`   → Testing endpoint: ${baseUrl}`);
        console.log(`   → Deployment: ${deploymentName}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a helpful assistant. Respond with exactly "SMOKE_TEST_OK" and nothing else.' },
                    { role: 'user', content: 'Please respond with the test confirmation.' }
                ],
                temperature: 0,
                max_tokens: 20,
            }),
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                name: 'Azure OpenAI Connectivity',
                status: 'fail',
                message: `API returned ${response.status}: ${response.statusText}`,
                latencyMs,
                details: { error: errorText.substring(0, 500) }
            };
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '';

        return {
            name: 'Azure OpenAI Connectivity',
            status: 'pass',
            message: `GPT-4o-mini responded successfully`,
            latencyMs,
            details: {
                model: data.model,
                responsePreview: responseText.substring(0, 100),
                usage: data.usage,
                finishReason: data.choices?.[0]?.finish_reason
            }
        };
    } catch (error) {
        return {
            name: 'Azure OpenAI Connectivity',
            status: 'fail',
            message: `Connection error: ${error.message}`,
            latencyMs: Date.now() - startTime
        };
    }
}

async function testAzureDocumentIntelligence(): Promise<TestResult> {
    const endpoint = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT');
    const apiKey = Deno.env.get('AZURE_DOC_INTEL_KEY');
    const apiVersion = '2024-02-29-preview';

    if (!endpoint || !apiKey) {
        return {
            name: 'Azure Document Intelligence Connectivity',
            status: 'skip',
            message: 'Missing AZURE_DOC_INTEL_ENDPOINT or AZURE_DOC_INTEL_KEY environment variables'
        };
    }

    const startTime = Date.now();

    try {
        const baseUrl = endpoint.replace(/\/$/, '');

        // Test the document models endpoint to verify connectivity
        const url = `${baseUrl}/documentintelligence/documentModels?api-version=${apiVersion}`;

        console.log(`   → Testing endpoint: ${baseUrl}`);
        console.log(`   → Listing available models...`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
            },
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                name: 'Azure Document Intelligence Connectivity',
                status: 'fail',
                message: `API returned ${response.status}: ${response.statusText}`,
                latencyMs,
                details: { error: errorText.substring(0, 500) }
            };
        }

        const data = await response.json();
        const modelCount = data.value?.length || 0;
        const prebuiltModels = data.value?.filter((m: any) => m.modelId.startsWith('prebuilt-')) || [];

        return {
            name: 'Azure Document Intelligence Connectivity',
            status: 'pass',
            message: `Service accessible - ${modelCount} models available`,
            latencyMs,
            details: {
                totalModels: modelCount,
                prebuiltModels: prebuiltModels.map((m: any) => m.modelId),
                hasPrebuiltLayout: prebuiltModels.some((m: any) => m.modelId === 'prebuilt-layout')
            }
        };
    } catch (error) {
        return {
            name: 'Azure Document Intelligence Connectivity',
            status: 'fail',
            message: `Connection error: ${error.message}`,
            latencyMs: Date.now() - startTime
        };
    }
}

async function testAzureOpenAIJSONMode(): Promise<TestResult> {
    const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const apiKey = Deno.env.get('AZURE_OPENAI_KEY');
    const deploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini';
    const apiVersion = '2024-08-01-preview';

    if (!endpoint || !apiKey) {
        return {
            name: 'Azure OpenAI JSON Mode',
            status: 'skip',
            message: 'Missing credentials (requires OpenAI test to pass first)'
        };
    }

    const startTime = Date.now();

    try {
        const baseUrl = endpoint.replace(/\/$/, '');
        const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

        console.log(`   → Testing JSON structured output...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a validation assistant. Always respond with valid JSON matching this schema: { "status": "pass" | "fail", "message": string }'
                    },
                    {
                        role: 'user',
                        content: 'Return a validation result with status "pass" and message "JSON mode working correctly".'
                    }
                ],
                temperature: 0,
                max_tokens: 100,
                response_format: { type: 'json_object' }
            }),
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                name: 'Azure OpenAI JSON Mode',
                status: 'fail',
                message: `API returned ${response.status}: ${response.statusText}`,
                latencyMs,
                details: { error: errorText.substring(0, 500) }
            };
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '';

        // Try to parse the JSON response
        let parsedJson;
        try {
            parsedJson = JSON.parse(responseText);
        } catch {
            return {
                name: 'Azure OpenAI JSON Mode',
                status: 'fail',
                message: 'Response was not valid JSON',
                latencyMs,
                details: { rawResponse: responseText.substring(0, 200) }
            };
        }

        return {
            name: 'Azure OpenAI JSON Mode',
            status: 'pass',
            message: `JSON structured output working correctly`,
            latencyMs,
            details: {
                parsedResponse: parsedJson
            }
        };
    } catch (error) {
        return {
            name: 'Azure OpenAI JSON Mode',
            status: 'fail',
            message: `Connection error: ${error.message}`,
            latencyMs: Date.now() - startTime
        };
    }
}

async function checkEnvironmentConfig(): Promise<TestResult> {
    const checks: Record<string, boolean> = {
        AZURE_OPENAI_ENDPOINT: !!Deno.env.get('AZURE_OPENAI_ENDPOINT'),
        AZURE_OPENAI_KEY: !!Deno.env.get('AZURE_OPENAI_KEY'),
        AZURE_OPENAI_DEPLOYMENT: !!Deno.env.get('AZURE_OPENAI_DEPLOYMENT'),
        AZURE_DOC_INTEL_ENDPOINT: !!Deno.env.get('AZURE_DOC_INTEL_ENDPOINT'),
        AZURE_DOC_INTEL_KEY: !!Deno.env.get('AZURE_DOC_INTEL_KEY'),
    };

    const configured = Object.entries(checks).filter(([_, v]) => v).map(([k]) => k);
    const missing = Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k);

    const allConfigured = missing.length === 0;

    return {
        name: 'Environment Configuration',
        status: allConfigured ? 'pass' : (configured.length > 0 ? 'pass' : 'fail'),
        message: allConfigured
            ? 'All Azure environment variables configured'
            : `${configured.length}/5 variables configured`,
        details: {
            configured,
            missing: missing.length > 0 ? missing : undefined
        }
    };
}

// Main execution
async function main() {
    printHeader('AZURE SERVICES SMOKE TEST');
    console.log(`\nTimestamp: ${new Date().toISOString()}`);
    console.log('Testing Azure OpenAI and Document Intelligence connectivity...\n');

    // Run tests
    const configResult = await checkEnvironmentConfig();
    results.push(configResult);
    printResult(configResult);

    console.log('\n--- Azure OpenAI Tests ---');

    const openaiResult = await testAzureOpenAI();
    results.push(openaiResult);
    printResult(openaiResult);

    if (openaiResult.status === 'pass') {
        const jsonModeResult = await testAzureOpenAIJSONMode();
        results.push(jsonModeResult);
        printResult(jsonModeResult);
    }

    console.log('\n--- Azure Document Intelligence Tests ---');

    const docIntelResult = await testAzureDocumentIntelligence();
    results.push(docIntelResult);
    printResult(docIntelResult);

    // Summary
    printHeader('TEST SUMMARY');

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    console.log(`\n  ✅ Passed:  ${passed}`);
    console.log(`  ❌ Failed:  ${failed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);

    if (failed > 0) {
        console.log('\n⚠️  Some tests failed. Check the details above for troubleshooting.');
        Deno.exit(1);
    } else if (passed === 0 && skipped > 0) {
        console.log('\n⚠️  All tests skipped. Please configure environment variables.');
        console.log('\nRequired environment variables:');
        console.log('  - AZURE_OPENAI_ENDPOINT');
        console.log('  - AZURE_OPENAI_KEY');
        console.log('  - AZURE_OPENAI_DEPLOYMENT (default: gpt-4o-mini)');
        console.log('  - AZURE_DOC_INTEL_ENDPOINT');
        console.log('  - AZURE_DOC_INTEL_KEY');
        Deno.exit(1);
    } else {
        console.log('\n🎉 All tests passed! Azure services are ready.');
    }
}

main().catch(console.error);
