-- Fix search path security issues in functions
CREATE OR REPLACE FUNCTION public.is_project_team_member(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM project_team_members ptm 
    WHERE ptm.project_id = project_uuid 
    AND ptm.user_id = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_creator(project_uuid UUID, user_uuid UUID) 
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM projects p 
    WHERE p.id = project_uuid 
    AND p.created_by = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_owner(client_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM clients c 
    WHERE c.id = client_uuid 
    AND c.created_by = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND length(email_text) <= 254;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT TRIM(REGEXP_REPLACE(input_text, '[<>]', '', 'g'));
$$;