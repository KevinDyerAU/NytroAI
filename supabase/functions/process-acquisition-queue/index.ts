import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * process-acquisition-queue
 * 
 * Called by the n8n scheduled workflow to:
 * 1. Fetch pending/retry items from the acquisition queue
 * 2. Process each item by calling the scrape-training-gov-au function
 * 3. Update queue status and UnitOfCompetency completeness flags
 * 
 * This edge function acts as the orchestrator between n8n and the scraper,
 * keeping all queue state management server-side for reliability.
 */

interface QueueItem {
  id: number;
  unit_code: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_history: Array<{ timestamp: string; error: string; retry_count: number }>;
  sections_captured: {
    ke: boolean;
    pe: boolean;
    fs: boolean;
    epc: boolean;
    ac: boolean;
  };
}

interface ProcessResult {
  queue_id: number;
  unit_code: string;
  success: boolean;
  status: string;
  sections_captured: Record<string, boolean>;
  error?: string;
  next_retry_at?: string;
}

// Exponential backoff intervals in minutes: 5, 15, 30, 60, 120
const BACKOFF_MINUTES = [5, 15, 30, 60, 120];

function calculateNextRetryAt(retryCount: number): string {
  const minutes = BACKOFF_MINUTES[Math.min(retryCount, BACKOFF_MINUTES.length - 1)];
  const nextRetry = new Date(Date.now() + minutes * 60 * 1000);
  return nextRetry.toISOString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 5;
    const action = body.action || 'process'; // 'process' | 'fetch' | 'update_status'

    // Initialize Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Action: fetch ──────────────────────────────────────────────────
    // Returns pending queue items for n8n to process
    if (action === 'fetch') {
      const { data: items, error: fetchError } = await supabase
        .from('unit_acquisition_queue')
        .select('*')
        .in('status', ['queued', 'retry'])
        .or('next_retry_at.is.null,next_retry_at.lte.now()')
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (fetchError) {
        console.error('[ProcessQueue] Fetch error:', fetchError);
        return new Response(
          JSON.stringify({ error: fetchError.message, items: [] }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          count: items?.length || 0,
          items: items || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Action: update_status ──────────────────────────────────────────
    // Called by n8n after processing each item to update its status
    if (action === 'update_status') {
      const { queue_id, status, error: errorMsg, sections_captured } = body;

      if (!queue_id || !status) {
        return new Response(
          JSON.stringify({ error: 'queue_id and status are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch current queue item
      const { data: currentItem, error: getError } = await supabase
        .from('unit_acquisition_queue')
        .select('*')
        .eq('id', queue_id)
        .single();

      if (getError || !currentItem) {
        return new Response(
          JSON.stringify({ error: `Queue item ${queue_id} not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, any> = { status };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.last_error = null;
        updateData.next_retry_at = null;
        if (sections_captured) {
          updateData.sections_captured = sections_captured;
        }
      } else if (status === 'in_progress') {
        // Just mark as in progress
      } else if (status === 'retry' || status === 'failed') {
        const newRetryCount = currentItem.retry_count + 1;
        const errorEntry = {
          timestamp: new Date().toISOString(),
          error: errorMsg || 'Unknown error',
          retry_count: currentItem.retry_count,
        };
        const errorHistory = [...(currentItem.error_history || []), errorEntry];

        if (newRetryCount >= currentItem.max_retries) {
          // Exceeded max retries — mark as failed
          updateData.status = 'failed';
          updateData.retry_count = newRetryCount;
          updateData.last_error = errorMsg || 'Max retries exceeded';
          updateData.error_history = errorHistory;
          updateData.next_retry_at = null;
        } else {
          // Schedule next retry with exponential backoff
          updateData.status = 'retry';
          updateData.retry_count = newRetryCount;
          updateData.last_error = errorMsg || 'Scrape failed';
          updateData.error_history = errorHistory;
          updateData.next_retry_at = calculateNextRetryAt(newRetryCount);
        }

        if (sections_captured) {
          updateData.sections_captured = sections_captured;
        }
      } else if (status === 'partial_success') {
        updateData.last_error = errorMsg || 'Partial sections captured';
        if (sections_captured) {
          updateData.sections_captured = sections_captured;
        }
      }

      const { error: updateError } = await supabase
        .from('unit_acquisition_queue')
        .update(updateData)
        .eq('id', queue_id);

      if (updateError) {
        console.error('[ProcessQueue] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If completed, also update UnitOfCompetency completeness flags
      if (status === 'completed' || status === 'partial_success') {
        await updateCompletenessFlags(supabase, currentItem.unit_code);
      }

      return new Response(
        JSON.stringify({
          success: true,
          queue_id,
          status: updateData.status,
          next_retry_at: updateData.next_retry_at || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Action: process (default) ──────────────────────────────────────
    // Full processing: fetch items, scrape each, update statuses
    // This is the all-in-one mode for simpler n8n workflows
    const { data: items, error: fetchError } = await supabase
      .from('unit_acquisition_queue')
      .select('*')
      .in('status', ['queued', 'retry'])
      .or('next_retry_at.is.null,next_retry_at.lte.now()')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('[ProcessQueue] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No items to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ProcessQueue] Processing ${items.length} queue items`);

    const results: ProcessResult[] = [];

    for (const item of items as QueueItem[]) {
      console.log(`[ProcessQueue] Processing item ${item.id}: ${item.unit_code}`);

      // Mark as in_progress
      await supabase
        .from('unit_acquisition_queue')
        .update({ status: 'in_progress' })
        .eq('id', item.id);

      try {
        // Call the existing scrape-training-gov-au edge function internally
        const scrapeUrl = `${supabaseUrl}/functions/v1/scrape-training-gov-au`;
        const scrapeResponse = await fetch(scrapeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            unitCode: item.unit_code,
          }),
        });

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text().catch(() => 'Unknown error');
          throw new Error(`Scrape failed (${scrapeResponse.status}): ${errorText}`);
        }

        const scrapeResult = await scrapeResponse.json();

        // Determine which sections were captured
        const sectionsCaptured = {
          ke: scrapeResult.data?.knowledgeEvidence?.length > 0,
          pe: scrapeResult.data?.performanceEvidence?.length > 0,
          fs: scrapeResult.data?.foundationSkills?.length > 0,
          epc: scrapeResult.data?.elements?.length > 0,
          ac: scrapeResult.data?.assessmentConditions?.length > 0,
        };

        const allCaptured = Object.values(sectionsCaptured).every(v => v);
        const anyCaptured = Object.values(sectionsCaptured).some(v => v);

        if (allCaptured) {
          // Full success
          await supabase
            .from('unit_acquisition_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error: null,
              next_retry_at: null,
              sections_captured: sectionsCaptured,
            })
            .eq('id', item.id);

          results.push({
            queue_id: item.id,
            unit_code: item.unit_code,
            success: true,
            status: 'completed',
            sections_captured: sectionsCaptured,
          });
        } else if (anyCaptured) {
          // Partial success — some sections captured
          const missingSections = Object.entries(sectionsCaptured)
            .filter(([, v]) => !v)
            .map(([k]) => k);

          await supabase
            .from('unit_acquisition_queue')
            .update({
              status: 'partial_success',
              last_error: `Missing sections: ${missingSections.join(', ')}`,
              sections_captured: sectionsCaptured,
            })
            .eq('id', item.id);

          results.push({
            queue_id: item.id,
            unit_code: item.unit_code,
            success: true,
            status: 'partial_success',
            sections_captured: sectionsCaptured,
            error: `Missing: ${missingSections.join(', ')}`,
          });
        } else {
          throw new Error('No sections captured from scrape response');
        }

        // Update UnitOfCompetency completeness flags
        await updateCompletenessFlags(supabase, item.unit_code);

      } catch (error: any) {
        console.error(`[ProcessQueue] Error processing ${item.unit_code}:`, error.message);

        const newRetryCount = item.retry_count + 1;
        const errorEntry = {
          timestamp: new Date().toISOString(),
          error: error.message,
          retry_count: item.retry_count,
        };
        const errorHistory = [...(item.error_history || []), errorEntry];

        if (newRetryCount >= item.max_retries) {
          // Max retries exceeded
          await supabase
            .from('unit_acquisition_queue')
            .update({
              status: 'failed',
              retry_count: newRetryCount,
              last_error: error.message,
              error_history: errorHistory,
              next_retry_at: null,
            })
            .eq('id', item.id);

          results.push({
            queue_id: item.id,
            unit_code: item.unit_code,
            success: false,
            status: 'failed',
            sections_captured: item.sections_captured,
            error: `Max retries exceeded: ${error.message}`,
          });
        } else {
          // Schedule retry with exponential backoff
          const nextRetryAt = calculateNextRetryAt(newRetryCount);

          await supabase
            .from('unit_acquisition_queue')
            .update({
              status: 'retry',
              retry_count: newRetryCount,
              last_error: error.message,
              error_history: errorHistory,
              next_retry_at: nextRetryAt,
            })
            .eq('id', item.id);

          results.push({
            queue_id: item.id,
            unit_code: item.unit_code,
            success: false,
            status: 'retry',
            sections_captured: item.sections_captured,
            error: error.message,
            next_retry_at: nextRetryAt,
          });
        }

        // Update UnitOfCompetency error status
        await supabase
          .from('UnitOfCompetency')
          .update({
            acquisition_status: 'error',
            last_acquisition_error: error.message,
          })
          .eq('unitCode', item.unit_code);
      }

      // Small delay between items to be respectful to train.gov.au
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const summary = {
      success: true,
      processed: results.length,
      completed: results.filter(r => r.status === 'completed').length,
      partial: results.filter(r => r.status === 'partial_success').length,
      retrying: results.filter(r => r.status === 'retry').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    };

    console.log('[ProcessQueue] Summary:', JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ProcessQueue] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Update the completeness flags on UnitOfCompetency based on
 * what's actually in the requirement tables.
 */
async function updateCompletenessFlags(supabase: any, unitCode: string) {
  try {
    // Get the unit's Link (URL) and text columns (ac, fs) for completeness check
    const { data: unit, error: unitError } = await supabase
      .from('UnitOfCompetency')
      .select('id, "Link", unitCode, ac, fs, ke, pe, epc')
      .eq('unitCode', unitCode)
      .single();

    if (unitError || !unit) {
      console.error(`[ProcessQueue] Unit not found for code: ${unitCode}`);
      return;
    }

    const unitUrl = unit.Link;

    // Check dedicated requirement tables for structured data
    const [keResult, peResult, fsResult, epcResult, acResult] = await Promise.all([
      supabase.from('knowledge_evidence_requirements').select('id', { count: 'exact', head: true }).eq('unit_url', unitUrl),
      supabase.from('performance_evidence_requirements').select('id', { count: 'exact', head: true }).eq('unit_url', unitUrl),
      supabase.from('foundation_skills_requirements').select('id', { count: 'exact', head: true }).eq('unit_url', unitUrl),
      supabase.from('elements_performance_criteria_requirements').select('id', { count: 'exact', head: true }).eq('unit_url', unitUrl),
      supabase.from('assessment_conditions_requirements').select('id', { count: 'exact', head: true }).eq('unit_url', unitUrl),
    ]);

    // Check BOTH the dedicated tables AND the UnitOfCompetency text columns
    // The text columns (ac, fs, ke, pe, epc) are populated by the scraper and used by the validation engine
    // The dedicated tables may not always be populated (e.g., assessment_conditions, foundation_skills)
    const hasKE = (keResult.count || 0) > 0 || (unit.ke && unit.ke.trim().length > 0);
    const hasPE = (peResult.count || 0) > 0 || (unit.pe && unit.pe.trim().length > 0);
    const hasFS = (fsResult.count || 0) > 0 || (unit.fs && unit.fs.trim().length > 0);
    const hasEPC = (epcResult.count || 0) > 0 || (unit.epc && unit.epc.trim().length > 0);
    const hasAC = (acResult.count || 0) > 0 || (unit.ac && unit.ac.trim().length > 0);

    const allComplete = hasKE && hasPE && hasFS && hasEPC && hasAC;
    const anyPartial = hasKE || hasPE || hasFS || hasEPC || hasAC;

    const acquisitionStatus = allComplete ? 'complete' : anyPartial ? 'partial' : 'pending';

    await supabase
      .from('UnitOfCompetency')
      .update({
        has_knowledge_evidence: hasKE,
        has_performance_evidence: hasPE,
        has_foundation_skills: hasFS,
        has_elements_performance_criteria: hasEPC,
        has_assessment_conditions: hasAC,
        acquisition_status: acquisitionStatus,
        last_acquired_at: new Date().toISOString(),
        last_acquisition_error: null,
      })
      .eq('unitCode', unitCode);

    console.log(`[ProcessQueue] Updated completeness for ${unitCode}: ${acquisitionStatus} (KE:${hasKE} PE:${hasPE} FS:${hasFS} EPC:${hasEPC} AC:${hasAC})`);
  } catch (error: any) {
    console.error(`[ProcessQueue] Error updating completeness for ${unitCode}:`, error.message);
  }
}
