/**
 * Shared Validation Module - Core validation logic used by both validate-assessment and revalidate-proxy
 * 
 * This module provides:
 * 1. Document extraction using Azure Document Intelligence
 * 2. Requirement validation using Azure OpenAI
 * 3. Smart question generation (Phase 2) for non-Met requirements
 */

import { createDefaultAzureDocIntelClient } from './azure-document-intelligence.ts';
import { createAIClient } from './ai-provider.ts';

const FUNCTION_NAME = 'validate-requirement';

// Type definitions
export interface RequirementInput {
    id?: number;
    requirement_number: string;
    requirement_text: string;
    requirement_type: string;
    element_text?: string;
}

export interface ValidationContext {
    supabase: any;
    validationDetailId: number;
    unitCode: string;
    unitTitle: string;
    documentType: string;
    documents: any[];
    rtoCode?: string;
}

export interface ValidationResult {
    status: string;
    reasoning: string;
    mappedContent: string;
    citations: string;
    smartQuestions: string;
    benchmarkAnswer: string;
    recommendations: string;
    success: boolean;
    error?: string;
}

/**
 * Process documents with Azure Document Intelligence and store elements
 * This is called during validation if elements don't exist yet
 */
export async function extractDocuments(
    supabase: any,
    documents: any[],
    validationDetailId: number
): Promise<any[]> {
    console.log(`[${FUNCTION_NAME}] Processing ${documents.length} documents with Azure Document Intelligence...`);

    const docIntelClient = createDefaultAzureDocIntelClient();
    const allElements: any[] = [];

    for (const doc of documents) {
        const docUrl = `s3://smartrtobucket/${doc.storage_path}`;

        console.log(`[${FUNCTION_NAME}] Processing document: ${doc.file_name}`);

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(doc.storage_path);

        if (downloadError || !fileData) {
            console.error(`[${FUNCTION_NAME}] Failed to download ${doc.file_name}:`, downloadError);
            continue;
        }

        try {
            const fileBytes = new Uint8Array(await fileData.arrayBuffer());
            const extracted = await docIntelClient.extractDocument(fileBytes);

            // Create elements from extracted content
            const chunks = extracted.paragraphs?.map((p: any) => ({
                id: crypto.randomUUID(),
                text: p.content,
                page_number: p.pageNumber || 1,
                filename: doc.file_name,
                url: docUrl,
                type: p.role || 'paragraph',
                date_processed: new Date().toISOString()
            })) || [{
                id: crypto.randomUUID(),
                text: extracted.content,
                page_number: 1,
                filename: doc.file_name,
                url: docUrl,
                type: 'document',
                date_processed: new Date().toISOString()
            }];

            allElements.push(...chunks);

            // Store elements in database
            const { error: insertError } = await supabase
                .from('elements')
                .insert(chunks);

            if (insertError) {
                console.error(`[${FUNCTION_NAME}] Failed to store elements for ${doc.file_name}:`, insertError.message);
            } else {
                console.log(`[${FUNCTION_NAME}] Stored ${chunks.length} elements for ${doc.file_name}`);
            }

        } catch (extractError) {
            console.error(`[${FUNCTION_NAME}] Extraction failed for ${doc.file_name}:`, extractError);
            continue;
        }
    }

    // Update validation_detail to mark documents as extracted
    if (allElements.length > 0) {
        await supabase
            .from('validation_detail')
            .update({
                docExtracted: true,
                extractStatus: 'Completed',
                last_updated_at: new Date().toISOString()
            })
            .eq('id', validationDetailId);
    }

    return allElements;
}

/**
 * Get document content from elements table, extracting if needed
 */
