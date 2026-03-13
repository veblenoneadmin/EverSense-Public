-- Fix critical security issue: Add DELETE policy for organizations table
-- Only organization owners and admins should be able to delete organizations
CREATE POLICY "Organization owners can delete their organizations"
ON public.organizations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = organizations.id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
);

-- Also fix the missing INSERT policy for subscriptions table (critical finding)
CREATE POLICY "Organization owners can create subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = subscriptions.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'owner'
  )
);