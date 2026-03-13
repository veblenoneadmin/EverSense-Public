import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

export const useCalendarIntegration = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const addTaskToCalendar = useMutation({
    mutationFn: async ({ 
      taskId, 
      title, 
      dueDate, 
      estimatedHours 
    }: { 
      taskId: string; 
      title: string; 
      dueDate?: string; 
      estimatedHours?: number; 
    }) => {
      if (!user || !dueDate) return;

      const startTime = new Date(dueDate);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + (estimatedHours || 1));

      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: `Work on: ${title}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          macro_task_id: taskId,
          time_block_type: 'focused_work',
          color: '#3b82f6'
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "Task Added to Calendar",
        description: "Your task has been automatically scheduled.",
      });
    },
    onError: (error) => {
      console.error('Calendar integration error:', error);
      toast({
        title: "Calendar Error",
        description: "Could not add task to calendar.",
        variant: "destructive",
      });
    }
  });

  const addBrainDumpToCalendar = useMutation({
    mutationFn: async ({ 
      content, 
      extractedTimes 
    }: { 
      content: string; 
      extractedTimes: Array<{ time: string; context: string }>;
    }) => {
      if (!user || !extractedTimes.length) return;

      const events = extractedTimes.map(({ time, context }) => {
        const startTime = new Date(time);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1); // Default 1 hour duration

        return {
          user_id: user.id,
          title: `Brain Dump: ${context.substring(0, 50)}...`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          time_block_type: 'meeting' as const,
          color: '#10b981'
        };
      });

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(events);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: "Times Added to Calendar",
        description: `${variables.extractedTimes.length} events from your brain dump have been scheduled.`,
      });
    }
  });

  return {
    addTaskToCalendar,
    addBrainDumpToCalendar
  };
};