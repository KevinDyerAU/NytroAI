/**
 * Assessment and Learner Guide Report Generator
 * Generates Excel reports from validation_results data
 * 
 * Supports:
 * - Assessment Report (with Knowledge Evidence and Performance Evidence)
 * - Learner Guide Report (with Performance Evidence and Knowledge Evidence)
 */

import ExcelJS from 'exceljs';
import { ValidationEvidenceRecord } from '../types/rto';
import nytroLogo from '../assets/IMG_5440.jpeg';

// Color scheme - matching website theme
const COLORS = {
  HEADER: '3b82f6',      // Blue (website primary blue)
  TITLE: '1e40af',       // Dark Blue (website dark blue)
  MET: 'C6EFCE',         // Light Green
  PARTIAL: 'FFEB9C',     // Light Yellow
  NOT_MET: 'FFC7CE',     // Light Red
  COVER_BG: '0d9488',    // Teal (website gradient start)
};

export interface AssessmentReportParams {
  validationDetailId: number;
  unitCode: string;
  unitTitle: string;
  rtoName: string;
  validationType: 'assessment' | 'learner-guide';
  validationResults: ValidationEvidenceRecord[];
  createdDate?: string;
}

/**
 * Normalize status to consistent format: 'met', 'partial', or 'not-met'
 */
function normalizeStatus(status: string | undefined | null): 'met' | 'partial' | 'not-met' {
  if (!status) return 'not-met';
  const normalized = status.toLowerCase().replace(/[\s_]/g, '-');
  if (normalized === 'met') return 'met';
  if (normalized === 'not-met') return 'not-met';
  if (normalized === 'partial' || normalized === 'partially-met') return 'partial';
  return 'not-met';
}

/**
 * Apply status-based background color to cell
 */
