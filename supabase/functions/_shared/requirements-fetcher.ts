/**
 * Requirements Fetcher Utility
 * 
 * Fetches all requirements from database tables and returns them as structured JSON arrays.
 * This ensures consistent requirement handling across validation and smart question generation.
 */

export interface Requirement {
  id: number;
  unitCode: string;
  type: 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 'elements_performance_criteria' | 'assessment_conditions' | 'assessment_instructions';
  number: string;
  text: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface RequirementsByType {
  knowledge_evidence: Requirement[];
  performance_evidence: Requirement[];
  foundation_skills: Requirement[];
  elements_performance_criteria: Requirement[];
  assessment_conditions: Requirement[];
  assessment_instructions: Requirement[];
}

/**
 * Fetch all requirements for a specific unit and validation type
 */
export async function fetchRequirements(
  supabase: any,
  unitCode: string,
  validationType: 'assessment' | 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 'elements_criteria' | 'assessment_conditions' | 'assessment_instructions' | 'full_validation' | 'learner_guide_validation',
  unitLink?: string | null
): Promise<Requirement[]> {
  let requirementTable = '';
  let type: Requirement['type'] | null = null;

  // Handle 'assessment' as a special case that fetches ALL requirements
  if (validationType === 'assessment' || validationType === 'full_validation') {
    console.log(`[Requirements Fetcher] Fetching ALL requirements for ${unitCode}`);
    return await fetchAllRequirements(supabase, unitCode, unitLink);
  }

  switch (validationType) {
    case 'knowledge_evidence':
      requirementTable = 'knowledge_evidence_requirements';
      type = 'knowledge_evidence';
      break;
    case 'performance_evidence':
      requirementTable = 'performance_evidence_requirements';
      type = 'performance_evidence';
      break;
    case 'foundation_skills':
      requirementTable = 'foundation_skills_requirements';
      type = 'foundation_skills';
      break;
    case 'elements_criteria':
      requirementTable = 'elements_performance_criteria_requirements';
      type = 'elements_performance_criteria';
      break;
    case 'assessment_conditions':
      // Assessment conditions come from UnitOfCompetency table, not a separate requirements table
      type = 'assessment_conditions';
      try {
        console.log(`[Requirements Fetcher] Fetching assessment_conditions from UnitOfCompetency for ${unitCode}`);

        const query = unitLink
          ? supabase.from('UnitOfCompetency').select('ac, Link').ilike('Link', unitLink).single()
          : supabase.from('UnitOfCompetency').select('ac, Link').eq('unitCode', unitCode).single();

        const { data: uocData, error: uocError } = await query;

        if (uocError) {
          console.error(`[Requirements Fetcher] Error fetching from UnitOfCompetency:`, uocError);
          return [];
        }

        if (uocData && uocData.ac) {
          return [{
            id: 999999,
            unitCode: unitCode,
            type: 'assessment_conditions',
            number: '1',
            text: uocData.ac,
            description: uocData.ac,
            metadata: {
              source: 'UnitOfCompetency',
              unitLink: uocData.Link
            }
          }];
        }

        console.warn(`[Requirements Fetcher] No assessment conditions found in UnitOfCompetency for ${unitCode}`);
        return [];
      } catch (err) {
        console.error(`[Requirements Fetcher] Exception fetching assessment_conditions:`, err);
        return [];
      }
    case 'assessment_instructions':
      // Assessment instructions = ac + " - " + epc from UnitOfCompetency table
      type = 'assessment_instructions';
      try {
        console.log(`[Requirements Fetcher] Fetching assessment_instructions from UnitOfCompetency for ${unitCode}`);

        const query = unitLink
          ? supabase.from('UnitOfCompetency').select('ac, epc, Link').ilike('Link', unitLink).single()
          : supabase.from('UnitOfCompetency').select('ac, epc, Link').eq('unitCode', unitCode).single();

        const { data: uocData, error: uocError } = await query;

        if (uocError) {
          console.error(`[Requirements Fetcher] Error fetching from UnitOfCompetency:`, uocError);
          return [];
        }

        if (uocData && (uocData.ac || uocData.epc)) {
          const aiText = `${uocData.ac || ''}  -  ${uocData.epc || ''}`.trim();
          return [{
            id: 999998,
            unitCode: unitCode,
            type: 'assessment_instructions',
            number: '1',
            text: aiText,
            description: aiText,
            metadata: {
              source: 'UnitOfCompetency',
              unitLink: uocData.Link,
              ac: uocData.ac,
              epc: uocData.epc
            }
          }];
        }

        console.warn(`[Requirements Fetcher] No assessment instructions found in UnitOfCompetency for ${unitCode}`);
        return [];
      } catch (err) {
        console.error(`[Requirements Fetcher] Exception fetching assessment_instructions:`, err);
        return [];
      }
    case 'learner_guide_validation':
      // For full validation and learner guide validation, fetch all requirement types
      return await fetchAllRequirements(supabase, unitCode, unitLink);
  }

  if (!requirementTable || !type) {
    console.warn(`[Requirements Fetcher] Unknown validation type: ${validationType}`);
    return [];
  }

  try {
    // Use unit_url if unitLink is provided, otherwise fall back to unit_code
    const { data, error } = unitLink
      ? await supabase
        .from(requirementTable)
        .select('*')
        .eq('unit_url', unitLink)
        .order('id', { ascending: true })
      : await supabase
        .from(requirementTable)
        .select('*')
        .eq('unit_code', unitCode)
        .order('id', { ascending: true });

    if (error) {
      console.error(`[Requirements Fetcher] Error fetching from ${requirementTable}:`, error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`[Requirements Fetcher] No requirements found in ${requirementTable} for ${unitCode}`);
      return [];
    }

    console.log(`[Requirements Fetcher] Found ${data.length} requirements in ${requirementTable} for ${unitCode}`);

    // Normalize the data structure
    return data.map((row: any) => normalizeRequirement(row, type!));
  } catch (err) {
    console.error(`[Requirements Fetcher] Exception fetching requirements:`, err);
    return [];
  }
}

/**
 * Fetch all requirements for all types (used for full validation)
 */
export async function fetchAllRequirements(
  supabase: any,
  unitCode: string,
  unitLink?: string | null
): Promise<Requirement[]> {
  const allRequirements: Requirement[] = [];

  // Fetch each requirement type (excluding assessment_conditions which comes from UnitOfCompetency)
  const types: Array<{ table: string; type: Requirement['type'] }> = [
    { table: 'knowledge_evidence_requirements', type: 'knowledge_evidence' },
    { table: 'performance_evidence_requirements', type: 'performance_evidence' },
    { table: 'foundation_skills_requirements', type: 'foundation_skills' },
    { table: 'elements_performance_criteria_requirements', type: 'elements_performance_criteria' },
  ];

  for (const { table, type } of types) {
    try {
      // Use unit_url if unitLink is provided, otherwise fall back to unitCode
      let data, error;

      if (unitLink) {
        // Try with unit_url first
        const result = await supabase
          .from(table)
          .select('*')
          .eq('unit_url', unitLink)
          .order('id', { ascending: true });

        data = result.data;
        error = result.error;

        // If column doesn't exist (42703), fallback to unitCode
        if (error && error.code === '42703') {
          console.log(`[Requirements Fetcher] Table ${table} doesn't have unit_url, trying unitCode...`);
          const fallbackResult = await supabase
            .from(table)
            .select('*')
            .eq('unitCode', unitCode)
            .order('id', { ascending: true });
          data = fallbackResult.data;
          error = fallbackResult.error;
        }
      } else {
        // Use unitCode directly
        const result = await supabase
          .from(table)
          .select('*')
          .eq('unitCode', unitCode)
          .order('id', { ascending: true });
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error(`[Requirements Fetcher] Error fetching from ${table}:`, error);
        continue;
      }

      if (data && data.length > 0) {
        const normalized = data.map((row: any) => normalizeRequirement(row, type));
        allRequirements.push(...normalized);
        console.log(`[Requirements Fetcher] Found ${data.length} ${type} requirements for ${unitCode}`);
      }
    } catch (err) {
      console.error(`[Requirements Fetcher] Exception fetching from ${table}:`, err);
    }
  }

  // Fetch assessment_conditions and assessment_instructions from UnitOfCompetency table
  try {
    console.log(`[Requirements Fetcher] Fetching assessment_conditions and assessment_instructions from UnitOfCompetency for ${unitCode}`);

    const query = unitLink
      ? supabase.from('UnitOfCompetency').select('ac, epc, Link').ilike('Link', unitLink).single()
      : supabase.from('UnitOfCompetency').select('ac, epc, Link').eq('unitCode', unitCode).single();

    const { data: uocData, error: uocError } = await query;

    if (uocError) {
      console.error(`[Requirements Fetcher] Error fetching from UnitOfCompetency:`, uocError);
    } else if (uocData) {
      // Assessment conditions
      if (uocData.ac) {
        allRequirements.push({
          id: 999999, // Use a high ID to avoid conflicts
          unitCode: unitCode,
          type: 'assessment_conditions',
          number: '1',
          text: uocData.ac,
          description: uocData.ac,
          metadata: {
            source: 'UnitOfCompetency',
            unitLink: uocData.Link
          }
        });
        console.log(`[Requirements Fetcher] Found assessment_conditions from UnitOfCompetency for ${unitCode}`);
      }

      // Assessment instructions (ac + epc)
      if (uocData.ac || uocData.epc) {
        const aiText = `${uocData.ac || ''}  -  ${uocData.epc || ''}`.trim();
        allRequirements.push({
          id: 999998,
          unitCode: unitCode,
          type: 'assessment_instructions',
          number: '1',
          text: aiText,
          description: aiText,
          metadata: {
            source: 'UnitOfCompetency',
            unitLink: uocData.Link,
            ac: uocData.ac,
            epc: uocData.epc
          }
        });
        console.log(`[Requirements Fetcher] Found assessment_instructions from UnitOfCompetency for ${unitCode}`);
      }
    } else {
      console.warn(`[Requirements Fetcher] No data found in UnitOfCompetency for ${unitCode}`);
    }
  } catch (err) {
    console.error(`[Requirements Fetcher] Exception fetching from UnitOfCompetency:`, err);
  }

  // Add hardcoded compliance criteria (standard RTO requirements used by n8n)
  const hardcodedCriteria = getHardcodedComplianceCriteria(unitCode);
  allRequirements.push(...hardcodedCriteria);
  console.log(`[Requirements Fetcher] Added ${hardcodedCriteria.length} hardcoded compliance criteria`);

  console.log(`[Requirements Fetcher] Total requirements fetched: ${allRequirements.length}`);
  return allRequirements;
}

/**
 * Fetch requirements grouped by type (useful for structured validation)
 */
export async function fetchRequirementsByType(
  supabase: any,
  unitCode: string
): Promise<RequirementsByType> {
  const result: RequirementsByType = {
    knowledge_evidence: [],
    performance_evidence: [],
    foundation_skills: [],
    elements_performance_criteria: [],
    assessment_conditions: [],
    assessment_instructions: [],
  };

  const types: Array<{ table: string; type: keyof RequirementsByType }> = [
    { table: 'knowledge_evidence_requirements', type: 'knowledge_evidence' },
    { table: 'performance_evidence_requirements', type: 'performance_evidence' },
    { table: 'foundation_skills_requirements', type: 'foundation_skills' },
    { table: 'elements_performance_criteria_requirements', type: 'elements_performance_criteria' },
  ];

  for (const { table, type } of types) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('unitCode', unitCode)
        .order('id', { ascending: true });

      if (error) {
        console.error(`[Requirements Fetcher] Error fetching from ${table}:`, error);
        continue;
      }

      if (data && data.length > 0) {
        result[type] = data.map((row: any) => normalizeRequirement(row, type));
        console.log(`[Requirements Fetcher] Found ${data.length} ${type} requirements for ${unitCode}`);
      }
    } catch (err) {
      console.error(`[Requirements Fetcher] Exception fetching from ${table}:`, err);
    }
  }

  // Fetch assessment_conditions and assessment_instructions from UnitOfCompetency
  try {
    const { data: uocData, error: uocError } = await supabase
      .from('UnitOfCompetency')
      .select('ac, epc, Link')
      .eq('unitCode', unitCode)
      .single();

    if (!uocError && uocData) {
      // Assessment conditions
      if (uocData.ac) {
        result.assessment_conditions = [{
          id: 999999,
          unitCode: unitCode,
          type: 'assessment_conditions',
          number: '1',
          text: uocData.ac,
          description: uocData.ac,
          metadata: {
            source: 'UnitOfCompetency',
            unitLink: uocData.Link
          }
        }];
        console.log(`[Requirements Fetcher] Found assessment_conditions from UnitOfCompetency for ${unitCode}`);
      }

      // Assessment instructions (ac + epc)
      if (uocData.ac || uocData.epc) {
        const aiText = `${uocData.ac || ''}  -  ${uocData.epc || ''}`.trim();
        result.assessment_instructions = [{
          id: 999998,
          unitCode: unitCode,
          type: 'assessment_instructions',
          number: '1',
          text: aiText,
          description: aiText,
          metadata: {
            source: 'UnitOfCompetency',
            unitLink: uocData.Link,
            ac: uocData.ac,
            epc: uocData.epc
          }
        }];
        console.log(`[Requirements Fetcher] Found assessment_instructions from UnitOfCompetency for ${unitCode}`);
      }
    }
  } catch (err) {
    console.error(`[Requirements Fetcher] Exception fetching from UnitOfCompetency:`, err);
  }

  return result;
}

