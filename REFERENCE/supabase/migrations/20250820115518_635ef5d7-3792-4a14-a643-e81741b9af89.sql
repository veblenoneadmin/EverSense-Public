-- Create custom types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'employee', 'client');
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'paused', 'completed');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.log_type AS ENUM ('start', 'pause', 'resume', 'break_start', 'break_end', 'complete', 'switch_task');
CREATE TYPE public.time_block_type AS ENUM ('focused_work', 'meeting', 'break', 'admin', 'client_work');
CREATE TYPE public.access_level AS ENUM ('view_only', 'comment', 'approve');
CREATE TYPE public.communication_type AS ENUM ('message', 'file_upload', 'status_update', 'invoice_sent', 'payment_received');
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected', 'invoiced', 'reimbursed');

-- Users/Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role public.user_role DEFAULT 'employee',
  department VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'UTC',
  avatar_url VARCHAR(255),
  hourly_rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  client_code VARCHAR(50) UNIQUE NOT NULL,
  primary_contact_email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  website VARCHAR(255),
  tax_id VARCHAR(100),
  billing_address TEXT,
  payment_terms INTEGER DEFAULT 30,
  default_hourly_rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_code VARCHAR(50) UNIQUE NOT NULL,
  status public.project_status DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  hourly_rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  billable BOOLEAN DEFAULT true,
  color VARCHAR(7) DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project team members
CREATE TABLE public.project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role VARCHAR(100) DEFAULT 'member',
  hourly_rate DECIMAL(10,2),
  can_view_budget BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Brain dumps table
CREATE TABLE public.brain_dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  raw_content TEXT NOT NULL,
  dump_date DATE NOT NULL DEFAULT CURRENT_DATE,
  processed BOOLEAN DEFAULT false,
  ai_analysis_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Macro tasks table
CREATE TABLE public.macro_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  client_id UUID REFERENCES public.clients(id),
  brain_dump_id UUID REFERENCES public.brain_dumps(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority public.task_priority DEFAULT 'medium',
  status public.task_status DEFAULT 'not_started',
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2) DEFAULT 0,
  billable_hours DECIMAL(5,2) DEFAULT 0,
  hourly_rate DECIMAL(10,2),
  is_billable BOOLEAN DEFAULT true,
  due_date TIMESTAMP WITH TIME ZONE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  is_emergency BOOLEAN DEFAULT false,
  paused_at TIMESTAMP WITH TIME ZONE,
  pause_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Micro tasks table
CREATE TABLE public.micro_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_task_id UUID REFERENCES public.macro_tasks(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  status public.task_status DEFAULT 'not_started',
  estimated_minutes INTEGER,
  actual_minutes INTEGER DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  break_start TIMESTAMP WITH TIME ZONE,
  break_duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time logs table
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  client_id UUID REFERENCES public.clients(id),
  macro_task_id UUID REFERENCES public.macro_tasks(id),
  micro_task_id UUID REFERENCES public.micro_tasks(id),
  log_type public.log_type NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timezone VARCHAR(50),
  duration_minutes INTEGER,
  hourly_rate DECIMAL(10,2),
  is_billable BOOLEAN DEFAULT true,
  notes TEXT,
  previous_task_id UUID,
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  macro_task_id UUID REFERENCES public.macro_tasks(id),
  micro_task_id UUID REFERENCES public.micro_tasks(id),
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  time_block_type public.time_block_type DEFAULT 'focused_work',
  color VARCHAR(7) DEFAULT '#3b82f6',
  is_flexible BOOLEAN DEFAULT true,
  recurrence_rule VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task time blocks table
CREATE TABLE public.task_time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_task_id UUID REFERENCES public.macro_tasks(id),
  micro_task_id UUID REFERENCES public.micro_tasks(id),
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  block_duration_minutes INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  was_rescheduled BOOLEAN DEFAULT false,
  original_start TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  project_id UUID REFERENCES public.projects(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  status public.invoice_status DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(100),
  payment_date DATE,
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items table
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  time_log_id UUID REFERENCES public.time_logs(id),
  description TEXT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date_worked DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client portal access table
CREATE TABLE public.client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  access_level public.access_level DEFAULT 'view_only',
  can_view_time_logs BOOLEAN DEFAULT true,
  can_view_invoices BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  can_download_files BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client communications table
CREATE TABLE public.client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  project_id UUID REFERENCES public.projects(id),
  user_id UUID REFERENCES public.profiles(user_id),
  type public.communication_type NOT NULL,
  subject VARCHAR(255),
  message TEXT,
  file_url VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  priority VARCHAR(10) DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  client_id UUID REFERENCES public.clients(id),
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  expense_date DATE NOT NULL,
  receipt_url VARCHAR(500),
  is_billable BOOLEAN DEFAULT false,
  is_reimbursable BOOLEAN DEFAULT true,
  status public.expense_status DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(user_id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User analytics table
CREATE TABLE public.user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_work_hours DECIMAL(5,2) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  productivity_score DECIMAL(3,2),
  focus_time_minutes INTEGER DEFAULT 0,
  break_time_minutes INTEGER DEFAULT 0,
  task_switches INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_dumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Brain dumps policies
CREATE POLICY "Users can view their own brain dumps" ON public.brain_dumps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own brain dumps" ON public.brain_dumps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brain dumps" ON public.brain_dumps
  FOR UPDATE USING (auth.uid() = user_id);

-- Macro tasks policies
CREATE POLICY "Users can view their own macro tasks" ON public.macro_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own macro tasks" ON public.macro_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own macro tasks" ON public.macro_tasks
  FOR UPDATE USING (auth.uid() = user_id);

-- Micro tasks policies (through macro task ownership)
CREATE POLICY "Users can view micro tasks of their macro tasks" ON public.micro_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.macro_tasks
      WHERE macro_tasks.id = micro_tasks.macro_task_id
      AND macro_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create micro tasks for their macro tasks" ON public.micro_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.macro_tasks
      WHERE macro_tasks.id = micro_tasks.macro_task_id
      AND macro_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update micro tasks of their macro tasks" ON public.micro_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.macro_tasks
      WHERE macro_tasks.id = micro_tasks.macro_task_id
      AND macro_tasks.user_id = auth.uid()
    )
  );

-- Time logs policies
CREATE POLICY "Users can view their own time logs" ON public.time_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time logs" ON public.time_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time logs" ON public.time_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Calendar events policies
CREATE POLICY "Users can view their own calendar events" ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

-- User analytics policies
CREATE POLICY "Users can view their own analytics" ON public.user_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analytics" ON public.user_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics" ON public.user_analytics
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_macro_tasks_updated_at
  BEFORE UPDATE ON public.macro_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_micro_tasks_updated_at
  BEFORE UPDATE ON public.micro_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();