function applyStatusFill(cell: ExcelJS.Cell, status: string | undefined) {
  if (!status) return;
  
  const normalizedStatus = normalizeStatus(status);
  let color = COLORS.PARTIAL;
  
  if (normalizedStatus === 'met') {
    color = COLORS.MET;
  } else if (normalizedStatus === 'not-met') {
    color = COLORS.NOT_MET;
  }
  
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${color}` },
  };
}

/**
 * Parse requirement number to separate type and number (e.g., "KE 1" -> { type: "KE", number: "1" })
 */
function parseRequirementNumber(requirementNumber: string): { type: string; number: string } {
  const match = requirementNumber.match(/^([A-Z]+)\s*(\d+)$/);
  if (match) {
    return { type: match[1], number: match[2] };
  }
  return { type: 'KE', number: requirementNumber };
}

/**
 * Parse JSONB array from validation_results (smart_questions or citations)
 */
function parseJSONBArray(jsonbField: any): any[] {
  if (!jsonbField) return [];
  if (Array.isArray(jsonbField)) return jsonbField;
  if (typeof jsonbField === 'string') {
    // Handle empty strings
    if (jsonbField.trim() === '') return [];
    try {
      const parsed = JSON.parse(jsonbField);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // If it's not valid JSON, treat it as a single item
      return [jsonbField];
    }
  }
  // If it's an object (already parsed JSONB from Postgres), wrap it or return empty
  if (typeof jsonbField === 'object' && jsonbField !== null) {
    return [jsonbField];
  }
  return [];
}

/**
 * Generate Assessment Report (All Tabs)
 */
export async function generateAssessmentReport(
  params: AssessmentReportParams
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Separate by requirement type (from validation_results table)
  const knowledgeEvidence = params.validationResults.filter(r => 
    r.requirement_type === 'knowledge_evidence'
  );
  
  const performanceEvidence = params.validationResults.filter(r => 
    r.requirement_type === 'performance_evidence'
  );
  
  const foundationSkills = params.validationResults.filter(r => 
    r.requirement_type === 'foundation_skills'
  );
  
  const elementsPerfCriteria = params.validationResults.filter(r => 
    r.requirement_type === 'elements_performance_criteria'
  );
  
  const assessmentConditions = params.validationResults.filter(r => 
    r.requirement_type === 'assessment_conditions'
  );
  
  const assessmentInstructions = params.validationResults.filter(r => 
    r.requirement_type === 'assessment_instructions'
  );
  
  // Create sheets (all tabs for assessment)
  await createCoverSheet(workbook, params);
  createAssessmentSummarySheet(workbook, params, knowledgeEvidence, performanceEvidence, elementsPerfCriteria, foundationSkills, assessmentConditions, assessmentInstructions);
  createElementsPerformanceCriteriaSheet(workbook, elementsPerfCriteria);
  createKnowledgeEvidenceSheet(workbook, knowledgeEvidence, 'assessment');
  createPerformanceEvidenceSheet(workbook, performanceEvidence, 'assessment');
  createFoundationSkillsSheet(workbook, foundationSkills, 'assessment');
  createAssessmentConditionsSheet(workbook, assessmentConditions);
  createAssessmentInstructionsSheet(workbook, assessmentInstructions);
  
  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate Learner Guide Report (Elements & PC, Knowledge Evidence, Performance Evidence)
 */
export async function generateLearnerGuideReport(
  params: AssessmentReportParams
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Separate by requirement type (from validation_results table)
  const knowledgeEvidence = params.validationResults.filter(r => 
    r.requirement_type === 'knowledge_evidence'
  );
  
  const performanceEvidence = params.validationResults.filter(r => 
    r.requirement_type === 'performance_evidence'
  );
  
  const elementsPerfCriteria = params.validationResults.filter(r => 
    r.requirement_type === 'elements_performance_criteria'
  );
  
  // Create sheets (Elements & PC, KE, PE) - no smart questions for learner-guide
  await createCoverSheet(workbook, params);
  createLearnerGuideSummarySheet(workbook, params, knowledgeEvidence, performanceEvidence);
  createElementsPerformanceCriteriaSheet(workbook, elementsPerfCriteria, 'learner-guide');
  createKnowledgeEvidenceSheet(workbook, knowledgeEvidence, 'learner-guide');
  createPerformanceEvidenceSheet(workbook, performanceEvidence, 'learner-guide');
  
  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Create Cover Sheet
 */
async function createCoverSheet(workbook: ExcelJS.Workbook, params: AssessmentReportParams) {
  const sheet = workbook.addWorksheet('Cover');
  
  // Set background
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
  };
  
  // Add Nytro logo at the top (rows 1-7)
  try {
    const response = await fetch(nytroLogo);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const imageId = workbook.addImage({
      buffer: uint8Array as any,
      extension: 'jpeg',
    });
    
    // Position logo at top center spanning rows 1-7
    sheet.addImage(imageId, {
      tl: { col: 1.5, row: 0.5 }, // Top-left position 
      ext: { width: 121, height: 70 }, // Logo size (50% smaller)
    });
  } catch (error) {
    console.error('Failed to add logo to cover sheet:', error);
  }
  
  // Title area (starts at row 9 after logo)
  let row = 9;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = `${params.validationType === 'learner-guide' ? 'Learner Guide' : 'Assessment'} Validation Report`;
  titleCell.font = { bold: true, size: 24, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.HEADER}` },
  };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.mergeCells(`B${row}:D${row}`);
  sheet.getRow(row).height = 40;
  
  // Unit Information
  row += 3;
  const infoRows = [
    ['Unit Code:', params.unitCode],
    ['Unit Title:', params.unitTitle],
    ['Report Type:', params.validationType === 'learner-guide' ? 'Learner Guide' : 'Assessment'],
    ['Generated Date:', params.createdDate || new Date().toISOString().split('T')[0]],
  ];
  
  infoRows.forEach(([label, value]) => {
    sheet.getCell(`B${row}`).value = label;
    sheet.getCell(`B${row}`).font = { bold: true, size: 12 };
    sheet.getCell(`C${row}`).value = value;
    sheet.getCell(`C${row}`).font = { size: 12 };
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 23;
  sheet.getColumn('C').width = 46;
  sheet.getColumn('D').width = 23;
}

/**
 * Create Assessment Summary Sheet
 */
function createAssessmentSummarySheet(
  workbook: ExcelJS.Workbook,
  params: AssessmentReportParams,
  knowledgeEvidence: ValidationEvidenceRecord[],
  performanceEvidence: ValidationEvidenceRecord[],
  elementsPerfCriteria: ValidationEvidenceRecord[],
  foundationSkills: ValidationEvidenceRecord[],
  assessmentConditions: ValidationEvidenceRecord[],
  assessmentInstructions: ValidationEvidenceRecord[]
) {
  const sheet = workbook.addWorksheet('Summary');
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Assessment Validation Summary';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  sheet.mergeCells(`B${row}:E${row}`);
  row += 2;
  
  // Unit Information
  sheet.getCell(`B${row}`).value = 'Unit Code:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitCode;
  row++;
  
  sheet.getCell(`B${row}`).value = 'Unit Title:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitTitle;
  sheet.mergeCells(`C${row}:E${row}`);
  row++;
  
  sheet.getCell(`B${row}`).value = 'RTO:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.rtoName;
  row += 3;
  
  // Statistics by Tab
  sheet.getCell(`B${row}`).value = 'Validation Results by Tab';
  sheet.getCell(`B${row}`).font = { bold: true, size: 12 };
  row++;
  
  // Calculate stats with all status types
  const calculateStats = (items: ValidationEvidenceRecord[]) => {
    const total = items.length;
    const met = items.filter(r => normalizeStatus(r.status) === 'met').length;
    const partial = items.filter(r => normalizeStatus(r.status) === 'partial').length;
    const notMet = items.filter(r => normalizeStatus(r.status) === 'not-met').length;
    const percentage = total > 0 ? Math.round((met / total) * 100) : 0;
    return { met, partial, notMet, total, percentage };
  };
  
  const summaryData = [
    ['Elements & Performance Criteria', ...Object.values(calculateStats(elementsPerfCriteria))],
    ['Knowledge Evidence', ...Object.values(calculateStats(knowledgeEvidence))],
    ['Performance Evidence', ...Object.values(calculateStats(performanceEvidence))],
    ['Foundation Skills', ...Object.values(calculateStats(foundationSkills))],
    ['Assessment Conditions', ...Object.values(calculateStats(assessmentConditions))],
    ['Assessment Instructions', ...Object.values(calculateStats(assessmentInstructions))],
  ];
  
  // Headers - now includes Partial and Not Met columns
  ['Tab', 'Met', 'Partial', 'Not Met', 'Total', 'Met %'].forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  row++;
  
  // Data rows with all status columns
  summaryData.forEach(([tab, met, partial, notMet, total, percentage]) => {
    sheet.getCell(row, 2).value = tab;
    sheet.getCell(row, 3).value = met;
    applyStatusFill(sheet.getCell(row, 3), 'met');
    sheet.getCell(row, 4).value = partial;
    applyStatusFill(sheet.getCell(row, 4), 'partial');
    sheet.getCell(row, 5).value = notMet;
    applyStatusFill(sheet.getCell(row, 5), 'not-met');
    sheet.getCell(row, 6).value = total;
    sheet.getCell(row, 7).value = `${percentage}%`;
    row++;
  });
  
  // Set column widths for expanded summary (widened 15% for better readability)
  sheet.getColumn('B').width = 40;
  sheet.getColumn('C').width = 12;
  sheet.getColumn('D').width = 12;
  sheet.getColumn('E').width = 12;
  sheet.getColumn('F').width = 12;
  sheet.getColumn('G').width = 12;
}

/**
 * Create Learner Guide Summary Sheet
 */
function createLearnerGuideSummarySheet(
  workbook: ExcelJS.Workbook,
  params: AssessmentReportParams,
  knowledgeEvidence: ValidationEvidenceRecord[],
  performanceEvidence: ValidationEvidenceRecord[]
) {
  const sheet = workbook.addWorksheet('Summary');
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Learner Guide Validation Summary';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  sheet.mergeCells(`B${row}:E${row}`);
  row += 2;
  
  // Unit Information
  sheet.getCell(`B${row}`).value = 'Unit Code:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitCode;
  row++;
  
  sheet.getCell(`B${row}`).value = 'Unit Title:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitTitle;
  sheet.mergeCells(`C${row}:E${row}`);
  row++;
  
  sheet.getCell(`B${row}`).value = 'RTO:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.rtoName;
  row += 3;
  
  // Statistics by Tab
  sheet.getCell(`B${row}`).value = 'Validation Results by Tab';
  sheet.getCell(`B${row}`).font = { bold: true, size: 12 };
  row++;
  
  // Get all results by type
  const elementsPerfCriteria = params.validationResults.filter(r => r.requirement_type === 'elements_performance_criteria');
  
  // Calculate stats with all status types
  const calculateStats = (items: ValidationEvidenceRecord[]) => {
    const total = items.length;
    const met = items.filter(r => normalizeStatus(r.status) === 'met').length;
    const partial = items.filter(r => normalizeStatus(r.status) === 'partial').length;
    const notMet = items.filter(r => normalizeStatus(r.status) === 'not-met').length;
    const percentage = total > 0 ? Math.round((met / total) * 100) : 0;
    return { met, partial, notMet, total, percentage };
  };
  
  const summaryData = [
    ['Elements & Performance Criteria', ...Object.values(calculateStats(elementsPerfCriteria))],
    ['Knowledge Evidence', ...Object.values(calculateStats(knowledgeEvidence))],
    ['Performance Evidence', ...Object.values(calculateStats(performanceEvidence))],
  ];
  
  // Headers - now includes Partial and Not Met columns
  ['Tab', 'Met', 'Partial', 'Not Met', 'Total', 'Met %'].forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  row++;
  
  // Data rows with all status columns
  summaryData.forEach(([tab, met, partial, notMet, total, percentage]) => {
    sheet.getCell(row, 2).value = tab;
    sheet.getCell(row, 3).value = met;
    applyStatusFill(sheet.getCell(row, 3), 'met');
    sheet.getCell(row, 4).value = partial;
    applyStatusFill(sheet.getCell(row, 4), 'partial');
    sheet.getCell(row, 5).value = notMet;
    applyStatusFill(sheet.getCell(row, 5), 'not-met');
    sheet.getCell(row, 6).value = total;
    sheet.getCell(row, 7).value = `${percentage}%`;
    row++;
  });
  
  // Set column widths for expanded summary (widened 15% for better readability)
  sheet.getColumn('B').width = 40;
  sheet.getColumn('C').width = 12;
  sheet.getColumn('D').width = 12;
  sheet.getColumn('E').width = 12;
  sheet.getColumn('F').width = 12;
  sheet.getColumn('G').width = 12;
}

/**
 * Create Knowledge Evidence Sheet
 * For learner-guide reports, includes Recommendations instead of Smart Question and Benchmark Answer
 */
function createKnowledgeEvidenceSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[],
  reportType: 'assessment' | 'learner-guide'
) {
  const sheet = workbook.addWorksheet('Knowledge Evidence');
  const isLearnerGuide = reportType === 'learner-guide';
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Knowledge Evidence';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  const mergeEndCol = isLearnerGuide ? 'G' : 'H';
  sheet.mergeCells(`B${row}:${mergeEndCol}${row}`);
  row += 2;
  
  // Headers - learner-guide gets Recommendations, assessment gets Smart Question and Benchmark Answer
  const headers = isLearnerGuide ? [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Recommendations',
  ] : [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Smart Question',
    'Benchmark Answer',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row++;
  
  const maxCol = isLearnerGuide ? 7 : 8;
  
  // Data rows (using validation_results fields)
  data.forEach((item) => {
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.reasoning || '';
    
    // Citations (JSONB array)
    const citations = parseJSONBArray(item.citations);
    sheet.getCell(row, 6).value = citations.map((c: any, idx: number) => 
      `${idx + 1}. ${c.displayName || c.text || JSON.stringify(c)}`
    ).join('\n') || '';
    
    if (isLearnerGuide) {
      // Recommendations - only for learner-guide reports
      sheet.getCell(row, 7).value = item.recommendations || '';
    } else {
      // Smart questions and Benchmark Answer - only for assessment reports
      const smartQuestions = parseJSONBArray(item.smart_questions);
      sheet.getCell(row, 7).value = smartQuestions.map((q: any) => 
        typeof q === 'string' ? q : q.question || q.text || ''
      ).join('\n') || '';
      
      sheet.getCell(row, 8).value = item.benchmark_answer || '';
    }
    
    // Apply text wrapping
    for (let col = 2; col <= maxCol; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 40;
  sheet.getColumn('D').width = 14;
  sheet.getColumn('E').width = 35;
  sheet.getColumn('F').width = 35;
  if (isLearnerGuide) {
    sheet.getColumn('G').width = 40;
  } else {
    sheet.getColumn('G').width = 40;
    sheet.getColumn('H').width = 35;
  }
}

/**
 * Create Performance Evidence Sheet
 * For learner-guide reports, includes Recommendations instead of Smart Question and Benchmark Answer
 */
function createPerformanceEvidenceSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[],
  reportType: 'assessment' | 'learner-guide'
) {
  const sheet = workbook.addWorksheet('Performance Evidence');
  const isLearnerGuide = reportType === 'learner-guide';
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Performance Evidence';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  const mergeEndCol = isLearnerGuide ? 'G' : 'H';
  sheet.mergeCells(`B${row}:${mergeEndCol}${row}`);
  row += 2;
  
  // Headers - learner-guide gets Recommendations, assessment gets Smart Question and Benchmark Answer
  const headers = isLearnerGuide ? [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Recommendations',
  ] : [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Smart Question',
    'Benchmark Answer',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row++;
  
  const maxCol = isLearnerGuide ? 7 : 8;
  
  // Data rows (using validation_results fields)
  data.forEach((item) => {
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.reasoning || '';
    
    // Citations (JSONB array)
    const citations = parseJSONBArray(item.citations);
    sheet.getCell(row, 6).value = citations.map((c: any, idx: number) => 
      `${idx + 1}. ${c.displayName || c.text || JSON.stringify(c)}`
    ).join('\n') || '';
    
    if (isLearnerGuide) {
      // Recommendations - only for learner-guide reports
      sheet.getCell(row, 7).value = item.recommendations || '';
    } else {
      // Smart questions and Benchmark Answer - only for assessment reports
      const smartQuestions = parseJSONBArray(item.smart_questions);
      sheet.getCell(row, 7).value = smartQuestions.map((q: any) => 
        typeof q === 'string' ? q : q.question || q.text || ''
      ).join('\n') || '';
      
      sheet.getCell(row, 8).value = item.benchmark_answer || '';
    }
    
    // Apply text wrapping
    for (let col = 2; col <= maxCol; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 40;
  sheet.getColumn('D').width = 14;
  sheet.getColumn('E').width = 35;
  sheet.getColumn('F').width = 35;
  if (isLearnerGuide) {
    sheet.getColumn('G').width = 40;
  } else {
    sheet.getColumn('G').width = 40;
    sheet.getColumn('H').width = 35;
  }
}

/**
 * Create Elements & Performance Criteria Sheet
 * For learner-guide reports, includes Recommendations instead of Smart Question and Benchmark Answer
 */
function createElementsPerformanceCriteriaSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[],
  reportType: 'assessment' | 'learner-guide' = 'assessment'
) {
  const sheet = workbook.addWorksheet('Elements & Performance Criteria');
  const isLearnerGuide = reportType === 'learner-guide';
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Elements & Performance Criteria';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  const mergeEndCol = isLearnerGuide ? 'G' : 'H';
  sheet.mergeCells(`B${row}:${mergeEndCol}${row}`);
  row += 2;
  
  // Headers - learner-guide gets Recommendations, assessment gets Smart Question and Benchmark Answer
  const headers = isLearnerGuide ? [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Recommendations',
  ] : [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Smart Question',
    'Benchmark Answer',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row++;
  
  const maxCol = isLearnerGuide ? 7 : 8;
  
  // Data rows
  data.forEach((item) => {
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.reasoning || '';
    
    const citations = parseJSONBArray(item.citations);
    sheet.getCell(row, 6).value = citations.map((c: any, idx: number) => 
      `${idx + 1}. ${c.displayName || c.text || JSON.stringify(c)}`
    ).join('\n') || '';
    
    if (isLearnerGuide) {
      // Recommendations - only for learner-guide reports
      sheet.getCell(row, 7).value = item.recommendations || '';
    } else {
      // Smart questions and Benchmark Answer - only for assessment reports
      const smartQuestions = parseJSONBArray(item.smart_questions);
      sheet.getCell(row, 7).value = smartQuestions.map((q: any) => 
        typeof q === 'string' ? q : q.question || q.text || ''
      ).join('\n') || '';
      
      sheet.getCell(row, 8).value = item.benchmark_answer || '';
    }
    
    for (let col = 2; col <= maxCol; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 40;
  sheet.getColumn('D').width = 14;
  sheet.getColumn('E').width = 35;
  sheet.getColumn('F').width = 35;
  if (isLearnerGuide) {
    sheet.getColumn('G').width = 40;
  } else {
    sheet.getColumn('G').width = 40;
    sheet.getColumn('H').width = 35;
  }
}

/**
 * Create Foundation Skills Sheet
 * For learner-guide reports, includes Recommendations instead of Smart Question and Benchmark Answer
 */
function createFoundationSkillsSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[],
  reportType: 'assessment' | 'learner-guide' = 'assessment'
) {
  const sheet = workbook.addWorksheet('Foundation Skills');
  const isLearnerGuide = reportType === 'learner-guide';
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Foundation Skills';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  const mergeEndCol = isLearnerGuide ? 'G' : 'H';
  sheet.mergeCells(`B${row}:${mergeEndCol}${row}`);
  row += 2;
  
  // Headers - learner-guide gets Recommendations, assessment gets Smart Question and Benchmark Answer
  const headers = isLearnerGuide ? [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Recommendations',
  ] : [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
    'Smart Question',
    'Benchmark Answer',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row++;
  
  const maxCol = isLearnerGuide ? 7 : 8;
  
  // Data rows
  data.forEach((item) => {
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.reasoning || '';
    
    const citations = parseJSONBArray(item.citations);
    sheet.getCell(row, 6).value = citations.map((c: any, idx: number) => 
      `${idx + 1}. ${c.displayName || c.text || JSON.stringify(c)}`
    ).join('\n') || '';
    
    if (isLearnerGuide) {
      // Recommendations - only for learner-guide reports
      sheet.getCell(row, 7).value = item.recommendations || '';
    } else {
      // Smart questions and Benchmark Answer - only for assessment reports
      const smartQuestions = parseJSONBArray(item.smart_questions);
      sheet.getCell(row, 7).value = smartQuestions.map((q: any) => 
        typeof q === 'string' ? q : q.question || q.text || ''
      ).join('\n') || '';
      
      sheet.getCell(row, 8).value = item.benchmark_answer || '';
    }
    
    for (let col = 2; col <= maxCol; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 40;
  sheet.getColumn('D').width = 14;
  sheet.getColumn('E').width = 35;
  sheet.getColumn('F').width = 35;
  if (isLearnerGuide) {
    sheet.getColumn('G').width = 40;
  } else {
    sheet.getColumn('G').width = 40;
    sheet.getColumn('H').width = 35;
  }
}

/**
 * Create Assessment Conditions Sheet
 */
function createAssessmentConditionsSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[]
) {
  const sheet = workbook.addWorksheet('Assessment Conditions');
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Assessment Conditions';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  sheet.mergeCells(`B${row}:F${row}`);
  row += 2;
  
  // Headers - No Smart Question or Benchmark Answer for Assessment Conditions
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row++;
  
  // Data rows
  data.forEach((item) => {
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.reasoning || '';
    
    const citations = parseJSONBArray(item.citations);
    sheet.getCell(row, 6).value = citations.map((c: any, idx: number) => 
      `${idx + 1}. ${c.displayName || c.text || JSON.stringify(c)}`
    ).join('\n') || '';
    
    for (let col = 2; col <= 6; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 46;
  sheet.getColumn('D').width = 14;
  sheet.getColumn('E').width = 40;
  sheet.getColumn('F').width = 40;
}

/**
 * Create Assessment Instructions Sheet
 */
function createAssessmentInstructionsSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[]
) {
  const sheet = workbook.addWorksheet('Assessment Instructions');
  
  // Title
  let row = 2;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = 'Assessment Instructions';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  sheet.mergeCells(`B${row}:F${row}`);
  row += 2;
  
  // Headers - No Smart Question or Benchmark Answer for Assessment Instructions
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Reasoning',
    'Citations',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row++;
  
  // Data rows
  data.forEach((item) => {
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.reasoning || '';
    
    const citations = parseJSONBArray(item.citations);
    sheet.getCell(row, 6).value = citations.map((c: any, idx: number) => 
      `${idx + 1}. ${c.displayName || c.text || JSON.stringify(c)}`
    ).join('\n') || '';
    
    for (let col = 2; col <= 6; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths (widened 15% for better readability)
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 46;
  sheet.getColumn('D').width = 14;
  sheet.getColumn('E').width = 40;
  sheet.getColumn('F').width = 40;
}

/**
 * Download Excel file to client
 */
export function downloadExcelFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
