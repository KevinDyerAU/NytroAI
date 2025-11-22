/**
 * Unit Tests for ValidationService_v2
 * Phase 4.2 - Robust Error Handling and Retry Logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock Supabase using factory function
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    },
    from: vi.fn()
  }
}))

// Mock environment variables
vi.mock('../lib/env', () => ({
  VITE_SUPABASE_URL: 'https://dfqxmjmggokneiuljkta.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDg0NjIsImV4cCI6MjA3NzE4NDQ2Mn0.vPf2oAVXSZPNvWip08QLNvvHGx1dT8njRQdS568OxkE'
}))

// Import after mocking
import { supabase } from '../lib/supabase'
import { 
  validateAssessmentV2, 
  regenerateSmartQuestions, 
  getValidationResults,
  validateValidationRequest,
  validateRegenerationRequest,
  type ValidationRequest,
  type RegenerateRequest
} from '../services/ValidationService_v2'

// Cast the mocked functions to properly typed vi.fn()
const mockFunctionsInvoke = supabase.functions.invoke as any
const mockFrom = supabase.from as any

describe('ValidationService_v2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default fetch mock
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateValidationRequest', () => {
    it('should validate correct request', () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X',
        options: {
          difficultyLevel: 'intermediate'
        }
      }

      const result = validateValidationRequest(request)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject request without documentId', () => {
      const request = {
        unitCode: 'BSBWHS332X'
      } as ValidationRequest

      const result = validateValidationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Document ID is required')
    })

    it('should reject request without unitCode', () => {
      const request = {
        documentId: 'test-id'
      } as ValidationRequest

      const result = validateValidationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Unit code is required')
    })

    it('should reject invalid difficulty level', () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X',
        options: {
          difficultyLevel: 'invalid' as any
        }
      }

      const result = validateValidationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid difficulty level. Must be basic, intermediate, or advanced')
    })
  })

  describe('validateRegenerationRequest', () => {
    it('should validate correct request', () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-validation-id',
        userContext: 'Test context',
        options: {
          difficultyLevel: 'advanced',
          questionCount: 2
        }
      }

      const result = validateRegenerationRequest(request)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject request without validationResultId', () => {
      const request = {
        userContext: 'Test context'
      } as RegenerateRequest

      const result = validateRegenerationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Validation result ID is required')
    })

    it('should reject invalid difficulty level', () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-id',
        options: {
          difficultyLevel: 'invalid' as any
        }
      }

      const result = validateRegenerationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid difficulty level. Must be basic, intermediate, or advanced')
    })

    it('should reject question count too low', () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-id',
        options: {
          questionCount: 0
        }
      }

      const result = validateRegenerationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Question count must be between 1 and 10')
    })

    it('should reject question count too high', () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-id',
        options: {
          questionCount: 11
        }
      }

      const result = validateRegenerationRequest(request)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Question count must be between 1 and 10')
    })
  })

  describe('validateAssessmentV2', () => {
    it('should successfully validate assessment', async () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X',
        options: {
          includeSmartQuestions: true,
          difficultyLevel: 'intermediate'
        }
      }

      mockFunctionsInvoke.mockResolvedValue({
        data: { validationId: 'validation-123' },
        error: null
      })

      const result = await validateAssessmentV2(request)

      expect(result.success).toBe(true)
      expect(result.validationId).toBe('validation-123')
      expect(result.message).toBe('Validation started successfully')
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('validate-assessment-v2', {
        body: {
          documentId: 'test-id',
          unitCode: 'BSBWHS332X',
          validationType: 'full_validation',
          options: {
            includeSmartQuestions: true,
            difficultyLevel: 'intermediate',
            enableRegeneration: true
          }
        }
      })
    })

    it('should handle validation error with retry', async () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X'
      }

      // Mock retryable error on first attempt, success on second
      mockFunctionsInvoke
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'timeout' }
        })
        .mockResolvedValueOnce({
          data: { validationId: 'validation-123' },
          error: null
        })

      const result = await validateAssessmentV2(request)

      expect(result.success).toBe(true)
      expect(mockFunctionsInvoke).toHaveBeenCalledTimes(2)
    })

    it('should handle non-retryable error', async () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X'
      }

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Document not found' }
      })

      const result = await validateAssessmentV2(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('📄 Document not found. Please ensure the document was uploaded successfully.')
      expect(mockFunctionsInvoke).toHaveBeenCalledTimes(1)
    })

    it('should handle Response body error', async () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X'
      }

      const mockResponse = new Response('{"error": "Validation service error"}', {
        status: 400
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { 
          message: 'Validation service error',
          context: mockResponse
        }
      })

      const result = await validateAssessmentV2(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('❌ An error occurred during validation. Please try again or contact support.')
    })

    it('should handle max retries exceeded', async () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X'
      }

      // Always return timeout error
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'timeout' }
      })

      const result = await validateAssessmentV2(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Validation failed after multiple attempts')
      expect(result.error).toBe('Max retries exceeded')
      expect(mockFunctionsInvoke).toHaveBeenCalledTimes(3)
    })

    it('should handle unexpected error', async () => {
      const request: ValidationRequest = {
        documentId: 'test-id',
        unitCode: 'BSBWHS332X'
      }

      mockFunctionsInvoke.mockRejectedValue(new Error('Network error'))

      const result = await validateAssessmentV2(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Validation failed due to an unexpected error')
      expect(result.error).toBe('Network error')
    })
  })

  describe('regenerateSmartQuestions', () => {
    it('should successfully regenerate smart questions', async () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-validation-id',
        userContext: 'Focus on practical examples',
        currentQuestion: 'Old question',
        currentAnswer: 'Old answer',
        options: {
          difficultyLevel: 'advanced'
        }
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          question: {
            question: 'New improved question',
            benchmark_answer: 'New improved answer',
            question_type: 'scenario',
            difficulty_level: 'advanced'
          },
          message: 'Smart questions regenerated successfully'
        })
      })

      global.fetch = mockFetch

      const result = await regenerateSmartQuestions(request)

      expect(result.success).toBe(true)
      expect(result.question.question).toBe('New improved question')
      expect(result.message).toBe('Smart questions regenerated successfully')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/regenerate-smart-questions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDg0NjIsImV4cCI6MjA3NzE4NDQ2Mn0.vPf2oAVXSZPNvWip08QLNvvHGx1dT8njRQdS568OxkE'
          },
          body: JSON.stringify({
            validationResultId: 'test-validation-id',
            userContext: 'Focus on practical examples',
            currentQuestion: 'Old question',
            currentAnswer: 'Old answer',
            options: {
              difficultyLevel: 'advanced',
              questionCount: 1
            }
          })
        })
      )
    })

    it('should handle regeneration error with retry', async () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-validation-id'
      }

      // Mock retryable error on first attempt, success on second
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Service Unavailable'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            success: true,
            question: {
              question: 'Regenerated question',
              benchmark_answer: 'Regenerated answer'
            }
          })
        })

      global.fetch = mockFetch

      const result = await regenerateSmartQuestions(request)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle API error response', async () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-validation-id'
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('{"error": "Invalid request"}')
      })

      global.fetch = mockFetch

      const result = await regenerateSmartQuestions(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('❌ An error occurred during validation. Please try again or contact support.')
      expect(result.error).toBe('{"error": "Invalid request"}')
    })

    it('should handle unsuccessful response', async () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-validation-id'
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: 'AI service unavailable'
        })
      })

      global.fetch = mockFetch

      const result = await regenerateSmartQuestions(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('AI service unavailable')
    })

    it('should handle max retries exceeded for regeneration', async () => {
      const request: RegenerateRequest = {
        validationResultId: 'test-validation-id'
      }

      // Always return retryable error
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
        text: vi.fn().mockResolvedValue('Service Unavailable - service temporarily unavailable')
      })

      global.fetch = mockFetch

      const result = await regenerateSmartQuestions(request)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Smart question regeneration failed after multiple attempts')
      expect(result.error).toBe('Max retries exceeded')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('getValidationResults', () => {
    it('should successfully fetch validation results', async () => {
      const mockResults = [
        {
          id: 'result-1',
          requirement_number: 'KE1',
          requirement_type: 'knowledge_evidence',
          validation_status: 'partial',
          validation_reasoning: 'Some gaps identified'
        },
        {
          id: 'result-2',
          requirement_number: 'KE2',
          requirement_type: 'performance_evidence',
          validation_status: 'met',
          validation_reasoning: 'Fully addressed'
        }
      ]

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockResults,
              error: null
            })
          })
        })
      })

      const result = await getValidationResults('validation-123')

      expect(result.success).toBe(true)
      expect(result.results).toEqual(mockResults)
      expect(result.message).toBe('Retrieved 2 validation results')
      expect(mockFrom).toHaveBeenCalledWith('validation_results')
    })

    it('should handle database error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      })

      const result = await getValidationResults('validation-123')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Failed to fetch validation results')
      expect(result.error).toBe('Database connection failed')
    })

    it('should handle unexpected error', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected database error')
      })

      const result = await getValidationResults('validation-123')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Failed to fetch validation results due to an unexpected error')
      expect(result.error).toBe('Unexpected database error')
    })
  })

  describe('Error Message Handling', () => {
    it('should provide user-friendly error messages for different error types', async () => {
      const errorCases = [
        {
          error: { message: '404 - function not found' },
          expectedMessage: '❌ Validation function not found. Please ensure the edge functions are deployed.'
        },
        {
          error: { message: 'Request timeout' },
          expectedMessage: 'Validation failed after multiple attempts'
        },
        {
          error: { message: 'Rate limit exceeded' },
          expectedMessage: 'Validation failed after multiple attempts'
        },
        {
          error: { message: 'Unauthorized access' },
          expectedMessage: '🔒 Authentication failed. Please log in and try again.'
        },
        {
          error: { message: 'Forbidden resource' },
          expectedMessage: '🚫 Permission denied. You do not have access to this function.'
        },
        {
          error: { message: 'Document not found' },
          expectedMessage: '📄 Document not found. Please ensure the document was uploaded successfully.'
        },
        {
          error: { message: 'AI service error' },
          expectedMessage: '🤖 AI service temporarily unavailable. Please try again in a few moments.'
        },
        {
          error: { message: 'Insufficient credits' },
          expectedMessage: '💳 Insufficient credits. Please top up your account and try again.'
        }
      ]

      for (const testCase of errorCases) {
        mockFunctionsInvoke.mockResolvedValue({
          data: null,
          error: testCase.error
        })

        const request: ValidationRequest = {
          documentId: 'test-id',
          unitCode: 'BSBWHS332X'
        }

        const result = await validateAssessmentV2(request)
        expect(result.message).toBe(testCase.expectedMessage)
        expect(result.success).toBe(false)
      }
    })
  })
})
