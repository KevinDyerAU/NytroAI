-- Create consume_ai_credit and consume_validation_credit RPC functions
-- These functions deduct credits and log the transaction

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS consume_ai_credit(TEXT);
DROP FUNCTION IF EXISTS consume_validation_credit(TEXT, TEXT);

-- Create consume_ai_credit function
CREATE OR REPLACE FUNCTION consume_ai_credit(
  p_rto_code TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  new_balance INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rto_id BIGINT;
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get RTO ID
  SELECT id INTO v_rto_id
  FROM "RTO"
  WHERE code = p_rto_code;

  IF v_rto_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'RTO not found: ' || p_rto_code, 0;
    RETURN;
  END IF;

  -- Get current AI credits
  SELECT current_credits INTO v_current_credits
  FROM ai_credits
  WHERE rto_id = v_rto_id;

  -- Check if RTO has credit record
  IF v_current_credits IS NULL THEN
    -- Initialize with 0 credits if not exists
    INSERT INTO ai_credits (rto_id, current_credits, total_credits, subscription_credits)
    VALUES (v_rto_id, 0, 0, 0)
    ON CONFLICT (rto_id) DO NOTHING;
    v_current_credits := 0;
  END IF;

  -- Check if enough credits
  IF v_current_credits <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Insufficient AI credits', v_current_credits;
    RETURN;
  END IF;

  -- Deduct 1 credit
  UPDATE ai_credits
  SET 
    current_credits = current_credits - 1,
    updated_at = NOW()
  WHERE rto_id = v_rto_id
  RETURNING current_credits INTO v_new_balance;

  -- Log transaction
  INSERT INTO ai_credit_transactions (rto_id, amount, reason, balance_after)
  VALUES (v_rto_id, -1, 'AI operation (chat/smart question/revalidation/validation)', v_new_balance);

  RETURN QUERY SELECT TRUE, 'Credit consumed successfully', v_new_balance;
END;
$$;

-- Create consume_validation_credit function
CREATE OR REPLACE FUNCTION consume_validation_credit(
  p_rto_code TEXT,
  p_reason TEXT DEFAULT 'Validation creation'
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  new_balance INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rto_id BIGINT;
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get RTO ID
  SELECT id INTO v_rto_id
  FROM "RTO"
  WHERE code = p_rto_code;

  IF v_rto_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'RTO not found: ' || p_rto_code, 0;
    RETURN;
  END IF;

  -- Get current validation credits
  SELECT current_credits INTO v_current_credits
  FROM validation_credits
  WHERE rto_id = v_rto_id;

  -- Check if RTO has credit record
  IF v_current_credits IS NULL THEN
    -- Initialize with 0 credits if not exists
    INSERT INTO validation_credits (rto_id, current_credits, total_credits, subscription_credits)
    VALUES (v_rto_id, 0, 0, 0)
    ON CONFLICT (rto_id) DO NOTHING;
    v_current_credits := 0;
  END IF;

  -- Check if enough credits
  IF v_current_credits <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Insufficient validation credits', v_current_credits;
    RETURN;
  END IF;

  -- Deduct 1 credit
  UPDATE validation_credits
  SET 
    current_credits = current_credits - 1,
    updated_at = NOW()
  WHERE rto_id = v_rto_id
  RETURNING current_credits INTO v_new_balance;

  -- Log transaction
  INSERT INTO credit_transactions (rto_id, amount, reason, balance_after)
  VALUES (v_rto_id, -1, p_reason, v_new_balance);

  RETURN QUERY SELECT TRUE, 'Credit consumed successfully', v_new_balance;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION consume_ai_credit(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION consume_validation_credit(TEXT, TEXT) TO anon, authenticated, service_role;
