import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    message: string;
    latencyMs?: number;
    details?: Record<string, unknown>;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const results: TestResult[] = [];
    const startTime = Date.now();

    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log('║ AZURE SERVICES CONNECTIVITY TEST');
    console.log('╚════════════════════════════════════════════════════════════════════');

    // Check environment configuration
    const envCheck: TestResult = {
        name: 'Environment Configuration',
        status: 'pass',
        message: '',
        details: {}
    };

    const checks = {
        AZURE_OPENAI_ENDPOINT: !!Deno.env.get('AZURE_OPENAI_ENDPOINT'),
        AZURE_OPENAI_KEY: !!Deno.env.get('AZURE_OPENAI_KEY'),
        AZURE_OPENAI_DEPLOYMENT: !!Deno.env.get('AZURE_OPENAI_DEPLOYMENT'),
        AZURE_DOC_INTEL_ENDPOINT: !!Deno.env.get('AZURE_DOC_INTEL_ENDPOINT'),
        AZURE_DOC_INTEL_KEY: !!Deno.env.get('AZURE_DOC_INTEL_KEY'),
    };

    const configured = Object.entries(checks).filter(([_, v]) => v).map(([k]) => k);
    const missing = Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k);

    envCheck.details = { configured, missing: missing.length > 0 ? missing : undefined };
    envCheck.message = `${configured.length}/5 Azure variables configured`;
    envCheck.status = configured.length >= 2 ? 'pass' : 'fail';
    results.push(envCheck);

    console.log(`[Config] ${envCheck.message}`);
    if (missing.length > 0) {
        console.log(`[Config] Missing: ${missing.join(', ')}`);
    }

    // Test Azure OpenAI
    const openaiResult = await testAzureOpenAI();
    results.push(openaiResult);
    console.log(`[OpenAI] ${openaiResult.status.toUpperCase()}: ${openaiResult.message}`);

    // Test Azure OpenAI JSON mode if basic test passed
    if (openaiResult.status === 'pass') {
        const jsonResult = await testAzureOpenAIJSON();
        results.push(jsonResult);
        console.log(`[OpenAI JSON] ${jsonResult.status.toUpperCase()}: ${jsonResult.message}`);
    }

    // Test Azure Document Intelligence
    const docIntelResult = await testAzureDocIntel();
    results.push(docIntelResult);
    console.log(`[Doc Intel] ${docIntelResult.status.toUpperCase()}: ${docIntelResult.message}`);

    const totalTime = Date.now() - startTime;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log(`║ RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log(`║ Total time: ${totalTime}ms`);
    console.log('╚════════════════════════════════════════════════════════════════════');

    return new Response(
        JSON.stringify({
            success: failed === 0,
            timestamp: new Date().toISOString(),
            totalTimeMs: totalTime,
            summary: { passed, failed, skipped },
            results
        }, null, 2),
        {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: failed > 0 ? 500 : 200,
        }
    );
});

async function testAzureOpenAI(): Promise<TestResult> {
    const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const apiKey = Deno.env.get('AZURE_OPENAI_KEY');
    const deploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini';
    const apiVersion = '2024-08-01-preview';

    if (!endpoint || !apiKey) {
        return {
            name: 'Azure OpenAI',
            status: 'skip',
            message: 'Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_KEY'
        };
    }

    const startTime = Date.now();

    try {
        const baseUrl = endpoint.replace(/\/$/, '');
        const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'Respond with exactly: SMOKE_TEST_OK' },
                    { role: 'user', content: 'Test' }
                ],
                temperature: 0,
                max_tokens: 20,
            }),
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                name: 'Azure OpenAI',
                status: 'fail',
                message: `HTTP ${response.status}: ${response.statusText}`,
                latencyMs,
                details: { error: errorText.substring(0, 300), endpoint: baseUrl, deployment: deploymentName }
            };
        }

        const data = await response.json();

        return {
            name: 'Azure OpenAI',
            status: 'pass',
            message: `GPT-4o-mini responded (${latencyMs}ms)`,
            latencyMs,
            details: {
                model: data.model,
                response: data.choices?.[0]?.message?.content?.substring(0, 50),
                usage: data.usage
            }
        };
    } catch (error) {
        return {
            name: 'Azure OpenAI',
            status: 'fail',
            message: `Connection error: ${error.message}`,
            latencyMs: Date.now() - startTime
        };
    }
}

async function testAzureOpenAIJSON(): Promise<TestResult> {
    const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const apiKey = Deno.env.get('AZURE_OPENAI_KEY');
    const deploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini';
    const apiVersion = '2024-08-01-preview';

    const startTime = Date.now();

    try {
        const baseUrl = endpoint!.replace(/\/$/, '');
        const url = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey!,
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'Return JSON: {"status":"ok","test":true}' },
                    { role: 'user', content: 'Return the test JSON' }
                ],
                temperature: 0,
                max_tokens: 50,
                response_format: { type: 'json_object' }
            }),
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            return {
                name: 'Azure OpenAI JSON Mode',
                status: 'fail',
                message: `HTTP ${response.status}`,
                latencyMs
            };
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '';

        // Verify it's valid JSON
        const parsed = JSON.parse(responseText);

        return {
            name: 'Azure OpenAI JSON Mode',
            status: 'pass',
            message: `Structured output working (${latencyMs}ms)`,
            latencyMs,
            details: { parsedResponse: parsed }
        };
    } catch (error) {
        return {
            name: 'Azure OpenAI JSON Mode',
            status: 'fail',
            message: `Error: ${error.message}`,
            latencyMs: Date.now() - startTime
        };
    }
}

async function testAzureDocIntel(): Promise<TestResult> {
    const endpoint = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT');
    const apiKey = Deno.env.get('AZURE_DOC_INTEL_KEY');
    const apiVersion = '2024-11-30';

    if (!endpoint || !apiKey) {
        return {
            name: 'Azure Document Intelligence',
            status: 'skip',
            message: 'Missing AZURE_DOC_INTEL_ENDPOINT or AZURE_DOC_INTEL_KEY'
        };
    }

    const startTime = Date.now();

    try {
        const baseUrl = endpoint.replace(/\/$/, '');
        const url = `${baseUrl}/documentintelligence/documentModels?api-version=${apiVersion}`;

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
                name: 'Azure Document Intelligence',
                status: 'fail',
                message: `HTTP ${response.status}: ${response.statusText}`,
                latencyMs,
                details: { error: errorText.substring(0, 300), endpoint: baseUrl }
            };
        }

        const data = await response.json();
        const modelCount = data.value?.length || 0;
        const hasLayout = data.value?.some((m: any) => m.modelId === 'prebuilt-layout');

        return {
            name: 'Azure Document Intelligence',
            status: 'pass',
            message: `${modelCount} models available (${latencyMs}ms)`,
            latencyMs,
            details: {
                modelCount,
                hasPrebuiltLayout: hasLayout,
                models: data.value?.slice(0, 5).map((m: any) => m.modelId)
            }
        };
    } catch (error) {
        return {
            name: 'Azure Document Intelligence',
            status: 'fail',
            message: `Connection error: ${error.message}`,
            latencyMs: Date.now() - startTime
        };
    }
}
