/**
 * Unit Tests for ValidationCard_v2 Component
 * Phase 4.2 - Independent Validation & Smart Question Prompts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ValidationCard_v2 } from '../components/ValidationCard_v2'
import { toast } from 'sonner'

// Mock the supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } }
    })
  }
}

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase
}))

// Mock environment variables
vi.mock('../lib/env', () => ({
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-key'
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ValidationCard_v2 Component', () => {
  const mockResult = {
    id: 'test-validation-id',
    requirementNumber: 'KE1',
    type: 'knowledge_evidence',
    requirementText: 'Describe safety procedures in the workplace',
    status: 'partial' as const,
    reasoning: 'Basic concepts covered but missing practical examples',
    evidence: {
      mappedQuestions: ['Q1: What are safety procedures?'],
      unmappedReasoning: 'Additional context needed',
      documentReferences: ['Page 5', 'Section 2.1']
    },
    aiEnhancement: {
      smartQuestion: 'What safety procedures should be followed in a warehouse environment?',
      benchmarkAnswer: 'Warehouse safety procedures include pre-start checks, hazard identification...',
      recommendations: ['Add practical scenarios', 'Include equipment-specific procedures']
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

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        question: {
          question: 'Regenerated question',
          benchmark_answer: 'Regenerated answer',
          assessment_criteria: ['Criterion 1'],
          question_type: 'scenario',
          difficulty_level: 'intermediate',
          estimated_time: '15 minutes',
          focus_areas: ['Safety']
        },
        message: 'Question regenerated successfully'
      })
    })

    // Mock toast
    vi.mocked(toast.error).mockImplementation(() => {})
    vi.mocked(toast.success).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render validation card with all required information', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      expect(screen.getByText('KE1')).toBeInTheDocument()
      expect(screen.getByText('knowledge_evidence')).toBeInTheDocument()
      expect(screen.getByText('Describe safety procedures in the workplace')).toBeInTheDocument()
      expect(screen.getByText('Basic concepts covered but missing practical examples')).toBeInTheDocument()
    })

    it('should display correct status badge', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      const statusBadge = screen.getByText('partial', { selector: '.status-badge' })
      expect(statusBadge).toBeInTheDocument()
    })

    it('should expand and collapse content', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Initially collapsed
      expect(screen.queryByText('Evidence')).not.toBeInTheDocument()
      expect(screen.queryByText('SMART Question')).not.toBeInTheDocument()

      // Click expand button
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      // Should show expanded content
      expect(screen.getByText('Evidence')).toBeInTheDocument()
      expect(screen.getByText('SMART Question')).toBeInTheDocument()
    })

    it('should show evidence section when data exists', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand first
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Evidence')).toBeInTheDocument()
      expect(screen.getByText('Q1: What are safety procedures?')).toBeInTheDocument()
      expect(screen.getByText('Additional context needed')).toBeInTheDocument()
      expect(screen.getByText('Page 5')).toBeInTheDocument()
    })

    it('should show SMART question section', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand first
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('SMART Question')).toBeInTheDocument()
      expect(screen.getByText('What safety procedures should be followed in a warehouse environment?')).toBeInTheDocument()
      expect(screen.getByText('Benchmark Answer:')).toBeInTheDocument()
      expect(screen.getByText('Warehouse safety procedures include pre-start checks, hazard identification...')).toBeInTheDocument()
    })

    it('should show recommendations when available', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand first
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      expect(screen.getByText('Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Add practical scenarios')).toBeInTheDocument()
      expect(screen.getByText('Include equipment-specific procedures')).toBeInTheDocument()
    })

    it('should display chat button', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand first
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      const chatButton = screen.getByRole('button', { name: /discuss with ai/i })
      expect(chatButton).toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    beforeEach(() => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand first
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
    })

    it('should show edit controls when in edit mode', () => {
      expect(screen.getByText('Additional Context (Optional)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')).toBeInTheDocument()
      expect(screen.getByText('Question')).toBeInTheDocument()
      expect(screen.getByText('Benchmark Answer')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    it('should show regenerate button when AI credits are available', () => {
      expect(screen.getByRole('button', { name: /regenerate with ai/i })).toBeInTheDocument()
    })

    it('should not show regenerate button when AI credits are not available', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          aiCreditsAvailable={false}
          validationContext={mockValidationContext}
        />
      )

      // Expand and enter edit mode
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      expect(screen.queryByRole('button', { name: /regenerate with ai/i })).not.toBeInTheDocument()
    })

    it('should not show edit controls when report is signed', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          isReportSigned={true}
          validationContext={mockValidationContext}
        />
      )

      // Expand
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })
  })

  describe('Question Regeneration', () => {
    beforeEach(() => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand and enter edit mode
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
    })

    it('should call regenerate API with correct parameters', async () => {
      const userContext = 'Focus on warehouse safety'
      const contextTextarea = screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')
      
      fireEvent.change(contextTextarea, { target: { value: userContext } })

      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'https://test.supabase.co/functions/v1/regenerate-smart-questions',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            }),
            body: JSON.stringify({
              validationResultId: 'test-validation-id',
              userContext: userContext,
              currentQuestion: 'What safety procedures should be followed in a warehouse environment?',
              currentAnswer: 'Warehouse safety procedures include pre-start checks, hazard identification...',
              options: {
                difficultyLevel: 'intermediate',
                questionCount: 1
              }
            })
          })
        )
      })
    })

    it('should show loading state during regeneration', async () => {
      // Make fetch take longer
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      // Should show loading state
      expect(screen.getByText('Regenerating...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /regenerating\.\.\./i })).toBeDisabled()
    })

    it('should update question and answer on successful regeneration', async () => {
      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Regenerated question')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Regenerated answer')).toBeInTheDocument()
      })

      expect(toast.success).toHaveBeenCalledWith('Question regenerated successfully!')
    })

    it('should clear user context after successful regeneration', async () => {
      const contextTextarea = screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')
      
      fireEvent.change(contextTextarea, { target: { value: 'Test context' } })

      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      await waitFor(() => {
        expect(contextTextarea).toHaveValue('')
      })
    })

    it('should handle regeneration error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'API Error' })
      })

      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('API Error')
      })
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const regenerateButton = screen.getByRole('button', { name: /regenerate with ai/i })
      fireEvent.click(regenerateButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to regenerate question')
      })
    })

    it('should show error when no AI credits available', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          aiCreditsAvailable={false}
          validationContext={mockValidationContext}
        />
      )

      // Expand and enter edit mode
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      // Try to click regenerate (shouldn't exist)
      expect(screen.queryByRole('button', { name: /regenerate with ai/i })).not.toBeInTheDocument()
    })
  })

  describe('Save and Cancel Functionality', () => {
    beforeEach(() => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand and enter edit mode
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)
    })

    it('should save changes when save button is clicked', () => {
      const questionTextarea = screen.getByDisplayValue('What safety procedures should be followed in a warehouse environment?')
      const answerTextarea = screen.getByDisplayValue('Warehouse safety procedures include pre-start checks, hazard identification...')

      // Make changes
      fireEvent.change(questionTextarea, { target: { value: 'Updated question' } })
      fireEvent.change(answerTextarea, { target: { value: 'Updated answer' } })

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.click(saveButton)

      expect(toast.success).toHaveBeenCalledWith('Changes saved')
      
      // Should exit edit mode
      expect(screen.queryByText('Additional Context (Optional)')).not.toBeInTheDocument()
      expect(screen.getByText('Updated question')).toBeInTheDocument()
      expect(screen.getByText('Updated answer')).toBeInTheDocument()
    })

    it('should cancel changes and revert when cancel button is clicked', () => {
      const questionTextarea = screen.getByDisplayValue('What safety procedures should be followed in a warehouse environment?')
      
      // Make changes
      fireEvent.change(questionTextarea, { target: { value: 'Modified question' } })

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // Should revert to original
      expect(screen.getByText('What safety procedures should be followed in a warehouse environment?')).toBeInTheDocument()
      expect(screen.queryByText('Additional Context (Optional)')).not.toBeInTheDocument()
    })

    it('should clear user context when cancelling', () => {
      const contextTextarea = screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')
      
      fireEvent.change(contextTextarea, { target: { value: 'Test context' } })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // Re-enter edit mode to check context is cleared
      const editButton = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editButton)

      expect(contextTextarea).toHaveValue('')
    })
  })

  describe('Chat Functionality', () => {
    it('should call onChatClick when chat button is clicked', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      // Click chat button
      const chatButton = screen.getByRole('button', { name: /discuss with ai/i })
      fireEvent.click(chatButton)

      expect(mockOnChatClick).toHaveBeenCalledWith(mockResult)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty evidence', () => {
      const resultWithEmptyEvidence = {
        ...mockResult,
        evidence: {
          mappedQuestions: [],
          unmappedReasoning: '',
          documentReferences: []
        }
      }

      render(
        <ValidationCard_v2
          result={resultWithEmptyEvidence}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      expect(screen.queryByText('Mapped Questions:')).not.toBeInTheDocument()
      expect(screen.queryByText('Additional context needed')).not.toBeInTheDocument()
    })

    it('should handle empty recommendations', () => {
      const resultWithEmptyRecommendations = {
        ...mockResult,
        aiEnhancement: {
          ...mockResult.aiEnhancement,
          recommendations: []
        }
      }

      render(
        <ValidationCard_v2
          result={resultWithEmptyRecommendations}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand
      const expandButton = screen.getByRole('button', { name: /expand/i })
      fireEvent.click(expandButton)

      expect(screen.queryByText('Recommendations')).not.toBeInTheDocument()
    })

    it('should handle very long requirement text', () => {
      const longText = 'A'.repeat(1000)
      const resultWithLongText = {
        ...mockResult,
        requirementText: longText
      }

      render(
        <ValidationCard_v2
          result={resultWithLongText}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    it('should handle special characters in text', () => {
      const resultWithSpecialChars = {
        ...mockResult,
        requirementText: 'Safety for "high-risk" operations & equipment (100kg+) - café & naïve workers',
        aiEnhancement: {
          ...mockResult.aiEnhancement,
          smartQuestion: 'Question with "quotes" & symbols',
          benchmarkAnswer: 'Answer with <special> characters & symbols'
        }
      }

      render(
        <ValidationCard_v2
          result={resultWithSpecialChars}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      expect(screen.getByText('Safety for "high-risk" operations & equipment (100kg+) - café & naïve workers')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand button should have proper labeling
      const expandButton = screen.getByRole('button', { name: /expand/i })
      expect(expandButton).toBeInTheDocument()

      // Expand and check other buttons
      fireEvent.click(expandButton)

      const editButton = screen.getByRole('button', { name: /edit/i })
      expect(editButton).toBeInTheDocument()

      const chatButton = screen.getByRole('button', { name: /discuss with ai/i })
      expect(chatButton).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(
        <ValidationCard_v2
          result={mockResult}
          onChatClick={mockOnChatClick}
          validationContext={mockValidationContext}
        />
      )

      // Expand
      const expandButton = screen.getByRole('button', { name: /expand/i })
      expect(expandButton).not.toBeDisabled()

      // Enter edit mode
      fireEvent.click(expandButton)
      const editButton = screen.getByRole('button', { name: /edit/i })
      expect(editButton).not.toBeDisabled()

      // Check form inputs are focusable
      fireEvent.click(editButton)
      const contextTextarea = screen.getByPlaceholderText('Provide additional context, feedback, or specific areas to focus on...')
      expect(contextTextarea).not.toBeDisabled()
    })
  })
})
