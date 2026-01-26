import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
    step: string;
    status: 'pass' | 'fail' | 'skip';
    message: string;
    durationMs?: number;
    details?: Record<string, unknown>;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const results: TestResult[] = [];
    const startTime = Date.now();
    let documentContent = '';

    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log('║ AZURE END-TO-END INTEGRATION TEST');
    console.log('║ Document Processing + AI Validation Pipeline');
    console.log('╚════════════════════════════════════════════════════════════════════');

    try {
        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Find a test document in Supabase storage
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n[Step 1] Finding test document...');
        const step1Start = Date.now();

        const { data: documents, error: docError } = await supabase
            .from('documents')
            .select('id, file_name, storage_path, document_type')
            .not('storage_path', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (docError || !documents || documents.length === 0) {
            results.push({
                step: '1. Find Document',
                status: 'fail',
                message: 'No documents found in database',
                durationMs: Date.now() - step1Start,
                details: { error: docError?.message }
            });
            return createResponse(false, results, startTime);
        }

        const testDoc = documents[0];
        results.push({
            step: '1. Find Document',
            status: 'pass',
            message: `Found document: ${testDoc.file_name}`,
            durationMs: Date.now() - step1Start,
            details: {
                documentId: testDoc.id,
                storagePath: testDoc.storage_path
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Download document from Supabase storage
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n[Step 2] Downloading document from storage...');
        const step2Start = Date.now();

        const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(testDoc.storage_path);

        if (downloadError || !fileData) {
            results.push({
                step: '2. Download Document',
                status: 'fail',
                message: `Failed to download: ${downloadError?.message}`,
                durationMs: Date.now() - step2Start
            });
            return createResponse(false, results, startTime);
        }

        const fileSizeKB = (fileData.size / 1024).toFixed(2);
        results.push({
            step: '2. Download Document',
            status: 'pass',
            message: `Downloaded ${fileSizeKB} KB`,
            durationMs: Date.now() - step2Start,
            details: { sizeBytes: fileData.size }
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Extract text using Azure Document Intelligence
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n[Step 3] Extracting text with Azure Document Intelligence...');
        const step3Start = Date.now();

        const docIntelEndpoint = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT')!;
        const docIntelKey = Deno.env.get('AZURE_DOC_INTEL_KEY')!;
        const docIntelApiVersion = '2024-11-30';

        // Submit document for analysis
        const fileBytes = new Uint8Array(await fileData.arrayBuffer());
        const analyzeUrl = `${docIntelEndpoint.replace(/\/$/, '')}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${docIntelApiVersion}`;

        const analyzeResponse = await fetch(analyzeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/pdf',
                'Ocp-Apim-Subscription-Key': docIntelKey,
            },
            body: fileBytes,
        });

        if (!analyzeResponse.ok) {
            const errorText = await analyzeResponse.text();
            results.push({
                step: '3. Azure Doc Intelligence - Submit',
                status: 'fail',
                message: `Analysis failed: ${analyzeResponse.status}`,
                durationMs: Date.now() - step3Start,
                details: { error: errorText.substring(0, 300) }
            });
            return createResponse(false, results, startTime);
        }

        // Get operation location for polling
        const operationLocation = analyzeResponse.headers.get('Operation-Location');
        if (!operationLocation) {
            results.push({
                step: '3. Azure Doc Intelligence - Submit',
                status: 'fail',
                message: 'No operation location returned',
                durationMs: Date.now() - step3Start
            });
            return createResponse(false, results, startTime);
        }

        results.push({
            step: '3. Azure Doc Intelligence - Submit',
            status: 'pass',
            message: 'Document submitted for analysis',
            durationMs: Date.now() - step3Start
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Poll for extraction results
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n[Step 4] Waiting for extraction results...');
        const step4Start = Date.now();
        const maxWaitMs = 60000; // 60 seconds max
        const pollIntervalMs = 2000;
        let analysisResult = null;

        while (Date.now() - step4Start < maxWaitMs) {
            const resultResponse = await fetch(operationLocation, {
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': docIntelKey,
                },
            });

            if (!resultResponse.ok) {
                await new Promise(r => setTimeout(r, pollIntervalMs));
                continue;
            }

            const resultData = await resultResponse.json();

            if (resultData.status === 'succeeded') {
                analysisResult = resultData.analyzeResult;
                break;
            } else if (resultData.status === 'failed') {
                results.push({
                    step: '4. Azure Doc Intelligence - Extract',
                    status: 'fail',
                    message: `Analysis failed: ${resultData.error?.message}`,
                    durationMs: Date.now() - step4Start
                });
                return createResponse(false, results, startTime);
            }

            console.log(`   Polling... status: ${resultData.status}`);
            await new Promise(r => setTimeout(r, pollIntervalMs));
        }

        if (!analysisResult) {
            results.push({
                step: '4. Azure Doc Intelligence - Extract',
                status: 'fail',
                message: 'Extraction timed out',
                durationMs: Date.now() - step4Start
            });
            return createResponse(false, results, startTime);
        }

        documentContent = analysisResult.content || '';
        const pageCount = analysisResult.pages?.length || 0;
        const paragraphCount = analysisResult.paragraphs?.length || 0;

        results.push({
            step: '4. Azure Doc Intelligence - Extract',
            status: 'pass',
            message: `Extracted ${documentContent.length} chars from ${pageCount} pages`,
            durationMs: Date.now() - step4Start,
            details: {
                contentLength: documentContent.length,
                pageCount,
                paragraphCount,
                contentPreview: documentContent.substring(0, 200) + '...'
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Run AI validation using Azure OpenAI
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n[Step 5] Running AI validation with Azure OpenAI...');
        const step5Start = Date.now();

        const openaiEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT')!;
        const openaiKey = Deno.env.get('AZURE_OPENAI_KEY')!;
        const deployment = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o-mini';
        const openaiApiVersion = '2024-08-01-preview';

        const validationPrompt = `You are an expert RTO assessment validator. Analyze the following document excerpt and provide a brief assessment.

DOCUMENT CONTENT (first 3000 chars):
${documentContent.substring(0, 3000)}

Provide a JSON response with this structure:
{
  "documentType": "string - what type of assessment document this appears to be",
  "summary": "string - brief summary of the document content",
  "keyTopics": ["array of main topics covered"],
  "qualityIndicators": {
    "hasStructuredContent": boolean,
    "hasClearInstructions": boolean,
    "appearsComplete": boolean
  },
  "overallAssessment": "string - brief quality assessment"
}`;

        const openaiUrl = `${openaiEndpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${openaiApiVersion}`;

        const openaiResponse = await fetch(openaiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': openaiKey,
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are an expert RTO assessment validator. Always respond with valid JSON.' },
                    { role: 'user', content: validationPrompt }
                ],
                temperature: 0.3,
                max_tokens: 1000,
                response_format: { type: 'json_object' }
            }),
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            results.push({
                step: '5. Azure OpenAI - Validate',
                status: 'fail',
                message: `Validation failed: ${openaiResponse.status}`,
                durationMs: Date.now() - step5Start,
                details: { error: errorText.substring(0, 300) }
            });
            return createResponse(false, results, startTime);
        }

        const openaiData = await openaiResponse.json();
        const validationText = openaiData.choices?.[0]?.message?.content || '';

        let validationResult;
        try {
            validationResult = JSON.parse(validationText);
        } catch {
            validationResult = { rawResponse: validationText };
        }

        results.push({
            step: '5. Azure OpenAI - Validate',
            status: 'pass',
            message: `Validation complete - ${validationResult.documentType || 'Document analyzed'}`,
            durationMs: Date.now() - step5Start,
            details: {
                validationResult,
                usage: openaiData.usage
            }
        });

        console.log('\n╔════════════════════════════════════════════════════════════════════');
        console.log('║ END-TO-END TEST COMPLETE - ALL STEPS PASSED');
        console.log('╚════════════════════════════════════════════════════════════════════');

        return createResponse(true, results, startTime);

    } catch (error) {
        results.push({
            step: 'Unexpected Error',
            status: 'fail',
            message: error.message,
            details: { stack: error.stack?.substring(0, 500) }
        });
        return createResponse(false, results, startTime);
    }
});

function createResponse(success: boolean, results: TestResult[], startTime: number) {
    const totalTime = Date.now() - startTime;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;

    return new Response(
        JSON.stringify({
            success,
            timestamp: new Date().toISOString(),
            totalTimeMs: totalTime,
            summary: {
                passed,
                failed,
                total: results.length,
                pipeline: success ? 'COMPLETE' : 'FAILED'
            },
            results
        }, null, 2),
        {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: success ? 200 : 500,
        }
    );
}
