import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export function createSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    console.error('[createSupabaseClient] SUPABASE_URL environment variable is not set');
    throw new Error('SUPABASE_URL environment variable is not set');
  }

  if (!supabaseServiceKey) {
    console.error('[createSupabaseClient] SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }

  console.log('[createSupabaseClient] Creating client with URL:', supabaseUrl.substring(0, 30) + '...');

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getRTOByCode(supabase: any, rtoCode: string) {
  const { data, error } = await supabase
    .from('RTO')
    .select('id, code, legalname')
    .eq('code', rtoCode)
    .single();

  if (error) {
    throw new Error(`RTO not found: ${error.message}`);
  }

  return data;
}

export async function addAICreditsToRTO(
  supabase: any,
  rtoCode: string,
  credits: number,
  reason: string
) {
  const { data, error } = await supabase.rpc('add_ai_credits', {
    rto_code: rtoCode,
    amount: credits,
    reason: reason,
  });

  if (error) {
    throw new Error(`Failed to add AI credits: ${error.message}`);
  }

  return data;
}
