-- Create additional tables for comprehensive workspace system

-- Goals table for monthly goals tracking
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID DEFAULT NULL, -- for team goals
  title TEXT NOT NULL,
  description TEXT,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  health_status TEXT DEFAULT 'green' CHECK (health_status IN ('green', 'amber', 'red')),
  goal_type TEXT DEFAULT 'individual' CHECK (goal_type IN ('individual', 'team')),
  linked_task_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Messages table for internal chat and threading
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('task', 'request', 'direct', 'team')),
  channel_id UUID, -- references task_id, request_id, or team_id based on channel_type
  parent_message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE, -- for threading
  body TEXT NOT NULL,
  files TEXT[], -- array of file URLs
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Client requests table
CREATE TABLE public.client_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id), -- client user who submitted
  assigned_to UUID REFERENCES auth.users(id), -- staff member assigned
  department TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'in_progress', 'completed', 'cancelled')),
  files TEXT[], -- array of file URLs
  linked_task_id UUID REFERENCES public.macro_tasks(id),
  request_number TEXT UNIQUE NOT NULL, -- auto-generated reference number
  sla_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User presence tracking for live monitoring
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_status TEXT DEFAULT 'offline' CHECK (current_status IN ('online', 'away', 'busy', 'offline')),
  current_task_id UUID REFERENCES public.macro_tasks(id),
  timer_status TEXT DEFAULT 'stopped' CHECK (timer_status IN ('running', 'paused', 'stopped')),
  timer_start TIMESTAMP WITH TIME ZONE,
  idle_since TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Rate history for tracking rate changes
CREATE TABLE public.rate_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('user_default', 'project_override', 'client_default')),
  hourly_rate DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  end_date DATE, -- null means current rate
  created_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Retainer blocks for client billing
CREATE TABLE public.retainer_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  hours_purchased DECIMAL(8,2) NOT NULL,
  hours_used DECIMAL(8,2) DEFAULT 0,
  hourly_rate DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update profiles table to use the new role system
DO $$
BEGIN
  -- Drop existing role type if it exists and create new one
  DROP TYPE IF EXISTS user_role CASCADE;
  CREATE TYPE user_role AS ENUM ('staff', 'admin', 'client');
  
  -- Add new role column (temporary)
  ALTER TABLE public.profiles ADD COLUMN new_role user_role DEFAULT 'staff';
  
  -- Update existing roles
  UPDATE public.profiles SET new_role = 'admin' WHERE role::text = 'admin';
  UPDATE public.profiles SET new_role = 'staff' WHERE role::text = 'employee';  
  UPDATE public.profiles SET new_role = 'client' WHERE role::text = 'client';
  
  -- Drop old column and rename new one
  ALTER TABLE public.profiles DROP COLUMN role;
  ALTER TABLE public.profiles RENAME COLUMN new_role TO role;
EXCEPTION
  WHEN others THEN
    -- If there's an error, just add the column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'role') THEN
      ALTER TABLE public.profiles ADD COLUMN role user_role DEFAULT 'staff';
    END IF;
END $$;

-- Add additional fields to profiles for enhanced functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS cost_rate DECIMAL(10,2), -- internal cost vs billable rate
ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS slack_user_id TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

-- Add request number generation function
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.client_requests
  WHERE request_number ~ '^REQ-[0-9]+$';
  
  RETURN 'REQ-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-generate request numbers
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_request_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_request_number
  BEFORE INSERT ON public.client_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_request_number();

-- Enable RLS on new tables
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retainer_blocks ENABLE ROW LEVEL SECURITY;

-- Goals policies
CREATE POLICY "Users can create their own goals" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can view their own goals and team goals" ON public.goals
  FOR SELECT USING (auth.uid() = user_id OR team_id IS NOT NULL);
  
CREATE POLICY "Users can update their own goals" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies  
CREATE POLICY "Users can create messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = author_id);
  
CREATE POLICY "Users can view messages in their channels" ON public.messages
  FOR SELECT USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.macro_tasks 
      WHERE id = channel_id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.client_requests cr
      JOIN public.clients c ON cr.client_id = c.id
      WHERE cr.id = channel_id AND (cr.assigned_to = auth.uid() OR c.created_by = auth.uid())
    )
  );

-- Client requests policies
CREATE POLICY "Clients can create requests for their organization" ON public.client_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.profiles p ON c.created_by = p.user_id
      WHERE c.id = client_id AND (c.created_by = auth.uid() OR p.role = 'client')
    )
  );
  
CREATE POLICY "Users can view relevant requests" ON public.client_requests
  FOR SELECT USING (
    assigned_to = auth.uid() OR
    submitted_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  );
  
CREATE POLICY "Staff can update requests" ON public.client_requests
  FOR UPDATE USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- User presence policies
CREATE POLICY "Users can manage their own presence" ON public.user_presence
  FOR ALL USING (user_id = auth.uid());
  
CREATE POLICY "Staff and admins can view all presence" ON public.user_presence
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Rate history policies  
CREATE POLICY "Admins can manage all rates" ON public.rate_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
  
CREATE POLICY "Users can view their own rate history" ON public.rate_history
  FOR SELECT USING (user_id = auth.uid());

-- Retainer blocks policies
CREATE POLICY "Admins and clients can view retainer blocks" ON public.retainer_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.clients WHERE id = client_id AND created_by = auth.uid()
    )
  );
  
CREATE POLICY "Admins can manage retainer blocks" ON public.retainer_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
  
CREATE TRIGGER update_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
  
CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
  
CREATE TRIGGER update_retainer_blocks_updated_at
  BEFORE UPDATE ON public.retainer_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();