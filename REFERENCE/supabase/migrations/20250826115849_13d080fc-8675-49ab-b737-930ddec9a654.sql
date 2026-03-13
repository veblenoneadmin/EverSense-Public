-- Complete the invoice security fix by updating line items policies

-- Drop existing line items policies
DROP POLICY IF EXISTS "Users can create line items for their invoices" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can update line items of their invoices" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Users can view line items of their invoices" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Authorized users can view invoice line items" ON public.invoice_line_items;

-- Create restrictive line items SELECT policy matching invoice security
CREATE POLICY "invoice_line_items_select_authorized_only" 
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

-- Create restrictive line items INSERT policy
CREATE POLICY "invoice_line_items_insert_authorized_only" 
ON public.invoice_line_items 
FOR INSERT 
WITH CHECK (
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

-- Create restrictive line items UPDATE policy
CREATE POLICY "invoice_line_items_update_authorized_only" 
ON public.invoice_line_items 
FOR UPDATE 
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
    )
  )
);