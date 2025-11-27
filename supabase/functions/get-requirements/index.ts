/**
 * Get Requirements
 * 
 * Fetches all requirements for a unit from database tables
 * Used by n8n validation workflows
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface Requirement {
  id: number;
  number: string;
  text: string;
  type: string;
  description?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { unit_code, validation_detail_id } = await req.json();

    if (!unit_code) {
      return new Response(
        JSON.stringify({ error: 'unit_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[Get Requirements] Fetching requirements for unit: ${unit_code}`);

    const allRequirements: Requirement[] = [];

    // Define requirement tables to query
    const tables = [
      { name: 'knowledge_evidence', type: 'knowledge_evidence' },
      { name: 'performance_evidence', type: 'performance_evidence' },
      { name: 'foundation_skills', type: 'foundation_skills' },
      { name: 'elements_performance_criteria', type: 'elements_performance_criteria' },
      { name: 'assessment_conditions', type: 'assessment_conditions' }
    ];

    // Fetch from each table
    for (const table of tables) {
      try {
        const { data, error } = await supabaseClient
          .from(table.name)
          .select('id, number, text, description')
          .eq('unit_code', unit_code)
          .order('number');

        if (error) {
          console.warn(`[Get Requirements] Error fetching from ${table.name}:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          const requirements = data.map((item: any) => ({
            id: item.id,
            number: item.number || '',
            text: item.text || item.description || '',
            type: table.type,
            description: item.description
          }));
          
          allRequirements.push(...requirements);
          console.log(`[Get Requirements] ✓ Fetched ${requirements.length} from ${table.name}`);
        } else {
          console.log(`[Get Requirements] - No requirements in ${table.name}`);
        }
      } catch (error: any) {
        console.error(`[Get Requirements] ✗ Failed to fetch from ${table.name}:`, error.message);
      }
    }

    console.log(`[Get Requirements] Total requirements found: ${allRequirements.length}`);

    // Group by type for easier processing
    const groupedRequirements: Record<string, Requirement[]> = {};
    for (const req of allRequirements) {
      if (!groupedRequirements[req.type]) {
        groupedRequirements[req.type] = [];
      }
      groupedRequirements[req.type].push(req);
    }

    // Log summary
    console.log('[Get Requirements] Summary by type:');
    for (const [type, reqs] of Object.entries(groupedRequirements)) {
      console.log(`  - ${type}: ${reqs.length} requirements`);
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
