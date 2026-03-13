import { BaseWidget } from './BaseWidget';
import type { WidgetProps } from '../../lib/widgets/WidgetInterface';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Clock, Play, Eye, Calendar } from 'lucide-react';

interface RecentTask {
  id: string;
  title: string;
  projectName?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate?: Date | string;
  lastWorked?: Date | string;
  totalTime?: number; // seconds
}

interface RecentTasksWidgetData {
  tasks: RecentTask[];
  totalTasks: number;
}

interface RecentTasksWidgetProps extends WidgetProps {
  data?: RecentTasksWidgetData;
}

export function RecentTasksWidget(props: RecentTasksWidgetProps) {
  const { data } = props;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'not_started':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-800';
      case 'High':
        return 'bg-orange-100 text-orange-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatRelativeTime = (date?: Date | string): string => {
    if (!date) return '';
    
    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const diff = now.getTime() - dateObj.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const handleStartTimer = async (taskId: string) => {
    try {
      // Get user context (you may need to adjust this based on your auth implementation)
      const userId = localStorage.getItem('userId') || 'temp-user-id'; // Replace with actual user ID
      const orgId = localStorage.getItem('orgId') || 'temp-org-id'; // Replace with actual org ID
      
      const response = await fetch('/api/timers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          taskId,
          userId,
          orgId,
          description: `Working on task`,
          category: 'work',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      if (response.ok) {
        props.onRefresh?.();
      } else {
        const error = await response.json();
        console.error('Failed to start timer:', error);
      }
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleViewTask = (taskId: string) => {
    // Navigate to task details
    window.location.href = `/tasks/${taskId}`;
  };

  return (
    <BaseWidget {...props}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Recent Tasks</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {data?.totalTasks || 0} total
          </Badge>
        </div>

        {!data?.tasks?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent tasks</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.tasks.map(task => (
              <div
                key={task.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-sm font-medium truncate">
                        {task.title}
                      </h4>
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                    
                    {task.projectName && (
                      <p className="text-xs text-muted-foreground mb-1">
                        📁 {task.projectName}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                      <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                      
                      {task.totalTime && (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(task.totalTime)}</span>
                        </div>
                      )}
                      
                      {task.lastWorked && (
                        <span>
                          Last worked: {formatRelativeTime(task.lastWorked)}
                        </span>
                      )}
                      
                      {task.dueDate && (
                        <span className={
                          (task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)) < new Date() ? 'text-red-600' : ''
                        }>
                          Due: {(task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartTimer(task.id)}
                      title="Start timer"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTask(task.id)}
                      title="View task"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}