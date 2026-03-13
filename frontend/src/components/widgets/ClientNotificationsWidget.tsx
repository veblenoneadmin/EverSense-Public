import { useState, useEffect } from 'react';
import { useSession } from '../../lib/auth-client';
import { useApiClient } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  Settings,
  Calendar,
  FileText
} from 'lucide-react';

interface ClientNotificationsWidgetProps {
  config?: {
    title?: string;
    maxNotifications?: number;
  };
  onConfigure?: () => void;
}

interface Notification {
  id: string;
  type: 'task_completed' | 'milestone' | 'comment' | 'deadline' | 'project_update';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  taskId?: string;
  projectId?: string;
}

export function ClientNotificationsWidget({ config = {}, onConfigure }: ClientNotificationsWidgetProps) {
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    title = "Updates & Notifications",
    maxNotifications = 5
  } = config;

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        // For now, we'll generate notifications based on recent tasks and time entries
        // In a real implementation, this would be a dedicated notifications API
        const tasksResponse = await apiClient.fetch(`/api/tasks/recent?userId=${session.user.id}&limit=20`);
        const timeResponse = await apiClient.fetch(`/api/timers/recent?userId=${session.user.id}&limit=10`);

        const generatedNotifications: Notification[] = [];

        if (tasksResponse.success && tasksResponse.tasks) {
          // Create notifications for completed tasks
          tasksResponse.tasks
            .filter((task: any) => task.status === 'completed')
            .slice(0, 3)
            .forEach((task: any) => {
              generatedNotifications.push({
                id: `task-completed-${task.id}`,
                type: 'task_completed',
                title: 'Task Completed',
                message: `"${task.title}" has been completed successfully`,
                timestamp: task.updatedAt,
                isRead: false,
                priority: task.priority === 'High' || task.priority === 'Urgent' ? 'high' : 'medium',
                taskId: task.id
              });
            });

          // Create notifications for approaching deadlines
          const today = new Date();
          const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
          
          tasksResponse.tasks
            .filter((task: any) => {
              if (!task.dueDate || task.status === 'completed') return false;
              const dueDate = new Date(task.dueDate);
              return dueDate <= threeDaysFromNow && dueDate >= today;
            })
            .slice(0, 2)
            .forEach((task: any) => {
              const dueDate = new Date(task.dueDate);
              const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
              generatedNotifications.push({
                id: `deadline-${task.id}`,
                type: 'deadline',
                title: 'Upcoming Deadline',
                message: `"${task.title}" is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
                timestamp: new Date().toISOString(),
                isRead: false,
                priority: daysUntilDue <= 1 ? 'high' : 'medium',
                taskId: task.id
              });
            });
        }

        // Create notifications for recent time tracking activity
        if (timeResponse.entries && timeResponse.entries.length > 0) {
          const recentEntry = timeResponse.entries[0];
          if (recentEntry.endTime) { // Only for completed entries
            generatedNotifications.push({
              id: `time-logged-${recentEntry.id}`,
              type: 'project_update',
              title: 'Time Logged',
              message: `Logged ${Math.round(recentEntry.duration / 3600 * 10) / 10}h on "${recentEntry.taskTitle}"`,
              timestamp: recentEntry.endTime,
              isRead: false,
              priority: 'low'
            });
          }
        }

        // Add a welcome/milestone notification for new clients
        if (generatedNotifications.length === 0) {
          generatedNotifications.push({
            id: 'welcome',
            type: 'milestone',
            title: 'Welcome to EverSense Ai!',
            message: 'Your project workspace is ready. Start tracking your progress here.',
            timestamp: new Date().toISOString(),
            isRead: false,
            priority: 'medium'
          });
        }

        // Sort by timestamp and limit
        generatedNotifications
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, maxNotifications);

        setNotifications(generatedNotifications);

      } catch (err: any) {
        console.error('Error loading client notifications:', err);
        setError(err.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
    
    // Refresh notifications every 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.id, apiClient, maxNotifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_completed':
        return CheckCircle2;
      case 'deadline':
        return Clock;
      case 'comment':
        return MessageSquare;
      case 'milestone':
        return Calendar;
      case 'project_update':
        return FileText;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>{title}</span>
            </div>
            {onConfigure && (
              <Button variant="ghost" size="sm" onClick={onConfigure}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <Bell className="h-6 w-6 animate-pulse text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>{title}</span>
            </div>
            {onConfigure && (
              <Button variant="ghost" size="sm" onClick={onConfigure}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-primary/10">
              {notifications.filter(n => !n.isRead).length} new
            </Badge>
            {onConfigure && (
              <Button variant="ghost" size="sm" onClick={onConfigure}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No notifications</p>
              <p className="text-xs">Updates will appear here</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const IconComponent = getNotificationIcon(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors hover:bg-accent/50 ${
                    !notification.isRead ? 'bg-primary/5 border-primary/20' : 'bg-card'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <IconComponent className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{notification.title}</p>
                      <div className="flex items-center space-x-1">
                        <Badge 
                          variant={getNotificationColor(notification.priority)}
                          className="text-xs"
                        >
                          {notification.priority}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {notifications.length > 0 && (
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" className="w-full">
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}