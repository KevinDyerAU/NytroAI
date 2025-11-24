/**
 * Parse Validation Response V2
 * 
 * Parser for V2 validation responses that return structured JSON with
 * individual requirement validations.
 */

import { ValidationResponseV2, RequirementValidation } from './store-validation-results-v2.ts';

/**
 * Parse V2 validation response from Gemini
 * 
 * Expects JSON response in the format:
 * {
 *   "validationType": "knowledge_evidence",
 *   "unitCode": "BSBWHS211",
 *   "overallStatus": "met" | "partial" | "not_met",
 *   "summary": "...",
 *   "requirementValidations": [...]
 * }
 */
export function parseValidationResponseV2(
  responseText: string,
  validationType: string,
  unitCode: string
): ValidationResponseV2 | null {
  try {
    console.log('[Parse V2] Parsing validation response...');
    console.log('[Parse V2] Response length:', responseText.length);

    // Try to extract JSON from the response
    // Gemini sometimes wraps JSON in markdown code blocks
    let jsonText = responseText;

    // Remove markdown code blocks if present
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
      console.log('[Parse V2] Extracted JSON from code block');
    } else {
      // Try to find JSON object in the text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('[Parse V2] Extracted JSON from text');
      }
    }

    // Parse the JSON
    const parsed = JSON.parse(jsonText);

    // Validate structure
    if (!parsed.requirementValidations || !Array.isArray(parsed.requirementValidations)) {
      console.error('[Parse V2] Invalid structure: missing or invalid requirementValidations array');
      return null;
    }

    // Normalize and validate each requirement validation
    const requirementValidations: RequirementValidation[] = parsed.requirementValidations.map((rv: any) => ({
      requirementId: rv.requirementId || 0,
      requirementType: rv.requirementType || validationType,
      requirementNumber: rv.requirementNumber || '',
      requirementText: rv.requirementText || '',
      status: normalizeStatus(rv.status),
      reasoning: rv.reasoning || '',
      evidenceFound: Array.isArray(rv.evidenceFound) ? rv.evidenceFound : [],
      gaps: Array.isArray(rv.gaps) ? rv.gaps : [],
      smartQuestions: Array.isArray(rv.smartQuestions) ? rv.smartQuestions : [],
      citations: Array.isArray(rv.citations) ? rv.citations : [],
    }));

    console.log(`[Parse V2] Successfully parsed ${requirementValidations.length} requirement validations`);

    return {
      validationType: parsed.validationType || validationType,
      unitCode: parsed.unitCode || unitCode,
      overallStatus: normalizeStatus(parsed.overallStatus || 'not_met'),
      summary: parsed.summary || '',
      requirementValidations,
      summaryByType: parsed.summaryByType,
    };

  } catch (error) {
    console.error('[Parse V2] Error parsing validation response:', error);
    console.error('[Parse V2] Response text:', responseText.substring(0, 500));
    return null;
  }
}

/**
 * Normalize status values to ensure consistency
 */
function normalizeStatus(status: string): 'met' | 'partial' | 'not_met' {
  const normalized = status.toLowerCase().replace(/[_-]/g, '_');
  
  if (normalized === 'met' || normalized === 'pass') return 'met';
  if (normalized === 'partial') return 'partial';
  if (normalized === 'not_met' || normalized === 'notmet' || normalized === 'fail') return 'not_met';
  
  console.warn(`[Parse V2] Unknown status value: ${status}, defaulting to not_met`);
  return 'not_met';
}

/**
 * Try to parse V2 response, fall back to creating a basic structure if parsing fails
 */
export function parseValidationResponseV2WithFallback(
  responseText: string,
  validationType: string,
  unitCode: string,
  requirements: Array<{ id: number; number: string; text: string; type: string }>
): ValidationResponseV2 {
  // Try to parse as V2 format
  const parsed = parseValidationResponseV2(responseText, validationType, unitCode);
  if (parsed) {
    return parsed;
  }

  console.log('[Parse V2] Parsing failed, creating fallback structure');

  // Create fallback structure with basic validation
  // This ensures we always have something to store even if AI response is malformed
  const requirementValidations: RequirementValidation[] = requirements.map(req => ({
    requirementId: req.id,
    requirementType: req.type, // Use actual requirement type, NOT validationType
    requirementNumber: req.number,
    requirementText: req.text,
    status: 'not_met' as const,
    reasoning: 'Unable to parse validation response. Manual review required.',
    evidenceFound: [],
    gaps: ['Validation response could not be parsed'],
    smartQuestions: [],
    citations: [],
  }));

  return {
    validationType,
    unitCode,
    overallStatus: 'not_met',
    summary: 'Validation completed but response parsing failed. Manual review required.',
    requirementValidations,
  };
}

/**
 * Extract citations from grounding metadata
 */
export function extractCitationsFromGroundingMetadata(groundingMetadata: any): Array<{
  documentName: string;
  pageNumbers: number[];
  chunkText?: string;
}> {
  if (!groundingMetadata || !groundingMetadata.groundingChunks) {
    console.log('[Extract Citations] No grounding metadata or chunks available');
    return [];
  }

  console.log(`[Extract Citations] Found ${groundingMetadata.groundingChunks.length} grounding chunks`);
  console.log('[Extract Citations] First chunk structure:', JSON.stringify(groundingMetadata.groundingChunks[0], null, 2));

  const citations = groundingMetadata.groundingChunks.map((chunk: any) => {
    // Handle different grounding chunk structures
    const documentName = 
      chunk.fileSearchChunk?.documentName || 
      chunk.retrievedContext?.title ||
      chunk.web?.uri || 
      'Unknown';
    
    const pageNumbers = chunk.fileSearchChunk?.pageNumbers || [];
    
    const chunkText = 
      chunk.fileSearchChunk?.content || 
      chunk.retrievedContext?.text ||
      chunk.chunk?.content || 
      '';
    
    return {
      documentName,
      pageNumbers,
      chunkText,
    };
  });

  console.log(`[Extract Citations] Extracted ${citations.length} citations`);
  console.log('[Extract Citations] First citation:', JSON.stringify(citations[0], null, 2));

  return citations;
}

/**
 * Merge citations from grounding metadata into requirement validations
 */
export function mergeCitationsIntoValidations(
  validationResponse: ValidationResponseV2,
  groundingMetadata: any
): ValidationResponseV2 {
  console.log('[Merge Citations] Starting citation merge...');
  const citations = extractCitationsFromGroundingMetadata(groundingMetadata);
  
  console.log(`[Merge Citations] Extracted ${citations.length} citations to merge`);
  
  if (citations.length === 0) {
    console.log('[Merge Citations] No citations to merge, returning original response');
    return validationResponse;
  }

  // If requirement validations don't have citations, add the grounding citations
  const updatedValidations = validationResponse.requirementValidations.map(rv => {
    if (!rv.citations || rv.citations.length === 0) {
      return {
        ...rv,
        citations,
      };
    }
    return rv;
  });

  console.log(`[Merge Citations] Merged citations into ${updatedValidations.filter(v => v.citations.length > 0).length} validations`);

  return {
    ...validationResponse,
    requirementValidations: updatedValidations,
  };
}
