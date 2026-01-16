-- Migration: Add is_admin column to user_profiles table
-- Description: Adds a boolean flag to control admin access to maintenance features
-- New users will have is_admin = false by default

-- Add is_admin column to user_profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
        
        -- Add a comment for documentation
        COMMENT ON COLUMN user_profiles.is_admin IS 'Whether the user has admin access to maintenance features. Defaults to false for new users.';
    END IF;
END $$;

-- Create an index on is_admin for faster lookups (optional, useful if you query by admin status)
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;

-- Note: To grant admin access to a specific user, run:
-- UPDATE user_profiles SET is_admin = true WHERE email = 'user@example.com';
