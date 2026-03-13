-- Fix invoice security by restricting access to authorized personnel only

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view invoices for their projects" ON public.invoices;

-- Drop existing INSERT policy to make it more restrictive  
DROP POLICY IF EXISTS "Users can create invoices for their projects" ON public.invoices;

-- Create more restrictive SELECT policy - only allow:
-- 1. Invoice creators
-- 2. Admins 
-- 3. Project creators (not just team members)
-- 4. Client owners
CREATE POLICY "Authorized users can view invoices" 
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

-- Create more restrictive INSERT policy - only allow:
-- 1. Project creators or admins to create invoices
-- 2. Ensure user_id matches authenticated user
CREATE POLICY "Authorized users can create invoices" 
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

-- Add DELETE policy for data cleanup (restricted to creators and admins)
CREATE POLICY "Authorized users can delete invoices" 
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

-- Also restrict invoice line items access to prevent indirect data access
DROP POLICY IF EXISTS "Users can view line items of their invoices" ON public.invoice_line_items;

CREATE POLICY "Authorized users can view invoice line items" 
ON public.invoice_line_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.id = invoice_line_items.invoice_id 
    AND (
      -- Invoice creator
      (i.created_by = auth.uid())
      OR
      -- Admin
      (EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      ))
      OR
      -- Project creator
      (EXISTS (
        SELECT 1 FROM projects p 
        WHERE p.id = i.project_id 
        AND p.created_by = auth.uid()
      ))
      OR
      -- Client owner
      (EXISTS (
        SELECT 1 FROM clients c 
        WHERE c.id = i.client_id 
        AND c.created_by = auth.uid()
      ))
    )
  )
);