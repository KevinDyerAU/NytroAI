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

    const { rtoId, rtoCode: passedRtoCode } = await req.json();
    console.log('║ Parameters:', { rtoId, passedRtoCode });

    if (!rtoId && !passedRtoCode) {
      console.log('║ ERROR: Missing required parameters');
      console.log('╚════════════════════════════════════════════════════════════════════');
      throw new Error('Either rtoId or rtoCode is required');
    }

    // Look up the actual RTO code from the RTO table using rtoId
    let rtoCode = passedRtoCode;
    if (rtoId) {
      const { data: rtoData, error: rtoLookupError } = await supabaseClient
        .from('RTO')
        .select('code')
        .eq('id', rtoId)
        .maybeSingle();

      if (!rtoLookupError && rtoData?.code) {
        rtoCode = rtoData.code;
        console.log(`║ Looked up RTO code from ID ${rtoId}: ${rtoCode}`);
      }
    }
    console.log('║ Using rtoCode:', rtoCode);

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
    // Calculate percentage of "met" requirements from validation_results table
    
    // Get validation IDs for this RTO by joining with validation_summary
    let validationIdsForSuccess: number[] = [];
    if (rtoCode) {
      const { data: validationIds, error: validationIdsError } = await supabaseClient
        .from('validation_detail')
        .select('id, validation_summary!inner(rtoCode)')
        .eq('validation_summary.rtoCode', rtoCode);

      if (validationIdsError) {
        console.error('Error fetching validation IDs for success rate:', validationIdsError);
        throw validationIdsError;
      }

      validationIdsForSuccess = (validationIds || []).map((v: any) => v.id);
      console.log(`║ Found ${validationIdsForSuccess.length} validation_detail IDs for RTO ${rtoCode}`);
    }

    // Count total requirements and met requirements from validation_results table (ALL TIME)
    let allResultsQuery = supabaseClient
      .from('validation_results')
      .select('status');

    if (rtoCode && validationIdsForSuccess.length > 0) {
      allResultsQuery = allResultsQuery.in('validation_detail_id', validationIdsForSuccess);
    } else if (rtoCode && validationIdsForSuccess.length === 0) {
      // No validations for this RTO
      allResultsQuery = allResultsQuery.eq('id', -1);
    }

    const { data: allResults, error: allResultsError } = await allResultsQuery;

    if (allResultsError) {
      console.error('Error fetching all validation results:', allResultsError);
      throw allResultsError;
    }

    console.log(`║ Query returned ${allResults?.length || 0} validation_results records`);
    if (allResults && allResults.length > 0) {
      const statusCounts = allResults.reduce((acc: any, r: any) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      console.log('║ Status breakdown:', statusCounts);
    }

    const totalRequirements = allResults ? allResults.length : 0;
    const metRequirements = allResults ? allResults.filter((r: any) => 
      r.status && r.status.toLowerCase() === 'met'
    ).length : 0;

    const successRate = totalRequirements > 0
      ? (metRequirements / totalRequirements) * 100
      : 0;

    console.log(`║ Success Rate Calculation (All Time): ${metRequirements} met / ${totalRequirements} total = ${successRate.toFixed(1)}%`);

    // Calculate last month's success rate
    let lastMonthSuccessQuery = supabaseClient
      .from('validation_results')
      .select('status, created_at')
      .gte('created_at', startOfLastMonth.toISOString())
      .lte('created_at', endOfLastMonth.toISOString());

    if (rtoCode && validationIdsForSuccess.length > 0) {
      lastMonthSuccessQuery = lastMonthSuccessQuery.in('validation_detail_id', validationIdsForSuccess);
    } else if (rtoCode && validationIdsForSuccess.length === 0) {
      lastMonthSuccessQuery = lastMonthSuccessQuery.eq('id', -1);
    }

    const { data: lastMonthResults, error: lastMonthSuccessError } = await lastMonthSuccessQuery;

    if (lastMonthSuccessError) {
      console.error('Error fetching last month validation results:', lastMonthSuccessError);
      throw lastMonthSuccessError;
    }

    const totalRequirementsLastMonth = lastMonthResults ? lastMonthResults.length : 0;
    const metRequirementsLastMonth = lastMonthResults ? lastMonthResults.filter((r: any) => 
      r.status && r.status.toLowerCase() === 'met'
    ).length : 0;

    const lastMonthSuccessRate = totalRequirementsLastMonth > 0
      ? (metRequirementsLastMonth / totalRequirementsLastMonth) * 100
      : 0;

    const successRateChange = successRate - lastMonthSuccessRate;
    const changeText = successRateChange >= 0
      ? `↑ ${Math.abs(successRateChange).toFixed(1)}% from last month`
      : `↓ ${Math.abs(successRateChange).toFixed(1)}% from last month`;

    // 3. ACTIVE UNITS
    console.log('║ Step 3: Counting active units...');
    // Count total validated units and currently processing (within last 30 days)
    // Note: 48-hour Gemini expiry no longer applies - using 30 days for 'active' threshold
    const activeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Query validation_detail - get all records first
    const { data: activeUnitsData, error: activeUnitsError } = await supabaseClient
      .from('validation_detail')
      .select('id, created_at, validation_status, summary_id');

    if (activeUnitsError) {
      console.error('Error fetching active units:', activeUnitsError);
      throw activeUnitsError;
    }

    console.log(`║ Found ${activeUnitsData?.length || 0} total validation_detail records`);

    // Check for null summary_ids
    const nullSummaryIds = (activeUnitsData || []).filter((v: any) => !v.summary_id);
    console.log(`║ Records with null summary_id: ${nullSummaryIds.length}`);

    // Get validation_summary records to map summary_id to rtoCode
    const { data: summaryData, error: summaryError } = await supabaseClient
      .from('validation_summary')
      .select('id, rtoCode');

    if (summaryError) {
      console.error('Error fetching validation_summary:', summaryError);
      throw summaryError;
    }

    console.log(`║ Found ${summaryData?.length || 0} validation_summary records`);

    // Create a map of summary_id to rtoCode (convert to string for comparison)
    const summaryMap = new Map<number, string>();
    (summaryData || []).forEach((s: any) => {
      summaryMap.set(s.id, String(s.rtoCode));
    });

    // Count how many validation_detail records have matching rtoCode
    const matchingRtoCode = (activeUnitsData || []).filter((v: any) => {
      const summaryRtoCode = summaryMap.get(v.summary_id);
      return summaryRtoCode === String(rtoCode);
    });

    // Count how many have a different rtoCode
    const differentRtoCode = (activeUnitsData || []).filter((v: any) => {
      const summaryRtoCode = summaryMap.get(v.summary_id);
      return summaryRtoCode && summaryRtoCode !== String(rtoCode);
    });

    // Count how many have no mapping
    const noMapping = (activeUnitsData || []).filter((v: any) => {
      return v.summary_id && !summaryMap.has(v.summary_id);
    });

    console.log(`║ Matching rtoCode ${rtoCode}: ${matchingRtoCode.length}`);
    console.log(`║ Different rtoCode: ${differentRtoCode.length}`);
    console.log(`║ No summary mapping: ${noMapping.length}`);

    // Filter by RTO code if provided (compare as strings)
    const filteredUnits = rtoCode 
      ? matchingRtoCode
      : (activeUnitsData || []);

    console.log(`║ After RTO filter: ${filteredUnits.length} records for rtoCode ${rtoCode}`);

    // Total validated units (all validation_detail records for this RTO)
    const totalValidatedUnits = filteredUnits.length;
    
    // Currently processing = within last 30 days AND not finalised
    // Note: 48-hour Gemini expiry removed - validations no longer expire
    const currentlyProcessing = filteredUnits.filter((v: any) => {
      const createdAt = new Date(v.created_at);
      const isActive = createdAt >= activeThreshold;
      const isNotFinalised = v.validation_status !== 'Finalised';
      return isActive && isNotFinalised;
    }).length;

    console.log(`║ Total validated: ${totalValidatedUnits}, Currently processing: ${currentlyProcessing}`);

    // 4. AI QUERIES
    console.log('║ Step 4: Counting AI queries from credit transactions...');
    // Count AI credit consumptions (chat, smart questions, revalidations, validations)
    // from ai_credit_transactions table where amount < 0 (negative = consumption)
    
    // Get RTO ID from code
    let aiQueriesRtoId: number | null = null;
    if (rtoCode) {
      const { data: rtoData, error: rtoError } = await supabaseClient
        .from('RTO')
        .select('id')
        .eq('code', rtoCode)
        .maybeSingle();

      if (rtoError) {
        console.error('Error fetching RTO ID for AI queries:', rtoError);
        // Don't throw - just continue without RTO filtering for AI queries
      }

      aiQueriesRtoId = rtoData?.id || null;
    }

    // Count all-time AI queries (credit consumptions)
    let allTimeQuery = supabaseClient
      .from('ai_credit_transactions')
      .select('id', { count: 'exact' })
      .lt('amount', 0); // Only count consumptions (negative amounts)
    
    if (rtoCode && aiQueriesRtoId) {
      allTimeQuery = allTimeQuery.eq('rto_id', aiQueriesRtoId);
    } else if (rtoCode && !aiQueriesRtoId) {
      allTimeQuery = allTimeQuery.eq('id', -1); // No queries for this RTO
    }

    const { count: totalQueriesAllTime, error: allTimeError } = await allTimeQuery;

    if (allTimeError) {
      console.error('Error fetching all-time AI queries:', allTimeError);
      throw allTimeError;
    }

    console.log(`║ Found ${totalQueriesAllTime || 0} total AI credit consumptions (all time)`);

    // Count this month's AI queries
    let thisMonthAIQuery = supabaseClient
      .from('ai_credit_transactions')
      .select('id', { count: 'exact' })
      .lt('amount', 0) // Only count consumptions
      .gte('created_at', startOfMonth.toISOString());
    
    if (rtoCode && aiQueriesRtoId) {
      thisMonthAIQuery = thisMonthAIQuery.eq('rto_id', aiQueriesRtoId);
    } else if (rtoCode && !aiQueriesRtoId) {
      thisMonthAIQuery = thisMonthAIQuery.eq('id', -1); // No queries for this RTO
    }

    const { count: totalQueriesThisMonth, error: thisMonthAIError } = await thisMonthAIQuery;

    if (thisMonthAIError) {
      console.error('Error fetching this month AI queries:', thisMonthAIError);
      throw thisMonthAIError;
    }

    console.log(`║ Found ${totalQueriesThisMonth || 0} AI credit consumptions this month`);

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
        count: totalValidatedUnits || 0,
        status: `${currentlyProcessing} currently processing`,
      },
      aiQueries: {
        count: totalQueriesThisMonth || 0,
        period: `${(totalQueriesThisMonth || 0).toLocaleString()} this month / ${(totalQueriesAllTime || 0).toLocaleString()} all time`,
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
