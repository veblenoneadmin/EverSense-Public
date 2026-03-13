import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';

export interface ApiTask {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed' | 'not_started';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  // Additional fields that might come from the API
  category?: string;
  tags?: string[];
  projectId?: string;
  userId: string;
  orgId: string;
}

export function useApiTasks() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // EMERGENCY FIX: Use hardcoded orgId if currentOrg is not available
      const orgId = currentOrg?.id || 'org_1757046595553';
      console.log('🔧 Fetching tasks with orgId:', orgId, 'from:', currentOrg?.id ? 'currentOrg' : 'hardcoded fallback');

      const data = await apiClient.fetch(`/api/tasks/recent?userId=${session.user.id}&orgId=${orgId}&limit=50`);

      if (data.success) {
        setTasks(data.tasks || []);
      } else {
        throw new Error(data.error || 'Failed to fetch tasks');
      }
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
      setTasks([]); // Clear tasks on error
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, currentOrg?.id]);

  // Auto-fetch tasks when session changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Get only active tasks (not completed) for timer selection
  const activeTasks = tasks.filter(task => 
    task.status === 'todo' || 
    task.status === 'in_progress' || 
    task.status === 'not_started'
  );

  return {
    tasks,
    activeTasks,
    loading,
    error,
    refreshTasks: fetchTasks,
    clearError: () => setError(null)
  };
}