/**
 * Normalize requirement data from different table schemas into a consistent structure
 * Updated to match get-requirements field mappings and handle database typos
 */
function normalizeRequirement(row: any, type: Requirement['type']): Requirement {
  let text = '';
  let number = '';
  let description = '';

  switch (type) {
    case 'knowledge_evidence':
      text = row.knowled_point || row.knowledge_point || row.text || row.description || '';
      number = row.ke_number || row.requirement_number || row.number || String(row.id);
      description = text;
      break;

    case 'performance_evidence':
      text = row.performance_evidence || row.performance_task || row.text || row.description || '';
      number = row.pe_number || row.requirement_number || row.number || String(row.id);
      description = text;
      break;

    case 'foundation_skills':
      text = row.skill_point || row.skill_description || row.text || row.description || '';
      number = row.fs_number || row.skill_category || row.number || String(row.id);
      description = text;
      break;

    case 'elements_performance_criteria':
      text = row.performance_criteria || row.text || row.description || '';
      number = row.epc_number || row.element_number || row.number || String(row.id);
      description = row.element ? `${row.element}: ${text}` : text;
      break;

    case 'assessment_conditions':
      text = row.condition_text || row.ac || row.text || row.description || '';
      number = row.ac_number || row.condition_number || row.number || String(row.id);
      description = text;
      break;

    case 'assessment_instructions':
      text = row.text || row.description || '';
      number = row.number || String(row.id);
      description = text;
      break;
  }

  return {
    id: row.id,
    unitCode: row.unitCode || row.unit_code || '',
    type,
    number,
    text,
    description,
    metadata: {
      originalRow: row,
    },
  };
}

