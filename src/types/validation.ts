export interface Validation {
  id: string;
  unitCode: string;
  unitTitle: string;
  validationType: 'learner-guide' | 'assessment' | 'unit';
  validationDate: string;
  status: 'validated' | 'docExtracted' | 'reqExtracted' | 'pending';
  progress: number;
  sector: string;
  rtoId: string;
  documentsValidated?: number;
  requirementsChecked?: number;
  totalRequirements?: number;
  reportSigned?: boolean;
}

export const mockValidations: Validation[] = [
  // RTO-001 validations
  {
    id: 'val-001',
    unitCode: 'BSBWHS521',
    unitTitle: 'Ensure a safe workplace for a work area',
    validationType: 'learner-guide',
    validationDate: '2024-10-28',
    status: 'validated',
    progress: 85,
    sector: 'Business Services',
    rtoId: 'rto-001',
    documentsValidated: 1,
    requirementsChecked: 12,
    totalRequirements: 15,
    reportSigned: true
  },
  {
    id: 'val-002',
    unitCode: 'BSBWHS521',
    unitTitle: 'Ensure a safe workplace for a work area',
    validationType: 'assessment',
    validationDate: '2024-10-27',
    status: 'validated',
    progress: 92,
    sector: 'Business Services',
    rtoId: 'rto-001',
    documentsValidated: 1,
    requirementsChecked: 8,
    totalRequirements: 10,
    reportSigned: false
  },
  {
    id: 'val-003',
    unitCode: 'BSBCMM511',
    unitTitle: 'Communicate with influence',
    validationType: 'learner-guide',
    validationDate: '2024-10-26',
    status: 'docExtracted',
    progress: 60,
    sector: 'Business Services',
    rtoId: 'rto-001',
    documentsValidated: 1,
    requirementsChecked: 15,
    totalRequirements: 22,
    reportSigned: false
  },
  // RTO-002 validations
  {
    id: 'val-004',
    unitCode: 'CHCAGE001',
    unitTitle: 'Facilitate the empowerment of older people',
    validationType: 'unit',
    validationDate: '2024-10-25',
    status: 'reqExtracted',
    progress: 35,
    sector: 'Community Services',
    rtoId: 'rto-002',
    documentsValidated: 0,
    requirementsChecked: 10,
    totalRequirements: 18,
    reportSigned: false
  },
  {
    id: 'val-005',
    unitCode: 'HLTAID011',
    unitTitle: 'Provide First Aid',
    validationType: 'learner-guide',
    validationDate: '2024-10-24',
    status: 'pending',
    progress: 20,
    sector: 'Health',
    rtoId: 'rto-002',
    documentsValidated: 0,
    requirementsChecked: 0,
    totalRequirements: 20,
    reportSigned: false
  },
  {
    id: 'val-006',
    unitCode: 'CHCCOM005',
    unitTitle: 'Communicate and work in health or community services',
    validationType: 'assessment',
    validationDate: '2024-10-23',
    status: 'validated',
    progress: 78,
    sector: 'Community Services',
    rtoId: 'rto-002',
    documentsValidated: 1,
    requirementsChecked: 6,
    totalRequirements: 8,
    reportSigned: false
  },
  // RTO-003 validations
  {
    id: 'val-007',
    unitCode: 'ICTPRG302',
    unitTitle: 'Apply introductory programming techniques',
    validationType: 'learner-guide',
    validationDate: '2024-10-22',
    status: 'validated',
    progress: 95,
    sector: 'Information Technology',
    rtoId: 'rto-003',
    documentsValidated: 1,
    requirementsChecked: 18,
    totalRequirements: 19,
    reportSigned: false
  },
  {
    id: 'val-008',
    unitCode: 'ICTSAS527',
    unitTitle: 'Manage client problems',
    validationType: 'assessment',
    validationDate: '2024-10-21',
    status: 'validated',
    progress: 88,
    sector: 'Information Technology',
    rtoId: 'rto-003',
    documentsValidated: 1,
    requirementsChecked: 14,
    totalRequirements: 16,
    reportSigned: false
  },
  {
    id: 'val-009',
    unitCode: 'BSBXCS303',
    unitTitle: 'Securely manage personally identifiable information and workplace information',
    validationType: 'unit',
    validationDate: '2024-10-20',
    status: 'docExtracted',
    progress: 55,
    sector: 'Business Services',
    rtoId: 'rto-003',
    documentsValidated: 1,
    requirementsChecked: 12,
    totalRequirements: 24,
    reportSigned: false
  },
  // RTO-004 validations
  {
    id: 'val-010',
    unitCode: 'BSBWOR502',
    unitTitle: 'Lead and manage team effectiveness',
    validationType: 'learner-guide',
    validationDate: '2024-10-19',
    status: 'validated',
    progress: 82,
    sector: 'Business Services',
    rtoId: 'rto-004',
    documentsValidated: 1,
    requirementsChecked: 16,
    totalRequirements: 20,
    reportSigned: true
  },
  {
    id: 'val-011',
    unitCode: 'BSBWOR502',
    unitTitle: 'Lead and manage team effectiveness',
    validationType: 'assessment',
    validationDate: '2024-10-18',
    status: 'validated',
    progress: 90,
    sector: 'Business Services',
    rtoId: 'rto-004',
    documentsValidated: 1,
    requirementsChecked: 10,
    totalRequirements: 12,
    reportSigned: false
  },
];

