-- Update profiles table to handle Clerk user IDs
-- Clerk user IDs are different format than Supabase auth user IDs
-- Make user_id column more flexible to handle both formats

-- First, let's make sure the user_id column can handle Clerk's user ID format
-- Clerk user IDs are typically like "user_2xyz123" so we need to adjust if needed
ALTER TABLE profiles ALTER COLUMN user_id TYPE text;

-- Update the profiles table constraints and policies to work with Clerk
-- We'll need to use a custom function to get Clerk user ID since we can't use auth.uid()

-- Create a function to get current user ID from JWT claims (for Clerk integration)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id'
  );
$$;

-- Update RLS policies for profiles table with Clerk compatibility
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (user_id = get_current_user_id());

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (user_id = get_current_user_id());