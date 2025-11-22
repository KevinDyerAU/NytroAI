/**
 * Regenerate Smart Questions Edge Function
 * 
 * Allows users to regenerate SMART questions from the validation results page
 * with additional context. Completely independent from validation logic.
 * 
 * Usage:
 * POST /functions/v1/regenerate-smart-questions
 * {
 *   "validationResultId": "uuid",
 *   "userContext": "Additional context or feedback",
 *   "options": {
 *     "difficultyLevel": "intermediate",
 *     "questionCount": 1
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createSmartQuestionPrompt,
  createRegenerationPrompt,
  parseSmartQuestionResponse,
  isValidSmartQuestion,
  type SmartQuestionInput,
  type SmartQuestionOptions,
} from '../_shared/prompts/smart-question-prompt.ts';

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Parse request body
    const {
      validationResultId,
      userContext,
      currentQuestion,
      currentAnswer,
      options = {},
    } = await req.json();

    console.log('[Regenerate Smart Questions] Request:', {
      validationResultId,
      hasUserContext: !!userContext,
      hasCurrentQuestion: !!currentQuestion,
      options,
    });

    // Validate required fields
    if (!validationResultId) {
      return new Response(
        JSON.stringify({ error: 'validationResultId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch validation result details
    const { data: validationResult, error: fetchError } = await supabaseClient
      .from('validation_results')
      .select(`
        id,
        requirement_number,
        requirement_type,
        requirement_text,
        validation_status,
        validation_reasoning,
        evidence_data,
        smart_questions,
        validation_detail_id,
        validation_detail:validation_detail_id (
          rto_code,
          unit_code,
          unit_title
        )
      `)
      .eq('id', validationResultId)
      .single();

    if (fetchError || !validationResult) {
      console.error('[Regenerate Smart Questions] Failed to fetch validation result:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Validation result not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Regenerate Smart Questions] Found validation result:', {
      requirementNumber: validationResult.requirement_number,
      status: validationResult.validation_status,
      hasEvidence: !!validationResult.evidence_data,
    });

    // Prepare input for smart question generation
    const questionInput: SmartQuestionInput = {
      requirementNumber: validationResult.requirement_number,
      requirementType: validationResult.requirement_type,
      requirementText: validationResult.requirement_text,
      validationStatus: validationResult.validation_status,
      validationReasoning: validationResult.validation_reasoning,
      evidence: validationResult.evidence_data,
      unitCode: validationResult.validation_detail?.unit_code,
      unitTitle: validationResult.validation_detail?.unit_title,
      userContext: userContext || undefined,
    };

    const questionOptions: SmartQuestionOptions = {
      includeBenchmarkAnswer: true,
      includeAssessmentCriteria: true,
      difficultyLevel: options.difficultyLevel || 'intermediate',
      questionCount: options.questionCount || 1,
    };

    // Generate appropriate prompt based on whether we're regenerating or creating new
    let prompt: string;
    if (currentQuestion) {
      // Regeneration with user feedback
      prompt = createRegenerationPrompt(
        questionInput,
        {
          question: currentQuestion,
          benchmarkAnswer: currentAnswer,
        },
        userContext || 'Please improve this question',
        questionOptions
      );
      console.log('[Regenerate Smart Questions] Using regeneration prompt');
    } else {
      // New question generation
      prompt = createSmartQuestionPrompt(questionInput, questionOptions);
      console.log('[Regenerate Smart Questions] Using new question prompt');
    }

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('[Regenerate Smart Questions] Calling Gemini API...');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[Regenerate Smart Questions] Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('No response from Gemini API');
    }

    console.log('[Regenerate Smart Questions] Received AI response, parsing...');

    // Parse the AI response
    const parsedQuestion = parseSmartQuestionResponse(aiResponse);

    if (!parsedQuestion || !isValidSmartQuestion(parsedQuestion)) {
      console.error('[Regenerate Smart Questions] Invalid question format:', parsedQuestion);
      throw new Error('Failed to generate valid question');
    }

    console.log('[Regenerate Smart Questions] Successfully generated question');

    // Update the validation_results table with new smart question
    const updatedSmartQuestions = [{
      question: parsedQuestion.question,
      benchmark_answer: parsedQuestion.benchmark_answer || parsedQuestion.answer,
      assessment_criteria: parsedQuestion.assessment_criteria,
      question_type: parsedQuestion.question_type,
      difficulty_level: parsedQuestion.difficulty_level,
      estimated_time: parsedQuestion.estimated_time,
      focus_areas: parsedQuestion.focus_areas,
      generated_at: new Date().toISOString(),
      user_context: userContext || null,
    }];

    const { error: updateError } = await supabaseClient
      .from('validation_results')
      .update({
        smart_questions: updatedSmartQuestions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validationResultId);

    if (updateError) {
      console.error('[Regenerate Smart Questions] Failed to update database:', updateError);
      // Don't fail the request - we still return the question
    } else {
      console.log('[Regenerate Smart Questions] Updated database successfully');
    }

    // Return the generated question
    return new Response(
      JSON.stringify({
        success: true,
        question: parsedQuestion,
        message: currentQuestion 
          ? 'Question regenerated successfully'
          : 'Question generated successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Regenerate Smart Questions] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to regenerate smart questions',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
