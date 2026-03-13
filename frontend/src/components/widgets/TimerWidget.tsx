import { useState } from 'react';
import { useTimer } from '../../hooks/useTimer';
import { useApiTasks } from '../../hooks/useApiTasks';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Play, 
  Square, 
  Clock, 
  Target,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface TimerWidgetProps {
  config?: {
    title?: string;
    showTaskSelection?: boolean;
    compact?: boolean;
  };
  onConfigure?: () => void;
}

export function TimerWidget({ config = {}, onConfigure }: TimerWidgetProps) {
  const {
    activeTimer,
    loading,
    error,
    formattedElapsedTime,
    startTimer,
    stopTimer,
    isRunning
  } = useTimer();
  
  const { activeTasks } = useApiTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  
  const {
    title = "Timer",
    showTaskSelection = true,
    compact = false
  } = config;

  const handleStartTimer = async () => {
    if (!selectedTaskId && activeTasks.length === 0) {
      alert('No tasks available to track time for');
      return;
    }

    const taskId = selectedTaskId || activeTasks[0]?.id;
    if (!taskId) {
      alert('Please select a task first');
      return;
    }

    try {
      const selectedTask = activeTasks.find(t => t.id === taskId);
      const description = sessionNotes || `Working on ${selectedTask?.title || 'task'}`;
      
      await startTimer(taskId, description, 'work');
    } catch (error) {
      console.error('Failed to start timer:', error);
      alert('Failed to start timer. Please try again.');
    }
  };

  const handleStopTimer = async () => {
    try {
      await stopTimer();
      setSessionNotes('');
    } catch (error) {
      console.error('Failed to stop timer:', error);
      alert('Failed to stop timer. Please try again.');
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
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
            <Clock className="h-6 w-6 animate-spin text-primary" />
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
              <Clock className="h-4 w-4" />
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

  if (compact) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>{title}</span>
            </div>
            <Badge variant={isRunning ? "default" : "secondary"}>
              {isRunning ? "Running" : "Stopped"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Timer Display */}
            <div className="text-center">
              <div className={cn(
                "text-3xl font-mono font-bold",
                isRunning ? "text-primary" : "text-muted-foreground"
              )}>
                {formattedElapsedTime}
              </div>
              {activeTimer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activeTimer.taskTitle}
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="flex justify-center">
              {!isRunning ? (
                <Button
                  onClick={handleStartTimer}
                  size="sm"
                  disabled={activeTasks.length === 0}
                  className="flex items-center space-x-1"
                >
                  <Play className="h-3 w-3" />
                  <span>Start</span>
                </Button>
              ) : (
                <Button
                  onClick={handleStopTimer}
                  variant="destructive"
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <Square className="h-3 w-3" />
                  <span>Stop</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isRunning ? "default" : "secondary"}>
              {isRunning ? "Running" : "Stopped"}
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
        <div className="space-y-4">
          {/* Timer Display */}
          <div className="text-center">
            <div className={cn(
              "text-4xl font-mono font-bold",
              isRunning ? "text-primary" : "text-muted-foreground"
            )}>
              {formattedElapsedTime}
            </div>
            {activeTimer && (
              <p className="text-sm text-muted-foreground mt-2">
                {activeTimer.taskTitle}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-2">
            {!isRunning ? (
              <Button
                onClick={handleStartTimer}
                size="lg"
                disabled={activeTasks.length === 0}
                className="flex items-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Start Timer</span>
              </Button>
            ) : (
              <Button
                onClick={handleStopTimer}
                variant="destructive"
                size="lg"
                className="flex items-center space-x-2"
              >
                <Square className="h-4 w-4" />
                <span>Stop Timer</span>
              </Button>
            )}
          </div>

          {/* Task Selection */}
          {showTaskSelection && !isRunning && activeTasks.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Task:</label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full p-2 rounded border bg-background"
              >
                <option value="">Choose a task...</option>
                {activeTasks.slice(0, 5).map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.priority})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Session Notes */}
          {!compact && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes:</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="What are you working on?"
                className="w-full h-16 p-2 rounded border bg-background resize-none text-sm"
                disabled={isRunning && !activeTimer}
              />
            </div>
          )}

          {activeTasks.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active tasks</p>
              <p className="text-xs">Create tasks to start tracking time</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}