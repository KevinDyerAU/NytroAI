-- Fix ambiguous column reference in add_ai_credits and add_validation_credits RPC functions
-- The issue is that parameter names match column names, causing ambiguity

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS add_ai_credits(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS add_validation_credits(TEXT, INTEGER, TEXT);

-- Recreate add_ai_credits function with proper aliasing
CREATE OR REPLACE FUNCTION add_ai_credits(
  p_rto_code TEXT,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS TABLE(
  current_credits INTEGER,
  total_credits INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rto_id INTEGER;
  v_current INTEGER;
  v_total INTEGER;
BEGIN
  -- Get RTO ID
  SELECT id INTO v_rto_id
  FROM "RTO"
  WHERE code = p_rto_code;

  IF v_rto_id IS NULL THEN
    RAISE EXCEPTION 'RTO not found: %', p_rto_code;
  END IF;

  -- Update or insert AI credits
  INSERT INTO ai_credits (rto_id, current_credits, total_credits, subscription_credits)
  VALUES (v_rto_id, p_amount, p_amount, p_amount)
  ON CONFLICT (rto_id) DO UPDATE
  SET 
    current_credits = GREATEST(0, ai_credits.current_credits + p_amount),
    total_credits = ai_credits.total_credits + GREATEST(0, p_amount),
    updated_at = NOW();

  -- Get updated values
  SELECT ac.current_credits, ac.total_credits
  INTO v_current, v_total
  FROM ai_credits ac
  WHERE ac.rto_id = v_rto_id;

  -- Log transaction
  INSERT INTO ai_credit_transactions (rto_id, amount, reason, balance_after)
  VALUES (v_rto_id, p_amount, p_reason, v_current);

  RETURN QUERY SELECT v_current, v_total;
END;
$$;

-- Recreate add_validation_credits function with proper aliasing
CREATE OR REPLACE FUNCTION add_validation_credits(
  p_rto_code TEXT,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS TABLE(
  current_credits INTEGER,
  total_credits INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rto_id INTEGER;
  v_current INTEGER;
  v_total INTEGER;
BEGIN
  -- Get RTO ID
  SELECT id INTO v_rto_id
  FROM "RTO"
  WHERE code = p_rto_code;

  IF v_rto_id IS NULL THEN
    RAISE EXCEPTION 'RTO not found: %', p_rto_code;
  END IF;

  -- Update or insert validation credits
  INSERT INTO validation_credits (rto_id, current_credits, total_credits, subscription_credits)
  VALUES (v_rto_id, p_amount, p_amount, p_amount)
  ON CONFLICT (rto_id) DO UPDATE
  SET 
    current_credits = GREATEST(0, validation_credits.current_credits + p_amount),
    total_credits = validation_credits.total_credits + GREATEST(0, p_amount),
    updated_at = NOW();

  -- Get updated values
  SELECT vc.current_credits, vc.total_credits
  INTO v_current, v_total
  FROM validation_credits vc
  WHERE vc.rto_id = v_rto_id;

  -- Log transaction
  INSERT INTO credit_transactions (rto_id, amount, reason, balance_after)
  VALUES (v_rto_id, p_amount, p_reason, v_current);

  RETURN QUERY SELECT v_current, v_total;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_ai_credits(TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_validation_credits(TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;
