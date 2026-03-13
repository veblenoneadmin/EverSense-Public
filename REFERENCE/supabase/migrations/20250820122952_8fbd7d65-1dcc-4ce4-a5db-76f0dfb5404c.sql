-- Create security definer function to prevent RLS recursion in project team member checks
CREATE OR REPLACE FUNCTION public.is_project_team_member(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM project_team_members ptm 
    WHERE ptm.project_id = project_uuid 
    AND ptm.user_id = user_uuid
  );
$$;

-- Create security definer function to check if user is project creator
CREATE OR REPLACE FUNCTION public.is_project_creator(project_uuid UUID, user_uuid UUID) 
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM projects p 
    WHERE p.id = project_uuid 
    AND p.created_by = user_uuid
  );
$$;

-- Create security definer function to check if user owns client
CREATE OR REPLACE FUNCTION public.is_client_owner(client_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM clients c 
    WHERE c.id = client_uuid 
    AND c.created_by = user_uuid
  );
$$;

-- Drop existing problematic policies for project_team_members
DROP POLICY IF EXISTS "Project creators can manage team members" ON project_team_members;
DROP POLICY IF EXISTS "Users can view team members of their projects" ON project_team_members;

-- Create new safe policies using security definer functions
CREATE POLICY "Project creators can manage team members" 
ON project_team_members 
FOR ALL 
USING (public.is_project_creator(project_id, auth.uid()));

CREATE POLICY "Team members can view their project teams" 
ON project_team_members 
FOR SELECT 
USING (public.is_project_team_member(project_id, auth.uid()) OR public.is_project_creator(project_id, auth.uid()));

-- Improve client_communications policies using security definer functions
DROP POLICY IF EXISTS "Users can create communications for their clients" ON client_communications;
DROP POLICY IF EXISTS "Users can view communications for their clients" ON client_communications;

CREATE POLICY "Users can create communications for their projects" 
ON client_communications 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND (
    public.is_project_team_member(project_id, auth.uid()) OR
    public.is_client_owner(client_id, auth.uid())
  )
);

CREATE POLICY "Users can view communications for their projects" 
ON client_communications 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  public.is_project_team_member(project_id, auth.uid()) OR
  public.is_client_owner(client_id, auth.uid())
);

-- Add input validation functions
CREATE OR REPLACE FUNCTION public.validate_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND length(email_text) <= 254;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT TRIM(REGEXP_REPLACE(input_text, '[<>]', '', 'g'));
$$;

-- Add constraints for better data validation
ALTER TABLE profiles ADD CONSTRAINT valid_email_format 
CHECK (public.validate_email(email));

ALTER TABLE clients ADD CONSTRAINT valid_primary_contact_email 
CHECK (public.validate_email(primary_contact_email));

-- Add length constraints to prevent DoS attacks
ALTER TABLE brain_dumps ADD CONSTRAINT content_length_limit 
CHECK (length(raw_content) <= 50000);

ALTER TABLE macro_tasks ADD CONSTRAINT title_length_limit 
CHECK (length(title) <= 500);

ALTER TABLE macro_tasks ADD CONSTRAINT description_length_limit 
CHECK (length(description) <= 5000);