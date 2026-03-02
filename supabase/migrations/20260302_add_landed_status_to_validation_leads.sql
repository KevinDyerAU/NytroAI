-- Migration: Add 'landed' status to validation_leads
-- The Leads Management admin page uses: landed, processing, completed
-- 'landed' = customer submitted form and paid, awaiting admin review/approval

-- Drop the old check constraint and add a new one with 'landed'
ALTER TABLE public.validation_leads
  DROP CONSTRAINT IF EXISTS validation_leads_status_check;

ALTER TABLE public.validation_leads
  ADD CONSTRAINT validation_leads_status_check
  CHECK (status IN ('pending', 'paid', 'landed', 'processing', 'completed', 'cancelled'));

-- Update existing 'paid' leads to 'landed' (they've paid, now awaiting admin action)
-- Only update leads that haven't already been processed
UPDATE public.validation_leads
  SET status = 'landed', updated_at = now()
  WHERE status = 'paid';
