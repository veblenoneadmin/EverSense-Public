-- Fix brain dump deletion by adding DELETE policy
CREATE POLICY "Users can delete their own brain dumps" 
ON public.brain_dumps 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add missing DELETE policies for other tables that should support deletion
CREATE POLICY "Users can delete their own projects" 
ON public.projects 
FOR DELETE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own time logs" 
ON public.time_logs 
FOR DELETE 
USING (auth.uid() = user_id);