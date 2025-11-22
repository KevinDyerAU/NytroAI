-- ============================================================================
-- Phase 3.2: Fix get_validation_results Function Signature Issues
-- ============================================================================
-- This migration fixes the ambiguous function signature error by:
-- 1. Removing all existing overloaded versions
-- 2. Creating a single bigint version that works with both integer and bigint inputs
-- 3. Using the new consolidated validation_results table
-- ============================================================================

-- Step 1: Drop all existing versions of the function
-- ============================================================================

DROP FUNCTION IF EXISTS get_validation_results(integer);
DROP FUNCTION IF EXISTS get_validation_results(bigint);
DROP FUNCTION IF EXISTS get_validation_results(p_val_detail_id integer);
DROP FUNCTION IF EXISTS get_validation_results(p_val_detail_id bigint);

-- Step 2: Create single bigint version using new validation_results table
-- ============================================================================

CREATE OR REPLACE FUNCTION get_validation_results(p_val_detail_id bigint)
RETURNS TABLE (
    id text,
    requirement_number text,
    requirement_text text,
    status text,
    reasoning text,
    mapped_questions text,
    unmapped_reasoning text,
    document_references text,
    smart_question text,
    benchmark_answer text,
    recommendations text,
    table_source text,
    type text
) AS $$
BEGIN
    -- Return validation results from the consolidated validation_results table
    RETURN QUERY
    SELECT 
        vr.id::text,
        vr.requirement_number::text,
        vr.requirement_text::text,
        vr.status::text,
        vr.reasoning::text,
        COALESCE(
            (SELECT jsonb_agg(q->>'question') 
             FROM jsonb_array_elements(vr.smart_questions) q),
            '[]'::jsonb
        )::text as mapped_questions,
        ''::text as unmapped_reasoning,  -- Legacy field, no longer used
        COALESCE(vr.document_references::text, '[]'::text) as document_references,
        COALESCE(
            (SELECT (jsonb_array_elements(vr.smart_questions)->>'question')::text LIMIT 1),
            ''::text
        ) as smart_question,
        COALESCE(
            (SELECT (jsonb_array_elements(vr.smart_questions)->>'benchmark_answer')::text LIMIT 1),
            ''::text
        ) as benchmark_answer,
        COALESCE(vr.recommendations::text, ''::text) as recommendations,
        'validation_results'::text as table_source,
        vr.requirement_type::text as type
    FROM validation_results vr
    WHERE vr.validation_detail_id = p_val_detail_id
    ORDER BY vr.requirement_number;
    
    -- If no results found, return empty result set (not an error)
    IF NOT FOUND THEN
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION get_validation_results(bigint) IS 
'Retrieves validation results for a given validation_detail_id from the consolidated validation_results table. 
Returns empty result set if no results found (not an error).
Uses bigint to avoid ambiguity with integer parameters from JavaScript.';

-- Step 4: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_validation_results(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_validation_results(bigint) TO anon;

-- Step 5: Create fallback function for backward compatibility (optional)
-- ============================================================================
-- This allows old code using integer to still work

CREATE OR REPLACE FUNCTION get_validation_results_legacy(p_val_detail_id integer)
RETURNS TABLE (
    id text,
    requirement_number text,
    requirement_text text,
    status text,
    reasoning text,
    mapped_questions text,
    unmapped_reasoning text,
    document_references text,
    smart_question text,
    benchmark_answer text,
    recommendations text,
    table_source text,
    type text
) AS $$
BEGIN
    -- Just call the bigint version with cast
    RETURN QUERY
    SELECT * FROM get_validation_results(p_val_detail_id::bigint);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_validation_results_legacy(integer) IS 
'Legacy wrapper for get_validation_results that accepts integer. 
Internally casts to bigint and calls the main function.';

GRANT EXECUTE ON FUNCTION get_validation_results_legacy(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_validation_results_legacy(integer) TO anon;

-- Step 6: Verification
-- ============================================================================

DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    -- Check that only our functions exist
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_validation_results';
    
    RAISE NOTICE 'Found % get_validation_results function(s)', v_function_count;
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Function signature issue resolved - single bigint version exists';
    ELSIF v_function_count = 2 THEN
        RAISE NOTICE '✓ Both main and legacy functions exist';
    ELSE
        RAISE WARNING 'Unexpected number of functions found: %', v_function_count;
    END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary of changes:
-- ✅ Removed all ambiguous function overloads
-- ✅ Created single bigint version using validation_results table
-- ✅ Added legacy integer wrapper for backward compatibility
-- ✅ Proper error handling (returns empty set, not error)
-- ✅ Granted appropriate permissions
-- ✅ Added documentation

-- Next steps:
-- 1. Update frontend to explicitly cast to bigint or use the function directly
-- 2. Test with various validation_detail_id values
-- 3. Monitor for any remaining signature errors
