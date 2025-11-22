/**
 * Unit Tests for Smart Question Prompt Module
 * Phase 4.2 - Independent Validation & Smart Question Prompts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSmartQuestionPrompt,
  createBatchSmartQuestionPrompt,
  createRegenerationPrompt,
  parseSmartQuestionResponse,
  isValidSmartQuestion,
  simplifyQuestionResult,
  type SmartQuestionInput,
  type SmartQuestionOptions
} from '../../supabase/functions/_shared/prompts/smart-question-prompt.ts'

describe('Smart Question Prompt Module', () => {
  const mockInput: SmartQuestionInput = {
    requirementNumber: 'KE1',
    requirementType: 'knowledge_evidence',
    requirementText: 'Describe safety procedures in the workplace',
    validationStatus: 'partial',
    validationReasoning: 'Basic concepts covered but missing practical examples',
    evidence: {
      strengths: ['Good theoretical coverage'],
      gaps: ['Lacks workplace scenarios'],
      suggestions: ['Add practical examples']
    },
    unitCode: 'BSBWHS332X',
    unitTitle: 'Apply work health and safety procedures'
  }

  const mockOptions: SmartQuestionOptions = {
    includeBenchmarkAnswer: true,
    includeAssessmentCriteria: true,
    difficultyLevel: 'intermediate',
    questionCount: 1
  }

  describe('createSmartQuestionPrompt', () => {
    it('should create a smart question prompt with all required fields', () => {
      const prompt = createSmartQuestionPrompt(mockInput, mockOptions)
      
      expect(prompt).toContain('KE1')
      expect(prompt).toContain('knowledge_evidence')
      expect(prompt).toContain('Describe safety procedures in the workplace')
      expect(prompt).toContain('BSBWHS332X')
      expect(prompt).toContain('Apply work health and safety procedures')
      expect(prompt).toContain('partial')
      expect(prompt).toContain('Basic concepts covered but missing practical examples')
    })

    it('should include evidence when provided', () => {
      const prompt = createSmartQuestionPrompt(mockInput, mockOptions)
      
      expect(prompt).toContain('Evidence from Validation')
      expect(prompt).toContain('Good theoretical coverage')
      expect(prompt).toContain('Lacks workplace scenarios')
      expect(prompt).toContain('Add practical examples')
    })

    it('should include benchmark answer when enabled', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { includeBenchmarkAnswer: true })
      
      expect(prompt).toContain('benchmark_answer')
      expect(prompt).toContain('model answer')
    })

    it('should exclude benchmark answer when disabled', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { includeBenchmarkAnswer: false })
      
      expect(prompt).not.toContain('benchmark_answer')
    })

    it('should include assessment criteria when enabled', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { includeAssessmentCriteria: true })
      
      expect(prompt).toContain('assessment_criteria')
      expect(prompt).toContain('Criterion')
    })

    it('should exclude assessment criteria when disabled', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { includeAssessmentCriteria: false })
      
      expect(prompt).not.toContain('assessment_criteria')
    })

    it('should include difficulty level', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { difficultyLevel: 'advanced' })
      
      expect(prompt).toContain('advanced')
      expect(prompt).toContain('Achievable: Appropriate for the advanced level')
    })

    it('should handle multiple questions', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { questionCount: 3 })
      
      expect(prompt).toContain('3 SMART questions')
      expect(prompt).toContain('questions should be')
      expect(prompt).toContain('questions as a JSON array')
    })

    it('should include user context when provided', () => {
      const inputWithContext = {
        ...mockInput,
        userContext: 'Focus on warehouse safety scenarios'
      }
      
      const prompt = createSmartQuestionPrompt(inputWithContext)
      
      expect(prompt).toContain('Additional Context from User')
      expect(prompt).toContain('Focus on warehouse safety scenarios')
    })

    it('should provide appropriate guidance for met status', () => {
      const metInput = { ...mockInput, validationStatus: 'met' as const }
      
      const prompt = createSmartQuestionPrompt(metInput)
      
      expect(prompt).toContain('Since this requirement is already MET')
      expect(prompt).toContain('Reinforce and deepen understanding')
      expect(prompt).toContain('alternative ways to demonstrate competency')
    })

    it('should provide appropriate guidance for not-met status', () => {
      const notMetInput = { ...mockInput, validationStatus: 'not-met' as const }
      
      const prompt = createSmartQuestionPrompt(notMetInput)
      
      expect(prompt).toContain('Since this requirement is NOT MET')
      expect(prompt).toContain('Directly address the gaps')
      expect(prompt).toContain('clear opportunities to demonstrate')
    })

    it('should provide appropriate guidance for partial status', () => {
      const partialInput = { ...mockInput, validationStatus: 'partial' as const }
      
      const prompt = createSmartQuestionPrompt(partialInput)
      
      expect(prompt).toContain('Since this requirement is PARTIALLY met')
      expect(prompt).toContain('Address the specific gaps')
      expect(prompt).toContain('building on strengths')
    })
  })

  describe('createBatchSmartQuestionPrompt', () => {
    const mockRequirements: SmartQuestionInput[] = [
      mockInput,
      {
        requirementNumber: 'KE2',
        requirementType: 'performance_evidence',
        requirementText: 'Demonstrate emergency procedures',
        validationStatus: 'not-met',
        validationReasoning: 'No demonstration provided'
      },
      {
        requirementNumber: 'KE3',
        requirementType: 'knowledge_evidence',
        requirementText: 'Explain risk assessment process',
        validationStatus: 'met',
        validationReasoning: 'Comprehensive explanation provided'
      }
    ]

    it('should create a batch prompt for multiple requirements', () => {
      const prompt = createBatchSmartQuestionPrompt(mockRequirements)
      
      expect(prompt).toContain('KE1')
      expect(prompt).toContain('KE2')
      expect(prompt).toContain('KE3')
      expect(prompt).toContain('knowledge_evidence')
      expect(prompt).toContain('performance_evidence')
      expect(prompt).toContain('partial')
      expect(prompt).toContain('not-met')
      expect(prompt).toContain('met')
    })

    it('should include validation reasoning for each requirement', () => {
      const prompt = createBatchSmartQuestionPrompt(mockRequirements)
      
      expect(prompt).toContain('Basic concepts covered but missing practical examples')
      expect(prompt).toContain('No demonstration provided')
      expect(prompt).toContain('Comprehensive explanation provided')
    })

    it('should include gaps to address when available', () => {
      const prompt = createBatchSmartQuestionPrompt(mockRequirements)
      
      expect(prompt).toContain('Gaps to Address:')
      expect(prompt).toContain('Lacks workplace scenarios')
    })

    it('should format as numbered requirements', () => {
      const prompt = createBatchSmartQuestionPrompt(mockRequirements)
      
      expect(prompt).toContain('Requirement 1: KE1')
      expect(prompt).toContain('Requirement 2: KE2')
      expect(prompt).toContain('Requirement 3: KE3')
    })

    it('should include difficulty level in guidance', () => {
      const prompt = createBatchSmartQuestionPrompt(mockRequirements, { difficultyLevel: 'basic' })
      
      expect(prompt).toContain('basic level')
    })

    it('should handle empty requirements array', () => {
      const prompt = createBatchSmartQuestionPrompt([])
      
      expect(prompt).toContain('Requirements to Address')
      expect(prompt).toContain('Generate ONE SMART question for EACH requirement')
    })
  })

  describe('createRegenerationPrompt', () => {
    const mockCurrentQuestion = {
      question: 'Describe general safety procedures',
      benchmarkAnswer: 'General safety procedures include...'
    }

    it('should create a regeneration prompt with current question', () => {
      const prompt = createRegenerationPrompt(
        mockInput,
        mockCurrentQuestion,
        'Make it more specific to warehouse environments'
      )
      
      expect(prompt).toContain('Current SMART Question')
      expect(prompt).toContain('Describe general safety procedures')
      expect(prompt).toContain('Current Benchmark Answer')
      expect(prompt).toContain('General safety procedures include...')
      expect(prompt).toContain('User Feedback')
      expect(prompt).toContain('Make it more specific to warehouse environments')
    })

    it('should handle missing benchmark answer', () => {
      const questionWithoutAnswer = {
        question: 'Test question'
      }
      
      const prompt = createRegenerationPrompt(
        mockInput,
        questionWithoutAnswer,
        'Improve this question'
      )
      
      expect(prompt).toContain('Test question')
      expect(prompt).not.toContain('Current Benchmark Answer')
    })

    it('should include user context when provided', () => {
      const inputWithContext = {
        ...mockInput,
        userContext: 'Focus on forklift operations'
      }
      
      const prompt = createRegenerationPrompt(
        inputWithContext,
        mockCurrentQuestion,
        'Add forklift examples'
      )
      
      expect(prompt).toContain('Additional Context')
      expect(prompt).toContain('Focus on forklift operations')
    })

    it('should include improvements made section', () => {
      const prompt = createRegenerationPrompt(
        mockInput,
        mockCurrentQuestion,
        'Make it better'
      )
      
      expect(prompt).toContain('improvements_made')
      expect(prompt).toContain('What was improved based on feedback')
    })

    it('should maintain focus on requirement number', () => {
      const prompt = createRegenerationPrompt(
        mockInput,
        mockCurrentQuestion,
        'Improve question'
      )
      
      expect(prompt).toContain('maintains focus on KE1 ONLY')
      expect(prompt).toContain('Keep the question focused on KE1 only')
    })
  })

  describe('parseSmartQuestionResponse', () => {
    it('should parse single question from JSON code block', () => {
      const response = `\`\`\`json
{
  "question": "What safety procedures should be followed when operating heavy machinery?",
  "benchmark_answer": "Operators should conduct pre-start checks, follow lockout procedures, wear appropriate PPE...",
  "assessment_criteria": ["Pre-start checks", "Lockout procedures", "PPE requirements"],
  "question_type": "scenario",
  "difficulty_level": "intermediate",
  "estimated_time": "15 minutes",
  "focus_areas": ["Safety", "Machinery"]
}
\`\`\``
      
      const result = parseSmartQuestionResponse(response)
      
      expect(result).toEqual({
        question: 'What safety procedures should be followed when operating heavy machinery?',
        benchmark_answer: 'Operators should conduct pre-start checks, follow lockout procedures, wear appropriate PPE...',
        assessment_criteria: ["Pre-start checks", "Lockout procedures", "PPE requirements"],
        question_type: 'scenario',
        difficulty_level: 'intermediate',
        estimated_time: '15 minutes',
        focus_areas: ["Safety", "Machinery"]
      })
    })

    it('should parse array of questions', () => {
      const response = `\`\`\`json
[
  {
    "question": "Question 1",
    "benchmark_answer": "Answer 1",
    "question_type": "scenario"
  },
  {
    "question": "Question 2", 
    "benchmark_answer": "Answer 2",
    "question_type": "knowledge"
  }
]
\`\`\``
      
      const result = parseSmartQuestionResponse(response)
      
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0].question).toBe('Question 1')
      expect(result[1].question).toBe('Question 2')
    })

    it('should parse JSON without code block', () => {
      const response = `{"question": "Test question", "question_type": "practical"}`
      
      const result = parseSmartQuestionResponse(response)
      
      expect(result).toEqual({
        question: 'Test question',
        question_type: 'practical'
      })
    })

    it('should handle malformed JSON gracefully', () => {
      const response = `{"question": "test", "question_type":`
      
      const result = parseSmartQuestionResponse(response)
      
      expect(result).toBeNull()
    })

    it('should extract JSON from mixed text response', () => {
      const response = `Here is your question:
{"question": "Safety question", "question_type": "scenario"}
Thank you!`
      
      const result = parseSmartQuestionResponse(response)
      
      expect(result).toEqual({
        question: 'Safety question',
        question_type: 'scenario'
      })
    })
  })

  describe('isValidSmartQuestion', () => {
    it('should validate correct structure', () => {
      const validQuestion = {
        question: 'Test question',
        question_type: 'scenario'
      }
      
      expect(isValidSmartQuestion(validQuestion)).toBe(true)
    })

    it('should accept all valid question types', () => {
      const validTypes = ['scenario', 'case-study', 'practical', 'knowledge', 'analysis']
      
      validTypes.forEach(type => {
        const question = {
          question: 'Test question',
          question_type: type
        }
        expect(isValidSmartQuestion(question)).toBe(true)
      })
    })

    it('should reject invalid question type', () => {
      const invalidQuestion = {
        question: 'Test question',
        question_type: 'invalid'
      }
      
      expect(isValidSmartQuestion(invalidQuestion)).toBe(false)
    })

    it('should reject missing question', () => {
      const missingQuestion = {
        question_type: 'scenario'
      }
      
      expect(isValidSmartQuestion(missingQuestion)).toBe(false)
    })

    it('should reject empty question', () => {
      const emptyQuestion = {
        question: '',
        question_type: 'scenario'
      }
      
      expect(isValidSmartQuestion(emptyQuestion)).toBe(false)
    })

    it('should reject null or undefined input', () => {
      expect(isValidSmartQuestion(null)).toBe(false)
      expect(isValidSmartQuestion(undefined)).toBe(false)
    })

    it('should reject non-object input', () => {
      expect(isValidSmartQuestion('string')).toBe(false)
      expect(isValidSmartQuestion(123)).toBe(false)
      expect(isValidSmartQuestion([])).toBe(false)
    })

    it('should accept valid additional fields', () => {
      const questionWithExtras = {
        question: 'Test question',
        question_type: 'scenario',
        benchmark_answer: 'Model answer',
        assessment_criteria: ['Criterion 1'],
        difficulty_level: 'intermediate'
      }
      
      expect(isValidSmartQuestion(questionWithExtras)).toBe(true)
    })
  })

  describe('simplifyQuestionResult', () => {
    it('should extract question and benchmark answer', () => {
      const fullResult = {
        question: 'Test question',
        benchmark_answer: 'Model answer',
        assessment_criteria: ['Criterion 1'],
        question_type: 'scenario',
        difficulty_level: 'intermediate'
      }
      
      const simplified = simplifyQuestionResult(fullResult)
      
      expect(simplified).toEqual({
        question: 'Test question',
        answer: 'Model answer'
      })
    })

    it('should handle missing benchmark_answer', () => {
      const resultWithoutBenchmark = {
        question: 'Test question',
        answer: 'Alternative answer field',
        question_type: 'scenario'
      }
      
      const simplified = simplifyQuestionResult(resultWithoutBenchmark)
      
      expect(simplified).toEqual({
        question: 'Test question',
        answer: 'Alternative answer field'
      })
    })

    it('should handle missing both answer fields', () => {
      const resultWithoutAnswers = {
        question: 'Test question',
        question_type: 'scenario'
      }
      
      const simplified = simplifyQuestionResult(resultWithoutAnswers)
      
      expect(simplified).toEqual({
        question: 'Test question',
        answer: ''
      })
    })

    it('should handle empty input', () => {
      const simplified = simplifyQuestionResult({})
      
      expect(simplified).toEqual({
        question: '',
        answer: ''
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in requirement text', () => {
      const specialInput = {
        ...mockInput,
        requirementText: 'Safety for "high-risk" operations & equipment (100kg+)'
      }
      
      const prompt = createSmartQuestionPrompt(specialInput)
      
      expect(prompt).toContain('Safety for "high-risk" operations & equipment (100kg+)')
    })

    it('should handle very long user context', () => {
      const longContext = 'A'.repeat(1000)
      const inputWithLongContext = {
        ...mockInput,
        userContext: longContext
      }
      
      const prompt = createSmartQuestionPrompt(inputWithLongContext)
      
      expect(prompt).toContain(longContext)
    })

    it('should handle evidence with missing fields', () => {
      const partialEvidence = {
        strengths: ['Good coverage'],
        gaps: ['Missing examples']
        // missing suggestions
      }
      
      const inputWithPartialEvidence = {
        ...mockInput,
        evidence: partialEvidence
      }
      
      const prompt = createSmartQuestionPrompt(inputWithPartialEvidence)
      
      expect(prompt).toContain('Good coverage')
      expect(prompt).toContain('Missing examples')
      expect(prompt).not.toContain('suggestions:')
    })

    it('should handle maximum question count', () => {
      const prompt = createSmartQuestionPrompt(mockInput, { questionCount: 10 })
      
      expect(prompt).toContain('10 SMART questions')
      expect(prompt).toContain('questions should be')
    })
  })
})
