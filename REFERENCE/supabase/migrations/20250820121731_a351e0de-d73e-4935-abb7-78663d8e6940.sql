-- Fix client_portal_access RLS policies to prevent unauthorized access

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage client portal access" ON client_portal_access;
DROP POLICY IF EXISTS "Authenticated users can view client portal access" ON client_portal_access;

-- Create secure RLS policies for client_portal_access

-- Users can view portal access records for clients they work with through projects
CREATE POLICY "Users can view portal access for their project clients"
ON client_portal_access
FOR SELECT
USING (
  -- User can see their own portal access records
  (auth.uid() = user_id)
  OR
  -- User can see portal access for clients they work with through projects
  (EXISTS (
    SELECT 1 FROM projects p
    JOIN project_team_members ptm ON p.id = ptm.project_id
    WHERE p.client_id = client_portal_access.client_id
    AND ptm.user_id = auth.uid()
  ))
  OR
  -- User can see portal access for clients of projects they created
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.client_id = client_portal_access.client_id
    AND p.created_by = auth.uid()
  ))
);

-- Users can create portal access records for clients they manage through projects
CREATE POLICY "Users can create portal access for their project clients"
ON client_portal_access
FOR INSERT
WITH CHECK (
  -- User can create portal access for clients they work with through projects
  (EXISTS (
    SELECT 1 FROM projects p
    JOIN project_team_members ptm ON p.id = ptm.project_id
    WHERE p.client_id = client_portal_access.client_id
    AND ptm.user_id = auth.uid()
  ))
  OR
  -- User can create portal access for clients of projects they created
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.client_id = client_portal_access.client_id
    AND p.created_by = auth.uid()
  ))
);

-- Users can update portal access records for clients they manage through projects
CREATE POLICY "Users can update portal access for their project clients"
ON client_portal_access
FOR UPDATE
USING (
  -- User can update portal access for clients they work with through projects
  (EXISTS (
    SELECT 1 FROM projects p
    JOIN project_team_members ptm ON p.id = ptm.project_id
    WHERE p.client_id = client_portal_access.client_id
    AND ptm.user_id = auth.uid()
  ))
  OR
  -- User can update portal access for clients of projects they created
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.client_id = client_portal_access.client_id
    AND p.created_by = auth.uid()
  ))
);

-- Users can delete portal access records for clients they manage through projects
CREATE POLICY "Users can delete portal access for their project clients"
ON client_portal_access
FOR DELETE
USING (
  -- User can delete portal access for clients they work with through projects
  (EXISTS (
    SELECT 1 FROM projects p
    JOIN project_team_members ptm ON p.id = ptm.project_id
    WHERE p.client_id = client_portal_access.client_id
    AND ptm.user_id = auth.uid()
  ))
  OR
  -- User can delete portal access for clients of projects they created
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.client_id = client_portal_access.client_id
    AND p.created_by = auth.uid()
  ))
);