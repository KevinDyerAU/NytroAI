/**
 * Generate Validation Report Edge Function
 * 
 * Generates formatted Excel validation reports from validation data
 * Supports both Unit Validation and Learner Guide reports
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

// Note: Excel generation in Deno requires external libraries
// We'll use a simpler approach: generate CSV or use a service
// For production, consider using a Python service or external API

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get request body
    const { validationId, reportType } = await req.json();

    if (!validationId) {
      return new Response(
        JSON.stringify({ error: 'validationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Fetch validation data
    const { data: validation, error: validationError } = await supabaseClient
      .from('validations')
      .select(`
        *,
        rto:rtos(*),
        unit:units(*),
        document:documents(*)
      `)
      .eq('id', validationId)
      .single();

    if (validationError) {
      throw validationError;
    }

    if (!validation) {
      return new Response(
        JSON.stringify({ error: 'Validation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch validation results
    const { data: results, error: resultsError } = await supabaseClient
      .from('validation_results')
      .select('*')
      .eq('validation_id', validationId);

    if (resultsError) {
      throw resultsError;
    }

    // Organize results by category
    const organizedData = organizeValidationData(validation, results || []);

    // Generate report based on type
    const reportData = reportType === 'learner_guide'
      ? await generateLearnerGuideReport(organizedData)
      : await generateUnitReport(organizedData);

    // For now, return JSON data
    // In production, this would generate an actual Excel file
    return new Response(
      JSON.stringify({
        success: true,
        reportType,
        data: reportData,
        message: 'Report data generated successfully. Excel generation coming soon.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Organize validation data for report generation
 */
function organizeValidationData(validation: any, results: any[]): any {
  return {
    unit_code: validation.unit?.code || 'N/A',
    unit_title: validation.unit?.title || 'N/A',
    rto_name: validation.rto?.name || 'N/A',
    overall_status: validation.status,
    overall_score: validation.score,
    
    // Organize results by validation type
    elements_criteria: results.filter(r => r.validation_type === 'elements_criteria'),
    foundation_skills: results.filter(r => r.validation_type === 'foundation_skills'),
    performance_evidence: results.filter(r => r.validation_type === 'performance_evidence'),
    knowledge_evidence: results.filter(r => r.validation_type === 'knowledge_evidence'),
    assessment_conditions: results.filter(r => r.validation_type === 'assessment_conditions'),
    assessment_instructions: results.filter(r => r.validation_type === 'assessment_instructions'),
    
    // Category scores
    epc_status: calculateCategoryStatus(results, 'elements_criteria'),
    epc_score: calculateCategoryScore(results, 'elements_criteria'),
    fs_status: calculateCategoryStatus(results, 'foundation_skills'),
    fs_score: calculateCategoryScore(results, 'foundation_skills'),
    pe_status: calculateCategoryStatus(results, 'performance_evidence'),
    pe_score: calculateCategoryScore(results, 'performance_evidence'),
    ke_status: calculateCategoryStatus(results, 'knowledge_evidence'),
    ke_score: calculateCategoryScore(results, 'knowledge_evidence'),
    ac_status: calculateCategoryStatus(results, 'assessment_conditions'),
    ac_score: calculateCategoryScore(results, 'assessment_conditions'),
    ai_status: calculateCategoryStatus(results, 'assessment_instructions'),
    ai_score: calculateCategoryScore(results, 'assessment_instructions'),
  };
}

/**
 * Calculate category status
 */
function calculateCategoryStatus(results: any[], category: string): string {
  const categoryResults = results.filter(r => r.validation_type === category);
  if (categoryResults.length === 0) return 'N/A';
  
  const metCount = categoryResults.filter(r => r.status === 'Met').length;
  const totalCount = categoryResults.length;
  
  if (metCount === totalCount) return 'Met';
  if (metCount > 0) return 'Partially Met';
  return 'Not Met';
}

/**
 * Calculate category score
 */
