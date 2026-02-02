/**
 * Trigger Validation Unified - Full Implementation
 * Processes all requirements using Azure Document Intelligence + Azure OpenAI
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, corsHeaders } from '../_shared/cors.ts';
import { fetchRequirements } from '../_shared/requirements-fetcher.ts';
import { getAIProviderConfig } from '../_shared/ai-provider.ts';
import { createDefaultAzureDocIntelClient } from '../_shared/azure-document-intelligence.ts';
import { validateRequirementUnified } from '../_shared/unified-validator.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const startTime = Date.now();

  try {
    const supabase = createSupabaseClient(req);
    const config = getAIProviderConfig();
    const { validationDetailId } = await req.json();

    if (!validationDetailId) {
      return createErrorResponse('Missing validationDetailId', 400);
    }

    console.log(`[Trigger Validation] Starting. Provider: ${config.provider}, ID: ${validationDetailId}`);

    // 1. Fetch validation detail
    const { data: detail, error: detailError } = await supabase
      .from('validation_detail')
      .select(`id, document_type, validation_summary!inner (unitCode, unitLink)`)
      .eq('id', validationDetailId)
      .single();

    if (detailError) {
      return createErrorResponse(`Validation not found: ${detailError.message}`, 404);
    }

    const unitCode = detail.validation_summary.unitCode;
    const unitLink = detail.validation_summary.unitLink;
    const documentType = (detail.document_type || 'unit') as 'unit' | 'learner_guide';

    // 2. Fetch requirements
    const requirements = await fetchRequirements(supabase, unitCode, 'full_validation', unitLink);
    if (!requirements?.length) {
      return createErrorResponse(`No requirements found for ${unitCode}`, 400);
    }
    console.log(`[Trigger Validation] Found ${requirements.length} requirements`);

    // 3. Fetch and extract documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, file_name, storage_path')
      .eq('validation_detail_id', validationDetailId);

    if (!documents?.length) {
      return createErrorResponse('No documents found', 404);
    }

    const docIntelClient = createDefaultAzureDocIntelClient();
    let allContent = '';

    for (const doc of documents) {
      // Check if we already have extracted content for this document
      const { data: existingElements } = await supabase
        .from('elements')
        .select('text, page_number')
        .eq('filename', doc.file_name)
        .eq('record_id', `doc-${doc.id}`)
        .order('page_number', { ascending: true });

      if (existingElements && existingElements.length > 0) {
        // Use cached extraction
        console.log(`[Trigger Validation] Using cached extraction for ${doc.file_name}: ${existingElements.length} elements`);
        const cachedContent = existingElements.map(e => e.text).join('\n');
        allContent += `\n=== ${doc.file_name} ===\n${cachedContent}\n`;
      } else {
        // Extract and save to elements table
        const { data: fileData } = await supabase.storage.from('documents').download(doc.storage_path);
        if (fileData) {
          try {
            const fileBytes = new Uint8Array(await fileData.arrayBuffer());
            const extracted = await docIntelClient.extractDocument(fileBytes);
            
            // Save paragraphs to elements table with page numbers
            if (extracted.paragraphs && extracted.paragraphs.length > 0) {
              const elementsToInsert = extracted.paragraphs.map((para, idx) => ({
                id: crypto.randomUUID(),
                element_id: `${doc.id}-p${idx}`,
                text: para.content,
                page_number: para.pageNumber || 1,
                filename: doc.file_name,
                record_id: `doc-${doc.id}`,
                type: para.role || 'paragraph',
                filetype: 'pdf'
              }));

              const { error: insertError } = await supabase
                .from('elements')
                .insert(elementsToInsert);

              if (insertError) {
                console.error(`[Trigger Validation] Failed to save elements for ${doc.file_name}:`, insertError.message);
              } else {
                console.log(`[Trigger Validation] Saved ${elementsToInsert.length} elements for ${doc.file_name}`);
              }
            }

            // Also save full extracted content to documents table
            await supabase
              .from('documents')
              .update({ extracted_content: extracted.content })
              .eq('id', doc.id);

            allContent += `\n=== ${doc.file_name} ===\n${extracted.content}\n`;
          } catch (err) {
            console.error(`Extraction failed: ${doc.file_name}`, err);
          }
        }
      }
    }

    if (!allContent) {
      return createErrorResponse('Failed to extract document content', 500);
    }
    console.log(`[Trigger Validation] Extracted ${allContent.length} chars from ${documents.length} docs`);

    // 4. Update status to processing
    await supabase
      .from('validation_detail')
      .update({ validation_status: 'processing', validation_total: requirements.length, validation_count: 0 })
      .eq('id', validationDetailId);

    // 5. Process each requirement with delays to avoid rate limits
    let successCount = 0;
    let failCount = 0;
    const statusCounts: Record<string, number> = {};
    const DELAY_BETWEEN_CALLS_MS = 15000; // 15 second delay - S0 tier has strict rate limits

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < requirements.length; i++) {
      const req = requirements[i];
      console.log(`[Trigger Validation] ${i + 1}/${requirements.length}: ${req.type} ${req.number}`);

      // Add delay between calls to avoid 429 rate limits (skip first call)
      if (i > 0) {
        console.log(`[Trigger Validation] Waiting ${DELAY_BETWEEN_CALLS_MS}ms before next call...`);
        await sleep(DELAY_BETWEEN_CALLS_MS);
      }

      // Smart element retrieval - search for content related to this requirement
      let relevantContent = '';
      const reqNum = req.number || '';
      const reqText = req.text || '';
      const keywords = reqText.split(' ').filter((w: string) => w.length > 5).slice(0, 3);
      
      // Build record_ids from documents
      const docRecordIds = documents.map((d: any) => `doc-${d.id}`);
      
      // Search elements for requirement number or keywords
      const { data: matchedElements } = await supabase
        .from('elements')
        .select('text, page_number, filename')
        .in('record_id', docRecordIds)
        .or(`text.ilike.%${reqNum}%,text.ilike.%${keywords[0] || reqNum}%`)
        .order('page_number', { ascending: true })
        .limit(30);

      if (matchedElements && matchedElements.length > 0) {
        console.log(`[Trigger Validation] Found ${matchedElements.length} relevant elements for ${reqNum}`);
        relevantContent = matchedElements.map((e: any) => `[Page ${e.page_number}] ${e.text}`).join('\n\n');
      }

      try {
        const result = await validateRequirementUnified({
          requirement: {
            id: req.id,
            requirement_number: req.number || '',
            requirement_text: req.text || '',
            requirement_type: req.type
          },
          documentContent: relevantContent || allContent.slice(0, 30000), // Use relevant content or fallback to 30K
          documentType,
          unitCode,
          validationDetailId,
          supabase
        });

        // Save result
        const { error: insertError } = await supabase.from('validation_results').insert({
          validation_detail_id: validationDetailId,
          status: result.status,
          reasoning: result.reasoning,
          mapped_content: result.mappedContent,
          citations: result.citations,
          doc_references: result.citations,
          smart_questions: result.smartQuestions,
          benchmark_answer: result.benchmarkAnswer,
          requirement_type: req.type,
          requirement_number: req.number || '',
          requirement_text: req.text || '',
          document_type: documentType,
          recommendations: result.recommendations
        });

        if (insertError) {
          console.error(`Insert failed for ${req.number}:`, insertError.message);
          failCount++;
        } else {
          statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
          successCount++;
        }
      } catch (err: any) {
        console.error(`Error on ${req.number}:`, err.message);
        failCount++;
      }

      // Update progress
      await supabase
        .from('validation_detail')
        .update({ validation_count: i + 1, validation_progress: Math.round(((i + 1) / requirements.length) * 100) })
        .eq('id', validationDetailId);
    }

    // 6. Final status
    await supabase
      .from('validation_detail')
      .update({ validation_status: failCount === 0 ? 'completed' : 'partial', validation_progress: 100 })
      .eq('id', validationDetailId);

    const elapsed = Date.now() - startTime;
    console.log(`[Trigger Validation] Complete. Success: ${successCount}, Failed: ${failCount}, Time: ${elapsed}ms`);

    return new Response(JSON.stringify({
      success: true,
      provider: config.provider,
      validationDetailId,
      totalRequirements: requirements.length,
      successfulValidations: successCount,
      failedValidations: failCount,
      statusDistribution: statusCounts,
      elapsedMs: elapsed
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Trigger Validation] Error:', error);
    return createErrorResponse(error.message || 'Unknown error', 500);
  }
});
