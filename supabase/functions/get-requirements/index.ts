/**
 * Get Requirements
 * 
 * Fetches all requirements for a unit from database tables
 * Used by n8n validation workflows
 * 
 * Updated to use the unified requirements-fetcher shared utility
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { fetchAllRequirements, type Requirement } from '../_shared/requirements-fetcher.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { validation_detail_id } = await req.json();

    if (!validation_detail_id) {
      return new Response(
        JSON.stringify({ error: 'validation_detail_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[Get Requirements] Processing validation detail: ${validation_detail_id}`);

    // Get unit metadata from validation_detail
    const { data: validationDetail, error: validationError } = await supabaseClient
      .from('validation_detail')
      .select(`
        id,
        summary_id,
        validation_summary!inner(
          unitCode,
          unitLink
        )
      `)
      .eq('id', validation_detail_id)
      .single();

    if (validationError || !validationDetail) {
      console.error('[Get Requirements] Failed to fetch validation detail:', validationError);
      return new Response(
        JSON.stringify({
          error: 'Validation detail not found',
          validation_detail_id
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const unit_url = validationDetail.validation_summary?.unitLink;
    const unit_code = validationDetail.validation_summary?.unitCode;

    if (!unit_code) {
      return new Response(
        JSON.stringify({
          error: 'No unit_code found for this validation',
          validation_detail_id
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Get Requirements] Fetching all requirements for unit: ${unit_code} using shared fetcher`);

    // Use the SHARED fetcher to get all requirements
    // This will automatically PERSIST the total count to validation_detail
    const allRequirements: Requirement[] = await fetchAllRequirements(
      supabaseClient,
      unit_code,
      unit_url,
      validation_detail_id
    );

    // Group by type for the response (same format as before for backward compatibility)
    const groupedRequirements: Record<string, Requirement[]> = {};
    for (const req of allRequirements) {
      if (!groupedRequirements[req.type]) {
        groupedRequirements[req.type] = [];
      }
      groupedRequirements[req.type].push(req);
    }

    return new Response(
      JSON.stringify({
        success: true,
        unit_code,
        validation_detail_id: validation_detail_id || null,
        total_requirements: allRequirements.length,
        requirements: allRequirements,
        requirements_by_type: groupedRequirements,
        summary: Object.entries(groupedRequirements).map(([type, reqs]) => ({
          type,
          count: reqs.length
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Get Requirements] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
