import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseClient(req);

    console.log('[get-validation-status] Starting query...');

    // Query to get recent validation/document processing status
    const { data, error } = await supabase.rpc('get_validation_status');

    console.log('[get-validation-status] RPC result:', { data, error, dataLength: data?.length });

    if (error) {
      console.error('[get-validation-status] RPC Error - using fallback:', error);
      
      // Fallback to direct query if RPC doesn't exist
      const { data: directData, error: directError } = await supabase
        .from('documents')
        .select(`
          file_name,
          embedding_status,
          uploaded_at,
          validation_detail_id,
          gemini_operations!gemini_operations_document_id_fkey (
            status,
            progress_percentage
          ),
          validation_detail!documents_validation_detail_id_fkey (
            extractStatus,
            numOfReq
          )
        `)
        .gte('uploaded_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order('uploaded_at', { ascending: false });

      if (directError) {
        return createErrorResponse('Failed to fetch validation status', 500);
      }

      // Transform data to match expected format
      const transformedData = (directData || []).map((doc: any) => {
        const minutesAgo = Math.round(
          (Date.now() - new Date(doc.uploaded_at).getTime()) / 1000 / 60
        );

        return {
          file_name: doc.file_name,
          embedding_status: doc.embedding_status,
          gemini_status: doc.gemini_operations?.[0]?.status || null,
          progress_percentage: doc.gemini_operations?.[0]?.progress_percentage || null,
          extractStatus: doc.validation_detail?.extractStatus || null,
          requirements_found: doc.validation_detail?.numOfReq || null,
          uploaded_at: doc.uploaded_at,
          minutes_ago: minutesAgo,
        };
      });

      return createSuccessResponse({
        status: transformedData,
        total: transformedData.length,
      });
    }

    return createSuccessResponse({
      status: data,
      total: data?.length || 0,
    });

  } catch (error) {
    console.error('[get-validation-status] Exception:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
