/**
 * Excel Report Generator
 * Client-side Excel generation using ExcelJS
 */

import ExcelJS from 'exceljs';

// Color scheme
const COLORS = {
  HEADER: '4472C4',      // Blue
  TITLE: '2F5496',       // Dark Blue
  MET: 'C6EFCE',         // Light Green
  PARTIAL: 'FFEB9C',     // Light Yellow
  NOT_MET: 'FFC7CE',     // Light Red
};

export interface ValidationReportData {
  unit_code: string;
  unit_title: string;
  rto_name: string;
  overall_status: string;
  overall_score: number;
  epc_status?: string;
  epc_score?: number;
  fs_status?: string;
  fs_score?: number;
  pe_status?: string;
  pe_score?: number;
  ke_status?: string;
  ke_score?: number;
  ac_status?: string;
  ac_score?: number;
  ai_status?: string;
  ai_score?: number;
  elements_criteria: any[];
  foundation_skills?: any[];
  performance_evidence: any[];
  knowledge_evidence: any[];
  assessment_conditions?: any[];
  assessment_instructions?: any;
}

/**
 * Generate Unit Validation Report
 */
export async function generateUnitValidationReport(
  data: ValidationReportData
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Create sheets
  createSummarySheet(workbook, data, 'unit');
  createEPCSheet(workbook, data);
  createFoundationSkillsSheet(workbook, data);
  createPerformanceEvidenceSheet(workbook, data);
  createKnowledgeEvidenceSheet(workbook, data);
  createAssessmentConditionsSheet(workbook, data);
  createAssessmentInstructionsSheet(workbook, data);
  
  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate Learner Guide Validation Report
 */
export async function generateLearnerGuideReport(
  data: ValidationReportData
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Create sheets
  createSummarySheet(workbook, data, 'learner_guide');
  createEPCLGSheet(workbook, data);
  createPerformanceEvidenceLGSheet(workbook, data);
  createKnowledgeEvidenceLGSheet(workbook, data);
  
  // Generate buffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Create Summary Sheet
 */
function createSummarySheet(
  workbook: ExcelJS.Workbook,
  data: ValidationReportData,
  reportType: 'unit' | 'learner_guide'
) {
  const sheet = workbook.addWorksheet('Summary');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = `${reportType === 'unit' ? 'Unit' : 'Learner Guide'} Validation Report`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLORS.TITLE}` },
  };
  sheet.mergeCells('B2:D2');
  
  // Unit Information
  let row = 4;
  const unitInfo = [
    ['Unit Code:', data.unit_code],
    ['Unit Title:', data.unit_title],
    ['RTO:', data.rto_name],
    ['Validation Date:', new Date().toISOString().split('T')[0]],
    ['Validated By:', 'Nytro AI Validator'],
  ];
  
  unitInfo.forEach(([label, value]) => {
    sheet.getCell(`B${row}`).value = label;
    sheet.getCell(`B${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = value;
    row++;
  });
  
  // Overall Status
  row += 2;
  sheet.getCell(`B${row}`).value = 'Overall Validation Status';
  sheet.getCell(`B${row}`).font = { bold: true, size: 14 };
  row++;
  
  sheet.getCell(`B${row}`).value = 'Status:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = data.overall_status;
  applyStatusFill(sheet.getCell(`C${row}`), data.overall_status);
  row++;
  
  sheet.getCell(`B${row}`).value = 'Score:';
  sheet.getCell(`B${row}`).font = { bold: true };
  sheet.getCell(`C${row}`).value = `${data.overall_score}%`;
  row++;
  
  // Validation Summary by Category
  row += 2;
  sheet.getCell(`B${row}`).value = 'Validation Summary by Category';
  sheet.getCell(`B${row}`).font = { bold: true, size: 14 };
  row++;
  
  // Headers
  ['B', 'C', 'D'].forEach((col, idx) => {
    const cell = sheet.getCell(`${col}${row}`);
    cell.value = ['Category', 'Status', 'Score'][idx];
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
  });
  row++;
  
  // Categories
  const categories = reportType === 'unit'
    ? [
        ['Elements & Performance Criteria', data.epc_status, data.epc_score],
        ['Foundation Skills', data.fs_status, data.fs_score],
        ['Performance Evidence', data.pe_status, data.pe_score],
        ['Knowledge Evidence', data.ke_status, data.ke_score],
        ['Assessment Conditions', data.ac_status, data.ac_score],
        ['Assessment Instructions', data.ai_status, data.ai_score],
      ]
    : [
        ['Elements & Performance Criteria', data.epc_status, data.epc_score],
        ['Performance Evidence', data.pe_status, data.pe_score],
        ['Knowledge Evidence', data.ke_status, data.ke_score],
      ];
  
  categories.forEach(([category, status, score]) => {
    sheet.getCell(`B${row}`).value = category;
    sheet.getCell(`C${row}`).value = status || 'N/A';
    applyStatusFill(sheet.getCell(`C${row}`), status as string);
    sheet.getCell(`D${row}`).value = score != null ? `${score}%` : 'N/A';
    row++;
  });
  
  // Set column widths
  sheet.getColumn('B').width = 35;
  sheet.getColumn('C').width = 20;
  sheet.getColumn('D').width = 15;
}

