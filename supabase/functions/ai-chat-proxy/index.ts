/**
 * AI Chat Proxy Edge Function
 * 
 * Proxies AI chat requests to n8n webhook to avoid CORS issues.
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
    const n8nUrl = Deno.env.get('N8N_AI_CHAT_URL') || 'https://n8n-gtoa.onrender.com/webhook/chat';
    
    console.log('[ai-chat-proxy] Proxying request to n8n:', n8nUrl);

    // Get request body
    const body = await req.json();
    console.log('[ai-chat-proxy] Request payload:', {
      validation_detail_id: body.validation_detail_id,
      messageLength: body.message?.length,
      historyLength: body.conversation_history?.length,
    });

    // Forward to n8n
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('[ai-chat-proxy] n8n response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ai-chat-proxy] n8n error:', errorText);
      throw new Error(`n8n request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[ai-chat-proxy] Raw n8n response:', data);

    // Check if this is a Gemini API response (from n8n)
    if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
      const geminiResponse = data.candidates[0]?.content?.parts?.[0]?.text;
      
      if (geminiResponse) {
        console.log('[ai-chat-proxy] Extracted Gemini response:', geminiResponse.substring(0, 100) + '...');
        
        // Transform to expected format
        const transformedData = {
          success: true,
          response: geminiResponse,
          metadata: {
            usageMetadata: data.usageMetadata,
            modelVersion: data.modelVersion,
          }
        };
        
        return new Response(
          JSON.stringify(transformedData),
          { 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json' 
            } 
          }
        );
      }
    }

    // If it's already in the expected format, return as-is
    console.log('[ai-chat-proxy] n8n response received:', {
      success: data.success,
      hasResponse: !!data.response,
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
    console.error('[ai-chat-proxy] Error:', error);
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
