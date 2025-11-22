/**
 * Unit Tests for Regenerate Smart Questions Edge Function
 * Phase 4.2 - Independent Validation & Smart Question Prompts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Mock the edge function module
const mockServe = vi.fn()
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({
  serve: mockServe
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn()
  },
  from: vi.fn()
}

const mockCreateClient = vi.fn(() => mockSupabaseClient)
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: mockCreateClient
}))

// Mock the smart question prompt module
vi.mock('../supabase/functions/_shared/prompts/smart-question-prompt.ts', () => ({
  createSmartQuestionPrompt: vi.fn(),
  createRegenerationPrompt: vi.fn(),
  parseSmartQuestionResponse: vi.fn(),
  isValidSmartQuestion: vi.fn()
}))

// Import after mocking
import { 
  createSmartQuestionPrompt,
  createRegenerationPrompt,
  parseSmartQuestionResponse,
  isValidSmartQuestion
} from '../supabase/functions/_shared/prompts/smart-question-prompt.ts'

describe('Regenerate Smart Questions Edge Function', () => {
  const mockEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'test-gemini-key'
  }

  const mockValidationResult = {
    id: 'test-validation-id',
    requirement_number: 'KE1',
    requirement_type: 'knowledge_evidence',
    requirement_text: 'Describe safety procedures',
    validation_status: 'partial',
    validation_reasoning: 'Some gaps exist',
    evidence_data: {
      strengths: ['Good coverage'],
      gaps: ['Missing examples'],
      suggestions: ['Add practical scenarios']
    },
    smart_questions: [],
    validation_detail: {
      unit_code: 'BSBWHS332X',
      unit_title: 'Safety Unit'
    }
  }

  const mockGeminiResponse = {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            question: 'Test question',
            benchmark_answer: 'Test answer',
            assessment_criteria: ['Criterion 1'],
            question_type: 'scenario',
            difficulty_level: 'intermediate',
            estimated_time: '15 minutes',
            focus_areas: ['Safety']
          })
        }]
      }
    }]
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup environment variables
    global.Deno = {
      env: {
        get: vi.fn((key) => mockEnv[key])
      }
    } as any

    // Setup default mock implementations
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } }
    })

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockValidationResult,
            error: null
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockGeminiResponse),
      text: vi.fn().mockResolvedValue(JSON.stringify(mockGeminiResponse))
    })

    ;(createSmartQuestionPrompt as any).mockReturnValue('mock prompt')
    ;(parseSmartQuestionResponse as any).mockReturnValue({
      question: 'Test question',
      benchmark_answer: 'Test answer',
      question_type: 'scenario'
    })
    ;(isValidSmartQuestion as any).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Request Handling', () => {
    it('should handle CORS preflight request', async () => {
      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'OPTIONS'
      })

      // Mock the serve function to capture the handler
      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      // Import and execute the edge function
      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('should validate required validationResultId field', async () => {
      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          // Missing validationResultId
          userContext: 'Test context'
        })
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(400)
      expect(responseData.error).toBe('validationResultId is required')
    })

    it('should handle valid request for new question generation', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id',
        userContext: 'Focus on warehouse safety',
        options: {
          difficultyLevel: 'intermediate',
          questionCount: 1
        }
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.question).toBeDefined()
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('validation_results')
    })

    it('should handle request for question regeneration', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id',
        currentQuestion: 'Current question text',
        currentAnswer: 'Current answer text',
        userContext: 'Make it more practical',
        options: {
          difficultyLevel: 'advanced'
        }
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Question regenerated successfully')
      expect(createRegenerationPrompt as any).toHaveBeenCalled()
    })
  })

  describe('Database Operations', () => {
    it('should fetch validation result with proper joins', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      await handler(mockRequest)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('validation_results')
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        expect.stringContaining('validation_detail(')
      )
    })

    it('should handle validation result not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const requestBody = {
        validationResultId: 'non-existent-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(404)
      expect(responseData.error).toBe('Validation result not found')
    })

    it('should update database with new smart question', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      await handler(mockRequest)

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          smart_questions: expect.arrayContaining([
            expect.objectContaining({
              question: expect.any(String),
              benchmark_answer: expect.any(String),
              generated_at: expect.any(String)
            })
          ]),
          updated_at: expect.any(String)
        })
      )
    })

    it('should handle database update error gracefully', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue({
        error: { message: 'Database error' }
      })

      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      // Should still return success even if update fails
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
    })
  })

  describe('Gemini API Integration', () => {
    it('should call Gemini API with correct parameters', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      await handler(mockRequest)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('mock prompt')
        })
      )
    })

    it('should handle Gemini API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'API Error',
        text: vi.fn().mockResolvedValue('Error details')
      })

      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toContain('Gemini API error')
    })

    it('should handle missing Gemini API key', async () => {
      global.Deno.env.get.mockImplementation((key) => {
        if (key === 'GEMINI_API_KEY') return undefined
        return mockEnv[key]
      })

      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toContain('GEMINI_API_KEY not configured')
    })
  })

  describe('Response Processing', () => {
    it('should handle invalid question format', async () => {
      ;(isValidSmartQuestion as any).mockReturnValue(false)

      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to generate valid question')
    })

    it('should handle parsing failure', async () => {
      ;(parseSmartQuestionResponse as any).mockReturnValue(null)

      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to generate valid question')
    })

    it('should return correct response format for new question', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(responseData).toEqual({
        success: true,
        question: expect.objectContaining({
          question: expect.any(String),
          benchmark_answer: expect.any(String)
        }),
        message: 'Question generated successfully'
      })
    })

    it('should return correct response format for regeneration', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id',
        currentQuestion: 'Old question',
        currentAnswer: 'Old answer'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(responseData.message).toBe('Question regenerated successfully')
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parsing error', async () => {
      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: 'invalid json'
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toBeDefined()
    })

    it('should handle missing authorization header', async () => {
      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Missing Authorization
        },
        body: JSON.stringify({
          validationResultId: 'test-validation-id'
        })
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      
      // Should handle gracefully with anon key fallback
      expect(response.status).toBe(200)
    })

    it('should handle unexpected errors', async () => {
      // Make Supabase client throw an error
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const requestBody = {
        validationResultId: 'test-validation-id'
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      const response = await handler(mockRequest)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toBeDefined()
    })
  })

  describe('Input Processing', () => {
    it('should process options with defaults', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id'
        // No options provided
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      await handler(mockRequest)

      expect(createSmartQuestionPrompt as any).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          includeBenchmarkAnswer: true,
          includeAssessmentCriteria: true,
          difficultyLevel: 'intermediate',
          questionCount: 1
        })
      )
    })

    it('should process custom options', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id',
        options: {
          difficultyLevel: 'advanced',
          questionCount: 2,
          includeBenchmarkAnswer: false
        }
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      await handler(mockRequest)

      expect(createSmartQuestionPrompt as any).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          difficultyLevel: 'advanced',
          questionCount: 2,
          includeBenchmarkAnswer: false
        })
      )
    })

    it('should handle empty user context', async () => {
      const requestBody = {
        validationResultId: 'test-validation-id',
        userContext: ''
      }

      const mockRequest = new Request('https://example.com/functions/v1/regenerate-smart-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(requestBody)
      })

      let handler: any
      mockServe.mockImplementation((fn) => {
        handler = fn
        return vi.fn()
      })

      await import('../supabase/functions/regenerate-smart-questions/index.ts')

      await handler(mockRequest)

      expect(createSmartQuestionPrompt as any).toHaveBeenCalledWith(
        expect.objectContaining({
          userContext: undefined
        }),
        expect.any(Object)
      )
    })
  })
})