/**
 * Get hardcoded compliance criteria (Assessment Conditions & Instructions)
 * These are used by n8n validation workflows to ensure RTO standard compliance
 */
export function getHardcodedComplianceCriteria(unitCode: string): Requirement[] {
  const assessmentConditions: Requirement[] = [
    {
      id: 9000001,
      unitCode,
      number: 'AC1',
      text: 'Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment.',
      type: 'assessment_conditions',
      description: 'Assessors must hold credentials specified within the Standards for Registered Training Organisations current at the time of assessment.'
    },
    {
      id: 9000002,
      unitCode,
      number: 'AC2',
      text: 'Assessment must satisfy the Principles of Assessment and Rules of Evidence and all regulatory requirements included within the Standards for Registered Training Organisations current at the time of assessment.',
      type: 'assessment_conditions',
      description: 'Assessment must satisfy the Principles of Assessment and Rules of Evidence and all regulatory requirements included within the Standards for Registered Training Organisations current at the time of assessment.'
    },
    {
      id: 9000003,
      unitCode,
      number: 'AC3',
      text: 'Assessment must occur in workplace operational situations where it is appropriate to do so; where this is not appropriate, assessment must occur in simulated workplace operational situations that replicate workplace conditions.',
      type: 'assessment_conditions',
      description: 'Assessment must occur in workplace operational situations where it is appropriate to do so; where this is not appropriate, assessment must occur in simulated workplace operational situations that replicate workplace conditions.'
    },
    {
      id: 9000004,
      unitCode,
      number: 'AC4',
      text: 'Assessment processes and techniques must be appropriate to the language, literacy and numeracy requirements of the work being performed and the needs of the candidate.',
      type: 'assessment_conditions',
      description: 'Assessment processes and techniques must be appropriate to the language, literacy and numeracy requirements of the work being performed and the needs of the candidate.'
    },
    {
      id: 9000005,
      unitCode,
      number: 'AC5',
      text: 'Resources for assessment must include access to: a range of relevant exercises, case studies and/or simulations; relevant and appropriate materials, tools, equipment and PPE currently used in industry; applicable documentation, including legislation, regulations, codes of practice, workplace procedures and operation manuals.',
      type: 'assessment_conditions',
      description: 'Resources for assessment must include access to: a range of relevant exercises, case studies and/or simulations; relevant and appropriate materials, tools, equipment and PPE currently used in industry; applicable documentation, including legislation, regulations, codes of practice, workplace procedures and operation manuals.'
    }
  ];

  const assessmentInstructions: Requirement[] = [
    {
      id: 8000001,
      unitCode,
      number: 'AI1',
      text: 'Assessment methods include simulated customer interactions and require learners to assess customer interactions against established criteria and document compliance with requirements.',
      type: 'assessment_instructions',
      description: 'Assessment methods: Evaluate whether assessment methods are appropriate, varied, and aligned with unit requirements.'
    },
    {
      id: 8000002,
      unitCode,
      number: 'AI2',
      text: 'Evidence requirements are met through documenting feedback and recording insights from customer interactions, with clear documentation of complaints and non-compliant interactions.',
      type: 'assessment_instructions',
      description: 'Evidence requirements: Verify that evidence requirements are clearly documented and aligned with assessment methods.'
    },
    {
      id: 8000003,
      unitCode,
      number: 'AI3',
      text: 'Instructions are clear and use simple language throughout the assessment documents, with visual aids or flowcharts to simplify process where appropriate.',
      type: 'assessment_instructions',
      description: 'Clarity and language: Assess whether instructions are clear, unambiguous, and appropriate for the target audience.'
    },
    {
      id: 8000004,
      unitCode,
      number: 'AI4',
      text: 'Consistent language and instructions are maintained throughout the assessment tool, with all sections referencing the same documents for consistency and using consistent practices.',
      type: 'assessment_instructions',
      description: 'Consistency: Check for consistency in language, terminology, and instructions across all assessment documents.'
    },
    {
      id: 8000005,
      unitCode,
      number: 'AI5',
      text: 'Opportunities for feedback and review are embedded within the assessment structure, with clearly documented follow-up procedures post-feedback to ensure continuous improvement.',
      type: 'assessment_instructions',
      description: 'Assessment review process: Verify that feedback and review processes are clearly documented and embedded in the assessment.'
    },
    {
      id: 8000006,
      unitCode,
      number: 'AI6',
      text: 'Guidance for reasonable adjustments is limited in documentation provided, with recommendations to add detailed guidance for accommodating learners with special needs including alternative assessment methods.',
      type: 'assessment_instructions',
      description: 'Reasonable adjustments: Check whether guidance for reasonable adjustments is provided for learners with special needs.'
    },
    {
      id: 8000007,
      unitCode,
      number: 'AI7',
      text: 'Resubmission and reassessment pathways can be inferred but are not explicitly stated, with recommendations to clearly state the process for resubmission or reassessment.',
      type: 'assessment_instructions',
      description: 'Resubmission and reassessment policy: Verify that policies for resubmission and reassessment are clearly documented.'
    },
    {
      id: 8000008,
      unitCode,
      number: 'AI8',
      text: 'Overall compliance report indicates that assessment instructions meet RTO standards with identified areas for improvement in reasonable adjustments and reassessment policies.',
      type: 'assessment_instructions',
      description: 'Compliance report: Overall assessment of compliance with RTO standards and identification of improvement areas.'
    }
  ];

  return [...assessmentConditions, ...assessmentInstructions];
}

/**
 * Format requirements as JSON string for prompt injection
 */
export function formatRequirementsAsJSON(requirements: Requirement[]): string {
  return JSON.stringify(requirements, null, 2);
}

/**
 * Format requirements grouped by type as JSON string
 */
export function formatRequirementsByTypeAsJSON(requirementsByType: RequirementsByType): string {
  return JSON.stringify(requirementsByType, null, 2);
}
