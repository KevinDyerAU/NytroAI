-- Migration: Migrate data from old validation tables to consolidated validation_results
-- Date: 2025-01-22
-- Purpose: Phase 2 - Data Migration with Consistent Naming Conventions
-- Version: 2 (Updated to match new schema)
-- NOTE: Run this AFTER creating the validation_results table (20250122_create_validation_results_v2.sql)

-- COLUMN MAPPING:
-- Old -> New
-- valDetail_id -> validation_detail_id
-- requirementId -> requirement_id
-- ke_number/pe_number/fs_number/epc_number/ac_number -> requirement_number
-- ke_requirement/pe_requirement/fs_requirement/performance_criteria/ac_point -> requirement_text
-- mapped_questions/mapped_content -> mapped_content
-- unmappedContent/unmappedContentExplanation -> unmapped_content
-- unmappedRecommendations/unmappedContentRecommendation/recommendation -> recommendations
-- docReferences -> doc_references
-- smart_question + benchmarkAnswer -> smart_questions (JSONB array)

-- ============================================================================
-- 1. MIGRATE KNOWLEDGE EVIDENCE VALIDATIONS
-- ============================================================================
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
  "valDetail_id" as validation_detail_id,
  1, -- Knowledge Evidence type ID
  "requirementId" as requirement_id,
  'ke' as requirement_type,
  ke_number as requirement_number,
  ke_requirement as requirement_text,
  LOWER(status) as status,
  unmappedContent as reasoning,  -- Using unmappedContent as reasoning
  mapped_questions as mapped_content,
  unmappedContent as unmapped_content,
  unmappedRecommendations as recommendations,
  docReferences as doc_references,
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
  END as smart_questions,
  created_at
FROM public.knowledge_evidence_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 2. MIGRATE PERFORMANCE EVIDENCE VALIDATIONS
-- ============================================================================
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
  "valDetail_id" as validation_detail_id,
  3, -- Performance Evidence type ID
  "requirementId" as requirement_id,
  'pe' as requirement_type,
  pe_number as requirement_number,
  pe_requirement as requirement_text,
  LOWER(status) as status,
  unmappedContent as reasoning,
  mapped_questions as mapped_content,
  unmappedContent as unmapped_content,
  unmappedRecommendations as recommendations,
  docReferences as doc_references,
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
  END as smart_questions,
  created_at
FROM public.performance_evidence_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 3. MIGRATE FOUNDATION SKILLS VALIDATIONS
-- ============================================================================
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
  "valDetail_id" as validation_detail_id,
  5, -- Foundation Skills type ID
  "requirementId" as requirement_id,
  'fs' as requirement_type,
  fs_number as requirement_number,
  fs_requirement as requirement_text,
  LOWER(status) as status,
  unmappedContent as reasoning,
  mapped_questions as mapped_content,
  unmappedContent as unmapped_content,
  unmappedRecommendations as recommendations,
  docReferences as doc_references,
  created_at
FROM public.foundation_skills_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 4. MIGRATE ELEMENTS AND PERFORMANCE CRITERIA VALIDATIONS
-- ============================================================================
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
  "valDetail_id" as validation_detail_id,
  2, -- Elements and Performance Criteria type ID
  "requirementId" as requirement_id,
  'epc' as requirement_type,
  epc_number as requirement_number,
  performance_criteria as requirement_text,
  LOWER(status) as status,
  unmappedContentExplanation as reasoning,
  mapped_questions as mapped_content,
  unmappedContentExplanation as unmapped_content,
  unmappedContentRecommendation as recommendations,
  docReferences as doc_references,
  created_at
FROM public.elements_performance_criteria_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 5. MIGRATE ASSESSMENT CONDITIONS VALIDATIONS
-- ============================================================================
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
  "valDetail_id" as validation_detail_id,
  4, -- Assessment Conditions type ID
  "requirementId" as requirement_id,
  'ac' as requirement_type,
  'AC-' || id::text as requirement_number,
  ac_point as requirement_text,
  LOWER(status) as status,
  reasoning as reasoning,
  recommendation as recommendations,
  created_at
FROM public.assessment_conditions_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 6. MIGRATE KNOWLEDGE EVIDENCE LEARNER VALIDATIONS
-- ============================================================================
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
  metadata,
  created_at
)
SELECT 
  "valDetail_id" as validation_detail_id,
  1, -- Knowledge Evidence type ID
  "requirementId" as requirement_id,
  'learner' as requirement_type,  -- Mark as learner guide validation
  ke_number as requirement_number,
  ke_requirement as requirement_text,
  LOWER(status) as status,
  unmappedContent as reasoning,
  mapped_content as mapped_content,
  unmappedContent as unmapped_content,
  unmappedRecommendations as recommendations,
  docReferences as doc_references,
  jsonb_build_object('is_learner_guide', true) as metadata,
  created_at
