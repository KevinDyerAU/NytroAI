/**
 * Get Requirements
 * 
 * Fetches all requirements for a unit from database tables
 * Used by n8n validation workflows
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface Requirement {
  id: number;
  number: string;
  text: string;
  type: string;
  display_type: string;
  description?: string;
  element?: string;
  element_number?: string;
}

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

    console.log(`[Get Requirements] Fetching validation detail: ${validation_detail_id}`);

    // Get unit_url from validation_summary via summary_id
    const { data: validationDetail, error: validationError } = await supabaseClient
      .from('validation_detail')
      .select(`
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

    if (!unit_url) {
      return new Response(
        JSON.stringify({ 
          error: 'No unit_url found for this validation',
          validation_detail_id 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Get Requirements] Fetching requirements for unit: ${unit_code} (${unit_url})`);

    const allRequirements: Requirement[] = [];

    // Define requirement tables to query
    const tables = [
      { name: 'knowledge_evidence_requirements', type: 'knowledge_evidence' },
      { name: 'performance_evidence_requirements', type: 'performance_evidence' },
      { name: 'foundation_skills_requirements', type: 'foundation_skills' },
      { name: 'elements_performance_criteria_requirements', type: 'elements_performance_criteria' }
      // Note: assessment_conditions are hard-coded below (standard RTO requirements)
    ];

    // Fetch from each table
    for (const table of tables) {
      try {
        const { data, error } = await supabaseClient
          .from(table.name)
          .select('*')
          .eq('unit_url', unit_url);

        if (error) {
          console.warn(`[Get Requirements] Error fetching from ${table.name}:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          // Map fields based on table type
          const requirements = data.map((item: any, index: number) => {
            let number = String(index + 1);
            let text = '';
            let description = '';
            let display_type = '';
            let element: string | undefined = undefined;
            let element_number: string | undefined = undefined;

            // Table-specific field mapping
            switch (table.type) {
              case 'knowledge_evidence':
                number = item.ke_number || String(index + 1);
                text = item.knowledge_point || '';
                description = item.knowledge_point || '';
                display_type = 'Knowledge Evidence';
                break;
              
              case 'performance_evidence':
                number = item.pe_number || String(index + 1);
                text = item.performance_task || '';
                description = item.performance_task || '';
                display_type = 'Performance Evidence';
                break;
              
              case 'foundation_skills':
                number = item.fs_number || String(index + 1);
                text = item.skill_description || '';
                description = item.skill_description || '';
                display_type = 'Foundation Skills';
                break;
              
              case 'elements_performance_criteria':
                number = item.epc_number || String(index + 1);
                text = item.performance_criteria || '';
                description = item.element ? `${item.element}: ${item.performance_criteria}` : item.performance_criteria || '';
                display_type = 'Performance Criteria';
                // Extract element and element number
                element = item.element || undefined;
                // Try to extract element number from epc_number (e.g., "1.1" -> element "1")
                if (item.epc_number) {
                  const match = item.epc_number.match(/^(\d+)\./); // Match "1." from "1.1"
                  element_number = match ? match[1] : undefined;
                }
                break;
              
              case 'assessment_conditions':
                number = item.ac_number || String(index + 1);
                text = item.condition_text || '';
                description = item.condition_text || '';
                display_type = 'Assessment Conditions';
                break;
            }

            return {
              id: item.id,
              number,
              text,
              type: table.type,
              display_type,
              description,
              element,
              element_number
            };
          });
          
          allRequirements.push(...requirements);
          console.log(`[Get Requirements] ✓ Fetched ${requirements.length} from ${table.name}`);
        } else {
          console.log(`[Get Requirements] - No requirements in ${table.name}`);
        }
      } catch (error: any) {
        console.error(`[Get Requirements] ✗ Failed to fetch from ${table.name}:`, error.message);
      }
    }

    // Add hard-coded assessment conditions (standard RTO requirements)
    const assessmentConditions: Requirement[] = [
      {
        id: 9000001, // High ID to avoid conflicts
        number: 'AC1',
        text: 'Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment.',
        type: 'assessment_conditions',
        display_type: 'Assessment Conditions',
        description: 'Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment.'
      },
      {
        id: 9000002,
        number: 'AC2',
        text: 'Assessment must satisfy the Principles of Assessment and Rules of Evidence and all regulatory requirements included within the Standards for Registered Training Organisations current at the time of assessment.',
        type: 'assessment_conditions',
        display_type: 'Assessment Conditions',
        description: 'Assessment must satisfy the Principles of Assessment and Rules of Evidence and all regulatory requirements included within the Standards for Registered Training Organisations current at the time of assessment.'
      },
      {
        id: 9000003,
        number: 'AC3',
        text: 'Assessment must occur in workplace operational situations where it is appropriate to do so; where this is not appropriate, assessment must occur in simulated workplace operational situations that replicate workplace conditions.',
        type: 'assessment_conditions',
        display_type: 'Assessment Conditions',
        description: 'Assessment must occur in workplace operational situations where it is appropriate to do so; where this is not appropriate, assessment must occur in simulated workplace operational situations that replicate workplace conditions.'
      },
      {
        id: 9000004,
        number: 'AC4',
        text: 'Assessment processes and techniques must be appropriate to the language, literacy and numeracy requirements of the work being performed and the needs of the candidate.',
        type: 'assessment_conditions',
        display_type: 'Assessment Conditions',
        description: 'Assessment processes and techniques must be appropriate to the language, literacy and numeracy requirements of the work being performed and the needs of the candidate.'
      },
      {
        id: 9000005,
        number: 'AC5',
        text: 'Resources for assessment must include access to: a range of relevant exercises, case studies and/or simulations; relevant and appropriate materials, tools, equipment and PPE currently used in industry; applicable documentation, including legislation, regulations, codes of practice, workplace procedures and operation manuals.',
        type: 'assessment_conditions',
        display_type: 'Assessment Conditions',
        description: 'Resources for assessment must include access to: a range of relevant exercises, case studies and/or simulations; relevant and appropriate materials, tools, equipment and PPE currently used in industry; applicable documentation, including legislation, regulations, codes of practice, workplace procedures and operation manuals.'
      }
    ];

    // Add assessment conditions to all requirements
    allRequirements.push(...assessmentConditions);

    console.log(`[Get Requirements] Total requirements found: ${allRequirements.length} (including ${assessmentConditions.length} standard assessment conditions)`);

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
