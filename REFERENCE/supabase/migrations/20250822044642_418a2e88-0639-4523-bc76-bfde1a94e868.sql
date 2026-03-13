-- Fix user_presence table relationships and add missing fields
-- Drop existing foreign key if it exists and recreate properly
ALTER TABLE public.user_presence DROP CONSTRAINT IF EXISTS fk_user_presence_user_id;

-- Add proper foreign key to profiles table (not auth.users)
ALTER TABLE public.user_presence 
ADD CONSTRAINT fk_user_presence_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add missing fields to macro_tasks for client visibility
ALTER TABLE public.macro_tasks 
ADD COLUMN IF NOT EXISTS client_visible boolean DEFAULT false;

-- Add missing fields to client_requests for better tracking
ALTER TABLE public.client_requests 
ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(user_id);

-- Add client_id to profiles for client portal users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Create goals table for user goals tracking
CREATE TABLE IF NOT EXISTS public.goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    title character varying NOT NULL,
    description text,
    current_value numeric DEFAULT 0,
    target_value numeric NOT NULL,
    health_status character varying DEFAULT 'on_track',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for goals
CREATE POLICY "Users can create their own goals" 
ON public.goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own goals" 
ON public.goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.goals 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for goals updated_at
CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_assigned_to ON public.client_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);