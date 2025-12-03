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

// Color scheme
const COLORS = {
  HEADER: '4472C4',      // Blue
  TITLE: '2F5496',       // Dark Blue
  MET: 'C6EFCE',         // Light Green
  PARTIAL: 'FFEB9C',     // Light Yellow
  NOT_MET: 'FFC7CE',     // Light Red
  COVER_BG: '1F4E78',    // Dark Blue for cover
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
 * Apply status-based background color to cell
 */
function applyStatusFill(cell: ExcelJS.Cell, status: string | undefined) {
  if (!status) return;
  
  const normalizedStatus = status.toLowerCase().trim();
  let color = COLORS.PARTIAL;
  
  if (normalizedStatus === 'met') {
    color = COLORS.MET;
  } else if (normalizedStatus === 'not-met' || normalizedStatus === 'not met') {
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
 * Generate Assessment Report
 */
export async function generateAssessmentReport(
  params: AssessmentReportParams
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Separate knowledge and performance evidence
  const knowledgeEvidence = params.validationResults.filter(r => 
    r.requirement_type?.toLowerCase() === 'knowledge' || 
    r.requirement_number?.startsWith('KE')
  );
  
  const performanceEvidence = params.validationResults.filter(r => 
    r.requirement_type?.toLowerCase() === 'performance' || 
    r.requirement_number?.startsWith('PE')
  );
  
  // Create sheets
  createCoverSheet(workbook, params);
  createAssessmentSummarySheet(workbook, params, knowledgeEvidence, performanceEvidence);
  createKnowledgeEvidenceSheet(workbook, knowledgeEvidence, 'assessment');
  createPerformanceEvidenceSheet(workbook, performanceEvidence, 'assessment');
  
  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate Learner Guide Report
 */
export async function generateLearnerGuideReport(
  params: AssessmentReportParams
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Separate knowledge and performance evidence
  const knowledgeEvidence = params.validationResults.filter(r => 
    r.requirement_type?.toLowerCase() === 'knowledge' || 
    r.requirement_number?.startsWith('KE')
  );
  
  const performanceEvidence = params.validationResults.filter(r => 
    r.requirement_type?.toLowerCase() === 'performance' || 
    r.requirement_number?.startsWith('PE')
  );
  
  // Create sheets
  createCoverSheet(workbook, params);
  createLearnerGuideSummarySheet(workbook, params, knowledgeEvidence, performanceEvidence);
  createPerformanceEvidenceSheet(workbook, performanceEvidence, 'learner-guide');
  createKnowledgeEvidenceSheet(workbook, knowledgeEvidence, 'learner-guide');
  
  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Create Cover Sheet
 */
function createCoverSheet(workbook: ExcelJS.Workbook, params: AssessmentReportParams) {
  const sheet = workbook.addWorksheet('Cover');
  
  // Set background
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
  };
  
  // Title area
  let row = 5;
  const titleCell = sheet.getCell(`B${row}`);
  titleCell.value = `${params.validationType === 'learner-guide' ? 'Learner Guide' : 'Assessment'} Validation Report`;
  titleCell.font = { bold: true, size: 24, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.COVER_BG}` },
  };
  sheet.mergeCells(`B${row}:D${row}`);
  sheet.getRow(row).height = 40;
  
  // Unit Information
  row += 3;
  const infoRows = [
    ['Unit Code:', params.unitCode],
    ['Unit Title:', params.unitTitle],
    ['RTO Name:', params.rtoName],
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
  
  // Set column widths
  sheet.getColumn('B').width = 20;
  sheet.getColumn('C').width = 40;
  sheet.getColumn('D').width = 20;
}

/**
 * Create Assessment Summary Sheet
 */
function createAssessmentSummarySheet(
  workbook: ExcelJS.Workbook,
  params: AssessmentReportParams,
  knowledgeEvidence: ValidationEvidenceRecord[],
  performanceEvidence: ValidationEvidenceRecord[]
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
  sheet.mergeCells(`B${row}:D${row}`);
  
  // Unit Information
  row += 2;
  sheet.getCell(`B${row}`).value = 'Unit Code:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitCode;
  row++;
  
  sheet.getCell(`B${row}`).value = 'Unit Title:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitTitle;
  row++;
  
  sheet.getCell(`B${row}`).value = 'RTO:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.rtoName;
  row++;
  
  // Validation Summary
  row += 2;
  sheet.getCell(`B${row}`).value = 'Validation Summary';
  sheet.getCell(`B${row}`).font = { bold: true, size: 12 };
  row++;
  
  const keMetCount = knowledgeEvidence.filter(r => r.status === 'met').length;
  const keTotalCount = knowledgeEvidence.length;
  const peMetCount = performanceEvidence.filter(r => r.status === 'met').length;
  const peTotalCount = performanceEvidence.length;
  
  const summaryData = [
    ['Knowledge Evidence', `${keMetCount}/${keTotalCount}`, `${keTotalCount > 0 ? Math.round((keMetCount / keTotalCount) * 100) : 0}%`],
    ['Performance Evidence', `${peMetCount}/${peTotalCount}`, `${peTotalCount > 0 ? Math.round((peMetCount / peTotalCount) * 100) : 0}%`],
  ];
  
  // Headers
  ['Category', 'Met/Total', 'Percentage'].forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
  });
  row++;
  
  summaryData.forEach(([category, metTotal, percentage]) => {
    sheet.getCell(row, 2).value = category;
    sheet.getCell(row, 3).value = metTotal;
    sheet.getCell(row, 4).value = percentage;
    row++;
  });
  
  // Set column widths
  sheet.getColumn('B').width = 25;
  sheet.getColumn('C').width = 15;
  sheet.getColumn('D').width = 15;
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
  sheet.mergeCells(`B${row}:D${row}`);
  
  // Unit Information
  row += 2;
  sheet.getCell(`B${row}`).value = 'Unit Code:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitCode;
  row++;
  
  sheet.getCell(`B${row}`).value = 'Unit Title:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.unitTitle;
  row++;
  
  sheet.getCell(`B${row}`).value = 'RTO:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = params.rtoName;
  row++;
  
  // Validation Summary
  row += 2;
  sheet.getCell(`B${row}`).value = 'Validation Summary';
  sheet.getCell(`B${row}`).font = { bold: true, size: 12 };
  row++;
  
  const peMetCount = performanceEvidence.filter(r => r.status === 'met').length;
  const peTotalCount = performanceEvidence.length;
  const keMetCount = knowledgeEvidence.filter(r => r.status === 'met').length;
  const keTotalCount = knowledgeEvidence.length;
  
  const summaryData = [
    ['Performance Evidence', `${peMetCount}/${peTotalCount}`, `${peTotalCount > 0 ? Math.round((peMetCount / peTotalCount) * 100) : 0}%`],
    ['Knowledge Evidence', `${keMetCount}/${keTotalCount}`, `${keTotalCount > 0 ? Math.round((keMetCount / keTotalCount) * 100) : 0}%`],
  ];
  
  // Headers
  ['Category', 'Met/Total', 'Percentage'].forEach((header, idx) => {
    const cell = sheet.getCell(row, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
  });
  row++;
  
  summaryData.forEach(([category, metTotal, percentage]) => {
    sheet.getCell(row, 2).value = category;
    sheet.getCell(row, 3).value = metTotal;
    sheet.getCell(row, 4).value = percentage;
    row++;
  });
  
  // Set column widths
  sheet.getColumn('B').width = 25;
  sheet.getColumn('C').width = 15;
  sheet.getColumn('D').width = 15;
}

/**
 * Create Knowledge Evidence Sheet
 */
function createKnowledgeEvidenceSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[],
  reportType: 'assessment' | 'learner-guide'
) {
  const sheet = workbook.addWorksheet('Knowledge Evidence');
  
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
  sheet.mergeCells(`B${row}:I${row}`);
  row += 2;
  
  // Headers
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Mapped Content',
    'Unmapped Content Reasoning',
    'Recommendations',
    'Document Reference',
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
    const parsed = parseRequirementNumber(item.requirement_number);
    
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_content || '';
    sheet.getCell(row, 6).value = item.reasoning || '';
    sheet.getCell(row, 7).value = item.benchmark_answer || '';
    sheet.getCell(row, 8).value = item.doc_references || '';
    
    // Apply text wrapping
    for (let col = 2; col <= 8; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths
  sheet.getColumn('B').width = 12;
  sheet.getColumn('C').width = 30;
  sheet.getColumn('D').width = 15;
  sheet.getColumn('E').width = 25;
  sheet.getColumn('F').width = 25;
  sheet.getColumn('G').width = 25;
  sheet.getColumn('H').width = 20;
}

/**
 * Create Performance Evidence Sheet
 */
function createPerformanceEvidenceSheet(
  workbook: ExcelJS.Workbook,
  data: ValidationEvidenceRecord[],
  reportType: 'assessment' | 'learner-guide'
) {
  const sheet = workbook.addWorksheet('Performance Evidence');
  
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
  sheet.mergeCells(`B${row}:I${row}`);
  row += 2;
  
  // Headers
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Mapped Content',
    'Unmapped Content Reasoning',
    'Recommendations',
    'Document Reference',
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
    const parsed = parseRequirementNumber(item.requirement_number);
    
    sheet.getCell(row, 2).value = item.requirement_number;
    sheet.getCell(row, 3).value = item.requirement_text;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_content || '';
    sheet.getCell(row, 6).value = item.reasoning || '';
    sheet.getCell(row, 7).value = item.benchmark_answer || '';
    sheet.getCell(row, 8).value = item.doc_references || '';
    
    // Apply text wrapping
    for (let col = 2; col <= 8; col++) {
      sheet.getCell(row, col).alignment = { wrapText: true, vertical: 'top' };
    }
    
    row++;
  });
  
  // Set column widths
  sheet.getColumn('B').width = 12;
  sheet.getColumn('C').width = 30;
  sheet.getColumn('D').width = 15;
  sheet.getColumn('E').width = 25;
  sheet.getColumn('F').width = 25;
  sheet.getColumn('G').width = 25;
  sheet.getColumn('H').width = 20;
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
