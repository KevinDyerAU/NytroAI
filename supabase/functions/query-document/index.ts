import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';

interface QueryDocumentRequest {
  documentId?: number;
  rtoCode?: string;
  unitCode?: string;
  query: string;
  metadataFilter?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body
    const requestData: QueryDocumentRequest = await req.json();
    const { documentId, rtoCode, unitCode, query, metadataFilter } = requestData;

    // Validate request
    if (!query) {
      return createErrorResponse('Missing required field: query');
    }

    if (!documentId && !rtoCode) {
      return createErrorResponse('Either documentId or rtoCode must be provided');
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient(req);

    let fileSearchStoreId: string;
    let filter = metadataFilter;

    if (documentId) {
      // Query specific document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return createErrorResponse(`Document not found: ${documentId}`);
      }

      fileSearchStoreId = document.file_search_store_id;

      // Build filter from document metadata
      if (!filter && document.metadata) {
        const filters: string[] = [];
        if (document.metadata.unit_code) {
          filters.push(`unit_code=${document.metadata.unit_code}`);
        }
        if (document.metadata.document_type) {
          filters.push(`document_type=${document.metadata.document_type}`);
        }
        filter = filters.join(' AND ');
      }
    } else if (rtoCode) {
      // Query all documents for RTO
      const storeName = `rto-${rtoCode.toLowerCase()}-assessments`;

      // Initialize Gemini client to check if store exists
      const gemini = createDefaultGeminiClient();
      const stores = await gemini.listFileSearchStores();
      const store = stores.find((s) => s.displayName === storeName);

      if (!store) {
        return createErrorResponse(`No File Search store found for RTO: ${rtoCode}`);
      }

      fileSearchStoreId = store.name;

      // Build filter
      const filters: string[] = [`rto_code=${rtoCode}`];
      if (unitCode) {
        filters.push(`unit_code=${unitCode}`);
      }
      filter = filters.join(' AND ');
    } else {
      return createErrorResponse('Invalid request parameters');
    }

    // Initialize Gemini client
    const gemini = createDefaultGeminiClient();

    console.log(`Querying File Search store: ${fileSearchStoreId}`);
    console.log(`Filter: ${filter || 'none'}`);
    console.log(`Query: ${query}`);

    // Query with File Search
    const response = await gemini.generateContentWithFileSearch(
      query,
      [fileSearchStoreId],
      filter
    );

    // Extract citations from both File Search and web sources
    // Prioritize File Search chunks which include page numbers and document names
    const citations =
      response.candidates[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => {
        // Handle File Search results (PDFs, documents with page numbers)
        if (chunk.fileSearchChunk) {
          return {
            type: 'file',
            documentName: chunk.fileSearchChunk.documentName || 'Unknown Document',
            displayName: chunk.fileSearchChunk.displayName || chunk.fileSearchChunk.documentName || 'Document',
            pageNumbers: chunk.fileSearchChunk.pageNumbers || [],
            chunkText: chunk.fileSearchChunk.chunkText,
            customMetadata: chunk.fileSearchChunk.customMetadata || [],
          };
        }
        // Handle web search results (fallback)
        else if (chunk.web) {
          return {
            type: 'web',
            source: chunk.web.uri || 'Unknown',
            title: chunk.web.title || 'Web Source',
          };
        }
        // Handle unknown chunk types
        return {
          type: 'unknown',
          source: 'Unknown',
          title: 'Unknown Source',
        };
      }) || [];

    console.log(`Query completed. Response length: ${response.text.length}`);

    return createSuccessResponse({
      success: true,
      response: response.text,
      citations,
      metadata: {
        fileSearchStoreId,
        filter,
        query,
      },
    });
  } catch (error) {
    console.error('Error querying document:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
