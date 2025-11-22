/**
 * UOC Page Parser
 * 
 * Parses Unit of Competency (UOC) page text into structured requirements.
 * Handles both plain text and JSON formats.
 */

export interface ParsedRequirement {
  type: 'performance_evidence' | 'knowledge_evidence' | 'foundation_skills' | 'elements_criteria' | 'assessment_conditions';
  number: string;
  text: string;
}

export interface ParsedUOCPage {
  knowledgeEvidence: string;
  performanceEvidence: string;
  foundationSkills: string;
  elementsAndPerformanceCriteria: string;
  assessmentConditions: string;
  requirements: ParsedRequirement[];
}

/**
 * Safely parse UOCPage data - handles both text and JSON formats
 */
export function parseUOCPage(uocPageData: any): ParsedUOCPage | null {
  if (!uocPageData) {
    console.log('[UOC Parser] No UOCPage data provided');
    return null;
  }

  // If it's already an object with the expected structure, return it
  if (typeof uocPageData === 'object' && !Array.isArray(uocPageData)) {
    if (uocPageData.KnowledgeEvidence || uocPageData.PerformanceEvidence) {
      return formatUOCPageObject(uocPageData);
    }
  }

  // If it's a string, try to parse it
  if (typeof uocPageData === 'string') {
    // First, check if it looks like JSON
    const trimmed = uocPageData.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatUOCPageObject(parsed);
      } catch (error) {
        console.log('[UOC Parser] Not valid JSON, treating as plain text');
        // Fall through to text parsing
      }
    }

    // Parse as plain text
    return parseUOCPageText(trimmed);
  }

  console.warn('[UOC Parser] Unexpected UOCPage format:', typeof uocPageData);
  return null;
}

/**
 * Format UOCPage object into standard structure
 */
function formatUOCPageObject(uocPage: any): ParsedUOCPage {
  const result: ParsedUOCPage = {
    knowledgeEvidence: uocPage.KnowledgeEvidence || uocPage.ke || '',
    performanceEvidence: uocPage.PerformanceEvidence || uocPage.pe || '',
    foundationSkills: uocPage.FoundationSkills || uocPage.fs || '',
    elementsAndPerformanceCriteria: uocPage.ElementsAndPerformanceCriteria || uocPage.epc || '',
    assessmentConditions: uocPage.AssessmentConditions || uocPage.ac || '',
    requirements: []
  };

  // Extract individual requirements
  result.requirements = extractRequirementsFromSections(result);

  return result;
}

/**
 * Parse plain text UOCPage into structured format
 */
function parseUOCPageText(text: string): ParsedUOCPage {
  const result: ParsedUOCPage = {
    knowledgeEvidence: '',
    performanceEvidence: '',
    foundationSkills: '',
    elementsAndPerformanceCriteria: '',
    assessmentConditions: '',
    requirements: []
  };

  // Extract sections using regex patterns
  result.knowledgeEvidence = extractSection(text, 'Knowledge Evidence') || '';
  result.performanceEvidence = extractSection(text, 'Performance Evidence') || '';
  result.foundationSkills = extractSection(text, 'Foundation Skills') || '';
  result.elementsAndPerformanceCriteria = extractSection(text, 'Elements and Performance Criteria') || 
                                          extractSection(text, 'Elements') || '';
  result.assessmentConditions = extractSection(text, 'Assessment Conditions') || '';

  // Extract individual requirements
  result.requirements = extractRequirementsFromSections(result);

  return result;
}

/**
 * Extract a section from UOC text by header name
 */
