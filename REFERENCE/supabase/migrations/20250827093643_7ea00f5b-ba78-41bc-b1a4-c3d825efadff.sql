-- Fix critical security issues: Enable RLS and ensure comprehensive policies

-- Enable RLS on organizations table if not already enabled
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on subscriptions table if not already enabled  
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on organization_memberships table if not already enabled
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- Ensure all required policies exist for organizations table
-- (Some may already exist, but this ensures comprehensive coverage)

-- SELECT policy for organizations (should already exist but ensuring it's correct)
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = organizations.id 
    AND om.user_id = auth.uid()
  )
);

-- UPDATE policy for organizations (should already exist)
DROP POLICY IF EXISTS "Organization owners can update their organizations" ON public.organizations;
CREATE POLICY "Organization owners can update their organizations"
ON public.organizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = organizations.id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
);

-- Ensure all required policies exist for subscriptions table

-- SELECT policy for subscriptions (should already exist)
DROP POLICY IF EXISTS "Organization members can view their subscription" ON public.subscriptions;
CREATE POLICY "Organization members can view their subscription"
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = subscriptions.organization_id 
    AND om.user_id = auth.uid()
  )
);

-- UPDATE policy for subscriptions
DROP POLICY IF EXISTS "Organization owners can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Organization owners can manage subscriptions"
ON public.subscriptions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = subscriptions.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'owner'
  )
);

-- DELETE policy for subscriptions
DROP POLICY IF EXISTS "Organization owners can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Organization owners can delete subscriptions"
ON public.subscriptions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM organization_memberships om
    WHERE om.organization_id = subscriptions.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'owner'
  )
);