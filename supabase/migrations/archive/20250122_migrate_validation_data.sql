-- Migration: Migrate data from old validation tables to consolidated validation_results
-- Date: 2025-01-22
-- Purpose: Phase 2 - Data Migration
-- NOTE: Run this AFTER creating the validation_results table

-- Migrate Knowledge Evidence Validations
INSERT INTO public.validation_results (
  validation_detail_id,
  validation_type_id,
  requirement_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  mapped_content,
  unmapped_content,
  recommendations,
  doc_references,
  smart_questions,
  created_at
)
SELECT 
  valDetail_id,
  1, -- Knowledge Evidence type ID
  requirementId,
  'ke',
  ke_number,
  ke_requirement,
  LOWER(status),
  unmappedContent,
  mapped_questions,
  unmappedContent,
  unmappedRecommendations,
  docReferences,
  CASE 
    WHEN smart_question IS NOT NULL AND smart_question != '' THEN 
      jsonb_build_array(
        jsonb_build_object(
          'question', smart_question,
          'benchmark_answer', COALESCE(benchmarkAnswer, ''),
          'type', 'smart'
        )
      )
    ELSE '[]'::jsonb
  END,
  created_at
FROM public.knowledge_evidence_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = valDetail_id);

-- Migrate Performance Evidence Validations
INSERT INTO public.validation_results (
  validation_detail_id,
  validation_type_id,
  requirement_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  mapped_content,
  unmapped_content,
  recommendations,
  doc_references,
  smart_questions,
  created_at
)
SELECT 
  valDetail_id,
  3, -- Performance Evidence type ID
  requirementId,
  'pe',
  pe_number,
  pe_requirement,
  LOWER(status),
  unmappedContent,
  mapped_questions,
  unmappedContent,
  unmappedRecommendations,
  docReferences,
  CASE 
    WHEN smart_question IS NOT NULL AND smart_question != '' THEN 
      jsonb_build_array(
        jsonb_build_object(
          'question', smart_question,
          'benchmark_answer', COALESCE(benchmarkAnswer, ''),
          'type', 'smart'
        )
      )
    ELSE '[]'::jsonb
  END,
  created_at
FROM public.performance_evidence_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = valDetail_id);

-- Migrate Foundation Skills Validations
INSERT INTO public.validation_results (
  validation_detail_id,
  validation_type_id,
  requirement_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  mapped_content,
  unmapped_content,
  recommendations,
  doc_references,
  created_at
)
SELECT 
  valDetail_id,
  5, -- Foundation Skills type ID
  requirementId,
  'fs',
  fs_number,
  fs_requirement,
  LOWER(status),
  unmappedContent,
  mapped_questions,
  unmappedContent,
  unmappedRecommendations,
  docReferences,
  created_at
FROM public.foundation_skills_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = valDetail_id);

-- Migrate Elements and Performance Criteria Validations
INSERT INTO public.validation_results (
  validation_detail_id,
  validation_type_id,
  requirement_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  mapped_content,
  unmapped_content,
  recommendations,
  doc_references,
  created_at
)
SELECT 
  valDetail_id,
  2, -- Elements and Performance Criteria type ID
  requirementId,
  'epc',
  epc_number,
  performance_criteria,
  LOWER(status),
  unmappedContentExplanation,
  mapped_questions,
  unmappedContentExplanation,
  unmappedContentRecommendation,
  docReferences,
  created_at
FROM public.elements_performance_criteria_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = valDetail_id);

-- Migrate Assessment Conditions Validations
INSERT INTO public.validation_results (
  validation_detail_id,
  validation_type_id,
  requirement_id,
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  recommendations,
  created_at
)
SELECT 
  valDetail_id,
  4, -- Assessment Conditions type ID
  requirementId,
  'ac',
  'AC-' || id::text,
  ac_point,
  LOWER(status),
  reasoning,
  recommendation,
  created_at
FROM public.assessment_conditions_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = valDetail_id);

-- Verify migration counts
DO $$
DECLARE
  ke_count INTEGER;
  pe_count INTEGER;
  fs_count INTEGER;
  epc_count INTEGER;
  ac_count INTEGER;
  total_old INTEGER;
  total_new INTEGER;
BEGIN
  SELECT COUNT(*) INTO ke_count FROM public.knowledge_evidence_validations;
  SELECT COUNT(*) INTO pe_count FROM public.performance_evidence_validations;
  SELECT COUNT(*) INTO fs_count FROM public.foundation_skills_validations;
  SELECT COUNT(*) INTO epc_count FROM public.elements_performance_criteria_validations;
  SELECT COUNT(*) INTO ac_count FROM public.assessment_conditions_validations;
  
  total_old := ke_count + pe_count + fs_count + epc_count + ac_count;
  
  SELECT COUNT(*) INTO total_new FROM public.validation_results;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Knowledge Evidence: % records', ke_count;
  RAISE NOTICE '  Performance Evidence: % records', pe_count;
  RAISE NOTICE '  Foundation Skills: % records', fs_count;
  RAISE NOTICE '  Elements & Performance Criteria: % records', epc_count;
  RAISE NOTICE '  Assessment Conditions: % records', ac_count;
  RAISE NOTICE '  Total in old tables: % records', total_old;
  RAISE NOTICE '  Total in validation_results: % records', total_new;
  
  IF total_new >= total_old THEN
    RAISE NOTICE 'Migration completed successfully!';
  ELSE
    RAISE WARNING 'Migration may be incomplete. Expected at least % records, got %', total_old, total_new;
  END IF;
END $$;
