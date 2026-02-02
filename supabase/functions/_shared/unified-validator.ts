/**
 * Unified Validator
 * 
 * Single source of truth for requirement validation logic.
 * Used by both validate-assessment and revalidate-proxy.
 * 
 * Key features:
 * - Explicit N/A instructions in prompts for Met status
 * - Phase 2 generation only for non-Met
 * - Consistent result parsing
 */

import { createAIClient, getAIProviderConfig } from './ai-provider.ts';

const FUNCTION_NAME = 'UnifiedValidator';

export interface ValidatorInput {
    requirement: {
        id?: number;
        requirement_number: string;
        requirement_text: string;
        requirement_type: string;
        element_text?: string;
    };
    documentContent: string;
    documentType: 'unit' | 'learner_guide';
    unitCode: string;
    unitTitle?: string;
    validationDetailId: number;
    supabase: any;
}

export interface ValidatorResult {
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
 * Core validation function - single AI call with embedded N/A logic
 */
export async function validateRequirementUnified(input: ValidatorInput): Promise<ValidatorResult> {
    const { requirement, documentContent, documentType, unitCode, unitTitle, supabase } = input;
    const requirementType = normalizeRequirementType(requirement.requirement_type);

    console.log(`[${FUNCTION_NAME}] START: ${requirement.requirement_number}`);
    console.log(`[${FUNCTION_NAME}] Type: ${requirementType}, DocType: ${documentType}`);

    try {
        const aiClient = createAIClient();

        // 1. Fetch validation prompt from database
        let { data: promptTemplate } = await supabase
            .from('prompts')
            .select('*')
            .eq('prompt_type', 'validation')
            .eq('requirement_type', requirementType)
            .eq('document_type', documentType)
            .eq('is_active', true)
            .eq('is_default', true)
            .limit(1)
            .maybeSingle();

        // Fallback to general prompt if specific not found
        if (!promptTemplate) {
            const { data: generalPrompt } = await supabase
                .from('prompts')
                .select('*')
                .eq('prompt_type', 'validation')
                .eq('requirement_type', requirementType)
                .eq('is_active', true)
                .eq('is_default', true)
                .limit(1)
                .maybeSingle();
            promptTemplate = generalPrompt;
        }

        // 2. Build prompt with template substitution
        let promptText = promptTemplate?.prompt_text || getDefaultPrompt(requirementType);

        promptText = promptText
            .replace(/{{requirement_number}}/g, requirement.requirement_number || '')
            .replace(/{{requirement_text}}/g, requirement.requirement_text || '')
            .replace(/{{requirement_type}}/g, requirementType)
            .replace(/{{element_text}}/g, requirement.element_text || '')
            .replace(/{{unit_code}}/g, unitCode)
            .replace(/{{unit_title}}/g, unitTitle || '')
            .replace(/{{document_type}}/g, documentType);

        const systemInstruction = promptTemplate?.system_instruction ||
            'You are an expert RTO validator. Return a JSON response with all required fields.';

        // 3. CRITICAL: Add explicit N/A instructions for Azure
        // This is the key difference that makes revalidate work - embedded in prompt
        const outputFormatInstruction = getOutputFormatInstruction(requirementType);
        promptText += outputFormatInstruction;

        // 4. Call AI
        console.log(`[${FUNCTION_NAME}] Calling AI with prompt: ${promptTemplate?.name || 'default'}`);
        const aiResponse = await aiClient.generateValidation({
            prompt: promptText,
            documentContent,
            systemInstruction,
            outputSchema: promptTemplate?.output_schema,
            generationConfig: promptTemplate?.generation_config
        });

        // 5. Parse response
        console.log(`[${FUNCTION_NAME}] AI Response length: ${aiResponse.text?.length || 0}`);

        let parsedResult: any;
        try {
            parsedResult = JSON.parse(aiResponse.text);
        } catch (e) {
            console.error(`[${FUNCTION_NAME}] JSON parse failed:`, aiResponse.text?.substring(0, 500));
            throw new Error('AI returned invalid JSON');
        }

        // 6. Normalize keys
        const normalizedResult = normalizeKeys(parsedResult);
        console.log(`[${FUNCTION_NAME}] Parsed status: ${normalizedResult.status}`);

        // 7. Extract all fields
        const status = normalizedResult.status || 'Unknown';
        const reasoning = extractText(normalizedResult.reasoning || normalizedResult.explanation || '');
        let mappedContent = extractText(normalizedResult.mapped_content || normalizedResult.mapped_questions || '');
        let citations = normalizedResult.citations || normalizedResult.doc_references || [];
        let recommendations = extractText(normalizedResult.unmapped_content || normalizedResult.recommendations || '');

        // 8. Extract smart questions and benchmark
        let { smartQuestions, benchmarkAnswer } = extractSmartFields(normalizedResult, requirementType);

        // 9. Enforce N/A for Met status - belt and suspenders approach
        const normalizedStatus = status.toLowerCase().replace(/[^a-z]/g, '');
        if (normalizedStatus === 'met' || normalizedStatus === 'requirementmet') {
            console.log(`[${FUNCTION_NAME}] Status is Met - enforcing N/A for smart_questions and benchmark_answer`);
            smartQuestions = 'N/A';
            benchmarkAnswer = 'N/A';
        } else {
            // 10. Phase 2: Generate smart questions for non-Met status
            console.log(`[${FUNCTION_NAME}] Status is ${status} - running Phase 2 generation`);

            const phase2Result = await runPhase2Generation(
                supabase,
                aiClient,
                requirement,
                requirementType,
                documentType,
                documentContent,
                unitCode,
                unitTitle || '',
                status,
                reasoning,
                recommendations
            );

            if (phase2Result) {
                smartQuestions = phase2Result.smartQuestions || smartQuestions;
                benchmarkAnswer = phase2Result.benchmarkAnswer || benchmarkAnswer;
            }
        }

        console.log(`[${FUNCTION_NAME}] COMPLETE: ${requirement.requirement_number} = ${status}`);
        console.log(`[${FUNCTION_NAME}] smart_questions: "${smartQuestions.substring(0, 100)}..."`);

        return {
            status,
            reasoning,
            mappedContent,
            citations: Array.isArray(citations) ? JSON.stringify(citations) : String(citations || '[]'),
            smartQuestions: smartQuestions || 'N/A',
            benchmarkAnswer: benchmarkAnswer || 'N/A',
            recommendations,
            success: true
        };

    } catch (error: any) {
        console.error(`[${FUNCTION_NAME}] Failed for ${requirement.requirement_number}:`, error);
        return {
            status: 'Not Met',
            reasoning: `Validation failed: ${error.message}`,
            mappedContent: '',
            citations: '[]',
            smartQuestions: 'N/A',
            benchmarkAnswer: 'N/A',
            recommendations: '',
            success: false,
            error: error.message
        };
    }
}

/**
 * Phase 2: Generate smart questions/tasks for non-Met requirements
 */
async function runPhase2Generation(
    supabase: any,
    aiClient: any,
    requirement: any,
    requirementType: string,
    documentType: string,
    documentContent: string,
    unitCode: string,
    unitTitle: string,
    status: string,
    reasoning: string,
    unmappedContent: string
): Promise<{ smartQuestions: string; benchmarkAnswer: string } | null> {
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
            console.log(`[${FUNCTION_NAME}] No Phase 2 prompt found for ${requirementType}/${documentType}`);
            return null;
        }