export async function getDocumentContent(
    supabase: any,
    documents: any[],
    validationDetailId: number,
    requirementNumber?: string,
    requirementText?: string
): Promise<string> {
    const docUrls = documents.map((doc: any) => `s3://smartrtobucket/${doc.storage_path}`);

    // Check if elements exist for these documents
    const { data: existingElements } = await supabase
        .from('elements')
        .select('id, text, url, page_number')
        .in('url', docUrls)
        .limit(1);

    if (!existingElements || existingElements.length === 0) {
        // No elements found - need to process documents first
        console.log(`[${FUNCTION_NAME}] No elements found for documents. Extracting now...`);
        await extractDocuments(supabase, documents, validationDetailId);
    }

    // Smart Element Retrieval - search for requirement-specific content
    let matchedElements: any[] = [];

    if (requirementNumber) {
        const reqNum = requirementNumber.trim();
        console.log(`[${FUNCTION_NAME}] Searching for: "${reqNum}"`);

        // Try exact requirement number search first
        const { data: exactMatches } = await supabase
            .from('elements')
            .select('id, text, url, page_number')
            .in('url', docUrls)
            .ilike('text', `%${reqNum}%`)
            .limit(50);

        matchedElements = exactMatches || [];

        // If no matches, try keywords from requirement text
        if (matchedElements.length === 0 && requirementText) {
            const keywords = requirementText.split(' ').filter((w: string) => w.length > 6).slice(0, 2);
            if (keywords.length > 0) {
                console.log(`[${FUNCTION_NAME}] No exact match, trying keywords: ${keywords.join(', ')}`);
                const { data: keywordMatches } = await supabase
                    .from('elements')
                    .select('id, text, url, page_number')
                    .in('url', docUrls)
                    .ilike('text', `%${keywords[0]}%`)
                    .limit(50);
                matchedElements = keywordMatches || [];
            }
        }
    }

    // Build content string from matched elements
    let finalContent = '';
    if (matchedElements.length > 0) {
        // Fetch all elements from the pages where we found matches
        const pageNumbers = [...new Set(matchedElements.map((e: any) => e.page_number))];
        console.log(`[${FUNCTION_NAME}] Found matches on pages: ${pageNumbers.join(', ')}. Fetching context...`);

        const { data: contextualElements } = await supabase
            .from('elements')
            .select('text, url, page_number')
            .in('url', docUrls)
            .in('page_number', pageNumbers.slice(0, 6)) // Limit to first 6 matching pages
            .order('id', { ascending: true })
            .limit(120);

        const docGroups: Record<string, string[]> = {};
        (contextualElements || matchedElements).forEach((e: any) => {
            if (!docGroups[e.url]) docGroups[e.url] = [];
            docGroups[e.url].push(e.text);
        });

        for (const [url, texts] of Object.entries(docGroups)) {
            const docName = url.split('/').pop() || url;
            finalContent += `\n\n=== Document: ${docName} ===\n${texts.join('\n\n')}`;
        }
    } else {
        // No specific matches - use all elements (limited)
        console.log(`[${FUNCTION_NAME}] No specific matches found, using all available content`);
        const { data: allElements } = await supabase
            .from('elements')
            .select('text, url, page_number')
            .in('url', docUrls)
            .order('page_number', { ascending: true })
            .limit(100);

        if (allElements) {
            const docGroups: Record<string, string[]> = {};
            allElements.forEach((e: any) => {
                if (!docGroups[e.url]) docGroups[e.url] = [];
                docGroups[e.url].push(e.text);
            });

            for (const [url, texts] of Object.entries(docGroups)) {
                const docName = url.split('/').pop() || url;
                finalContent += `\n\n=== Document: ${docName} ===\n${texts.join('\n\n')}`;
            }
        }
    }

    if (!finalContent) {
        console.warn(`[${FUNCTION_NAME}] No document content available for validation`);
        finalContent = 'No document content available.';
    }

    return finalContent;
}

/**
 * Validate a single requirement against document content
 */
