/**
 * Unit Tests for Validation Prompt Module
 * Phase 4.2 - Independent Validation & Smart Question Prompts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createValidationPrompt,
  createBatchValidationPrompt,
  createRevalidationPrompt,
  parseValidationResponse,
  isValidValidationResult,
  type ValidationPromptInput,
  type ValidationPromptOptions
} from '../../supabase/functions/_shared/prompts/validation-prompt.ts'

describe('Validation Prompt Module', () => {
  const mockInput: ValidationPromptInput = {
    requirementNumber: 'KE1',
    requirementType: 'knowledge_evidence',
    requirementText: 'Describe safety procedures in the workplace',
    unitCode: 'BSBWHS332X',
    unitTitle: 'Apply work health and safety procedures'
  }

  const mockOptions: ValidationPromptOptions = {
    includeEvidence: true,
    includeCitations: true,
    detailedReasoning: true
  }

  describe('createValidationPrompt', () => {
    it('should create a validation prompt with all required fields', () => {
      const prompt = createValidationPrompt(mockInput, mockOptions)
      
      expect(prompt).toContain('KE1')
      expect(prompt).toContain('knowledge_evidence')
      expect(prompt).toContain('Describe safety procedures in the workplace')
      expect(prompt).toContain('BSBWHS332X')
      expect(prompt).toContain('Apply work health and safety procedures')
    })

    it('should include evidence section when enabled', () => {
      const prompt = createValidationPrompt(mockInput, { includeEvidence: true })
      
      expect(prompt).toContain('evidence')
      expect(prompt).toContain('strengths')
      expect(prompt).toContain('gaps')
      expect(prompt).toContain('suggestions')
    })

    it('should exclude evidence section when disabled', () => {
      const prompt = createValidationPrompt(mockInput, { includeEvidence: false })
      
      expect(prompt).not.toContain('evidence')
      expect(prompt).not.toContain('strengths')
    })

    it('should include citations section when enabled', () => {
      const prompt = createValidationPrompt(mockInput, { includeCitations: true })
      
      expect(prompt).toContain('citations')
      expect(prompt).toContain('text')
      expect(prompt).toContain('page')
      expect(prompt).toContain('relevance')
    })

    it('should include detailed analysis when enabled', () => {
      const prompt = createValidationPrompt(mockInput, { detailedReasoning: true })
      
      expect(prompt).toContain('detailed_analysis')
      expect(prompt).toContain('coverage_score')
      expect(prompt).toContain('assessment_methods')
      expect(prompt).toContain('alignment')
    })

    it('should work with minimal input', () => {
      const minimalInput: ValidationPromptInput = {
        requirementNumber: 'KE1',
        requirementType: 'knowledge_evidence',
        requirementText: 'Test requirement'
      }
      
      const prompt = createValidationPrompt(minimalInput)
      
      expect(prompt).toContain('KE1')
      expect(prompt).toContain('knowledge_evidence')
      expect(prompt).toContain('Test requirement')
      expect(prompt).toContain('met" | "not-met" | "partial"')
    })

    it('should include assessment context when provided', () => {
      const inputWithContext = {
        ...mockInput,
        assessmentContext: 'This is a practical assessment for warehouse workers'
      }
      
      const prompt = createValidationPrompt(inputWithContext)
      
      expect(prompt).toContain('Assessment Context')
      expect(prompt).toContain('This is a practical assessment for warehouse workers')
    })
  })

  describe('createBatchValidationPrompt', () => {
    const mockRequirements: ValidationPromptInput[] = [
      mockInput,
      {
        requirementNumber: 'KE2',
        requirementType: 'performance_evidence',
        requirementText: 'Demonstrate emergency procedures'
      },
      {
        requirementNumber: 'KE3',
        requirementType: 'knowledge_evidence',
        requirementText: 'Explain risk assessment process'
      }
    ]

    it('should create a batch validation prompt for multiple requirements', () => {
      const prompt = createBatchValidationPrompt(mockRequirements)
      
      expect(prompt).toContain('KE1')
      expect(prompt).toContain('KE2')
      expect(prompt).toContain('KE3')
      expect(prompt).toContain('knowledge_evidence')
      expect(prompt).toContain('performance_evidence')
      expect(prompt).toContain('Demonstrate emergency procedures')
      expect(prompt).toContain('Explain risk assessment process')
    })

    it('should include assessment context when provided', () => {
      const context = 'Batch validation for manufacturing unit'
      const prompt = createBatchValidationPrompt(mockRequirements, context)
      
      expect(prompt).toContain('Assessment Context')
      expect(prompt).toContain(context)
    })

    it('should format requirements as a numbered list', () => {
      const prompt = createBatchValidationPrompt(mockRequirements)
      
      expect(prompt).toContain('Requirement 1: KE1')
      expect(prompt).toContain('Requirement 2: KE2')
      expect(prompt).toContain('Requirement 3: KE3')
    })

    it('should handle empty requirements array', () => {
      const prompt = createBatchValidationPrompt([])
      
      expect(prompt).toContain('Requirements to Validate')
      expect(prompt).toContain('Validate whether the following requirements')
    })
  })

  describe('createRevalidationPrompt', () => {
    const mockPreviousValidation = {
      status: 'partial',
      reasoning: 'Some aspects are covered but gaps remain',
      evidence: {
        strengths: ['Good coverage of basic concepts'],
        gaps: ['Missing practical examples']
      }
    }

    it('should create a revalidation prompt with previous result', () => {
      const prompt = createRevalidationPrompt(mockInput, mockPreviousValidation)
      
      expect(prompt).toContain('Previous Validation Result')
      expect(prompt).toContain('partial')
      expect(prompt).toContain('Some aspects are covered but gaps remain')
      expect(prompt).toContain('Good coverage of basic concepts')
      expect(prompt).toContain('Missing practical examples')
    })

    it('should include changes note when provided', () => {
      const changesNote = 'Added new practical exercises'
      const prompt = createRevalidationPrompt(mockInput, mockPreviousValidation, changesNote)
      
      expect(prompt).toContain('Changes Since Last Validation')
      expect(prompt).toContain(changesNote)
    })

    it('should handle previous validation without evidence', () => {
      const previousWithoutEvidence = {
        status: 'not-met',
        reasoning: 'Requirement not adequately addressed'
      }
      
      const prompt = createRevalidationPrompt(mockInput, previousWithoutEvidence)
      
      expect(prompt).toContain('Previous Validation Result')
      expect(prompt).toContain('not-met')
      expect(prompt).not.toContain('Previous Evidence')
    })

    it('should include updated assessment context', () => {
      const inputWithContext = {
        ...mockInput,
        assessmentContext: 'Updated with new assessment materials'
      }
      
      const prompt = createRevalidationPrompt(inputWithContext, mockPreviousValidation)
      
      expect(prompt).toContain('Updated Assessment Context')
      expect(prompt).toContain('Updated with new assessment materials')
    })
  })

  describe('parseValidationResponse', () => {
    it('should parse JSON from code block', () => {
      const response = `\`\`\`json
{
  "status": "met",
  "reasoning": "Requirement is fully addressed",
  "evidence": {
    "strengths": ["Comprehensive coverage"],
    "gaps": [],
    "suggestions": []
  }
}
\`\`\``
      
      const result = parseValidationResponse(response)
      
      expect(result).toEqual({
        status: 'met',
        reasoning: 'Requirement is fully addressed',
        evidence: {
          strengths: ['Comprehensive coverage'],
          gaps: [],
          suggestions: []
        }
      })
    })

    it('should parse JSON without code block', () => {
      const response = `{"status": "not-met", "reasoning": "Gaps identified"}`
      
      const result = parseValidationResponse(response)
      
      expect(result).toEqual({
        status: 'not-met',
        reasoning: 'Gaps identified'
      })
    })

    it('should handle malformed JSON gracefully', () => {
      const response = `{"status": "met", "reasoning": "incomplete`
      
      const result = parseValidationResponse(response)
      
      expect(result).toBeNull()
    })

    it('should handle empty response', () => {
      const result = parseValidationResponse('')
      
      expect(result).toBeNull()
    })

    it('should extract JSON from mixed text response', () => {
      const response = `Here is the validation result:
{"status": "partial", "reasoning": "Some gaps exist"}
Thank you for using our service.`
      
      const result = parseValidationResponse(response)
      
      expect(result).toEqual({
        status: 'partial',
        reasoning: 'Some gaps exist'
      })
    })
  })

  describe('isValidValidationResult', () => {
    it('should validate correct structure', () => {
      const validResult = {
        status: 'met',
        reasoning: 'Requirement fully addressed'
      }
      
      expect(isValidValidationResult(validResult)).toBe(true)
    })

    it('should reject invalid status', () => {
      const invalidResult = {
        status: 'invalid',
        reasoning: 'Invalid status'
      }
      
      expect(isValidValidationResult(invalidResult)).toBe(false)
    })

    it('should reject missing status', () => {
      const missingStatus = {
        reasoning: 'No status provided'
      }
      
      expect(isValidValidationResult(missingStatus)).toBe(false)
    })

    it('should reject missing reasoning', () => {
      const missingReasoning = {
        status: 'met'
      }
      
      expect(isValidValidationResult(missingReasoning)).toBe(false)
    })

    it('should reject empty reasoning', () => {
      const emptyReasoning = {
        status: 'met',
        reasoning: ''
      }
      
      expect(isValidValidationResult(emptyReasoning)).toBe(false)
    })

    it('should reject null or undefined input', () => {
      expect(isValidValidationResult(null)).toBe(false)
      expect(isValidValidationResult(undefined)).toBe(false)
    })

    it('should reject non-object input', () => {
      expect(isValidValidationResult('string')).toBe(false)
      expect(isValidValidationResult(123)).toBe(false)
      expect(isValidValidationResult([])).toBe(false)
    })

    it('should accept valid additional fields', () => {
      const resultWithExtras = {
        status: 'partial',
        reasoning: 'Some gaps exist',
        evidence: {
          strengths: ['Good coverage'],
          gaps: ['Missing examples']
        }
      }
      
      expect(isValidValidationResult(resultWithExtras)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in requirement text', () => {
      const specialInput = {
        ...mockInput,
        requirementText: 'Safety procedures for "high-risk" operations & equipment (100kg+)'
      }
      
      const prompt = createValidationPrompt(specialInput)
      
      expect(prompt).toContain('Safety procedures for "high-risk" operations & equipment (100kg+)')
    })

    it('should handle very long requirement text', () => {
      const longText = 'A'.repeat(1000)
      const longInput = {
        ...mockInput,
        requirementText: longText
      }
      
      const prompt = createValidationPrompt(longInput)
      
      expect(prompt).toContain(longText)
    })

    it('should handle unicode characters', () => {
      const unicodeInput = {
        ...mockInput,
        requirementText: 'Safety procedures for café and naïve workers'
      }
      
      const prompt = createValidationPrompt(unicodeInput)
      
      expect(prompt).toContain('café')
      expect(prompt).toContain('naïve')
    })
  })
})
