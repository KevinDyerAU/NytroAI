-- Fix assessment conditions and foundation skills flags
-- The has_assessment_conditions and has_foundation_skills flags were always false
-- because process-acquisition-queue checked the empty dedicated tables
-- instead of the UnitOfCompetency text columns (ac, fs) which have the data.

-- One-time data fix: set flags based on actual column data
UPDATE "UnitOfCompetency"
SET
  has_assessment_conditions = (ac IS NOT NULL AND LENGTH(ac) > 0),
  has_foundation_skills = (fs IS NOT NULL AND LENGTH(fs) > 0);

-- Update acquisition_status based on all 5 flags
UPDATE "UnitOfCompetency"
SET acquisition_status = CASE
  WHEN has_knowledge_evidence AND has_performance_evidence AND has_foundation_skills
       AND has_elements_performance_criteria AND has_assessment_conditions
  THEN 'complete'
  WHEN has_knowledge_evidence OR has_performance_evidence OR has_foundation_skills
       OR has_elements_performance_criteria OR has_assessment_conditions
  THEN 'partial'
  ELSE 'pending'
END;
