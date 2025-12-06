-- Create credit transaction tables for logging AI and validation credit usage
-- These tables track every credit consumption and addition for audit and metrics

-- Create ai_credit_transactions table
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id BIGSERIAL PRIMARY KEY,
  rto_id BIGINT NOT NULL REFERENCES public."RTO"(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Negative for consumption, positive for additions
  reason TEXT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit_transactions table for validation credits
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id BIGSERIAL PRIMARY KEY,
  rto_id BIGINT NOT NULL REFERENCES public."RTO"(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Negative for consumption, positive for additions
  reason TEXT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_rto_id ON public.ai_credit_transactions(rto_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_created_at ON public.ai_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_amount ON public.ai_credit_transactions(amount);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_rto_id ON public.credit_transactions(rto_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_amount ON public.credit_transactions(amount);

-- Enable RLS
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Service role has full access
CREATE POLICY "Service role has full access to ai_credit_transactions"
  ON public.ai_credit_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to credit_transactions"
  ON public.credit_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies: Users can view their RTO's transactions
CREATE POLICY "Users can view their RTO's ai_credit_transactions"
  ON public.ai_credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    rto_id IN (
      SELECT id FROM public."RTO" 
      WHERE id = (auth.jwt() -> 'user_metadata' ->> 'rto_id')::BIGINT
    )
  );

CREATE POLICY "Users can view their RTO's credit_transactions"
  ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    rto_id IN (
      SELECT id FROM public."RTO" 
      WHERE id = (auth.jwt() -> 'user_metadata' ->> 'rto_id')::BIGINT
    )
  );

-- Grant permissions
GRANT SELECT ON public.ai_credit_transactions TO anon, authenticated;
GRANT SELECT ON public.credit_transactions TO anon, authenticated;
GRANT ALL ON public.ai_credit_transactions TO service_role;
GRANT ALL ON public.credit_transactions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ai_credit_transactions_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE credit_transactions_id_seq TO service_role;

-- Add comments
COMMENT ON TABLE public.ai_credit_transactions IS 'Logs all AI credit transactions (consumptions and additions) for tracking usage';
COMMENT ON TABLE public.credit_transactions IS 'Logs all validation credit transactions (consumptions and additions) for tracking usage';
COMMENT ON COLUMN public.ai_credit_transactions.amount IS 'Negative values = consumption, positive values = addition';
COMMENT ON COLUMN public.credit_transactions.amount IS 'Negative values = consumption, positive values = addition';
