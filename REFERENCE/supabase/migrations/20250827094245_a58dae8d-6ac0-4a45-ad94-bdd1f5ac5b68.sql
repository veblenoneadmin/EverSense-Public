-- Fix remaining trigger functions to include search path protection
-- This prevents search path injection attacks on trigger functions

-- Fix create_user_organization trigger function
CREATE OR REPLACE FUNCTION public.create_user_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  org_id UUID;
  org_slug TEXT;
BEGIN
  -- Generate organization slug from email
  org_slug := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1),
    '[^a-z0-9]', '-', 'g'
  )) || '-' || LEFT(NEW.id::TEXT, 8);
  
  -- Create organization
  INSERT INTO public.organizations (name, slug, created_by, current_user_count)
  VALUES (
    SPLIT_PART(NEW.email, '@', 1) || '''s Organization',
    org_slug,
    NEW.id,
    1
  ) RETURNING id INTO org_id;
  
  -- Add user as organization owner
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');
  
  -- Update user's current organization
  UPDATE public.profiles
  SET current_organization_id = org_id
  WHERE user_id = NEW.id;
  
  -- Create initial subscription (trial)
  INSERT INTO public.subscriptions (organization_id, status, seats_included, seats_used)
  VALUES (org_id, 'trialing', 5, 1);
  
  RETURN NEW;
END;
$function$;

-- Fix update_organization_user_count trigger function
CREATE OR REPLACE FUNCTION public.update_organization_user_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.organizations
    SET current_user_count = current_user_count + 1,
        updated_at = now()
    WHERE id = NEW.organization_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.organizations
    SET current_user_count = GREATEST(current_user_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.organization_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;