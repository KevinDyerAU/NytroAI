import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

interface ValidationCreditsResponse {
  current: number;
  total: number;
  percentage: number;
  percentageText: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { rtoId } = await req.json();

    if (!rtoId) {
      throw new Error('rtoId is required');
    }

    // Query credit_transactions table and calculate balance
    const { data, error } = await supabaseClient
      .from('credit_transactions')
      .select('amount, transaction_type')
      .eq('rto_id', rtoId);

    if (error) {
      console.error('Error fetching credit transactions:', error);
      throw error;
    }

    // Calculate total allocations and consumptions
    const allocations = (data || [])
      .filter(tx => tx.transaction_type === 'allocation')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const consumptions = Math.abs((data || [])
      .filter(tx => tx.transaction_type === 'consumption')
      .reduce((sum, tx) => sum + tx.amount, 0));

    const current = allocations - consumptions;
    const total = allocations;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    const percentageText = `${percentage}% Remaining`;

    const response: ValidationCreditsResponse = {
      current,
      total,
      percentage,
      percentageText,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in get-validation-credits:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
