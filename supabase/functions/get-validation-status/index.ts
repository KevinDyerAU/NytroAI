import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

// Enhanced CORS headers for development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

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
      console.error('[get-validation-status] RPC Error:', error);
      return createErrorResponse(`Failed to fetch validation status: ${error.message}`, 500);
    }

    return createSuccessResponse({
      status: data || [],
      total: data?.length || 0,
    });

  } catch (error) {
    console.error('[get-validation-status] Exception:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
