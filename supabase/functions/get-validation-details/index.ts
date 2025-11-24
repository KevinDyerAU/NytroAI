import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

/**
 * Get Validation Details
 * 
 * Returns validation details with document counts for manual triggering
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createSupabaseClient(req);
    const url = new URL(req.url);
    const searchTerm = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Build query
    let query = supabase
      .from('validation_detail')
      .select(`
        id,
        extractStatus,
        namespace_code,
        created_at,
        validation_summary!inner(
          id,
          unitCode,
          rto_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Add date filter for recent validations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query = query.gte('created_at', sevenDaysAgo.toISOString());

    // Add search filter if provided
    if (searchTerm) {
      query = query.ilike('validation_summary.unitCode', `%${searchTerm}%`);
    }

    const { data: validationDetails, error } = await query;

    if (error) {
      console.error('[get-validation-details] Error fetching validation details:', error);
      return createErrorResponse('Failed to fetch validation details', 500);
    }

    // Get document counts for each validation detail
    const detailsWithCounts = await Promise.all(
      (validationDetails || []).map(async (detail) => {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('validation_detail_id', detail.id);

        return {
          detail_id: detail.id,
          unitCode: detail.validation_summary?.unitCode || 'Unknown',
          extractStatus: detail.extractStatus,
          namespace_code: detail.namespace_code,
          document_count: count || 0,
          created_at: detail.created_at,
          rto_id: detail.validation_summary?.rto_id,
        };
      })
    );

    return createSuccessResponse({
      validations: detailsWithCounts,
      total: detailsWithCounts.length,
    });

  } catch (error) {
    console.error('[get-validation-details] Exception:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
