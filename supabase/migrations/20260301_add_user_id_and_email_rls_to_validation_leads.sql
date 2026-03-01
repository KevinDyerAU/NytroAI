-- ============================================================================
-- Migration: Add user_id column and per-email RLS to validation_leads
-- Purpose: Ensure authenticated users can only see their own validations
-- ============================================================================

-- 1. Add user_id column (nullable, FK to auth.users)
ALTER TABLE public.validation_leads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_leads_user_id ON public.validation_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_leads_email ON public.validation_leads(email);

-- 3. RLS policies for authenticated users (email-based row isolation)
-- Users can only SELECT rows where their auth email matches the lead email
CREATE POLICY "Authenticated users can view own validations by email"
  ON public.validation_leads
  FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email')::text);

-- Users can only UPDATE rows where their auth email matches the lead email
CREATE POLICY "Authenticated users can update own validations by email"
  ON public.validation_leads
  FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email')::text)
  WITH CHECK (email = (auth.jwt() ->> 'email')::text);

-- Authenticated users can insert validations (no email restriction on insert)
CREATE POLICY "Authenticated users can insert validations"
  ON public.validation_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Backfill user_id for existing records where email matches an auth user
UPDATE public.validation_leads
  SET user_id = au.id
  FROM auth.users au
  WHERE validation_leads.email = au.email
    AND validation_leads.user_id IS NULL;