function calculateCategoryScore(results: any[], category: string): number | null {
  const categoryResults = results.filter(r => r.validation_type === category);
  if (categoryResults.length === 0) return null;
  
  const scores = categoryResults.map(r => r.score || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  return Math.round(avgScore);
}

/**
 * Generate Unit Validation Report data
 */
async function generateUnitReport(data: any): Promise<any> {
  return {
    summary: {
      unit_code: data.unit_code,
      unit_title: data.unit_title,
      rto_name: data.rto_name,
      overall_status: data.overall_status,
      overall_score: data.overall_score,
      categories: [
        { name: 'Elements & Performance Criteria', status: data.epc_status, score: data.epc_score },
        { name: 'Foundation Skills', status: data.fs_status, score: data.fs_score },
        { name: 'Performance Evidence', status: data.pe_status, score: data.pe_score },
        { name: 'Knowledge Evidence', status: data.ke_status, score: data.ke_score },
        { name: 'Assessment Conditions', status: data.ac_status, score: data.ac_score },
        { name: 'Assessment Instructions', status: data.ai_status, score: data.ai_score },
      ],
    },
    elements_criteria: data.elements_criteria.map(formatEPCResult),
    foundation_skills: data.foundation_skills.map(formatFSResult),
    performance_evidence: data.performance_evidence.map(formatPEResult),
    knowledge_evidence: data.knowledge_evidence.map(formatKEResult),
    assessment_conditions: data.assessment_conditions.map(formatACResult),
    assessment_instructions: formatAIResult(data.assessment_instructions[0]),
  };
}

/**
 * Generate Learner Guide Report data
 */
async function generateLearnerGuideReport(data: any): Promise<any> {
  return {
    summary: {
      unit_code: data.unit_code,
      unit_title: data.unit_title,
      rto_name: data.rto_name,
      overall_status: data.overall_status,
      overall_score: data.overall_score,
      categories: [
        { name: 'Elements & Performance Criteria', status: data.epc_status, score: data.epc_score },
        { name: 'Performance Evidence', status: data.pe_status, score: data.pe_score },
        { name: 'Knowledge Evidence', status: data.ke_status, score: data.ke_score },
      ],
    },
    elements_criteria: data.elements_criteria.map(formatEPCLGResult),
    performance_evidence: data.performance_evidence.map(formatPELGResult),
    knowledge_evidence: data.knowledge_evidence.map(formatKELGResult),
  };
}

/**
 * Format Elements & Performance Criteria result (Unit)
 */
function formatEPCResult(result: any): any {
  const details = result.details || {};
  return {
    element: details.element || '',
    criterion: details.criterion || '',
    description: details.description || '',
    status: result.status,
    mapped_questions: details.mapped_questions || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    smart_question: details.smart_question || '',
    benchmark_answer: details.benchmark_answer || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Elements & Performance Criteria result (Learner Guide)
 */
function formatEPCLGResult(result: any): any {
  const details = result.details || {};
  return {
    number: details.number || '',
    element: details.element || '',
    criterion: details.criterion || '',
    status: result.status,
    mapped_content: details.mapped_content || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Foundation Skills result
 */
function formatFSResult(result: any): any {
  const details = result.details || {};
  return {
    number: details.number || '',
    requirement: details.requirement || '',
    status: result.status,
    mapped_questions: details.mapped_questions || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    smart_question: details.smart_question || '',
    benchmark_answer: details.benchmark_answer || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Performance Evidence result (Unit)
 */
function formatPEResult(result: any): any {
  const details = result.details || {};
  return {
    number: details.number || '',
    requirement: details.requirement || '',
    status: result.status,
    mapped_questions: details.mapped_questions || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    practical_task: details.practical_task || '',
    benchmark_answer: details.benchmark_answer || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Performance Evidence result (Learner Guide)
 */
function formatPELGResult(result: any): any {
  const details = result.details || {};
  return {
    number: details.number || '',
    requirement: details.requirement || '',
    status: result.status,
    mapped_content: details.mapped_content || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Knowledge Evidence result (Unit)
 */
function formatKEResult(result: any): any {
  const details = result.details || {};
  return {
    number: details.number || '',
    requirement: details.requirement || '',
    status: result.status,
    mapped_questions: details.mapped_questions || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    smart_question: details.smart_question || '',
    benchmark_answer: details.benchmark_answer || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Knowledge Evidence result (Learner Guide)
 */
function formatKELGResult(result: any): any {
  const details = result.details || {};
  return {
    number: details.number || '',
    requirement: details.requirement || '',
    status: result.status,
    mapped_content: details.mapped_content || '',
    unmapped_reasoning: details.unmapped_reasoning || '',
    recommendations: details.recommendations || '',
    doc_references: details.doc_references || '',
  };
}

/**
 * Format Assessment Conditions result
 */
function formatACResult(result: any): any {
  const details = result.details || {};
  return {
    condition: details.condition || '',
    status: result.status,
    reasoning: details.reasoning || '',
    recommendation: details.recommendation || '',
  };
}

/**
 * Format Assessment Instructions result
 */
function formatAIResult(result: any): any {
  if (!result) return {};
  
  const details = result.details || {};
  return {
    assessment_methods: details.assessment_methods || '',
    evidence_requirements: details.evidence_requirements || '',
    clarity_and_language: details.clarity_and_language || '',
    consistency: details.consistency || '',
    assessment_review_process: details.assessment_review_process || '',
    reasonable_adjustments: details.reasonable_adjustments || '',
    resubmission_policy: details.resubmission_policy || '',
  };
}
