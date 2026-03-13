import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function useTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('macro_tasks')
        .select(`
          *,
          micro_tasks (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['goals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useClientRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['client-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('client_requests')
        .select(`
          *,
          clients!client_requests_client_id_fkey (*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useUserPresence() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-presence', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_presence')
        .select(`
          *,
          profiles (*)
        `)
        .eq('is_online', true)
        .order('last_seen', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useUpdateUserPresence() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (presenceData: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('user_presence')
        .upsert({ 
          user_id: user.id, 
          ...presenceData,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-presence'] });
    },
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Update user presence with timer info
      const { data, error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          timer_status: 'running',
          timer_start: new Date().toISOString(),
          current_task_id: taskId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-presence'] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Get current timer info
      const { data: presence } = await supabase
        .from('user_presence')
        .select('timer_start')
        .eq('user_id', user.id)
        .single();
      
      if (presence?.timer_start) {
        const startTime = new Date(presence.timer_start);
        const endTime = new Date();
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
        
        // Log the time
        await supabase.from('time_logs').insert({
          user_id: user.id,
          macro_task_id: taskId,
          log_type: 'complete',
          timestamp: presence.timer_start,
          duration_minutes: Math.floor(duration / 60)
        });
      }
      
      // Update user presence
      const { data, error } = await supabase
        .from('user_presence')
        .update({
          timer_status: 'stopped',
          timer_start: null,
          current_task_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-presence'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateClientRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (requestData: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Generate request number
      const requestNumber = `REQ-${Date.now()}`;
      
      const { data, error } = await supabase
        .from('client_requests')
        .insert({
          ...requestData,
          request_number: requestNumber,
          status: 'submitted',
          submitted_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-requests'] });
    },
  });
}

export function useTimeLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['time-logs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('time_logs')
        .select(`
          *,
          macro_tasks (*)
        `)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useBrainDumps() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['brain_dumps', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from('brain_dumps').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useUserAnalytics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user_analytics', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('user_analytics').select('*').eq('user_id', user.id).eq('date', today).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || { total_work_hours: 0, tasks_completed: 0, focus_time_minutes: 0, productivity_score: 0 };
    },
    enabled: !!user?.id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (taskData: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase.from('macro_tasks').insert({ ...taskData, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created successfully!');
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('macro_tasks').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useTimeLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (logData: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase.from('time_logs').insert({ ...logData, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useCalendarEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['calendar_events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from('calendar_events').select('*').eq('user_id', user.id).order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (eventData: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase.from('calendar_events').insert({ ...eventData, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar_events'] }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('calendar_events').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar_events'] }),
  });
}

export function useCreateBrainDump() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const { data, error } = await supabase.from('brain_dumps').insert({
        raw_content: content,
        user_id: user?.id,
        dump_date: new Date().toISOString().split('T')[0]
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brain_dumps'] }),
  });
}

export function useUpdateBrainDump() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('brain_dumps').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brain_dumps'] }),
  });
}

export function useDeleteBrainDump() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brain_dumps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brain_dumps'] }),
  });
}

export function useAllUsers() {
  const { user } = useAuth();
  const { data: currentProfile } = useProfile();
  
  return useQuery({
    queryKey: ['all_users', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Only allow admins to fetch all users
      if (currentProfile?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }
      
      // Log sensitive data access
      await supabase.rpc('log_sensitive_data_access', {
        table_name: 'profiles',
        record_id: user.id,
        action: 'admin_user_list_access'
      });
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && currentProfile?.role === 'admin',
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'manager' | 'employee' | 'client' }) => {
      const { data, error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('user_id', userId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all_users'] }),
  });
}

// Project Management Hooks
export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (projectData: any) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase.from('projects').insert({ ...projectData, created_by: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully!');
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully!');
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully!');
    },
  });
}

// Time Log Management Hooks
export function useUpdateTimeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('time_logs').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast.success('Time log updated successfully!');
    },
  });
}

export function useDeleteTimeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      toast.success('Time log deleted successfully!');
    },
  });
}
