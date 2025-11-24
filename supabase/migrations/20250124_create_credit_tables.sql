-- Create validation_credits table
CREATE TABLE IF NOT EXISTS public.validation_credits (
  id BIGSERIAL PRIMARY KEY,
  rto_id BIGINT NOT NULL REFERENCES public."RTO"(id) ON DELETE CASCADE,
  current_credits INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  subscription_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rto_id)
);

-- Create ai_credits table
CREATE TABLE IF NOT EXISTS public.ai_credits (
  id BIGSERIAL PRIMARY KEY,
  rto_id BIGINT NOT NULL REFERENCES public."RTO"(id) ON DELETE CASCADE,
  current_credits INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  subscription_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rto_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_validation_credits_rto_id ON public.validation_credits(rto_id);
CREATE INDEX IF NOT EXISTS idx_ai_credits_rto_id ON public.ai_credits(rto_id);

-- Enable RLS
ALTER TABLE public.validation_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow service_role full access
CREATE POLICY "Service role has full access to validation_credits"
  ON public.validation_credits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to ai_credits"
  ON public.ai_credits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies: Authenticated users can view their RTO's credits
CREATE POLICY "Users can view their RTO's validation credits"
  ON public.validation_credits
  FOR SELECT
  TO authenticated
  USING (
    rto_id IN (
      SELECT id FROM public."RTO" 
      WHERE id = (auth.jwt() -> 'user_metadata' ->> 'rto_id')::BIGINT
    )
  );

CREATE POLICY "Users can view their RTO's AI credits"
  ON public.ai_credits
  FOR SELECT
  TO authenticated
  USING (
    rto_id IN (
      SELECT id FROM public."RTO" 
      WHERE id = (auth.jwt() -> 'user_metadata' ->> 'rto_id')::BIGINT
    )
  );

-- Grant permissions
GRANT SELECT ON public.validation_credits TO anon, authenticated;
GRANT SELECT ON public.ai_credits TO anon, authenticated;
GRANT ALL ON public.validation_credits TO service_role;
GRANT ALL ON public.ai_credits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE validation_credits_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ai_credits_id_seq TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.validation_credits IS 'Tracks validation credits for each RTO (subscription + purchased)';
COMMENT ON TABLE public.ai_credits IS 'Tracks AI operation credits for each RTO (subscription + purchased)';
COMMENT ON COLUMN public.validation_credits.current_credits IS 'Currently available credits';
COMMENT ON COLUMN public.validation_credits.total_credits IS 'Total credits allocated (subscription + purchased)';
COMMENT ON COLUMN public.validation_credits.subscription_credits IS 'Base credits from subscription tier';
COMMENT ON COLUMN public.ai_credits.current_credits IS 'Currently available credits';
COMMENT ON COLUMN public.ai_credits.total_credits IS 'Total credits allocated (subscription + purchased)';
COMMENT ON COLUMN public.ai_credits.subscription_credits IS 'Base credits from subscription tier';
