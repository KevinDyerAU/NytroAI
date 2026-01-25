-- Create promo_codes table for storing promotional codes
CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_percent DECIMAL(5,2) CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
    discount_amount DECIMAL(10,2) CHECK (discount_amount IS NULL OR discount_amount >= 0),
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER CHECK (max_uses IS NULL OR max_uses >= 0),
    current_uses INTEGER NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure at least one type of discount is specified
    CONSTRAINT discount_type_check CHECK (discount_percent IS NOT NULL OR discount_amount IS NOT NULL)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (to validate codes)
CREATE POLICY "Allow authenticated users to read active promo codes"
    ON promo_codes
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Allow service role full access (for admin operations)
CREATE POLICY "Allow service role full access to promo codes"
    ON promo_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER trigger_update_promo_codes_updated_at
    BEFORE UPDATE ON promo_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_promo_codes_updated_at();

-- Insert some sample promo codes for testing
INSERT INTO promo_codes (code, description, discount_percent, valid_until, max_uses)
VALUES 
    ('WELCOME10', 'Welcome discount - 10% off first purchase', 10, NOW() + INTERVAL '1 year', 1000),
    ('LAUNCH20', 'Launch promotion - 20% off', 20, NOW() + INTERVAL '6 months', 500)
ON CONFLICT (code) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE promo_codes IS 'Stores promotional codes for subscription discounts';
COMMENT ON COLUMN promo_codes.discount_percent IS 'Percentage discount (0-100)';
COMMENT ON COLUMN promo_codes.discount_amount IS 'Fixed amount discount in dollars';
COMMENT ON COLUMN promo_codes.max_uses IS 'Maximum number of times this code can be used (NULL = unlimited)';
COMMENT ON COLUMN promo_codes.current_uses IS 'Number of times this code has been used';
