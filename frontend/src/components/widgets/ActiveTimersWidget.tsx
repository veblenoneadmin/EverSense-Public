import { useState, useEffect } from 'react';
import { BaseWidget } from './BaseWidget';
import type { WidgetProps } from '../../lib/widgets/WidgetInterface';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Square, Clock } from 'lucide-react';
import { useApiClient } from '../../lib/api-client';
import { useSession } from '../../lib/auth-client';

interface ActiveTimer {
  id: string;
  taskTitle: string;
  projectName?: string;
  startTime: Date | string;
  duration: number; // seconds
  status: 'running' | 'paused';
}

interface ActiveTimersWidgetData {
  timers: ActiveTimer[];
  totalActiveTime: number;
}

interface ActiveTimersWidgetProps extends WidgetProps {
  data?: ActiveTimersWidgetData;
}

export function ActiveTimersWidget(props: ActiveTimersWidgetProps) {
  const { data } = props;
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const [localTimers, setLocalTimers] = useState<ActiveTimer[]>([]);

  // Update local timers when data changes
  useEffect(() => {
    if (data?.timers) {
      setLocalTimers(data.timers);
    }
  }, [data?.timers]);

  // Update timer durations every second
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTimers(prevTimers => 
        prevTimers.map(timer => {
          if (timer.status === 'running') {
            const startTime = timer.startTime instanceof Date ? timer.startTime : new Date(timer.startTime);
            const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
            return { ...timer, duration: elapsed };
          }
          return timer;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStopTimer = async (timerId: string) => {
    try {
      if (!session?.user?.id) {
        console.error('User not authenticated');
        return;
      }
      
      const data = await apiClient.fetch(`/api/timers/${timerId}/stop`, {
        method: 'POST',
        body: JSON.stringify({ userId: session.user.id })
      });

      if (data.success) {
        // Remove stopped timer from local state
        setLocalTimers(prevTimers => 
          prevTimers.filter(timer => timer.id !== timerId)
        );
        
        // Trigger parent refresh
        props.onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  const totalRunningTime = localTimers
    .filter(timer => timer.status === 'running')
    .reduce((total, timer) => total + timer.duration, 0);

  return (
    <BaseWidget {...props}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-semibold">Active Timers</span>
          </div>
          <Badge variant="outline" className="glass-surface">
            {localTimers.length} running
          </Badge>
        </div>

        {/* Total Time */}
        <div className="text-center p-4 glass-surface rounded-lg">
          <div className="text-2xl font-bold text-primary mb-1">
            {formatDuration(totalRunningTime)}
          </div>
          <div className="text-sm text-muted-foreground">
            Total Active Time
          </div>
        </div>

        {/* Timer List */}
        {localTimers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active timers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {localTimers.map((timer) => (
              <div key={timer.id} className="glass-surface p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {timer.taskTitle}
                    </p>
                    {timer.projectName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {timer.projectName}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        timer.status === 'running' 
                          ? 'border-success text-success' 
                          : 'border-warning text-warning'
                      }`}
                    >
                      {formatDuration(timer.duration)}
                    </Badge>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStopTimer(timer.id)}
                      title="Stop timer"
                    >
                      <Square className="h-3 w-3" />
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