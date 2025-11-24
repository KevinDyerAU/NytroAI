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
  validationType: 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 'elements_criteria' | 'assessment_conditions' | 'assessment_instructions' | 'full_validation' | 'learner_guide_validation',
  unitLink?: string | null
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
    case 'full_validation':
    case 'learner_guide_validation':
      // For full validation and learner guide validation, fetch all requirement types
      return await fetchAllRequirements(supabase, unitCode, unitLink);
  }

  if (!requirementTable || !type) {
    console.warn(`[Requirements Fetcher] Unknown validation type: ${validationType}`);
    return [];
  }

  try {
    // Use unit_url if unitLink is provided, otherwise fall back to unitCode
    const { data, error } = unitLink
      ? await supabase
          .from(requirementTable)
          .select('*')
          .eq('unit_url', unitLink)
          .order('id', { ascending: true })
      : await supabase
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
      // assessment_conditions from UnitOfCompetency table
      text = row.condition_text || row.text || row.description || '';
      number = row.condition_number || row.number || String(row.id);
      description = row.description || text;
      break;

    case 'assessment_instructions':
      // assessment_instructions from UnitOfCompetency table (ac + epc)
      text = row.text || row.description || '';
      number = row.number || String(row.id);
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
