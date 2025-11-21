import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[fetch-units-of-competency] Fetching units...');

    const { data, error } = await supabase
      .from('UnitOfCompetency')
      .select('id, unitCode, Title')
      .order('unitCode', { ascending: true });

    if (error) {
      console.error('[fetch-units-of-competency] Error:', error);
      throw new Error(`Failed to fetch units: ${error.message}`);
    }

    console.log(`[fetch-units-of-competency] Successfully fetched ${data?.length || 0} units`);

    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[fetch-units-of-competency] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        data: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
