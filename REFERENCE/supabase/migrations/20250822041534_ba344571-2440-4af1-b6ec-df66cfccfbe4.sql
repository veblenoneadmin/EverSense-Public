-- Add missing fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cost_rate numeric;

-- Create user_presence table for real-time user tracking
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  is_online boolean DEFAULT false,
  current_status text DEFAULT 'offline',
  timer_status text DEFAULT 'stopped',
  timer_start timestamp with time zone,
  last_seen timestamp with time zone DEFAULT now(),
  current_task_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create client_requests table
CREATE TABLE IF NOT EXISTS public.client_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'normal',
  status text DEFAULT 'submitted',
  request_number text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_presence
CREATE POLICY "Users can view all user presence" 
ON public.user_presence 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own presence" 
ON public.user_presence 
FOR ALL 
USING (auth.uid() = user_id);

-- RLS policies for client_requests  
CREATE POLICY "Users can view client requests" 
ON public.client_requests 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create client requests" 
ON public.client_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own requests" 
ON public.client_requests 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add updated_at trigger for new tables
CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();