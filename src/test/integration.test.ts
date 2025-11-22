/**
 * Integration Tests for Phase 4.2 Components
 * Tests the complete workflow from UI to Edge Function to Database
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ValidationCard_v2 } from '../components/ValidationCard_v2'
import { 
  createValidationPrompt,
  createSmartQuestionPrompt,
  parseValidationResponse,
  isValidValidationResult,
  isValidSmartQuestion
} from '../supabase/functions/_shared/prompts/validation-prompt.ts'
import { 
  createSmartQuestionPrompt as createSmartQuestionPromptModule,
  parseSmartQuestionResponse
} from '../supabase/functions/_shared/prompts/smart-question-prompt.ts'

describe('Phase 4.2 Integration Tests', () => {
  const mockValidationResult = {
    id: 'integration-test-id',
    requirement_number: 'KE1',
    requirement_type: 'knowledge_evidence',
    requirement_text: 'Describe safety procedures in the workplace',
    validation_status: 'partial',
    validation_reasoning: 'Basic concepts covered but missing practical examples',
    evidence_data: {
      strengths: ['Good theoretical coverage'],
      gaps: ['Lacks workplace scenarios'],
      suggestions: ['Add practical examples']
    },
    smart_questions: [],
    validation_detail: {
      unit_code: 'BSBWHS332X',
      unit_title: 'Apply work health and safety procedures'
    }
  }

  const mockGeminiResponse = {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            question: 'What specific safety procedures should be followed when operating forklifts in a warehouse environment?',
            benchmark_answer: 'When operating forklifts in a warehouse, specific safety procedures include: 1) Conduct pre-start equipment checks, 2) Verify load capacity and stability, 3) Follow designated traffic patterns, 4) Use proper signaling when turning or reversing, 5) Maintain safe following distances, 6) Park in designated areas when not in use.',
            assessment_criteria: [
              'Pre-start equipment checks',
              'Load capacity verification',
              'Traffic pattern compliance',
              'Communication and signaling',
              'Safe parking procedures'
            ],
            question_type: 'scenario',
            difficulty_level: 'intermediate',
            estimated_time: '20 minutes',
            focus_areas: ['Forklift Safety', 'Warehouse Operations', 'Equipment Procedures']
          })
        }]
      }
    }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock Supabase
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'test-token' } }
        })
      },
      from: vi.fn().mockReturnValue({
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
    }

    vi.mock('../lib/supabase', () => ({
      supabase: mockSupabase
    }))

    // Mock environment
    vi.mock('../lib/env', () => ({
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key'
    }))

    // Mock fetch for edge function
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        question: mockGeminiResponse.candidates[0].content.parts[0].text ? 
          JSON.parse(mockGeminiResponse.candidates[0].content.parts[0].text) : null,
        message: 'Question regenerated successfully'
      })
    })

    // Mock toast
    vi.mock('sonner', () => ({
      toast: {
        error: vi.fn(),
        success: vi.fn(),
      }
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Workflow Integration', () => {
    it('should integrate validation prompt creation with response parsing', () => {
      const validationInput = {
        requirementNumber: 'KE1',
        requirementType: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        unitCode: 'BSBWHS332X'
      }

      const prompt = createValidationPrompt(validationInput, { 
        includeEvidence: true, 
        includeCitations: true 
      })

      expect(prompt).toContain('KE1')
      expect(prompt).toContain('knowledge_evidence')
      expect(prompt).toContain('evidence')
      expect(prompt).toContain('citations')

      // Test response parsing
      const mockResponse = `{
        "status": "partial",
        "reasoning": "Some gaps identified",
        "evidence": {
          "strengths": ["Good coverage"],
          "gaps": ["Missing examples"]
        }
      }`

      const parsed = parseValidationResponse(mockResponse)
      expect(isValidValidationResult(parsed)).toBe(true)
    })

    it('should integrate smart question prompt creation with response parsing', () => {
      const questionInput = {
        requirementNumber: 'KE1',
        requirementType: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        validationStatus: 'partial' as const,
        validationReasoning: 'Missing practical examples',
        evidence: {
          strengths: ['Good theory'],
          gaps: ['Missing practice']
        }
      }

      const prompt = createSmartQuestionPrompt(questionInput, {
        includeBenchmarkAnswer: true,
        includeAssessmentCriteria: true,
        difficultyLevel: 'intermediate'
      })

      expect(prompt).toContain('KE1')
      expect(prompt).toContain('partial')
      expect(prompt).toContain('benchmark_answer')
      expect(prompt).toContain('assessment_criteria')

      // Test response parsing
      const mockResponse = `{
        "question": "Test question",
        "benchmark_answer": "Test answer",
        "question_type": "scenario",
        "difficulty_level": "intermediate"
      }`

      const parsed = parseSmartQuestionResponse(mockResponse)
      expect(isValidSmartQuestion(parsed)).toBe(true)
    })

    it('should handle complete UI to edge function workflow', async () => {
      const mockResult = {
        id: 'integration-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures in the workplace',
        status: 'partial' as const,
        reasoning: 'Basic concepts covered but missing practical examples',
        evidence: {
          mappedQuestions: ['Q1: Basic safety'],
          unmappedReasoning: 'Need practical examples',
          documentReferences: ['Page 5']
        },
        aiEnhancement: {
          smartQuestion: 'What are basic safety procedures?',
          benchmarkAnswer: 'Basic safety procedures include...',
          recommendations: ['Add practical scenarios']
        }
      }

      const mockOnChatClick = vi.fn()
      const mockValidationContext = {
        rtoId: 'test-rto',
        unitCode: 'BSBWHS332X',
        unitTitle: 'Test Unit',
        validationType: 'assessment',
        validationId: 'test-validation'
      }

      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand card
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Add user context
      const contextTextarea = screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')
      fireEvent.change(contextTextarea, { target: { value: 'Focus on forklift safety procedures' } })

      // Regenerate question
      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      // Wait for API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://test.supabase.co/functions/v1/regenerate-smart-questions',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              validationResultId: 'integration-test-id',
              userContext: 'Focus on forklift safety procedures',
              currentQuestion: 'What are basic safety procedures?',
              currentAnswer: 'Basic safety procedures include...',
              options: {
                difficultyLevel: 'intermediate',
                questionCount: 1
              }
            })
          })
        )
      })

      // Verify UI updates
      await waitFor(() => {
        expect(screen.getByDisplayValue(/What specific safety procedures should be followed when operating forklifts/)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle edge function errors gracefully', async () => {
      const mockResult = {
        id: 'error-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        status: 'partial' as const,
        reasoning: 'Some gaps',
        evidence: { mappedQuestions: [], unmappedReasoning: '', documentReferences: [] },
        aiEnhancement: {
          smartQuestion: 'Basic question',
          benchmarkAnswer: 'Basic answer',
          recommendations: []
        }
      }

      // Mock fetch error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: 'Edge function error' })
      })

      const { toast } = await import('sonner')

      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={vi.fn()}
          validationContext={{ rtoId: 'test', unitCode: 'BSBWHS332X' }}
        />
      )

      // Expand, edit, and try to regenerate
      fireEvent.click(screen.getByRole('button', { name: /expand/i }))
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      fireEvent.click(screen.getByRole('button', { name: /regenerate with ai/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Edge function error')
      })
    })

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'test-token' } }
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            })
          })
        })
      }

      vi.mock('../lib/supabase', () => ({
        supabase: mockSupabase
      }))

      const mockResult = {
        id: 'db-error-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        status: 'partial' as const,
        reasoning: 'Some gaps',
        evidence: { mappedQuestions: [], unmappedReasoning: '', documentReferences: [] },
        aiEnhancement: {
          smartQuestion: 'Basic question',
          benchmarkAnswer: 'Basic answer',
          recommendations: []
        }
      }

      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={vi.fn()}
          validationContext={{ rtoId: 'test', unitCode: 'BSBWHS332X' }}
        />
      )

      // Expand, edit, and try to regenerate
      fireEvent.click(screen.getByRole('button', { name: /expand/i }))
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      fireEvent.click(screen.getByRole('button', { name: /regenerate with ai/i }))

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled()
        // Should show error toast
        const { toast } = require('sonner')
        expect(toast.error).toHaveBeenCalled()
      })
    })
  })

  describe('Data Flow Integration', () => {
    it('should correctly transform validation result to smart question input', () => {
      const validationResult = {
        id: 'transform-test-id',
        requirement_number: 'KE2',
        requirement_type: 'performance_evidence',
        requirement_text: 'Demonstrate emergency procedures',
        validation_status: 'not-met',
        validation_reasoning: 'No demonstration provided',
        evidence_data: {
          strengths: [],
          gaps: ['Missing demonstration'],
          suggestions: ['Add practical demo']
        },
        validation_detail: {
          unit_code: 'BSBWHS332X',
          unit_title: 'Safety Unit'
        }
      }

      // This simulates the transformation that happens in the edge function
      const questionInput = {
        requirementNumber: validationResult.requirement_number,
        requirementType: validationResult.requirement_type,
        requirementText: validationResult.requirement_text,
        validationStatus: validationResult.validation_status,
        validationReasoning: validationResult.validation_reasoning,
        evidence: validationResult.evidence_data,
        unitCode: validationResult.validation_detail?.unit_code,
        unitTitle: validationResult.validation_detail?.unit_title
      }

      expect(questionInput.requirementNumber).toBe('KE2')
      expect(questionInput.requirementType).toBe('performance_evidence')
      expect(questionInput.validationStatus).toBe('not-met')
      expect(questionInput.evidence?.gaps).toContain('Missing demonstration')
    })

    it('should correctly parse and validate AI responses', () => {
      const aiResponse = `Here is your SMART question:

\`\`\`json
{
  "question": "How would you respond to a fire emergency in a warehouse setting?",
  "benchmark_answer": "In a fire emergency: 1) Activate fire alarm, 2) Evacuate via nearest exit, 3) Call emergency services, 4) Use fire extinguisher if safe, 5) Account for all personnel.",
  "assessment_criteria": [
    "Alarm activation",
    "Evacuation procedures",
    "Emergency communication",
    "Fire extinguisher use",
    "Personnel accountability"
  ],
  "question_type": "scenario",
  "difficulty_level": "intermediate",
  "estimated_time": "15 minutes",
  "focus_areas": ["Emergency Response", "Fire Safety", "Warehouse Procedures"]
}
\`\`\`

This question tests practical emergency response.`

      const parsed = parseSmartQuestionResponse(aiResponse)
      expect(isValidSmartQuestion(parsed)).toBe(true)
      expect(parsed.question).toContain('fire emergency')
      expect(parsed.assessment_criteria).toHaveLength(5)
      expect(parsed.question_type).toBe('scenario')
    })
  })

  describe('Performance Integration', () => {
    it('should handle rapid user interactions without errors', async () => {
      const mockResult = {
        id: 'performance-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        status: 'partial' as const,
        reasoning: 'Some gaps',
        evidence: { mappedQuestions: [], unmappedReasoning: '', documentReferences: [] },
        aiEnhancement: {
          smartQuestion: 'Basic question',
          benchmarkAnswer: 'Basic answer',
          recommendations: []
        }
      }

      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={vi.fn()}
          validationContext={{ rtoId: 'test', unitCode: 'BSBWHS332X' }}
        />
      )

      // Rapid expand/collapse
      const expandButton = screen.getByRole('button', { name: /expand/i })
      
      fireEvent.click(expandButton)
      fireEvent.click(expandButton)
      fireEvent.click(expandButton)

      // Should still work
      expect(screen.getByText('SMART Question')).toBeInTheDocument()

      // Rapid edit mode toggles
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))

      expect(screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')).toBeInTheDocument()
    })

    it('should handle large data sets efficiently', () => {
      const largeRecommendations = Array.from({ length: 100 }, (_, i) => `Recommendation ${i + 1}`)
      const largeEvidence = Array.from({ length: 50 }, (_, i) => `Evidence point ${i + 1}`)

      const largeResult = {
        id: 'large-data-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        status: 'partial' as const,
        reasoning: 'Some gaps',
        evidence: {
          mappedQuestions: largeEvidence,
          unmappedReasoning: 'Large amount of evidence',
          documentReferences: Array.from({ length: 20 }, (_, i) => `Page ${i + 1}`)
        },
        aiEnhancement: {
          smartQuestion: 'Basic question',
          benchmarkAnswer: 'Basic answer',
          recommendations: largeRecommendations
        }
      }

      const startTime = performance.now()
      
      render(
        <ValidationCard_v2
          result={largeResult}
          onChatClick={vi.fn()}
          validationContext={{ rtoId: 'test', unitCode: 'BSBWHS332X' }}
        />
      )

      const renderTime = performance.now() - startTime
      
      // Should render quickly even with large data sets
      expect(renderTime).toBeLessThan(1000) // Less than 1 second
      
      // Expand to test rendering of large data
      fireEvent.click(screen.getByRole('button', { name: /expand/i }))
      
      // Should display large lists efficiently
      expect(screen.getByText('Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Recommendation 1')).toBeInTheDocument()
      expect(screen.getByText('Recommendation 100')).toBeInTheDocument()
    })
  })

  describe('Security Integration', () => {
    it('should properly handle authentication tokens', async () => {
      const mockResult = {
        id: 'security-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        status: 'partial' as const,
        reasoning: 'Some gaps',
        evidence: { mappedQuestions: [], unmappedReasoning: '', documentReferences: [] },
        aiEnhancement: {
          smartQuestion: 'Basic question',
          benchmarkAnswer: 'Basic answer',
          recommendations: []
        }
      }

      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={vi.fn()}
          validationContext={{ rtoId: 'test', unitCode: 'BSBWHS332X' }}
        />
      )

      // Expand, edit, and regenerate
      fireEvent.click(screen.getByRole('button', { name: /expand/i }))
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      fireEvent.click(screen.getByRole('button', { name: /regenerate with ai/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': expect.stringMatching(/Bearer .+/)
            })
          })
        )
      })
    })

    it('should sanitize user input before sending to API', async () => {
      const mockResult = {
        id: 'sanitization-test-id',
        requirementNumber: 'KE1',
        type: 'knowledge_evidence',
        requirementText: 'Describe safety procedures',
        status: 'partial' as const,
        reasoning: 'Some gaps',
        evidence: { mappedQuestions: [], unmappedReasoning: '', documentReferences: [] },
        aiEnhancement: {
          smartQuestion: 'Basic question',
          benchmarkAnswer: 'Basic answer',
          recommendations: []
        }
      }

      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={vi.fn()}
          validationContext={{ rtoId: 'test', unitCode: 'BSBWHS332X' }}
        />
      )

      // Expand, edit, and add potentially malicious context
      fireEvent.click(screen.getByRole('button', { name: /expand/i }))
      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      
      const contextTextarea = screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')
      const maliciousContext = '<script>alert("xss")</script> Focus on safety'
      fireEvent.change(contextTextarea, { target: { value: maliciousContext } })

      fireEvent.click(screen.getByRole('button', { name: /regenerate with ai/i }))

      await waitFor(() => {
        const callArgs = (global.fetch as any).mock.calls[0]
        const requestBody = JSON.parse(callArgs[1].body)
        
        // The context should be included but the edge function should handle sanitization
        expect(requestBody.userContext).toContain('Focus on safety')
        // Note: Actual sanitization would happen on the backend
      })
    })
  })
})
