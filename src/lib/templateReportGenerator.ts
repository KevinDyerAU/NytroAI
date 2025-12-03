/**
 * Template-Based Report Generator
 * 
 * Generates Excel reports by loading and populating template files
 * based on validation type (learner-guide, assessment, unit)
 */

import * as XLSX from 'xlsx';

export interface ReportGenerationParams {
  validationDetailId: number;
  unitCode: string;
  unitTitle: string;
  rtoName: string;
  rtoCode: string;
  validationType: 'learner-guide' | 'assessment' | 'unit';
  validationResults: any[];
  createdDate?: string;
}

export interface GeneratedReport {
  success: boolean;
  filename: string;
  data?: ArrayBuffer;
  error?: string;
}

/**
 * Map validation types to template files
 */
function getTemplateFilePath(validationType: string): string {
  const baseUrl = '/excel-templates';
  
  switch (validationType.toLowerCase()) {
    case 'learner-guide':
      return `${baseUrl}/LGValidationTemplate.xlsx`;
    case 'assessment':
    case 'unit':
    default:
      return `${baseUrl}/UnitValidationTemplate.xlsx`;
  }
}

/**
 * Generate filename for the report
 */
function generateReportFilename(
  unitCode: string,
  validationType: string,
  rtoCode: string
): string {
  const date = new Date().toISOString().split('T')[0];
  const typeLabel = validationType === 'learner-guide' ? 'Learner-Guide' : 'Assessment';
  return `${rtoCode}_${unitCode}_${typeLabel}_Report_${date}.xlsx`;
}

/**
 * Load template file from public folder
 */
async function loadTemplate(templatePath: string): Promise<XLSX.WorkBook> {
  try {
    console.log(`[templateReportGenerator] Loading template from: ${templatePath}`);
    
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    console.log(`[templateReportGenerator] Template loaded successfully`);
    console.log(`[templateReportGenerator] Worksheets: ${workbook.SheetNames.join(', ')}`);
    
    return workbook;
  } catch (error) {
    console.error('[templateReportGenerator] Error loading template:', error);
    throw error;
  }
}

/**
 * Populate template with validation data
 */
function populateTemplate(
  workbook: XLSX.WorkBook,
  params: ReportGenerationParams
): XLSX.WorkBook {
  try {
    console.log(`[templateReportGenerator] Populating template with data`);
    
    // Update Summary sheet
    if (workbook.Sheets['Summary']) {
      const summarySheet = workbook.Sheets['Summary'];
      
      // Add metadata
      summarySheet['B2'] = { t: 's', v: params.unitCode };
      summarySheet['B3'] = { t: 's', v: params.unitTitle };
      summarySheet['B4'] = { t: 's', v: params.rtoName };
      summarySheet['B5'] = { t: 's', v: params.rtoCode };
      summarySheet['B6'] = { t: 's', v: params.createdDate || new Date().toISOString().split('T')[0] };
      summarySheet['B7'] = { t: 's', v: params.validationType };
      
      // Add statistics
      const totalRequirements = params.validationResults.length;
      const metRequirements = params.validationResults.filter(r => r.status === 'Met').length;
      const partialRequirements = params.validationResults.filter(r => r.status === 'Partial').length;
      const notMetRequirements = params.validationResults.filter(r => r.status === 'Not Met').length;
      
      summarySheet['B10'] = { t: 'n', v: totalRequirements };
      summarySheet['B11'] = { t: 'n', v: metRequirements };
      summarySheet['B12'] = { t: 'n', v: partialRequirements };
      summarySheet['B13'] = { t: 'n', v: notMetRequirements };
      
      const compliancePercentage = totalRequirements > 0 
        ? ((metRequirements / totalRequirements) * 100).toFixed(1)
        : '0';
      summarySheet['B14'] = { t: 'n', v: parseFloat(compliancePercentage) };
    }
    
    // Update Knowledge Evidence sheet
    if (workbook.Sheets['Knowledge Evidence']) {
      const keSheet = workbook.Sheets['Knowledge Evidence'];
      const keData = params.validationResults.filter(r => 
        r.requirement_type?.toUpperCase().includes('KE') || 
        r.requirement_type?.toUpperCase().includes('KNOWLEDGE')
      );
      
      populateEvidenceSheet(keSheet, keData, 'Knowledge Evidence');
    }
    
    // Update Performance Evidence sheet
    if (workbook.Sheets['Performance Evidence']) {
      const peSheet = workbook.Sheets['Performance Evidence'];
      const peData = params.validationResults.filter(r => 
        r.requirement_type?.toUpperCase().includes('PE') || 
        r.requirement_type?.toUpperCase().includes('PERFORMANCE')
      );
      
      populateEvidenceSheet(peSheet, peData, 'Performance Evidence');
    }
    
    console.log(`[templateReportGenerator] Template populated successfully`);
    return workbook;
  } catch (error) {
    console.error('[templateReportGenerator] Error populating template:', error);
    throw error;
  }
}

