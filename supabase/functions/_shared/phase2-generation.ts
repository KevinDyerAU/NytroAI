/**
 * Phase 2 Generation - Shared module for smart question/task generation
 * 
 * This module handles Phase 2 of the validation process:
 * - Phase 1: Validate requirements against documents
 * - Phase 2: Generate smart questions/tasks for requirements with status != 'met'
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FUNCTION_NAME = 'phase2-generation';

export interface Phase2Input {
    supabase: SupabaseClient;
    aiClient: any;
    requirementType: string;
    documentType: string;
    requirementNumber: string;
    requirementText: string;
    elementText?: string;
    unitCode: string;
    unitTitle: string;
    status: string;
    reasoning: string;
    unmappedContent: string;
    documentContent: string;
    systemInstruction?: string;
    existingSmartQuestions?: string;
}

export interface Phase2Result {
    smartQuestions: string;
    benchmarkAnswer: string;
    success: boolean;
    error?: string;
}

/**
 * Check if Phase 2 should run for this requirement
 */
export function shouldRunPhase2(status: string, existingSmartQuestions?: string): boolean {
    const normalizedStatus = status.toLowerCase().replace(/[\s_-]/g, '');
    if (normalizedStatus === 'met') {
        return false; // Never generate smart questions for met requirements
    }

    // Check if existing smart questions are empty or placeholders
    if (!existingSmartQuestions || existingSmartQuestions.trim() === '') {
        return true;
    }

    const placeholders = ['n/a', 'na', 'none', 'null', 'undefined', ''];
    return placeholders.includes(existingSmartQuestions.trim().toLowerCase());
}

/**
 * Run Phase 2 generation to create smart questions/tasks
 */
export async function runPhase2Generation(input: Phase2Input): Promise<Phase2Result> {
    const {
        supabase,
        aiClient,
        requirementType,
        documentType,
        requirementNumber,
        requirementText,
        elementText,
        unitCode,
        unitTitle,
        status,
        reasoning,
        unmappedContent,
        documentContent,
        systemInstruction,
        existingSmartQuestions,
    } = input;

    // Check if we should run Phase 2
    if (!shouldRunPhase2(status, existingSmartQuestions)) {
        console.log(`[${FUNCTION_NAME}] Skipping Phase 2 for ${requirementNumber} (status: ${status})`);
        return {
            smartQuestions: '',
            benchmarkAnswer: '',
            success: true,
        };
    }

    console.log(`[${FUNCTION_NAME}] Running Phase 2 for ${requirementNumber} (status: ${status})`);

    try {
        // Fetch Phase 2 generation prompt
        const { data: generationPrompt } = await supabase
            .from('prompts')
            .select('*')
            .eq('prompt_type', 'generation')
            .eq('requirement_type', requirementType)
            .eq('document_type', documentType)
            .eq('is_active', true)
            .eq('is_default', true)
            .limit(1)
            .maybeSingle();

        if (!generationPrompt) {
            // Try without document type filter
            const { data: fallbackPrompt } = await supabase
                .from('prompts')
                .select('*')
                .eq('prompt_type', 'generation')
                .eq('requirement_type', requirementType)
                .eq('is_active', true)
                .eq('is_default', true)
                .limit(1)
                .maybeSingle();

            if (!fallbackPrompt) {
                console.warn(`[${FUNCTION_NAME}] No generation prompt found for ${requirementType}/${documentType}`);
                return {
                    smartQuestions: '',
                    benchmarkAnswer: '',
                    success: false,
                    error: `No generation prompt found for ${requirementType}/${documentType}`,
                };
            }

            return await executePhase2(fallbackPrompt, input);
        }

        return await executePhase2(generationPrompt, input);

    } catch (error) {
        console.error(`[${FUNCTION_NAME}] Phase 2 failed:`, error);
        return {
            smartQuestions: '',
            benchmarkAnswer: '',
            success: false,
            error: String(error),
        };
    }
}

