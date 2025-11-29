import { create } from 'zustand';

export interface ValidationProgress {
  id: number;
  unitCode: string;
  qualificationCode: string;
  validationType: string;
  documentType?: string;
  status: 'pending' | 'reqExtracted' | 'docExtracted' | 'validated';
  progress: number;
  docExtracted: boolean;
  reqExtracted: boolean;
  reqTotal: number;
  completedCount: number;
  createdAt: string;
}

export interface ValidationResult {
  id: number;
  requirementNumber: string;
  type: string;
  requirementText: string;
  status: 'met' | 'not-met' | 'partial';
  reasoning: string;
  evidence: {
    mappedQuestions: string[];
    unmappedReasoning: string;
    documentReferences: (string | number)[];
  };
  aiEnhancement: {
    smartQuestion: string;
    benchmarkAnswer: string;
    recommendations: string[];
  };
}

interface ValidationState {
  currentValidationId: number | null;
  validationProgress: ValidationProgress | null;
  validationResults: ValidationResult[];
  isLoading: boolean;
  error: string | null;
  
  setCurrentValidation: (validationId: number) => void;
  setValidationProgress: (progress: ValidationProgress | null) => void;
  setValidationResults: (results: ValidationResult[]) => void;
  updateValidationResult: (resultId: number, result: ValidationResult) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetValidation: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  currentValidationId: null,
  validationProgress: null,
  validationResults: [],
  isLoading: false,
  error: null,

  setCurrentValidation: (validationId) =>
    set({ currentValidationId: validationId }),

  setValidationProgress: (progress) =>
    set({ validationProgress: progress }),

  setValidationResults: (results) =>
    set({ validationResults: results }),

  updateValidationResult: (resultId, result) =>
    set((state) => ({
      validationResults: state.validationResults.map((r) =>
        r.id === resultId ? result : r
      ),
    })),

  setIsLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  resetValidation: () =>
    set({
      currentValidationId: null,
      validationProgress: null,
      validationResults: [],
      error: null,
    }),
}));
