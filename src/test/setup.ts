import '@testing-library/jest-dom'

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'mock-token' } }
    })
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'test-id',
            requirement_number: 'KE1',
            requirement_type: 'knowledge_evidence',
            requirement_text: 'Test requirement',
            validation_status: 'partial',
            validation_reasoning: 'Test reasoning',
            evidence_data: {
              strengths: ['Test strength'],
              gaps: ['Test gap'],
              suggestions: ['Test suggestion']
            },
            smart_questions: [],
            validation_detail: {
              unit_code: 'BSBWHS332X',
              unit_title: 'Test Unit'
            }
          },
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

// Mock fetch
global.fetch = vi.fn()

// Mock environment variables
vi.mock('../lib/env', () => ({
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-key'
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  }
}))

declare global {
  namespace Vi {
    interface JestAssertion<T = any> extends jest.Matchers<void, T> {}
  }
}
