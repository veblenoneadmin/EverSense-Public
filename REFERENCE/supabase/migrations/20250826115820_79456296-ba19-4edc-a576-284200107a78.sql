-- Fix invoice security - drop all existing policies first to avoid conflicts

-- Drop ALL existing invoice policies
DROP POLICY IF EXISTS "Authorized users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoices for their projects" ON public.invoices;
DROP POLICY IF EXISTS "Users can create invoices for their projects" ON public.invoices;
DROP POLICY IF EXISTS "Invoice creators can update their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authorized users can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authorized users can delete invoices" ON public.invoices;

-- Create new restrictive SELECT policy
CREATE POLICY "invoice_select_authorized_only" 
ON public.invoices 
FOR SELECT 
USING (
  -- User created the invoice
  (created_by = auth.uid()) 
  OR 
  -- User is admin
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ))
  OR
  -- User is the project creator (not just team member)
  (EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = invoices.project_id 
    AND p.created_by = auth.uid()
  ))
  OR
  -- User owns the client
  (EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = invoices.client_id 
    AND c.created_by = auth.uid()
  ))
);

-- Create new restrictive INSERT policy
CREATE POLICY "invoice_insert_authorized_only" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  -- User must be the creator
  (auth.uid() = created_by) 
  AND 
  (
    -- User is admin
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    ))
    OR
    -- User is the project creator
    (EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = invoices.project_id 
      AND p.created_by = auth.uid()
    ))
    OR
    -- User owns the client
    (EXISTS (
      SELECT 1 FROM clients c 
      WHERE c.id = invoices.client_id 
      AND c.created_by = auth.uid()
    ))
  )
);

-- Create restrictive UPDATE policy
CREATE POLICY "invoice_update_authorized_only" 
ON public.invoices 
FOR UPDATE 
USING (
  -- User created the invoice
  (created_by = auth.uid())
  OR
  -- User is admin  
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ))
);

-- Create DELETE policy for authorized cleanup
CREATE POLICY "invoice_delete_authorized_only" 
ON public.invoices 
FOR DELETE 
USING (
  -- User created the invoice
  (created_by = auth.uid())
  OR
  -- User is admin  
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ))
);