export async function validateRequirement(
    context: ValidationContext,
    requirement: RequirementInput,
    documentContent: string
): Promise<ValidationResult> {
    const { supabase, unitCode, unitTitle, documentType } = context;
    const aiClient = createAIClient();

    // Map requirement_type shorthands to database prompt types
    let requirementType = requirement.requirement_type;
    const typeMap: Record<string, string> = {
        'ke': 'knowledge_evidence',
        'pe': 'performance_evidence',
        'fs': 'foundation_skills',
        'epc': 'elements_performance_criteria',
        'ac': 'assessment_conditions',
        'ai': 'assessment_instructions',
        'learner': 'knowledge_evidence'
    };

    if (typeMap[requirementType]) {
        requirementType = typeMap[requirementType];
    }

    console.log(`[${FUNCTION_NAME}] Validating ${requirement.requirement_number} (${requirementType})`);

    // Fetch prompt from database
    let promptTemplate: any = null;

    // Try specific prompt first
    const { data: specificPrompt } = await supabase
        .from('prompts')
        .select('*')
        .eq('prompt_type', 'validation')
        .eq('requirement_type', requirementType)
        .eq('document_type', documentType)
        .eq('is_active', true)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

    if (specificPrompt) {
        promptTemplate = specificPrompt;
        console.log(`[${FUNCTION_NAME}] Using specific prompt: ${specificPrompt.name}`);
    } else {
        // Try without document type
        const { data: typePrompt } = await supabase
            .from('prompts')
            .select('*')
            .eq('prompt_type', 'validation')
            .eq('requirement_type', requirementType)
            .eq('is_active', true)
            .eq('is_default', true)
            .limit(1)
            .maybeSingle();

        if (typePrompt) {
            promptTemplate = typePrompt;
            console.log(`[${FUNCTION_NAME}] Using type prompt: ${typePrompt.name}`);
        } else {
            // Fallback to general revalidation prompt
            const { data: generalPrompt } = await supabase
                .from('prompts')
                .select('*')
                .eq('prompt_type', 'validation')
                .is('requirement_type', null)
                .eq('is_active', true)
                .eq('is_default', true)
                .limit(1)
                .maybeSingle();

            promptTemplate = generalPrompt;
        }
    }

    // Build prompt text
    let promptText = promptTemplate?.prompt_text ||
        `Validate the following requirement against the provided documents.
    Requirement: {{requirement_number}} - {{requirement_text}}`;

    promptText = promptText
        .replace(/{{requirement_number}}/g, requirement.requirement_number || '')
        .replace(/{{requirement_text}}/g, requirement.requirement_text || '')
        .replace(/{{requirement_type}}/g, requirementType)
        .replace(/{{unit_code}}/g, unitCode)
        .replace(/{{unit_title}}/g, unitTitle)
        .replace(/{{document_type}}/g, documentType);

    const systemInstruction = promptTemplate?.system_instruction ||
        'You are an expert RTO validator. Return a JSON response with: status, reasoning, mapped_content, citations (array), recommendations, smart_task, and benchmark_answer.';

    // Add JSON format instruction
    const isKE = requirementType === 'knowledge_evidence';
    const isPE = requirementType === 'performance_evidence' || requirementType === 'elements_performance_criteria';

    let outputFormatInstruction = '';
    if (isPE) {
        outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation (max 300 words)",
  "mapped_content": "Specific tasks/observations from the documents with page numbers",
  "citations": ["Document name, Section/Task name, Page X"],
  "smart_task": "If status is 'Met', use 'N/A'. Otherwise, ONE practical workplace task",
  "benchmark_answer": "If status is 'Met', use 'N/A'. Otherwise, expected observable behavior",
  "unmapped_content": "What is missing. Use 'N/A' if fully met"
}

ALL fields are required. Return ONLY the JSON object, no other text.`;
    } else if (isKE) {
        outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation (max 300 words)",
  "mapped_content": "Specific questions/content from the documents with page numbers",
  "citations": ["Document name, Question/Section, Page X"],
  "smart_question": "If status is 'Met', use 'N/A'. Otherwise, ONE clear question that tests this knowledge",
  "benchmark_answer": "If status is 'Met', use 'N/A'. Otherwise, the expected correct answer",
  "unmapped_content": "What knowledge areas are missing. Use 'N/A' if fully met"
}

ALL fields are required. Return ONLY the JSON object, no other text.`;
    } else {
        outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation (max 300 words)",
  "mapped_content": "Specific content from the documents with page numbers",
  "citations": ["Document name, Section, Page X"],
  "smart_task": "If status is 'Met', use 'N/A'. Otherwise, ONE task/question",
  "benchmark_answer": "If status is 'Met', use 'N/A'. Otherwise, expected answer/behavior",
  "unmapped_content": "What is missing. Use 'N/A' if fully met"
}

