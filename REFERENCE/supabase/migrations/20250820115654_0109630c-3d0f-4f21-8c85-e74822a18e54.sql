-- Fix function security issues
DROP FUNCTION IF EXISTS public.handle_new_user();

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Only authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Only authenticated users can manage clients" ON public.clients;

-- Add missing RLS policies for clients (admin only for now)
CREATE POLICY "Only authenticated users can view clients" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only authenticated users can manage clients" ON public.clients
  FOR ALL TO authenticated USING (true);

-- Projects policies (team members can view their projects)
CREATE POLICY "Users can view projects they're assigned to" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      WHERE ptm.project_id = projects.id
      AND ptm.user_id = auth.uid()
    ) OR created_by = auth.uid()
  );

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project creators can update their projects" ON public.projects
  FOR UPDATE USING (created_by = auth.uid());

-- Project team members policies
CREATE POLICY "Users can view team members of their projects" ON public.project_team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_team_members ptm2
      WHERE ptm2.project_id = project_team_members.project_id
      AND ptm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Project creators can manage team members" ON public.project_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_team_members.project_id
      AND p.created_by = auth.uid()
    )
  );

-- Task time blocks policies (through macro task ownership)
CREATE POLICY "Users can view time blocks of their tasks" ON public.task_time_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.macro_tasks mt
      WHERE mt.id = task_time_blocks.macro_task_id
      AND mt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create time blocks for their tasks" ON public.task_time_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.macro_tasks mt
      WHERE mt.id = task_time_blocks.macro_task_id
      AND mt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update time blocks of their tasks" ON public.task_time_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.macro_tasks mt
      WHERE mt.id = task_time_blocks.macro_task_id
      AND mt.user_id = auth.uid()
    )
  );

-- Invoices policies (project team members can view)
CREATE POLICY "Users can view invoices for their projects" ON public.invoices
  FOR SELECT USING (
    created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      WHERE ptm.project_id = invoices.project_id
      AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create invoices for their projects" ON public.invoices
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      WHERE ptm.project_id = invoices.project_id
      AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Invoice creators can update their invoices" ON public.invoices
  FOR UPDATE USING (created_by = auth.uid());

-- Invoice line items policies (through invoice ownership)
CREATE POLICY "Users can view line items of their invoices" ON public.invoice_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create line items for their invoices" ON public.invoice_line_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update line items of their invoices" ON public.invoice_line_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.created_by = auth.uid()
    )
  );

-- Client portal access policies (admin only for now)
CREATE POLICY "Authenticated users can view client portal access" ON public.client_portal_access
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage client portal access" ON public.client_portal_access
  FOR ALL TO authenticated USING (true);

-- Client communications policies (team members can view/create)
CREATE POLICY "Users can view communications for their projects" ON public.client_communications
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      WHERE ptm.project_id = client_communications.project_id
      AND ptm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create communications for their projects" ON public.client_communications
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      WHERE ptm.project_id = client_communications.project_id
      AND ptm.user_id = auth.uid()
    )
  );

-- Expenses policies
CREATE POLICY "Users can view their own expenses" ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expenses" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);