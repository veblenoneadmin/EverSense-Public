-- Set up admin role for tony@opusautomations.com
-- First, create or update the profile with admin role
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Get the user_id for tony@opusautomations.com from auth.users
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'tony@opusautomations.com';

    -- If user exists, update their profile to admin role
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, email, first_name, last_name, role, is_active)
        VALUES (
            admin_user_id,
            'tony@opusautomations.com',
            'Tony',
            'Admin',
            'admin'::user_role,
            true
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            role = 'admin'::user_role,
            is_active = true,
            updated_at = now();
    END IF;
END $$;