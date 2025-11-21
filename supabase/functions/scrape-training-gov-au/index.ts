import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface UnitData {
  unitCode: string;
  unitTitle: string;
  releaseDate: string;
  usageRecommendation: string;
  unitSector: string;
  application: string;
  elements: Array<{
    elementNumber: number;
    elementText: string;
    performanceCriteria: Array<{
      number: string;
      text: string;
    }>;
  }>;
  foundationSkills: Array<{
    skill: string;
    descriptions: string[];
  }>;
  performanceEvidence: string[];
  knowledgeEvidence: Array<{
    topic: string;
    subtopics: string[];
  }>;
  assessmentConditions: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { unitCode, rtoId } = await req.json();

    if (!unitCode) {
      return new Response(
        JSON.stringify({ error: 'Unit code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping training.gov.au for unit: ${unitCode}`);

    // Fetch the page
    const url = `https://training.gov.au/training/details/${unitCode.trim()}/unitdetails`;
    const response = await fetch(url);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch unit data: ${response.statusText}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Parse the HTML
    const unitData = parseUnitPage(html, unitCode);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save to database
    await saveUnitToDatabase(supabase, unitData, rtoId, url);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully scraped and saved unit ${unitCode}`,
        data: unitData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in scrape-training-gov-au:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseUnitPage(html: string, unitCode: string): UnitData {
  // Extract unit title
  const titleMatch = html.match(new RegExp(`${unitCode}\\s+([^<]+)`));
  const unitTitle = titleMatch ? titleMatch[1].trim() : '';

  // Extract release date
  const releaseDateMatch = html.match(/(\d{2}\/\w{3}\/\d{4})/);
  const releaseDate = releaseDateMatch ? releaseDateMatch[1] : '';

  // Extract usage recommendation
  const usageMatch = html.match(/Usage recommendation[^>]*>([^<]+)/i);
  const usageRecommendation = usageMatch ? usageMatch[1].trim() : 'Current';

  // Extract unit sector
  const sectorMatch = html.match(/Unit sector[^<]*<\/h\d+>[^<]*<[^>]*>([^<]+)/i);
  const unitSector = sectorMatch ? sectorMatch[1].trim() : '';

  // Extract application
  const applicationMatch = html.match(/Application[^<]*<\/h\d+>([\s\S]*?)(?=<h\d+|$)/i);
  let application = '';
  if (applicationMatch) {
    application = applicationMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Extract elements and performance criteria
  const elements = parseElementsAndCriteria(html);

  // Extract foundation skills
  const foundationSkills = parseFoundationSkills(html);

  // Extract performance evidence
  const performanceEvidence = parsePerformanceEvidence(html);

  // Extract knowledge evidence
  const knowledgeEvidence = parseKnowledgeEvidence(html);

  // Extract assessment conditions
  const assessmentConditions = parseAssessmentConditions(html);

  return {
    unitCode,
    unitTitle,
    releaseDate,
    usageRecommendation,
    unitSector,
    application,
    elements,
    foundationSkills,
    performanceEvidence,
    knowledgeEvidence,
    assessmentConditions,
  };
}

function parseElementsAndCriteria(html: string): UnitData['elements'] {
  const elements: UnitData['elements'] = [];
  
  // Find the Elements and performance criteria section
  const sectionMatch = html.match(/Elements and performance criteria[\s\S]*?<table[\s\S]*?<\/table>/i);
  if (!sectionMatch) return elements;

  const tableHtml = sectionMatch[0];
  
  // Extract table rows
  const rowMatches = tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi);
  
  let currentElement: any = null;
  
  for (const rowMatch of rowMatches) {
    const row = rowMatch[0];
    
    // Skip header rows
    if (row.includes('Elements describe') || row.includes('Performance criteria describe')) {
      continue;
    }
    
    // Extract cells
    const cellMatches = row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi);
    const cells = Array.from(cellMatches).map(m => m[1]);
    
    if (cells.length >= 2) {
      const elementCell = cells[0];
      const criteriaCell = cells[1];
      
      // Check if this is a new element
      const elementMatch = elementCell.match(/(\d+)\.\s*([^<]*(?:<[^>]+>[^<]*)*)/);
      if (elementMatch) {
        if (currentElement) {
          elements.push(currentElement);
        }
        
        currentElement = {
          elementNumber: parseInt(elementMatch[1]),
          elementText: elementMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          performanceCriteria: [],
        };
      }
      
      // Extract performance criteria from the cell
      const criteriaMatches = criteriaCell.matchAll(/(\d+\.\d+)\s*([^<]*(?:<[^>]+>[^<]*)*?)(?=\d+\.\d+|$)/g);
      
      for (const criteriaMatch of criteriaMatches) {
        if (currentElement) {
          currentElement.performanceCriteria.push({
            number: criteriaMatch[1],
            text: criteriaMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          });
        }
      }
    }
  }
  
  if (currentElement) {
    elements.push(currentElement);
  }
  
  return elements;
}

function parseFoundationSkills(html: string): UnitData['foundationSkills'] {
  const skills: UnitData['foundationSkills'] = [];
  
  const sectionMatch = html.match(/Foundation skills[\s\S]*?<table[\s\S]*?<\/table>/i);
  if (!sectionMatch) return skills;

  const tableHtml = sectionMatch[0];
  const rowMatches = tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi);
  
  for (const rowMatch of rowMatches) {
    const row = rowMatch[0];
    
    // Skip header rows
    if (row.includes('Skill') && row.includes('Description')) {
      continue;
    }
    
    const cellMatches = row.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi);
    const cells = Array.from(cellMatches).map(m => m[1]);
    
    if (cells.length >= 2) {
      const skillName = cells[0].replace(/<[^>]+>/g, '').trim();
      
      if (skillName) {
        // Extract bullet points
        const descriptions: string[] = [];
        const liMatches = cells[1].matchAll(/<li[\s\S]*?>([\s\S]*?)<\/li>/gi);
        
        for (const liMatch of liMatches) {
          const text = liMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) {
            descriptions.push(text);
          }
        }
        
        skills.push({
          skill: skillName,
          descriptions,
        });
      }
    }
  }
  
  return skills;
}

function parsePerformanceEvidence(html: string): string[] {
  const evidence: string[] = [];
  
  const sectionMatch = html.match(/Performance evidence[\s\S]*?(?=<h\d+|$)/i);
  if (!sectionMatch) return evidence;

  const section = sectionMatch[0];
  
  // Extract bullet points
  const liMatches = section.matchAll(/<li[\s\S]*?>([\s\S]*?)<\/li>/gi);
  
  for (const liMatch of liMatches) {
    const text = liMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text && text.length > 10) { // Filter out very short items
      evidence.push(text);
    }
  }
  
  return evidence;
}

function parseKnowledgeEvidence(html: string): UnitData['knowledgeEvidence'] {
  const knowledge: UnitData['knowledgeEvidence'] = [];
  
  const sectionMatch = html.match(/Knowledge evidence[\s\S]*?(?=<h\d+|$)/i);
  if (!sectionMatch) return knowledge;

  const section = sectionMatch[0];
  
  // Extract main list items
  const ulMatch = section.match(/<ul[\s\S]*?<\/ul>/);
  if (!ulMatch) return knowledge;

  const listHtml = ulMatch[0];
  const liMatches = listHtml.matchAll(/<li[\s\S]*?>([\s\S]*?)<\/li>/gi);
  
  for (const liMatch of liMatches) {
    const content = liMatch[1];
    
    // Extract main topic (text before nested ul)
    const topicMatch = content.match(/^([^<]+)(?=<ul|$)/);
    const topic = topicMatch ? topicMatch[1].trim() : content.replace(/<[^>]+>/g, '').trim();
    
    // Extract subtopics
    const subtopics: string[] = [];
    const nestedLiMatches = content.matchAll(/<ul[\s\S]*?<li[\s\S]*?>([\s\S]*?)<\/li>/gi);
    
    for (const nestedMatch of nestedLiMatches) {
      const subtext = nestedMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (subtext) {
        subtopics.push(subtext);
      }
    }
    
    if (topic) {
      knowledge.push({
        topic,
        subtopics,
      });
    }
  }
  
  return knowledge;
}

function parseAssessmentConditions(html: string): string[] {
  const conditions: string[] = [];
  
  const sectionMatch = html.match(/Assessment conditions[\s\S]*?(?=<h\d+|$)/i);
  if (!sectionMatch) return conditions;

  const section = sectionMatch[0];
  
  // Extract bullet points
  const liMatches = section.matchAll(/<li[\s\S]*?>([\s\S]*?)<\/li>/gi);
  
  for (const liMatch of liMatches) {
    const text = liMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text && text.length > 10) {
      conditions.push(text);
    }
  }
  
  return conditions;
}

async function saveUnitToDatabase(
  supabase: any,
  unitData: UnitData,
  rtoId: number | undefined,
  sourceUrl: string
) {
  // Insert or update UnitOfCompetency
  const { data: unit, error: unitError } = await supabase
    .from('UnitOfCompetency')
    .upsert({
      unitCode: unitData.unitCode,
      Title: unitData.unitTitle,
      Link: sourceUrl,
      // RTO_id removed - column doesn't exist in schema
      applciation: unitData.application, // Store application in the existing applciation column
    })
    .select()
    .single();

  if (unitError) {
    console.error('Error saving unit:', unitError);
    throw new Error(`Failed to save unit: ${unitError.message}`);
  }

  const unitId = unit.id;

  // Save Elements and Performance Criteria
  for (const element of unitData.elements) {
    // Save element as a requirement
    const { data: elementReq, error: elementError } = await supabase
      .from('Requirement')
      .upsert({
        unit_id: unitId,
        requirement_type: 'element',
        requirement_text: element.elementText,
        metadata: {
          elementNumber: element.elementNumber,
        },
      })
      .select()
      .single();

    if (elementError) {
      console.error('Error saving element:', elementError);
      continue;
    }

    // Save performance criteria
    for (const criteria of element.performanceCriteria) {
      await supabase.from('Requirement').upsert({
        unit_id: unitId,
        requirement_type: 'performance_criteria',
        requirement_text: criteria.text,
        metadata: {
          criteriaNumber: criteria.number,
          elementId: elementReq.id,
          elementNumber: element.elementNumber,
        },
      });
    }
  }

  // Save Foundation Skills
  for (const skill of unitData.foundationSkills) {
    await supabase.from('Requirement').upsert({
      unit_id: unitId,
      requirement_type: 'foundation_skills',
      requirement_text: skill.descriptions.join('\n'),
      metadata: {
        skillName: skill.skill,
        descriptions: skill.descriptions,
      },
    });
  }

  // Save Performance Evidence
  for (const evidence of unitData.performanceEvidence) {
    await supabase.from('Requirement').upsert({
      unit_id: unitId,
      requirement_type: 'performance_evidence',
      requirement_text: evidence,
    });
  }

  // Save Knowledge Evidence
  for (const knowledge of unitData.knowledgeEvidence) {
    await supabase.from('Requirement').upsert({
      unit_id: unitId,
      requirement_type: 'knowledge_evidence',
      requirement_text: knowledge.topic,
      metadata: {
        subtopics: knowledge.subtopics,
      },
    });
  }

  // Save Assessment Conditions
  for (const condition of unitData.assessmentConditions) {
    await supabase.from('Requirement').upsert({
      unit_id: unitId,
      requirement_type: 'assessment_conditions',
      requirement_text: condition,
    });
  }

  console.log(`Successfully saved unit ${unitData.unitCode} to database`);
}
