-- Fix critical security vulnerability in clients table
-- Add ownership to clients and implement proper RLS policies

-- Step 1: Add created_by column to clients table
ALTER TABLE public.clients 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Step 2: For existing clients (if any), we'll need to assign them to a user
-- This is a one-time data migration - in production you'd need to handle this carefully
-- For now, we'll leave them NULL and handle in application logic

-- Step 3: Drop the insecure existing policies
DROP POLICY IF EXISTS "Only authenticated users can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Only authenticated users can view clients" ON public.clients;

-- Step 4: Create secure user-specific RLS policies
CREATE POLICY "Users can view their own clients" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own clients" 
ON public.clients 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own clients" 
ON public.clients 
FOR DELETE 
USING (auth.uid() = created_by);

-- Step 5: Also need to secure related tables that reference clients
-- Update projects table policies to ensure users can only see projects for their clients
DROP POLICY IF EXISTS "Users can view projects they're assigned to" ON public.projects;
CREATE POLICY "Users can view projects they're assigned to" 
ON public.projects 
FOR SELECT 
USING (
  -- Users can see projects they created
  (created_by = auth.uid()) 
  OR 
  -- Users can see projects they're team members of
  (EXISTS (
    SELECT 1 FROM project_team_members ptm 
    WHERE ptm.project_id = projects.id AND ptm.user_id = auth.uid()
  ))
  OR
  -- Users can see projects for clients they own
  (EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = projects.client_id AND c.created_by = auth.uid()
  ))
);

-- Step 6: Update invoices table to ensure users can only see invoices for their clients/projects
DROP POLICY IF EXISTS "Users can view invoices for their projects" ON public.invoices;
CREATE POLICY "Users can view invoices for their projects" 
ON public.invoices 
FOR SELECT 
USING (
  -- Users can see invoices they created
  (created_by = auth.uid()) 
  OR 
  -- Users can see invoices for projects they're team members of
  (EXISTS (
    SELECT 1 FROM project_team_members ptm 
    WHERE ptm.project_id = invoices.project_id AND ptm.user_id = auth.uid()
  ))
  OR
  -- Users can see invoices for clients they own
  (EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = invoices.client_id AND c.created_by = auth.uid()
  ))
);

-- Step 7: Update client_communications to be properly secured
DROP POLICY IF EXISTS "Users can view communications for their projects" ON public.client_communications;
CREATE POLICY "Users can view communications for their clients" 
ON public.client_communications 
FOR SELECT 
USING (
  -- Users can see communications they created
  (user_id = auth.uid()) 
  OR 
  -- Users can see communications for projects they're team members of
  (EXISTS (
    SELECT 1 FROM project_team_members ptm 
    WHERE ptm.project_id = client_communications.project_id AND ptm.user_id = auth.uid()
  ))
  OR
  -- Users can see communications for clients they own
  (EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = client_communications.client_id AND c.created_by = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can create communications for their projects" ON public.client_communications;
CREATE POLICY "Users can create communications for their clients" 
ON public.client_communications 
FOR INSERT 
WITH CHECK (
  -- Users can create communications for their own actions
  (auth.uid() = user_id) 
  AND (
    -- For projects they're team members of
    (EXISTS (
      SELECT 1 FROM project_team_members ptm 
      WHERE ptm.project_id = client_communications.project_id AND ptm.user_id = auth.uid()
    ))
    OR
    -- For clients they own
    (EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = client_communications.client_id AND c.created_by = auth.uid()
    ))
  )
);