ALL fields are required. Return ONLY the JSON object, no other text.`;
    }

    promptText += outputFormatInstruction;

    // Call AI
    try {
        console.log(`[${FUNCTION_NAME}] Calling Azure for ${requirement.requirement_number}`);
        const aiResponse = await aiClient.generateValidation({
            prompt: promptText,
            documentContent,
            systemInstruction,
            outputSchema: promptTemplate?.output_schema,
            generationConfig: promptTemplate?.generation_config
        });

        // Parse response
        let parsedResult: any;
        try {
            parsedResult = JSON.parse(aiResponse.text);
        } catch (e) {
            console.error(`[${FUNCTION_NAME}] JSON Parse Failed:`, aiResponse.text.substring(0, 200));
            return {
                status: 'Not Met',
                reasoning: 'AI returned invalid response format',
                mappedContent: '',
                citations: '[]',
                smartQuestions: '',
                benchmarkAnswer: '',
                recommendations: '',
                success: false,
                error: 'Invalid AI response'
            };
        }

        // Normalize keys
        const normalizedResult: any = {};
        for (const key in parsedResult) {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            normalizedResult[normalizedKey] = parsedResult[key];
        }

        // Extract fields
        const status = normalizedResult.status || normalizedResult.validation_status || 'Not Met';
        const reasoning = normalizedResult.reasoning || normalizedResult.justification || '';
        let mappedContent = normalizedResult.mapped_content || normalizedResult.evidence_found || '';
        let citations = normalizedResult.citations || normalizedResult.doc_references || [];
        const recommendations = normalizedResult.unmapped_content || normalizedResult.recommendations || normalizedResult.gaps || '';

        // Handle citations formats
        if (Array.isArray(mappedContent) && (!citations || (Array.isArray(citations) && citations.length === 0))) {
            citations = mappedContent;
            mappedContent = '';
        }

        // Extract smart questions and benchmark
        let smartQuestions = '';
        let benchmarkAnswer = '';

        const smartTaskField = normalizedResult.practical_workplace_task ||
            normalizedResult.practical_task ||
            normalizedResult.smart_task ||
            normalizedResult.smart_question ||
            normalizedResult.suggested_question ||
            normalizedResult.tasks;

        if (smartTaskField) {
            if (typeof smartTaskField === 'object' && !Array.isArray(smartTaskField)) {
                smartQuestions = smartTaskField.task_text || smartTaskField.text || smartTaskField.question || '';
                benchmarkAnswer = smartTaskField.benchmark_answer || smartTaskField.answer || '';
            } else if (Array.isArray(smartTaskField)) {
                smartQuestions = smartTaskField.map((t: any) => typeof t === 'string' ? t : (t.task_text || t.text || JSON.stringify(t))).join('\n');
            } else {
                smartQuestions = String(smartTaskField);
            }
        }

        const benchmarkField = normalizedResult.benchmark_answer || normalizedResult.model_answer || normalizedResult.expected_behavior;
        if (benchmarkField && !benchmarkAnswer) {
            benchmarkAnswer = typeof benchmarkField === 'object' ? JSON.stringify(benchmarkField) : String(benchmarkField);
        }

        // Handle mapped_content as object
        if (typeof mappedContent === 'object' && !Array.isArray(mappedContent)) {
            mappedContent = mappedContent.text || mappedContent.content || JSON.stringify(mappedContent);
        }

        // Phase 2: Generate smart questions for any status that's not "Met"
        // Phase 1 validation prompts don't generate questions, so we always want Phase 2 to run
        const normalizedStatus = status.toLowerCase().replace(/[\s_-]/g, '');

        // FORCE N/A for Met requirements - AI may still generate but we override
        if (normalizedStatus === 'met') {
            smartQuestions = 'N/A';
            benchmarkAnswer = 'N/A';
            console.log(`[${FUNCTION_NAME}] Status is Met - forcing smart_questions and benchmark_answer to N/A`);
        }

        const shouldRunPhase2 = normalizedStatus !== 'met';

        if (shouldRunPhase2) {
            console.log(`[${FUNCTION_NAME}] ===== PHASE 2 TRIGGERED =====`);
            console.log(`[${FUNCTION_NAME}] Requirement: ${requirement.requirement_number}`);
            console.log(`[${FUNCTION_NAME}] Status: ${normalizedStatus}`);
            console.log(`[${FUNCTION_NAME}] RequirementType: ${requirementType}`);
            console.log(`[${FUNCTION_NAME}] Phase 1 smart_questions: "${smartQuestions}" (will be replaced by Phase 2)`);

            // Fetch Phase 2 generation prompt
            const { data: generationPrompt, error: promptError } = await supabase
                .from('prompts')
                .select('*')
                .eq('prompt_type', 'generation')
                .eq('requirement_type', requirementType)
                .eq('document_type', documentType)
                .eq('is_active', true)
                .eq('is_default', true)
                .limit(1)
                .maybeSingle();

            if (promptError) {
                console.error(`[${FUNCTION_NAME}] Error fetching generation prompt:`, promptError);
            }

            if (!generationPrompt) {
                console.warn(`[${FUNCTION_NAME}] No generation prompt found for:`);
                console.warn(`[${FUNCTION_NAME}]   prompt_type: generation`);
                console.warn(`[${FUNCTION_NAME}]   requirement_type: ${requirementType}`);
                console.warn(`[${FUNCTION_NAME}]   is_active: true, is_default: true`);
            }

            if (generationPrompt) {
                console.log(`[${FUNCTION_NAME}] Found generation prompt: ${generationPrompt.name} (ID: ${generationPrompt.id})`);
                console.log(`[${FUNCTION_NAME}] Prompt has system_instruction: ${!!generationPrompt.system_instruction}`);
                console.log(`[${FUNCTION_NAME}] Prompt has output_schema: ${!!generationPrompt.output_schema}`);

                let phase2Prompt = generationPrompt.prompt_text
                    .replace(/{{requirement_number}}/g, requirement.requirement_number)
                    .replace(/{{requirement_text}}/g, requirement.requirement_text)
                    .replace(/{{element_text}}/g, requirement.element_text || '')
                    .replace(/{{unit_code}}/g, unitCode)
                    .replace(/{{unit_title}}/g, unitTitle)
                    .replace(/{{status}}/g, status)
                    .replace(/{{reasoning}}/g, reasoning)
                    .replace(/{{unmapped_content}}/g, recommendations || 'N/A');

                try {
                    const phase2Response = await aiClient.generateValidation({
                        prompt: phase2Prompt,
                        documentContent,
                        systemInstruction: generationPrompt.system_instruction,
                        outputSchema: generationPrompt.output_schema,
                        generationConfig: generationPrompt.generation_config
                    });

                    if (phase2Response?.text) {
                        const phase2Result = JSON.parse(phase2Response.text);
                        const normalizedPhase2: any = {};
                        for (const key in phase2Result) {
                            normalizedPhase2[key.toLowerCase().replace(/\s+/g, '_')] = phase2Result[key];
                        }

                        const phase2SmartTask = normalizedPhase2.smart_task || normalizedPhase2.smart_question || normalizedPhase2.practical_task || '';
                        if (phase2SmartTask) {
                            smartQuestions = typeof phase2SmartTask === 'string' ? phase2SmartTask : JSON.stringify(phase2SmartTask);
                        }

                        const phase2Benchmark = normalizedPhase2.benchmark_answer || normalizedPhase2.model_answer || '';
                        if (phase2Benchmark) {
                            benchmarkAnswer = typeof phase2Benchmark === 'string' ? phase2Benchmark : JSON.stringify(phase2Benchmark);
                        }

                        console.log(`[${FUNCTION_NAME}] Phase 2 completed - smart_questions length: ${smartQuestions.length}`);
                    }
                } catch (e: any) {
                    console.error(`[${FUNCTION_NAME}] ===== PHASE 2 FAILED =====`);
                    console.error(`[${FUNCTION_NAME}] Error:`, e);
                    console.error(`[${FUNCTION_NAME}] Error message:`, e?.message);
                    console.error(`[${FUNCTION_NAME}] Stack:`, e?.stack);
                }
            }
        } else if (normalizedStatus === 'met') {
            // Clear smart questions for Met status
            smartQuestions = '';
            benchmarkAnswer = '';
        }

        return {
            status,
            reasoning: typeof reasoning === 'string' ? reasoning : '',
            mappedContent: typeof mappedContent === 'string' ? mappedContent : '',
            citations: Array.isArray(citations) ? JSON.stringify(citations) : String(citations || '[]'),
            smartQuestions: smartQuestions || '',
            benchmarkAnswer: benchmarkAnswer || '',
            recommendations: typeof recommendations === 'string' ? recommendations : '',
            success: true
        };

    } catch (error: any) {
        console.error(`[${FUNCTION_NAME}] Validation failed for ${requirement.requirement_number}:`, error);
        return {
            status: 'Not Met',
            reasoning: `Validation failed: ${error.message}`,
            mappedContent: '',
            citations: '[]',
            smartQuestions: '',
            benchmarkAnswer: '',
            recommendations: '',
            success: false,
            error: error.message
        };
    }
}
