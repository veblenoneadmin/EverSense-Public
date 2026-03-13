-- Fix nullable user_id columns for security
-- These columns should be NOT NULL as they're used in RLS policies

-- Make user_id NOT NULL in security-sensitive tables
ALTER TABLE brain_dumps ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE calendar_events ALTER COLUMN user_id SET NOT NULL;  
ALTER TABLE client_communications ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE macro_tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE time_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_analytics ALTER COLUMN user_id SET NOT NULL;

-- Note: client_portal_access.user_id can remain nullable as it may reference external users