async function executePhase2(generationPrompt: any, input: Phase2Input): Promise<Phase2Result> {
    const {
        aiClient,
        requirementNumber,
        requirementText,
        elementText,
        unitCode,
        unitTitle,
        status,
        reasoning,
        unmappedContent,
        documentContent,
        systemInstruction,
    } = input;

    console.log(`[${FUNCTION_NAME}] Using generation prompt: ${generationPrompt.name}`);

    // Build Phase 2 prompt
    let phase2Prompt = generationPrompt.prompt_text
        .replace(/{{requirement_number}}/g, requirementNumber)
        .replace(/{{requirement_text}}/g, requirementText)
        .replace(/{{element_text}}/g, elementText || '')
        .replace(/{{unit_code}}/g, unitCode)
        .replace(/{{unit_title}}/g, unitTitle)
        .replace(/{{status}}/g, status)
        .replace(/{{reasoning}}/g, reasoning)
        .replace(/{{unmapped_content}}/g, unmappedContent || 'N/A');

    // Call AI for Phase 2 generation
    console.log(`[${FUNCTION_NAME}] Calling AI for Phase 2 generation...`);

    const phase2Response = await aiClient.generateValidation({
        prompt: phase2Prompt,
        documentContent: documentContent,
        systemInstruction: systemInstruction || generationPrompt.system_instruction,
        outputSchema: generationPrompt.output_schema,
        generationConfig: generationPrompt.generation_config,
    });

    console.log(`[${FUNCTION_NAME}] Phase 2 raw response length: ${phase2Response?.text?.length || 0}`);

    if (!phase2Response?.text || phase2Response.text.trim() === '') {
        console.error(`[${FUNCTION_NAME}] Phase 2 returned empty response`);
        return {
            smartQuestions: '',
            benchmarkAnswer: '',
            success: false,
            error: 'AI returned empty response',
        };
    }

    // Parse the response
    const phase2Result = JSON.parse(phase2Response.text);
    const normalizedPhase2: any = {};
    for (const key in phase2Result) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        normalizedPhase2[normalizedKey] = phase2Result[key];
    }

    console.log(`[${FUNCTION_NAME}] Phase 2 parsed keys: ${Object.keys(normalizedPhase2).join(', ')}`);

    // Extract smart questions and benchmark answer
    const phase2SmartTask = normalizedPhase2.smart_task ||
        normalizedPhase2.smart_question ||
        normalizedPhase2.practical_workplace_task ||
        normalizedPhase2.practical_task ||
        '';

    let smartQuestions = '';
    if (phase2SmartTask) {
        smartQuestions = typeof phase2SmartTask === 'string' ? phase2SmartTask : JSON.stringify(phase2SmartTask);
    } else {
        console.warn(`[${FUNCTION_NAME}] Phase 2 response missing smart_task/smart_question field`);
    }

    const phase2Benchmark = normalizedPhase2.benchmark_answer || normalizedPhase2.model_answer || '';
    let benchmarkAnswer = '';
    if (phase2Benchmark) {
        benchmarkAnswer = typeof phase2Benchmark === 'string' ? phase2Benchmark : JSON.stringify(phase2Benchmark);
    }

    console.log(`[${FUNCTION_NAME}] Phase 2 completed - smart_questions length: ${smartQuestions.length}`);

    return {
        smartQuestions,
        benchmarkAnswer,
        success: true,
    };
}

/**
 * Run Phase 2 for multiple validation results and update the database
 * This is used after initial validation to generate smart questions for all non-met requirements
 */
export async function runPhase2ForValidations(
    supabase: SupabaseClient,
    aiClient: any,
    validationDetailId: number,
    documentContent: string,
    unitCode: string,
    unitTitle: string,
    systemInstruction?: string
): Promise<{ updated: number; failed: number }> {
    console.log(`[${FUNCTION_NAME}] Running Phase 2 for all non-met requirements in validation ${validationDetailId}`);

    // Fetch all validation results that need Phase 2
    const { data: results, error } = await supabase
        .from('validation_results')
        .select('*')
        .eq('validation_detail_id', validationDetailId)
        .neq('status', 'Met');

    if (error) {
        console.error(`[${FUNCTION_NAME}] Error fetching validation results:`, error);
        return { updated: 0, failed: 0 };
    }

    if (!results || results.length === 0) {
        console.log(`[${FUNCTION_NAME}] No non-met requirements found for Phase 2`);
        return { updated: 0, failed: 0 };
    }

    console.log(`[${FUNCTION_NAME}] Found ${results.length} requirements needing Phase 2`);

    let updated = 0;
    let failed = 0;

    for (const result of results) {
        // Skip if already has smart questions
        const existingQuestions = result.smart_questions;
        const hasSmartQuestions = existingQuestions &&
            typeof existingQuestions === 'string' &&
            existingQuestions.trim() !== '' &&
            !['n/a', 'na', 'none', 'null', 'undefined'].includes(existingQuestions.trim().toLowerCase());

        if (hasSmartQuestions) {
            console.log(`[${FUNCTION_NAME}] Skipping ${result.requirement_number} - already has smart questions`);
            continue;
        }

        // Determine document type
        const documentType = result.document_type || 'unit';

        try {
            const phase2Result = await runPhase2Generation({
                supabase,
                aiClient,
                requirementType: result.requirement_type,
                documentType,
                requirementNumber: result.requirement_number,
                requirementText: result.requirement_text,
                unitCode,
                unitTitle,
                status: result.status,
                reasoning: result.reasoning || '',
                unmappedContent: result.unmapped_content || '',
                documentContent,
                systemInstruction,
                existingSmartQuestions: existingQuestions,
            });

            if (phase2Result.success && phase2Result.smartQuestions) {
                // Update the validation result with smart questions
                const { error: updateError } = await supabase
                    .from('validation_results')
                    .update({
                        smart_questions: phase2Result.smartQuestions,
                        benchmark_answer: phase2Result.benchmarkAnswer,
                    })
                    .eq('id', result.id);

                if (updateError) {
                    console.error(`[${FUNCTION_NAME}] Error updating ${result.requirement_number}:`, updateError);
                    failed++;
                } else {
                    console.log(`[${FUNCTION_NAME}] Updated ${result.requirement_number} with smart questions`);
                    updated++;
                }
            } else if (!phase2Result.success) {
                console.warn(`[${FUNCTION_NAME}] Phase 2 failed for ${result.requirement_number}: ${phase2Result.error}`);
                failed++;
            }
        } catch (e) {
            console.error(`[${FUNCTION_NAME}] Exception processing ${result.requirement_number}:`, e);
            failed++;
        }
    }

    console.log(`[${FUNCTION_NAME}] Phase 2 complete: ${updated} updated, ${failed} failed`);
    return { updated, failed };
}
