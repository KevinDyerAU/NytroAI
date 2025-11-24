import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';

interface QueryDocumentRequest {
  query: string;
  rtoCode: string;
  context?: string;
  metadata?: Record<string, any>;
}

/**
 * Query Document Edge Function
 * 
 * This function handles AI queries for:
 * 1. AI Chat - conversational queries about documents
 * 2. Smart Question Regeneration - improving single validation requirements
 * 3. Single Validation Regeneration - re-validating individual requirements
 * 
 * AI Credits are consumed for each query (1 credit per query)
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('[query-document] Request received');
    
    const requestData: QueryDocumentRequest = await req.json();
    const { query, rtoCode, context, metadata } = requestData;

    if (!query) {
      return createErrorResponse('Missing required field: query', 400);
    }

    if (!rtoCode) {
      return createErrorResponse('Missing required field: rtoCode', 400);
    }

    const supabase = createSupabaseClient(req);

    console.log('[query-document] Query details:', {
      rtoCode,
      context,
      queryLength: query.length,
      metadata
    });

    // Determine operation type from context or metadata
    const operationType = context?.includes('chat') ? 'ai_chat' : 
                         context?.includes('regeneration') ? 'smart_question_regen' : 
                         'ai_query';

    console.log('[query-document] Operation type:', operationType);

    // ✅ CONSUME AI CREDIT BEFORE PROCESSING
    console.log('[query-document] Consuming AI credit for RTO:', rtoCode);
    
    const { data: creditData, error: creditError } = await supabase.rpc('add_ai_credits', {
      rto_code: rtoCode,
      amount: -1, // Consume 1 credit
      reason: `AI ${operationType.replace('_', ' ')} query`,
    });

    if (creditError) {
      console.error('[query-document] Credit consumption error:', creditError);
      
      // Check if insufficient credits
      if (creditError.message?.includes('Insufficient') || 
          creditError.message?.includes('not enough') ||
          creditError.message?.includes('cannot be negative')) {
        return createErrorResponse('Insufficient AI credits', 402);
      }
      
      throw new Error(`Failed to consume AI credit: ${creditError.message}`);
    }

    console.log('[query-document] AI credit consumed successfully. Remaining credits:', creditData);

    // Get RTO ID and File Search store for document filtering
    const { data: rto, error: rtoError } = await supabase
      .from('RTO')
      .select('id, gemini_store_name')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rto) {
      console.error('[query-document] RTO not found:', rtoCode);
      return createErrorResponse('RTO not found', 404);
    }

    if (!rto.gemini_store_name) {
      console.error('[query-document] No Gemini File Search store found for RTO:', rtoCode);
      return createErrorResponse('No document store configured for this RTO', 404);
    }

    // Query Gemini with File Search context
    console.log('[query-document] Querying Gemini with File Search store:', rto.gemini_store_name);
    
    const geminiClient = createDefaultGeminiClient();
    const geminiResponse = await geminiClient.generateContentWithFileSearch(
      query,
      [rto.gemini_store_name],
      metadata?.validationDetailId ? `validation_detail_id:${metadata.validationDetailId}` : undefined
    );

    console.log('[query-document] Gemini query successful');

    // Extract citations from grounding metadata
    const citations = geminiResponse.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      documentName: chunk.fileSearchChunk?.documentName || 'Unknown',
      displayName: chunk.fileSearchChunk?.displayName || 'Document',
      pageNumbers: chunk.fileSearchChunk?.pageNumbers || [],
      chunkText: chunk.fileSearchChunk?.chunkText,
    })) || [];

    // Return the AI response
    return createSuccessResponse({
      answer: geminiResponse.text,
      citations,
      operationType,
      creditConsumed: true,
      remainingCredits: creditData?.current_credits || 0,
    });

  } catch (error) {
    console.error('[query-document] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