        console.log(`[${FUNCTION_NAME}] Phase 2 using: ${generationPrompt.name}`);

        // Build Phase 2 prompt
        let phase2Prompt = generationPrompt.prompt_text
            .replace(/{{requirement_number}}/g, requirement.requirement_number)
            .replace(/{{requirement_text}}/g, requirement.requirement_text)
            .replace(/{{element_text}}/g, requirement.element_text || '')
            .replace(/{{unit_code}}/g, unitCode)
            .replace(/{{unit_title}}/g, unitTitle)
            .replace(/{{status}}/g, status)
            .replace(/{{reasoning}}/g, reasoning)
            .replace(/{{unmapped_content}}/g, unmappedContent || 'N/A');

        // Add explicit output format instruction for Azure robustness
        phase2Prompt += getOutputFormatInstruction(requirementType);

        // Call AI
        const phase2Response = await aiClient.generateValidation({
            prompt: phase2Prompt,
            documentContent,
            systemInstruction: generationPrompt.system_instruction,
            outputSchema: generationPrompt.output_schema,
            generationConfig: generationPrompt.generation_config
        });

        if (!phase2Response?.text) {
            console.error(`[${FUNCTION_NAME}] Phase 2 returned empty response`);
            return null;
        }

        const phase2Result = JSON.parse(phase2Response.text);
        const normalized = normalizeKeys(phase2Result);