/**
 * Populate evidence sheet with requirement data
 */
function populateEvidenceSheet(
  sheet: XLSX.WorkSheet,
  data: any[],
  sheetName: string
): void {
  console.log(`[templateReportGenerator] Populating ${sheetName} with ${data.length} records`);
  
  let rowIndex = 3; // Start after header rows
  
  for (const record of data) {
    const cellPrefix = String.fromCharCode(65 + (rowIndex - 3) % 26); // Column letter
    
    // Requirement Number
    sheet[`A${rowIndex}`] = { t: 's', v: record.requirement_number || '' };
    
    // Requirement Text
    sheet[`B${rowIndex}`] = { t: 's', v: record.requirement_text || '' };
    
    // Status with color coding
    const status = record.status || 'Not Met';
    sheet[`C${rowIndex}`] = { t: 's', v: status };
    
    // Apply color based on status
    const statusColor = getStatusColor(status);
    if (statusColor) {
      sheet[`C${rowIndex}`].s = { fill: { fgColor: { rgb: statusColor } } };
    }
    
    // Mapped Content
    sheet[`D${rowIndex}`] = { t: 's', v: record.mapped_content || '' };
    
    // Unmapped Content Reasoning
    sheet[`E${rowIndex}`] = { t: 's', v: record.reasoning || '' };
    
    // Recommendations
    sheet[`F${rowIndex}`] = { t: 's', v: record.benchmark_answer || '' };
    
    // Document Reference
    sheet[`G${rowIndex}`] = { t: 's', v: record.doc_references || '' };
    
    rowIndex++;
  }
}

/**
 * Get color code for status
 */
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'met':
      return 'FF00B050'; // Green
    case 'partial':
      return 'FFFFFF00'; // Yellow
    case 'not met':
    default:
      return 'FFFF0000'; // Red
  }
}

/**
 * Generate and download report
 */
export async function generateReportFromTemplate(
  params: ReportGenerationParams
): Promise<GeneratedReport> {
  try {
    console.log(`[templateReportGenerator] Starting report generation for ${params.validationType}`);
    
    // Get template path based on validation type
    const templatePath = getTemplateFilePath(params.validationType);
    
    // Load template
    const workbook = await loadTemplate(templatePath);
    
    // Populate with data
    const populatedWorkbook = populateTemplate(workbook, params);
    
    // Generate filename
    const filename = generateReportFilename(params.unitCode, params.validationType, params.rtoCode);
    
    // Write to buffer
    const buffer = XLSX.write(populatedWorkbook, { type: 'array' });
    
    console.log(`[templateReportGenerator] Report generated successfully: ${filename}`);
    
    return {
      success: true,
      filename,
      data: buffer
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[templateReportGenerator] Error generating report:', errorMessage);
    
    return {
      success: false,
      filename: '',
      error: errorMessage
    };
  }
}

/**
 * Download report file
 */
export function downloadReport(data: ArrayBuffer, filename: string): void {
  try {
    console.log(`[templateReportGenerator] Downloading report: ${filename}`);
    
    const blob = new Blob([data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`[templateReportGenerator] Report downloaded successfully`);
  } catch (error) {
    console.error('[templateReportGenerator] Error downloading report:', error);
    throw error;
  }
}
