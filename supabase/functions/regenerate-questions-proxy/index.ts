/**
 * Regenerate Questions Proxy Edge Function
 * 
 * Proxies regenerate questions requests to n8n webhook to avoid CORS issues.
 * Frontend → Supabase Edge Function → n8n (no CORS)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get n8n URL from Supabase env secret or use fallback
    // Set N8N_REGENERATE_QUESTIONS_URL in Supabase Edge Function secrets to override
    const n8nUrl = Deno.env.get('N8N_REGENERATE_QUESTIONS_URL') || 'https://n8n-gtoa.onrender.com/webhook/regenerate-questions';
    
    console.log('[regenerate-questions-proxy] Proxying request to n8n:', n8nUrl);

    // Get request body
    const body = await req.json();
    console.log('[regenerate-questions-proxy] Request payload:', {
      validation_result_id: body.validation_result_id,
      userGuidanceLength: body.user_guidance?.length,
    });

    // Forward to n8n
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[regenerate-questions-proxy] n8n response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[regenerate-questions-proxy] n8n error:', errorText);
      throw new Error(`n8n request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[regenerate-questions-proxy] Response received:', {
      success: data.success,
      questionCount: data.questions?.length,
    });

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('[regenerate-questions-proxy] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
