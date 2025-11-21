/**
 * Generate Smart Questions Edge Function
 *
 * Generates SMART assessment questions using document context and unit requirements
 * Uses Google Gemini File Search API for document-aware question generation
 */

// @ts-ignore: Deno Edge Function - these imports are valid in Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';
// @ts-ignore: Deno import map resolves this
import { GoogleGenerativeAI } from '@google/generative-ai';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get request body
    const {
      rtoId,
      unitId,
      documentId,
      requirementId,
      requirementType,
      requirementText,
      questionCount = 5,
      userContext,
    } = await req.json();

    if (!rtoId || !unitId) {
      return new Response(
        JSON.stringify({ error: 'rtoId and unitId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createSupabaseClient(req);

    // Fetch RTO, Unit, and Document data
    const { data: rto, error: rtoError } = await supabaseClient
      .from('RTO')
      .select('*')
      .eq('id', rtoId)
      .single();

    if (rtoError) throw rtoError;

    const { data: unit, error: unitError } = await supabaseClient
      .from('UnitOfCompetency')
      .select('*')
      .eq('id', unitId)
      .single();

    if (unitError) throw unitError;

    // Fetch document if provided
    let document = null;
    if (documentId) {
      try {
        const { data: doc, error: docError } = await supabaseClient
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (!docError) {
          document = doc;
        }
      } catch (error) {
        // Documents table might not exist yet, continue without document context
        console.log('Documents table not available, proceeding without document context');
      }
    }

    // Fetch requirement if provided
    let requirement = null;
    if (requirementId) {
      try {
        const { data: req, error: reqError } = await supabaseClient
          .from('requirements')
          .select('*')
          .eq('id', requirementId)
          .single();

        if (!reqError) {
          requirement = req;
        }
      } catch (error) {
        // Requirements table might not exist yet, continue without requirement context
        console.log('Requirements table not available, proceeding without requirement context');
      }
    }

    // Build context for question generation
    const context = buildQuestionGenerationContext({
      rto,
      unit,
      document,
      requirement,
      requirementType,
      requirementText,
      questionCount,
      userContext,
    });

    // Generate questions using Gemini with document context
    let questions;
    
    if (document && document.gemini_file_uri) {
      // Use File Search for document-aware generation
      questions = await generateQuestionsWithDocument(
        context,
        document.gemini_file_uri,
        document.gemini_store_id,
        rto.code
      );
    } else {
      // Generate without document context
      questions = await generateQuestionsWithoutDocument(context);
    }

    // Save questions to database
    const savedQuestions = [];
    for (const question of questions) {
      const { data, error } = await supabaseClient
        .from('SmartQuestion')
        .insert({
          question: question.question,
          benchmark_answer: question.benchmark_answer,
          question_type: question.question_type,
          difficulty_level: question.difficulty_level,
          assessment_category: question.assessment_category,
          validation_id: null, // Can be linked later
          requirement_id: requirementId || null,
          unit_id: unitId,
          rto_id: rtoId,
          document_id: documentId || null,
          metadata: {
            requirement_type: requirementType,
            user_context: userContext,
            doc_references: question.doc_references,
          },
        })
        .select()
        .single();

      if (!error && data) {
        savedQuestions.push(data);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        questions: savedQuestions,
        count: savedQuestions.length,
        message: `Generated ${savedQuestions.length} SMART questions`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating questions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Build context for question generation
 */
function buildQuestionGenerationContext(params: any): string {
  const {
    rto,
    unit,
    document,
    requirement,
    requirementType,
    requirementText,
    questionCount,
    userContext,
  } = params;

  let context = `# SMART Question Generation Context\n\n`;
  
  context += `## RTO Information\n`;
  context += `- RTO Code: ${rto.code}\n`;
  context += `- RTO Name: ${rto.name}\n\n`;

  context += `## Unit of Competency\n`;
  context += `- Unit Code: ${unit.code}\n`;
  context += `- Unit Title: ${unit.title}\n`;
  if (unit.description) {
    context += `- Description: ${unit.description}\n`;
  }
  context += `\n`;

  if (document) {
    context += `## Assessment Document\n`;
    context += `- Document Name: ${document.name}\n`;
    context += `- Document Type: ${document.type}\n`;
    context += `- Status: Document is available for context\n\n`;
  }

  if (requirement || requirementText) {
    context += `## Requirement\n`;
    if (requirementType) {
      context += `- Type: ${requirementType}\n`;
    }
    if (requirement) {
      context += `- Requirement: ${requirement.requirement_text || requirement.description}\n`;
    } else if (requirementText) {
      context += `- Requirement: ${requirementText}\n`;
    }
    context += `\n`;
  }

  if (userContext) {
    context += `## Additional Context\n`;
    context += `${userContext}\n\n`;
  }

  context += `## Generation Parameters\n`;
  context += `- Number of Questions: ${questionCount}\n`;
  context += `- Question Type: SMART (Specific, Measurable, Achievable, Relevant, Time-bound)\n\n`;

  return context;
}

/**
 * Generate questions with document context using File Search
 */
async function generateQuestionsWithDocument(
  context: string,
  fileUri: string,
  storeId: string,
  rtoCode: string
): Promise<any[]> {
  const gemini = createDefaultGeminiClient();

  const prompt = `${context}

## Task

Generate SMART assessment questions based on the unit requirements and the assessment document provided.

**Instructions:**
1. Review the assessment document to understand the current assessment approach
2. Generate questions that align with both the unit requirements and the document context
3. Ensure questions are grounded in the actual assessment materials
4. Reference specific sections of the document where relevant
5. Create questions that build upon or improve the existing assessment

**Output Format:**
Return a JSON array of questions with the following structure:
[
  {
    "question": "The SMART question text",
    "benchmark_answer": "Detailed benchmark answer with key points",
    "question_type": "knowledge|performance|foundation_skills",
    "difficulty_level": "basic|intermediate|advanced",
    "assessment_category": "Category name (e.g., 'Infection Control Procedures')",
    "doc_references": "References to document sections (e.g., 'Section 2, Page 5')"
  }
]

**SMART Criteria:**
- **Specific**: Clearly defined and unambiguous
- **Measurable**: Can be assessed objectively
- **Achievable**: Realistic for the competency level
- **Relevant**: Directly related to unit requirements
- **Time-bound**: Can be completed within assessment timeframe

Generate the questions now.`;

  const response = await gemini.generateContentWithFileSearch(
    prompt,
    [storeId],
    `rto_code=${rtoCode}`
  );

  return parseQuestionsFromResponse(response.text);
}

/**
 * Generate questions without document context
 */
async function generateQuestionsWithoutDocument(context: string): Promise<any[]> {
  // @ts-ignore: Deno global is available in Supabase Edge Functions
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `${context}

## Task

Generate SMART assessment questions based on the unit requirements.

**Instructions:**
1. Create questions that assess the specified requirements
2. Ensure questions are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
3. Provide detailed benchmark answers
4. Vary question types and difficulty levels

**Output Format:**
Return a JSON array of questions with the following structure:
[
  {
    "question": "The SMART question text",
    "benchmark_answer": "Detailed benchmark answer with key points",
    "question_type": "knowledge|performance|foundation_skills",
    "difficulty_level": "basic|intermediate|advanced",
    "assessment_category": "Category name (e.g., 'Infection Control Procedures')",
    "doc_references": ""
  }
]

Generate the questions now.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  return parseQuestionsFromResponse(response);
}

/**
 * Parse questions from Gemini response
 */
function parseQuestionsFromResponse(response: string): any[] {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : response;

    const questions = JSON.parse(jsonText);

    if (!Array.isArray(questions)) {
      throw new Error('Response is not an array');
    }

    return questions.map((q: any) => ({
      question: q.question || '',
      benchmark_answer: q.benchmark_answer || '',
      question_type: q.question_type || 'knowledge',
      difficulty_level: q.difficulty_level || 'intermediate',
      assessment_category: q.assessment_category || 'General',
      doc_references: q.doc_references || '',
    }));
  } catch (error) {
    console.error('Failed to parse questions:', error);
    console.error('Response:', response);
    
    // Fallback: try to extract questions manually
    return extractQuestionsManually(response);
  }
}

/**
 * Manually extract questions from response if JSON parsing fails
 */
function extractQuestionsManually(response: string): any[] {
  const questions: any[] = [];
  
  // Simple extraction logic - look for question patterns
  const lines = response.split('\n');
  let currentQuestion: any = null;

  for (const line of lines) {
    if (line.toLowerCase().includes('question:')) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        question: line.replace(/.*question:\s*/i, '').trim(),
        benchmark_answer: '',
        question_type: 'knowledge',
        difficulty_level: 'intermediate',
        assessment_category: 'General',
        doc_references: '',
      };
    } else if (currentQuestion && line.toLowerCase().includes('answer:')) {
      currentQuestion.benchmark_answer = line.replace(/.*answer:\s*/i, '').trim();
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions.length > 0 ? questions : [
    {
      question: 'Failed to generate questions. Please try again.',
      benchmark_answer: 'N/A',
      question_type: 'knowledge',
      difficulty_level: 'intermediate',
      assessment_category: 'General',
      doc_references: '',
    },
  ];
}