/**
 * Create E&P Criteria Sheet (Unit)
 */
function createEPCSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('E&P Criteria');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Elements & Performance Criteria';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:K2');
  
  // Headers
  const headers = [
    'Element',
    'Performance Criterion',
    'Description',
    'Mapping Status',
    'Mapped Questions',
    'Unmapped Question Reasoning',
    'Recommendations',
    'SMART Question',
    'Benchmark Answer',
    'Document References',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  data.elements_criteria.forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.element;
    sheet.getCell(row, 3).value = item.criterion;
    sheet.getCell(row, 4).value = item.description;
    sheet.getCell(row, 5).value = item.status;
    applyStatusFill(sheet.getCell(row, 5), item.status);
    sheet.getCell(row, 6).value = item.mapped_questions;
    sheet.getCell(row, 7).value = item.unmapped_reasoning;
    sheet.getCell(row, 8).value = item.recommendations;
    sheet.getCell(row, 9).value = item.smart_question;
    sheet.getCell(row, 10).value = item.benchmark_answer;
    sheet.getCell(row, 11).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 30;
  sheet.getColumn(5).width = 15;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 30;
  sheet.getColumn(9).width = 30;
  sheet.getColumn(10).width = 30;
  sheet.getColumn(11).width = 20;
}

/**
 * Create E&P Criteria Sheet (Learner Guide)
 */
function createEPCLGSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('E&P Criteria');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Elements & Performance Criteria';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:I2');
  
  // Headers
  const headers = [
    'Number',
    'Element',
    'Performance Criterion',
    'Mapping Status',
    'Mapped Content',
    'Unmapped Question Reasoning',
    'Recommendations',
    'Document References',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  data.elements_criteria.forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.number;
    sheet.getCell(row, 3).value = item.element;
    sheet.getCell(row, 4).value = item.criterion;
    sheet.getCell(row, 5).value = item.status;
    applyStatusFill(sheet.getCell(row, 5), item.status);
    sheet.getCell(row, 6).value = item.mapped_content;
    sheet.getCell(row, 7).value = item.unmapped_reasoning;
    sheet.getCell(row, 8).value = item.recommendations;
    sheet.getCell(row, 9).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 30;
  sheet.getColumn(5).width = 15;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 30;
  sheet.getColumn(9).width = 20;
}

/**
 * Create Foundation Skills Sheet
 */
function createFoundationSkillsSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Foundation Skills');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Foundation Skills';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:J2');
  
  // Headers
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Mapped Questions',
    'Unmapped Question Reasoning',
    'Unmapped Question Recommendations',
    'SMART Question',
    'Benchmark Answer',
    'Document References',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  (data.foundation_skills || []).forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.number;
    sheet.getCell(row, 3).value = item.requirement;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_questions;
    sheet.getCell(row, 6).value = item.unmapped_reasoning;
    sheet.getCell(row, 7).value = item.recommendations;
    sheet.getCell(row, 8).value = item.smart_question;
    sheet.getCell(row, 9).value = item.benchmark_answer;
    sheet.getCell(row, 10).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 30;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 30;
  sheet.getColumn(9).width = 30;
  sheet.getColumn(10).width = 20;
}

/**
 * Create Performance Evidence Sheet (Unit)
 */
function createPerformanceEvidenceSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Performance Evidence');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Performance Evidence';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:J2');
  
  // Headers
  const headers = [
    'Performance Criteria',
    'Requirement',
    'Mapping Status',
    'Mapped Questions',
    'Unmapped Question Reasoning',
    'Unmapped Question Recommendations',
    'Practical Task',
    'Benchmark Answer',
    'Document References',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  data.performance_evidence.forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.number;
    sheet.getCell(row, 3).value = item.requirement;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_questions;
    sheet.getCell(row, 6).value = item.unmapped_reasoning;
    sheet.getCell(row, 7).value = item.recommendations;
    sheet.getCell(row, 8).value = item.practical_task;
    sheet.getCell(row, 9).value = item.benchmark_answer;
    sheet.getCell(row, 10).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 30;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 30;
  sheet.getColumn(9).width = 30;
  sheet.getColumn(10).width = 20;
}

/**
 * Create Performance Evidence Sheet (Learner Guide)
 */
function createPerformanceEvidenceLGSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Performance Evidence');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Performance Evidence';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:H2');
  
  // Headers
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Mapped Content',
    'Unmapped Content Reasoning',
    'Recommendations',
    'Document References',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  data.performance_evidence.forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.number;
    sheet.getCell(row, 3).value = item.requirement;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_content;
    sheet.getCell(row, 6).value = item.unmapped_reasoning;
    sheet.getCell(row, 7).value = item.recommendations;
    sheet.getCell(row, 8).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 30;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 20;
}

