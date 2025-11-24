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

    // Add date filter for recent validations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Build query - simpler version without nested selects
    const { data: validationDetails, error } = await supabase
      .from('validation_detail')
      .select('id, extractStatus, namespace_code, created_at, summary_id')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[get-validation-details] Error fetching validation details:', error);
      return createErrorResponse('Failed to fetch validation details', 500);
    }

    // Fetch validation summaries separately
    const summaryIds = validationDetails?.map(d => d.summary_id).filter(Boolean) || [];
    const { data: summaries } = await supabase
      .from('validation_summary')
      .select('id, unitCode, rto_id')
      .in('id', summaryIds);

    const summaryMap = new Map(summaries?.map((s: any) => [s.id, s]) || []);

    // Get document counts and combine data
    const detailsWithCounts = await Promise.all(
      (validationDetails || []).map(async (detail: any) => {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('validation_detail_id', detail.id);

        const summary: any = summaryMap.get(detail.summary_id);

        return {
          detail_id: detail.id,
          unitCode: summary?.unitCode || 'Unknown',
          extractStatus: detail.extractStatus,
          namespace_code: detail.namespace_code,
          document_count: count || 0,
          created_at: detail.created_at,
          rto_id: summary?.rto_id || null,
        };
      })
    );

    // Apply search filter on unit code if provided
    const filteredDetails = searchTerm
      ? detailsWithCounts.filter(d => 
          d.unitCode.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : detailsWithCounts;

    return createSuccessResponse({
      validations: filteredDetails,
      total: filteredDetails.length,
    });

  } catch (error) {
    console.error('[get-validation-details] Exception:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