FROM public.knowledge_evidence_learner_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 7. MIGRATE PERFORMANCE EVIDENCE LEARNER VALIDATIONS
-- ============================================================================
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
  metadata,
  created_at
)
SELECT 
  "valDetail_id" as validation_detail_id,
  3, -- Performance Evidence type ID
  "requirementId" as requirement_id,
  'learner' as requirement_type,  -- Mark as learner guide validation
  pe_number as requirement_number,
  pe_requirement as requirement_text,
  LOWER(status) as status,
  unmappedContent as reasoning,
  mapped_content as mapped_content,
  unmappedContent as unmapped_content,
  unmappedRecommendation as recommendations,
  docReferences as doc_references,
  jsonb_build_object('is_learner_guide', true) as metadata,
  created_at
FROM public.performance_evidence_learner_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- 8. MIGRATE ELEMENTS AND PERFORMANCE CRITERIA LEARNER VALIDATIONS
-- ============================================================================
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
  metadata,
  created_at
)
SELECT 
  "valDetail_id" as validation_detail_id,
  2, -- Elements and Performance Criteria type ID
  "requirementId" as requirement_id,
  'learner' as requirement_type,  -- Mark as learner guide validation
  epc_number as requirement_number,
  performance_criteria as requirement_text,
  LOWER(status) as status,
  unmappedContent as reasoning,
  mapped_content as mapped_content,
  unmappedContent as unmapped_content,
  unmappedRecommendation as recommendations,
  docReferences as doc_references,
  jsonb_build_object('is_learner_guide', true) as metadata,
  created_at
FROM public.elements_performance_criteria_learner_validations
WHERE EXISTS (SELECT 1 FROM public.validation_detail WHERE id = "valDetail_id");

-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================
DO $$
DECLARE
  ke_count INTEGER;
  pe_count INTEGER;
  fs_count INTEGER;
  epc_count INTEGER;
  ac_count INTEGER;
  ke_learner_count INTEGER;
  pe_learner_count INTEGER;
  epc_learner_count INTEGER;
  total_old INTEGER;
  total_new INTEGER;
  by_type RECORD;
BEGIN
  -- Count old table records
  SELECT COUNT(*) INTO ke_count FROM public.knowledge_evidence_validations;
  SELECT COUNT(*) INTO pe_count FROM public.performance_evidence_validations;
  SELECT COUNT(*) INTO fs_count FROM public.foundation_skills_validations;
  SELECT COUNT(*) INTO epc_count FROM public.elements_performance_criteria_validations;
  SELECT COUNT(*) INTO ac_count FROM public.assessment_conditions_validations;
  SELECT COUNT(*) INTO ke_learner_count FROM public.knowledge_evidence_learner_validations;
  SELECT COUNT(*) INTO pe_learner_count FROM public.performance_evidence_learner_validations;
  SELECT COUNT(*) INTO epc_learner_count FROM public.elements_performance_criteria_learner_validations;
  
  total_old := ke_count + pe_count + fs_count + epc_count + ac_count + 
               ke_learner_count + pe_learner_count + epc_learner_count;
  
  SELECT COUNT(*) INTO total_new FROM public.validation_results;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Assessment Validations:';
  RAISE NOTICE '  Knowledge Evidence: % records', ke_count;
  RAISE NOTICE '  Performance Evidence: % records', pe_count;
  RAISE NOTICE '  Foundation Skills: % records', fs_count;
  RAISE NOTICE '  Elements & Performance Criteria: % records', epc_count;
  RAISE NOTICE '  Assessment Conditions: % records', ac_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Learner Guide Validations:';
  RAISE NOTICE '  Knowledge Evidence (Learner): % records', ke_learner_count;
  RAISE NOTICE '  Performance Evidence (Learner): % records', pe_learner_count;
  RAISE NOTICE '  Elements & PC (Learner): % records', epc_learner_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Total in old tables: % records', total_old;
  RAISE NOTICE 'Total in validation_results: % records', total_new;
  RAISE NOTICE '';
  
  -- Show breakdown by requirement_type
  RAISE NOTICE 'Breakdown by requirement_type:';
  FOR by_type IN 
    SELECT requirement_type, COUNT(*) as count 
    FROM public.validation_results 
    GROUP BY requirement_type 
    ORDER BY requirement_type
  LOOP
    RAISE NOTICE '  %: % records', by_type.requirement_type, by_type.count;
  END LOOP;
  
  RAISE NOTICE '========================================';
  
  IF total_new >= total_old THEN
    RAISE NOTICE '✅ Migration completed successfully!';
  ELSE
    RAISE WARNING '⚠️  Migration may be incomplete. Expected at least % records, got %', total_old, total_new;
  END IF;
END $$;
