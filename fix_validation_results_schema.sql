-- Fix validation_results schema issues
-- Run this in Supabase SQL Editor

-- 1. Add citations column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'validation_results' 
    AND column_name = 'citations'
  ) THEN
    ALTER TABLE validation_results 
    ADD COLUMN citations JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added citations column';
  ELSE
    RAISE NOTICE 'Citations column already exists';
  END IF;
END $$;

-- 2. Fix assessment_conditions_requirements table to use unit_url
DO $$
BEGIN
  -- Check if unit_url column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'assessment_conditions_requirements' 
    AND column_name = 'unit_url'
  ) THEN
    -- Check if unitCode column exists (old column name)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'assessment_conditions_requirements' 
      AND column_name = 'unitCode'
    ) THEN
      -- Rename unitCode to unit_url
      ALTER TABLE assessment_conditions_requirements 
      RENAME COLUMN "unitCode" TO unit_url;
      RAISE NOTICE 'Renamed unitCode to unit_url in assessment_conditions_requirements';
    ELSE
      -- Add unit_url column
      ALTER TABLE assessment_conditions_requirements 
      ADD COLUMN unit_url TEXT;
      
      -- Create index
      CREATE INDEX IF NOT EXISTS idx_assessment_conditions_unit_url 
        ON assessment_conditions_requirements(unit_url);
      
      RAISE NOTICE 'Added unit_url column to assessment_conditions_requirements';
    END IF;
  ELSE
    RAISE NOTICE 'unit_url column already exists in assessment_conditions_requirements';
  END IF;
END $$;

-- 3. Verify the changes
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('validation_results', 'assessment_conditions_requirements')
AND column_name IN ('citations', 'unit_url', 'unitCode')
ORDER BY table_name, column_name;
