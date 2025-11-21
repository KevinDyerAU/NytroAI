import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

interface DashboardMetrics {
  totalValidations: {
    count: number;
    monthlyChange: number;
    monthlyGrowth: string;
  };
  successRate: {
    rate: number;
    change: number;
    changeText: string;
  };
  activeUnits: {
    count: number;
    status: string;
  };
  aiQueries: {
    count: number;
    period: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log('║ GET DASHBOARD METRICS - START');
    console.log('╠════════════════════════════════════════════════════════════════════');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { rtoId, rtoCode } = await req.json();
    console.log('║ Parameters:', { rtoId, rtoCode });

    if (!rtoId && !rtoCode) {
      console.log('║ ERROR: Missing required parameters');
      console.log('╚════════════════════════════════════════════════════════════════════');
      throw new Error('Either rtoId or rtoCode is required');
    }

    // Get current date boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // 1. TOTAL VALIDATIONS
    console.log('║ Step 1: Fetching total validations...');
    // Count all validations for this RTO
    let validationQuery = supabaseClient
      .from('validation_summary')
      .select('id', { count: 'exact' });

    if (rtoCode) {
      validationQuery = validationQuery.eq('rtoCode', rtoCode);
    }

    const { count: totalCount, error: totalError } = await validationQuery;

    if (totalError) {
      console.error('Error fetching total validations:', totalError);
      throw totalError;
    }

    // Count validations this month
    let thisMonthQuery = supabaseClient
      .from('validation_summary')
      .select('id', { count: 'exact' })
      .gte('created_at', startOfMonth.toISOString());

    if (rtoCode) {
      thisMonthQuery = thisMonthQuery.eq('rtoCode', rtoCode);
    }

    const { count: thisMonthCount, error: thisMonthError } = await thisMonthQuery;

    if (thisMonthError) {
      console.error('Error fetching this month validations:', thisMonthError);
      throw thisMonthError;
    }

    // Count validations last month
    let lastMonthQuery = supabaseClient
      .from('validation_summary')
      .select('id', { count: 'exact' })
      .gte('created_at', startOfLastMonth.toISOString())
      .lte('created_at', endOfLastMonth.toISOString());

    if (rtoCode) {
      lastMonthQuery = lastMonthQuery.eq('rtoCode', rtoCode);
    }

    const { count: lastMonthCount, error: lastMonthError } = await lastMonthQuery;

    if (lastMonthError) {
      console.error('Error fetching last month validations:', lastMonthError);
      throw lastMonthError;
    }

    const monthlyChange = (thisMonthCount || 0) - (lastMonthCount || 0);
    const monthlyGrowth = monthlyChange >= 0 
      ? `+${monthlyChange} this month` 
      : `${monthlyChange} this month`;

    // 2. SUCCESS RATE
    console.log('║ Step 2: Calculating success rate...');
    // Calculate percentage of "met" requirements across all validation results
    // Query all validation result tables to get met vs total requirements
    
    // Get validation IDs for this RTO if needed
    let validationIdsForSuccess: number[] = [];
    if (rtoCode) {
      const { data: validationIds, error: validationIdsError } = await supabaseClient
        .from('validation_detail')
        .select('id')
        .eq('namespace_code', rtoCode);

      if (validationIdsError) {
        console.error('Error fetching validation IDs for success rate:', validationIdsError);
        throw validationIdsError;
      }

      validationIdsForSuccess = (validationIds || []).map((v: any) => v.id);
    }

    // Count total requirements and met requirements from all validation tables
    const validationTables = [
      'knowledge_evidence_validations',
      'performance_evidence_validations',
      'foundation_skills_validations'
    ];

    let totalRequirements = 0;
    let metRequirements = 0;

    for (const table of validationTables) {
      let query = supabaseClient
        .from(table)
        .select('status');

      if (rtoCode && validationIdsForSuccess.length > 0) {
        query = query.in('valDetail_id', validationIdsForSuccess);
      } else if (rtoCode && validationIdsForSuccess.length === 0) {
        continue; // No validations for this RTO
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        continue; // Skip this table on error
      }

      if (data && data.length > 0) {
        totalRequirements += data.length;
        metRequirements += data.filter((r: any) => r.status === 'met').length;
      }
    }

    const successRate = totalRequirements > 0
      ? (metRequirements / totalRequirements) * 100
      : 0;

    // Calculate last month's success rate
    let totalRequirementsLastMonth = 0;
    let metRequirementsLastMonth = 0;

    for (const table of validationTables) {
      let query = supabaseClient
        .from(table)
        .select('status, created_at')
        .gte('created_at', startOfLastMonth.toISOString())
        .lte('created_at', endOfLastMonth.toISOString());

      if (rtoCode && validationIdsForSuccess.length > 0) {
        query = query.in('valDetail_id', validationIdsForSuccess);
      } else if (rtoCode && validationIdsForSuccess.length === 0) {
        continue;
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching last month ${table}:`, error);
        continue;
      }

      if (data && data.length > 0) {
        totalRequirementsLastMonth += data.length;
        metRequirementsLastMonth += data.filter((r: any) => r.status === 'met').length;
      }
    }

    const lastMonthSuccessRate = totalRequirementsLastMonth > 0
      ? (metRequirementsLastMonth / totalRequirementsLastMonth) * 100
      : 0;

    const successRateChange = successRate - lastMonthSuccessRate;
    const changeText = successRateChange >= 0
      ? `↑ ${Math.abs(successRateChange).toFixed(1)}% from last month`
      : `↓ ${Math.abs(successRateChange).toFixed(1)}% from last month`;

    // 3. ACTIVE UNITS
    console.log('║ Step 3: Counting active units...');
    // Count validations NOT in report stage (report stage = numOfReq === reqTotal and reqTotal > 0)
    // Join with validation_summary to get reqTotal
    let activeUnitsQuery = supabaseClient
      .from('validation_detail')
      .select(`
        id,
        numOfReq,
        validation_summary!inner(
          reqTotal
        )
      `);

    if (rtoCode) {
      activeUnitsQuery = activeUnitsQuery.eq('validation_summary.rtoCode', rtoCode);
    }

    const { data: activeUnitsData, error: activeUnitsError } = await activeUnitsQuery;

    if (activeUnitsError) {
      console.error('Error fetching active units:', activeUnitsError);
      throw activeUnitsError;
    }

    // Filter to only include validations NOT in report stage
    const activeUnitsCount = (activeUnitsData || []).filter((v: any) => {
      const reqTotal = v.validation_summary?.reqTotal;
      return v.numOfReq < reqTotal || reqTotal === 0 || reqTotal === null;
    }).length;

    // 4. AI QUERIES
    console.log('║ Step 4: Counting AI queries...');
    // Count total AI queries (all time) and this month from gemini_operations
    
    // Get validation IDs for this RTO if needed
    let validationIdsForAI: number[] = [];
    if (rtoCode) {
      const { data: validationIds, error: validationIdsError } = await supabaseClient
        .from('validation_detail')
        .select('id')
        .eq('namespace_code', rtoCode);

      if (validationIdsError) {
        console.error('Error fetching validation IDs for AI queries:', validationIdsError);
        throw validationIdsError;
      }

      validationIdsForAI = (validationIds || []).map((v: any) => v.id);
    }

    // Count all-time AI queries
    let allTimeQuery = supabaseClient
      .from('gemini_operations')
      .select('id', { count: 'exact' });
    
    if (rtoCode && validationIdsForAI.length > 0) {
      allTimeQuery = allTimeQuery.in('validation_detail_id', validationIdsForAI);
    } else if (rtoCode && validationIdsForAI.length === 0) {
      allTimeQuery = allTimeQuery.eq('id', -1); // No queries for this RTO
    }

    const { count: totalQueriesAllTime, error: allTimeError } = await allTimeQuery;

    if (allTimeError) {
      console.error('Error fetching all-time AI queries:', allTimeError);
      throw allTimeError;
    }

    // Count this month's AI queries
    let thisMonthAIQuery = supabaseClient
      .from('gemini_operations')
      .select('id', { count: 'exact' })
      .gte('created_at', startOfMonth.toISOString());
    
    if (rtoCode && validationIdsForAI.length > 0) {
      thisMonthAIQuery = thisMonthAIQuery.in('validation_detail_id', validationIdsForAI);
    } else if (rtoCode && validationIdsForAI.length === 0) {
      thisMonthAIQuery = thisMonthAIQuery.eq('id', -1); // No queries for this RTO
    }

    const { count: totalQueriesThisMonth, error: thisMonthAIError } = await thisMonthAIQuery;

    if (thisMonthAIError) {
      console.error('Error fetching this month AI queries:', thisMonthAIError);
      throw thisMonthAIError;
    }

    console.log('║ Step 5: Building metrics response...');
    const metrics: DashboardMetrics = {
      totalValidations: {
        count: totalCount || 0,
        monthlyChange,
        monthlyGrowth,
      },
      successRate: {
        rate: Math.round(successRate * 10) / 10, // Round to 1 decimal
        change: Math.round(successRateChange * 10) / 10,
        changeText,
      },
      activeUnits: {
        count: activeUnitsCount || 0,
        status: 'Currently processing',
      },
      aiQueries: {
        count: totalQueriesThisMonth,
        period: `${totalQueriesThisMonth.toLocaleString()} this month / ${totalQueriesAllTime.toLocaleString()} all time`,
      },
    };

    console.log('║ SUCCESS: Metrics calculated successfully');
    console.log('║ Metrics:', JSON.stringify(metrics, null, 2));
    console.log('╚════════════════════════════════════════════════════════════════════');
    
    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('╔════════════════════════════════════════════════════════════════════');
    console.error('║ ERROR in get-dashboard-metrics');
    console.error('╠════════════════════════════════════════════════════════════════════');
    console.error('║ Error:', error);
    console.error('║ Message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('║ Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('╚════════════════════════════════════════════════════════════════════');
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