/**
 * Create Knowledge Evidence Sheet (Unit)
 */
function createKnowledgeEvidenceSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Knowledge Evidence');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Knowledge Evidence';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:J2');
  
  // Headers
  const headers = [
    'Number',
    'Requirement',
    'Mapping Status',
    'Mapped Questions',
    'Unmapped Question Reasoning',
    'Unmapped Question Recommendations',
    'SMART Question',
    'Benchmark Answer',
    'Document References',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  data.knowledge_evidence.forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.number;
    sheet.getCell(row, 3).value = item.requirement;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_questions;
    sheet.getCell(row, 6).value = item.unmapped_reasoning;
    sheet.getCell(row, 7).value = item.recommendations;
    sheet.getCell(row, 8).value = item.smart_question;
    sheet.getCell(row, 9).value = item.benchmark_answer;
    sheet.getCell(row, 10).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 30;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 30;
  sheet.getColumn(9).width = 30;
  sheet.getColumn(10).width = 20;
}

/**
 * Create Knowledge Evidence Sheet (Learner Guide)
 */
function createKnowledgeEvidenceLGSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Knowledge Evidence');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Knowledge Evidence';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:H2');
  
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
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  data.knowledge_evidence.forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.number;
    sheet.getCell(row, 3).value = item.requirement;
    sheet.getCell(row, 4).value = item.status;
    applyStatusFill(sheet.getCell(row, 4), item.status);
    sheet.getCell(row, 5).value = item.mapped_content;
    sheet.getCell(row, 6).value = item.unmapped_reasoning;
    sheet.getCell(row, 7).value = item.recommendations;
    sheet.getCell(row, 8).value = item.doc_references;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 30;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 30;
  sheet.getColumn(8).width = 20;
}

/**
 * Create Assessment Conditions Sheet
 */
function createAssessmentConditionsSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Assessment Conditions');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Assessment Conditions';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:E2');
  
  // Headers
  const headers = ['Assessment Condition', 'Status', 'Reasoning', 'Recommendation'];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data rows
  (data.assessment_conditions || []).forEach((item, idx) => {
    const row = idx + 4;
    sheet.getCell(row, 2).value = item.condition;
    sheet.getCell(row, 3).value = item.status;
    applyStatusFill(sheet.getCell(row, 3), item.status);
    sheet.getCell(row, 4).value = item.reasoning;
    sheet.getCell(row, 5).value = item.recommendation;
  });
  
  // Set column widths
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 40;
  sheet.getColumn(5).width = 40;
}

/**
 * Create Assessment Instructions Sheet
 */
function createAssessmentInstructionsSheet(workbook: ExcelJS.Workbook, data: ValidationReportData) {
  const sheet = workbook.addWorksheet('Assessment Instructions');
  
  // Title
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'Assessment Instructions';
  titleCell.font = { bold: true, size: 14 };
  sheet.mergeCells('B2:H2');
  
  // Headers
  const headers = [
    'Assessment Methods',
    'Evidence Requirements',
    'Clarity and Language',
    'Consistency',
    'Assessment Review Process',
    'Reasonable Adjustments',
    'Resubmission And Reassessment Policy',
  ];
  
  headers.forEach((header, idx) => {
    const cell = sheet.getCell(3, idx + 2);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${COLORS.HEADER}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  
  // Data row
  const ai = data.assessment_instructions || {};
  sheet.getCell(4, 2).value = ai.assessment_methods;
  sheet.getCell(4, 3).value = ai.evidence_requirements;
  sheet.getCell(4, 4).value = ai.clarity_and_language;
  sheet.getCell(4, 5).value = ai.consistency;
  sheet.getCell(4, 6).value = ai.assessment_review_process;
  sheet.getCell(4, 7).value = ai.reasonable_adjustments;
  sheet.getCell(4, 8).value = ai.resubmission_policy;
  
  // Set column widths
  for (let col = 2; col <= 8; col++) {
    sheet.getColumn(col).width = 30;
  }
}

/**
 * Apply status-based fill color to cell
 */
function applyStatusFill(cell: ExcelJS.Cell, status: string) {
  if (!status) return;
  
  const statusLower = status.toLowerCase();
  let color: string;
  
  if (statusLower.includes('met') && !statusLower.includes('not')) {
    if (statusLower.includes('partial')) {
      color = COLORS.PARTIAL;
    } else {
      color = COLORS.MET;
    }
  } else if (statusLower.includes('not met') || statusLower.includes('fail')) {
    color = COLORS.NOT_MET;
  } else {
    return;
  }
  
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${color}` },
  };
}

/**
 * Download Excel file
 */
export function downloadExcelFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