function extractSection(text: string, sectionName: string): string | null {
  // Try different header formats
  const patterns = [
    new RegExp(`${sectionName}:?\\s*([\\s\\S]*?)(?=\\n\\n[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*:?|$)`, 'i'),
    new RegExp(`##?\\s*${sectionName}\\s*([\\s\\S]*?)(?=\\n##?\\s*[A-Z]|$)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract individual requirements from sections
 */
function extractRequirementsFromSections(sections: Omit<ParsedUOCPage, 'requirements'>): ParsedRequirement[] {
  const requirements: ParsedRequirement[] = [];

  // Knowledge Evidence
  if (sections.knowledgeEvidence) {
    const items = extractNumberedItems(sections.knowledgeEvidence);
    items.forEach(item => {
      requirements.push({
        type: 'knowledge_evidence',
        number: item.number,
        text: item.text
      });
    });
  }

  // Performance Evidence
  if (sections.performanceEvidence) {
    const items = extractNumberedItems(sections.performanceEvidence);
    items.forEach(item => {
      requirements.push({
        type: 'performance_evidence',
        number: item.number,
        text: item.text
      });
    });
  }

  // Foundation Skills
  if (sections.foundationSkills) {
    const items = extractBulletItems(sections.foundationSkills);
    items.forEach((text, index) => {
      requirements.push({
        type: 'foundation_skills',
        number: `FS${index + 1}`,
        text
      });
    });
  }

  // Elements and Performance Criteria
  if (sections.elementsAndPerformanceCriteria) {
    const items = parseElementsAndCriteria(sections.elementsAndPerformanceCriteria);
    items.forEach(item => {
      requirements.push({
        type: 'elements_criteria',
        number: item.number,
        text: item.text
      });
    });
  }

  // Assessment Conditions
  if (sections.assessmentConditions) {
    const items = extractBulletItems(sections.assessmentConditions);
    items.forEach((text, index) => {
      requirements.push({
        type: 'assessment_conditions',
        number: `AC${index + 1}`,
        text
      });
    });
  }

  return requirements;
}

/**
 * Extract numbered items (1., 2., 3. or 1.1, 1.2, etc.)
 */
function extractNumberedItems(text: string): Array<{ number: string; text: string }> {
  const items: Array<{ number: string; text: string }> = [];
  
  // Match patterns like "1.", "1.1", "a)", etc.
  const patterns = [
    /(\d+(?:\.\d+)?)\.\s+([^\n]+(?:\n(?!\d+(?:\.\d+)?\.)[^\n]+)*)/g,
    /([a-z])\)\s+([^\n]+(?:\n(?![a-z]\))[^\n]+)*)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        items.push({
          number: match[1],
          text: match[2].trim()
        });
      }
    }
  }

  return items;
}

/**
 * Extract bullet items (-, *, •)
 */
function extractBulletItems(text: string): string[] {
  const items: string[] = [];
  
  const pattern = /[-*•]\s+([^\n]+(?:\n(?![-*•])[^\n]+)*)/g;
  const matches = text.matchAll(pattern);
  
  for (const match of matches) {
    if (match[1]) {
      items.push(match[1].trim());
    }
  }

  // If no bullet items found, try splitting by newlines
  if (items.length === 0) {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^(Knowledge|Performance|Foundation|Elements|Assessment)/i));
    
    return lines;
  }

  return items;
}

/**
 * Parse Elements and Performance Criteria
 * Format: "Element 1.1: Description\nPC1.1.1: Criterion"
 */
function parseElementsAndCriteria(text: string): Array<{ number: string; text: string }> {
  const items: Array<{ number: string; text: string }> = [];
  
  // Match Element headers
  const elementPattern = /Element\s+(\d+(?:\.\d+)?):?\s+([^\n]+)/gi;
  const elementMatches = text.matchAll(elementPattern);
  
  for (const match of elementMatches) {
    if (match[1] && match[2]) {
      items.push({
        number: `E${match[1]}`,
        text: match[2].trim()
      });
    }
  }
  
  // Match Performance Criteria
  const pcPattern = /(?:PC\s*)?(\d+\.\d+\.\d+):?\s+([^\n]+)/gi;
  const pcMatches = text.matchAll(pcPattern);
  
  for (const match of pcMatches) {
    if (match[1] && match[2]) {
      items.push({
        number: `PC${match[1]}`,
        text: match[2].trim()
      });
    }
  }
  
  return items;
}

/**
 * Format requirements for prompt inclusion
 */
export function formatRequirementsForPrompt(uocPage: ParsedUOCPage): string {
  const sections: string[] = [];

  if (uocPage.knowledgeEvidence) {
    sections.push('**Knowledge Evidence Requirements:**\n' + uocPage.knowledgeEvidence);
  }

  if (uocPage.performanceEvidence) {
    sections.push('\n**Performance Evidence Requirements:**\n' + uocPage.performanceEvidence);
  }

  if (uocPage.elementsAndPerformanceCriteria) {
    sections.push('\n**Elements and Performance Criteria:**\n' + uocPage.elementsAndPerformanceCriteria);
  }

  if (uocPage.foundationSkills) {
    sections.push('\n**Foundation Skills Requirements:**\n' + uocPage.foundationSkills);
  }

  if (uocPage.assessmentConditions) {
    sections.push('\n**Assessment Conditions:**\n' + uocPage.assessmentConditions);
  }

  return sections.join('\n');
}
