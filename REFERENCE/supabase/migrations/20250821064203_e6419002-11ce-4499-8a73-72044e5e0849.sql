-- Fix security vulnerability: Make created_by field non-nullable in clients table
-- This ensures RLS policies work correctly and prevents orphaned records

-- First, update any existing NULL values (there are none currently, but this is defensive)
UPDATE clients 
SET created_by = auth.uid() 
WHERE created_by IS NULL;

-- Make the created_by column NOT NULL and add default value
ALTER TABLE clients 
ALTER COLUMN created_by SET NOT NULL,
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Add a comment for documentation
COMMENT ON COLUMN clients.created_by IS 'User who created this client record. Required for RLS security.';