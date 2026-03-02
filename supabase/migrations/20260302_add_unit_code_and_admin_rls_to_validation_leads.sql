-- Migration: Add unit_code, unit_not_found, validation_id, admin_notes to validation_leads
-- Also adds admin RLS bypass for validation_leads and promo_codes

-- Add unit_code column for the unit being validated
ALTER TABLE validation_leads ADD COLUMN IF NOT EXISTS unit_code text;

-- Add flag for when unit code is not found in UnitOfCompetency table
ALTER TABLE validation_leads ADD COLUMN IF NOT EXISTS unit_not_found boolean DEFAULT false;

-- Add validation_id to link to actual validation records
ALTER TABLE validation_leads ADD COLUMN IF NOT EXISTS validation_id bigint;

-- Add admin_notes for internal admin comments
ALTER TABLE validation_leads ADD COLUMN IF NOT EXISTS admin_notes text;

-- Create index on unit_code for lookup performance
CREATE INDEX IF NOT EXISTS idx_validation_leads_unit_code ON validation_leads(unit_code);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_validation_leads_status ON validation_leads(status);

-- Create index on unit_not_found for admin flagging
CREATE INDEX IF NOT EXISTS idx_validation_leads_unit_not_found ON validation_leads(unit_not_found);

-- Allow admin users (is_admin = true in user_profiles) to see ALL validation_leads rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'validation_leads' AND policyname = 'admin_full_access_validation_leads'
  ) THEN
    CREATE POLICY admin_full_access_validation_leads ON validation_leads
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- Also add admin full access to promo_codes table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'promo_codes' AND policyname = 'admin_full_access_promo_codes'
  ) THEN
    ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY admin_full_access_promo_codes ON promo_codes
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      );
  END IF;
END $$;