        const smartQuestions = extractText(
            normalized.smart_task ||
            normalized.smart_question ||
            normalized.practical_workplace_task ||
            normalized.practical_task ||
            ''
        );

        const benchmarkAnswer = extractText(
            normalized.benchmark_answer ||
            normalized.model_answer ||
            ''
        );

        console.log(`[${FUNCTION_NAME}] Phase 2 completed: smart_questions length=${smartQuestions.length}`);
        return { smartQuestions, benchmarkAnswer };

    } catch (e: any) {
        console.error(`[${FUNCTION_NAME}] Phase 2 failed:`, e);
        return null;
    }
}

/**
 * Get explicit N/A instructions for Azure - embedded in prompt
 */
function getOutputFormatInstruction(requirementType: string): string {
    const isKE = requirementType === 'knowledge_evidence';
    const smartField = isKE ? 'smart_question' : 'smart_task';

    return `

CRITICAL: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation (max 300 words)",
  "mapped_content": "Specific content with page numbers",
  "citations": ["Document name, Section, Page X"],
  "${smartField}": "If status is 'Met', you MUST use 'N/A'. Otherwise, ONE ${isKE ? 'question' : 'practical task'}",
  "benchmark_answer": "If status is 'Met', you MUST use 'N/A'. Otherwise, expected answer/behavior",
  "unmapped_content": "What is missing. Use 'N/A' if fully met"
}

IMPORTANT RULES:
- If status is "Met", ${smartField} MUST be exactly "N/A"
- If status is "Met", benchmark_answer MUST be exactly "N/A"
- ALL fields are required
- Return ONLY the JSON object`;
}

/**
 * Default validation prompt if none found in database
 */
function getDefaultPrompt(requirementType: string): string {
    return `Validate the following ${requirementType} requirement against the provided documents.

**Requirement Number:** {{requirement_number}}
**Requirement Text:** {{requirement_text}}

Determine if this requirement is Met, Partially Met, or Not Met based on the document content.`;
}

/**
 * Normalize requirement type to database format
 */
function normalizeRequirementType(type: string): string {
    const typeMap: Record<string, string> = {
        'ke': 'knowledge_evidence',
        'pe': 'performance_evidence',
        'fs': 'foundation_skills',
        'epc': 'elements_performance_criteria',
        'ac': 'assessment_conditions',
        'ai': 'assessment_instructions'
    };
    return typeMap[type] || type;
}

/**
 * Normalize object keys to lowercase with underscores
 */
function normalizeKeys(obj: any): any {
    const normalized: any = {};
    for (const key in obj) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        normalized[normalizedKey] = obj[key];
    }
    return normalized;
}

/**
 * Extract text from various field formats
 */
function extractText(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && !Array.isArray(field)) {
        return field.text || field.content || field.question || JSON.stringify(field);
    }
    if (Array.isArray(field)) {
        return field.map((item: any) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
    }
    return String(field);
}

/**
 * Extract smart questions and benchmark from normalized result
 */
function extractSmartFields(result: any, requirementType: string): { smartQuestions: string; benchmarkAnswer: string } {
    let smartQuestions = '';
    let benchmarkAnswer = '';

    // Try various field names
    const smartTaskField = result.practical_workplace_task ||
        result.practical_task ||
        result.smart_task ||
        result.smart_question ||
        result.suggested_question ||
        result.tasks;

    if (smartTaskField) {
        if (typeof smartTaskField === 'object' && !Array.isArray(smartTaskField)) {
            smartQuestions = smartTaskField.task_text || smartTaskField.text || smartTaskField.question || '';
            benchmarkAnswer = smartTaskField.benchmark_answer || smartTaskField.answer || '';
        } else if (Array.isArray(smartTaskField)) {
            smartQuestions = smartTaskField.map((t: any) =>
                typeof t === 'string' ? t : (t.task_text || t.text || JSON.stringify(t))
            ).join('\n');
        } else {
            smartQuestions = String(smartTaskField);
        }
    }

    // Check for separate benchmark field
    const benchmarkField = result.benchmark_answer || result.model_answer || result.expected_behavior;
    if (benchmarkField && !benchmarkAnswer) {
        benchmarkAnswer = extractText(benchmarkField);
    }

    return { smartQuestions, benchmarkAnswer };
}
