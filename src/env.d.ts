/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  
  // n8n Webhooks
  readonly VITE_N8N_DOCUMENT_PROCESSING_URL: string
  readonly VITE_N8N_VALIDATION_URL: string
  readonly VITE_N8N_REPORT_URL: string
  readonly VITE_N8N_REVALIDATE_URL: string
  readonly VITE_N8N_REGENERATE_QUESTIONS_URL: string
  readonly VITE_N8N_AI_CHAT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
