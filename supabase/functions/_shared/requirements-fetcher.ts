/**
 * Requirements Fetcher Utility
 * 
 * Fetches all requirements from database tables and returns them as structured JSON arrays.
 * This ensures consistent requirement handling across validation and smart question generation.
 */

export interface Requirement {
  id: number;
  unitCode: string;
  type: 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 'elements_performance_criteria' | 'assessment_conditions';
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
}

/**
 * Fetch all requirements for a specific unit and validation type
 */
export async function fetchRequirements(
  supabase: any,
  unitCode: string,
  validationType: 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 'elements_criteria' | 'assessment_conditions' | 'full_validation'
): Promise<Requirement[]> {
  let requirementTable = '';
  let type: Requirement['type'] | null = null;

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
      requirementTable = 'assessment_conditions_requirements';
      type = 'assessment_conditions';
      break;
    case 'full_validation':
      // For full validation, fetch all requirement types
      return await fetchAllRequirements(supabase, unitCode);
  }

  if (!requirementTable || !type) {
    console.warn(`[Requirements Fetcher] Unknown validation type: ${validationType}`);
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(requirementTable)
      .select('*')
      .eq('unitCode', unitCode)
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
  unitCode: string
): Promise<Requirement[]> {
  const allRequirements: Requirement[] = [];

  // Fetch each requirement type
  const types: Array<{ table: string; type: Requirement['type'] }> = [
    { table: 'knowledge_evidence_requirements', type: 'knowledge_evidence' },
    { table: 'performance_evidence_requirements', type: 'performance_evidence' },
    { table: 'foundation_skills_requirements', type: 'foundation_skills' },
    { table: 'elements_performance_criteria_requirements', type: 'elements_performance_criteria' },
    { table: 'assessment_conditions_requirements', type: 'assessment_conditions' },
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
        const normalized = data.map((row: any) => normalizeRequirement(row, type));
        allRequirements.push(...normalized);
        console.log(`[Requirements Fetcher] Found ${data.length} ${type} requirements for ${unitCode}`);
      }
    } catch (err) {
      console.error(`[Requirements Fetcher] Exception fetching from ${table}:`, err);
    }
  }

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
  };

  const types: Array<{ table: string; type: keyof RequirementsByType }> = [
    { table: 'knowledge_evidence_requirements', type: 'knowledge_evidence' },
    { table: 'performance_evidence_requirements', type: 'performance_evidence' },
    { table: 'foundation_skills_requirements', type: 'foundation_skills' },
    { table: 'elements_performance_criteria_requirements', type: 'elements_performance_criteria' },
    { table: 'assessment_conditions_requirements', type: 'assessment_conditions' },
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

  return result;
}

/**
 * Normalize requirement data from different table schemas into a consistent structure
 */
function normalizeRequirement(row: any, type: Requirement['type']): Requirement {
  // Different tables have different column names, normalize them
  let text = '';
  let number = '';
  let description = '';

  switch (type) {
    case 'knowledge_evidence':
      // knowledge_evidence_requirements table structure
      text = row.knowledge_point || row.text || row.description || '';
      number = row.requirement_number || row.number || String(row.id);
      description = row.description || text;
      break;

    case 'performance_evidence':
      // performance_evidence_requirements table structure
      text = row.performance_evidence || row.text || row.description || '';
      number = row.requirement_number || row.number || String(row.id);
      description = row.description || text;
      break;

    case 'foundation_skills':
      // foundation_skills_requirements table structure
      text = row.skill_description || row.text || row.description || '';
      number = row.skill_category || row.number || String(row.id);
      description = row.description || text;
      break;

    case 'elements_performance_criteria':
      // elements_performance_criteria_requirements table structure
      text = row.performance_criteria || row.text || row.description || '';
      number = row.element_number || row.number || String(row.id);
      description = row.description || text;
      break;

    case 'assessment_conditions':
      // assessment_conditions_requirements table structure
      text = row.condition_text || row.text || row.description || '';
      number = row.condition_number || row.number || String(row.id);
      description = row.description || text;
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