export function getValidationTypeLabel(type: string): string {
  switch (type) {
    case 'learner-guide':
      return 'Learner Guide';
    case 'assessment':
      return 'Assessment';
    case 'unit':
      return 'Unit Validation';
    default:
      return type;
  }
}

export function formatValidationDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export type ValidationStage = 'pending' | 'requirements' | 'documents' | 'validated';

export interface ValidationWorkflowStage {
  stage: ValidationStage;
  label: string;
  description: string;
  isCurrent: boolean;
  isComplete: boolean;
}

export function getValidationStage(
  extractStatus: string,
  docExtracted: boolean,
  reqExtracted: boolean,
  numOfReq: number,
  completedCount: number
): ValidationStage {
  // Stage 4: Fully validated (all requirements completed)
  if (numOfReq > 0 && completedCount >= numOfReq) {
    return 'validated';
  }

  // Stage 3: Documents extracted (requirements validation in progress or completed)
  if (docExtracted) {
    return 'documents';
  }

  // Stage 2: Document Processing (files uploaded, AI is learning from documents)
  if (extractStatus === 'DocumentProcessing') {
    return 'requirements';
  }

  // Stage 2: Requirements extracted
  if (reqExtracted) {
    return 'requirements';
  }

  // Stage 1: Pending (default - includes "Uploading" status)
  return 'pending';
}

export function getValidationWorkflow(
  extractStatus: string,
  docExtracted: boolean,
  reqExtracted: boolean,
  numOfReq: number,
  completedCount: number
): ValidationWorkflowStage[] {
  const currentStage = getValidationStage(extractStatus, docExtracted, reqExtracted, numOfReq, completedCount);
  const stageOrder: ValidationStage[] = ['pending', 'requirements', 'documents', 'validated'];
  const currentIndex = stageOrder.indexOf(currentStage);

  return [
    {
      stage: 'pending',
      label: 'Pending',
      description: 'Validation initiated, awaiting processing',
      isCurrent: currentStage === 'pending',
      isComplete: currentIndex > 0,
    },
    {
      stage: 'requirements',
      label: 'Requirements',
      description: 'AI extracting requirements from various standards',
      isCurrent: currentStage === 'requirements',
      isComplete: currentIndex > 1,
    },
    {
      stage: 'documents',
      label: 'Documents',
      description: 'AI checking all documents against requirements',
      isCurrent: currentStage === 'documents',
      isComplete: currentIndex > 2,
    },
    {
      stage: 'validated',
      label: 'Validated',
      description: 'Processing - all requirements being checked against evidence',
      isCurrent: currentStage === 'validated',
      isComplete: currentIndex > 3,
    },
  ];
}
