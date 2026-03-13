import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTasks, useTimeLog, useUserAnalytics, useUpdateTask } from '@/hooks/useDatabase';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Target,
  DollarSign,
  CheckCircle2,
  Coffee,
  SkipForward,
  Timer as TimerIcon,
  TrendingUp,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface TimerState {
  isRunning: boolean;
  isOnBreak: boolean;
  currentSessionTime: number;
  breakTime: number;
  startTime: Date | null;
  breakStartTime: Date | null;
}

interface MicroTaskSession {
  id: string;
  title: string;
  timeSpent: number;
  completed: boolean;
}

const TimerInterface: React.FC = () => {
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    isOnBreak: false,
    currentSessionTime: 0,
    breakTime: 0,
    startTime: null,
    breakStartTime: null
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentMicroTask, setCurrentMicroTask] = useState<string>('');
  const [microTaskSessions, setMicroTaskSessions] = useState<MicroTaskSession[]>([]);

  const { data: tasks = [] } = useTasks();
  const { data: analytics } = useUserAnalytics();
  const timeLogMutation = useTimeLog();
  const updateTaskMutation = useUpdateTask();

  // Get current task
  const currentTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : tasks[0];
  const activeMicroTaskSession = microTaskSessions.find(s => s.title === currentMicroTask && !s.completed);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerState.isRunning) {
      interval = setInterval(() => {
        setTimerState(prev => ({
          ...prev,
          currentSessionTime: prev.isOnBreak ? prev.currentSessionTime : prev.currentSessionTime + 1,
          breakTime: prev.isOnBreak ? prev.breakTime + 1 : prev.breakTime
        }));
        
        // Update active micro-task session time
        if (!timerState.isOnBreak && currentMicroTask) {
          setMicroTaskSessions(prev => prev.map(session =>
            session.title === currentMicroTask && !session.completed
              ? { ...session, timeSpent: session.timeSpent + 1 }
              : session
          ));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState.isRunning, timerState.isOnBreak, currentMicroTask]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!currentTask) {
      toast.error('Please select a task first');
      return;
    }
    
    setTimerState(prev => ({
      ...prev,
      isRunning: true,
      startTime: new Date(),
      isOnBreak: false
    }));
    
    // Create initial micro-task session if one is specified
    if (currentMicroTask && !activeMicroTaskSession) {
      const newSession: MicroTaskSession = {
        id: Date.now().toString(),
        title: currentMicroTask,
        timeSpent: 0,
        completed: false
      };
      setMicroTaskSessions(prev => [...prev, newSession]);
    }
    
    toast.success('Timer started');
  };

  const handleBreak = () => {
    if (!timerState.isRunning || timerState.isOnBreak) return;
    
    // Pause timer and start break
    setTimerState(prev => ({
      ...prev,
      isOnBreak: true,
      isRunning: false,
      breakStartTime: new Date()
    }));
    
    toast.success('Break started - timer paused');
  };

  const handleResumeWork = () => {
    if (!timerState.isOnBreak) return;
    
    // Resume timer from break
    setTimerState(prev => ({
      ...prev,
      isOnBreak: false,
      isRunning: true,
      breakStartTime: null,
      startTime: new Date() // Reset start time to continue accurate tracking
    }));
    
    toast.success('Work resumed');
  };

  const handleStop = async () => {
    if (!timerState.isRunning || !currentTask) return;
    
    const totalWorkMinutes = Math.floor(timerState.currentSessionTime / 60);
    const totalBreakMinutes = Math.floor(timerState.breakTime / 60);
    
    if (totalWorkMinutes > 0) {
      try {
        // Log work time
        await timeLogMutation.mutateAsync({
          macro_task_id: currentTask.id,
          duration_minutes: totalWorkMinutes,
          log_type: 'work',
          timestamp: new Date().toISOString(),
          notes: `Work: ${formatTime(timerState.currentSessionTime)}, Break: ${formatTime(timerState.breakTime)}. Micro-tasks: ${microTaskSessions.map(s => `${s.title} (${formatTime(s.timeSpent)})`).join(', ')}`,
          is_billable: currentTask.is_billable || false,
          hourly_rate: currentTask.hourly_rate
        });

        // Log break time if any
        if (totalBreakMinutes > 0) {
          await timeLogMutation.mutateAsync({
            macro_task_id: currentTask.id,
            duration_minutes: totalBreakMinutes,
            log_type: 'break',
            timestamp: new Date().toISOString(),
            notes: `Break time during work session`,
            is_billable: false
          });
        }

        // Update task actual hours (only work time, not break time)
        const newActualHours = (currentTask.actual_hours || 0) + (timerState.currentSessionTime / 3600);
        await updateTaskMutation.mutateAsync({
          id: currentTask.id,
          updates: { 
            actual_hours: newActualHours,
            status: timerState.currentSessionTime > 300 ? 'in_progress' : currentTask.status
          }
        });

        toast.success(`Logged ${formatTime(timerState.currentSessionTime)} work time to ${currentTask.title}`);
      } catch (error) {
        logger.error('Time logging failed', { taskId: currentTask?.id });
        toast.error('Failed to log time');
      }
    }

    // Reset timer state
    setTimerState({
      isRunning: false,
      isOnBreak: false,
      currentSessionTime: 0,
      breakTime: 0,
      startTime: null,
      breakStartTime: null
    });
    
    // Mark all micro-task sessions as completed
    setMicroTaskSessions(prev => prev.map(s => ({ ...s, completed: true })));
    setCurrentMicroTask('');
  };

  const handleAddMicroTask = (taskName: string) => {
    if (!taskName.trim()) return;
    
    const newSession: MicroTaskSession = {
      id: Date.now().toString(),
      title: taskName.trim(),
      timeSpent: 0,
      completed: false
    };
    
    setMicroTaskSessions(prev => [...prev, newSession]);
    setCurrentMicroTask(taskName.trim());
    toast.success(`Added micro-task: ${taskName}`);
  };

  const handleSwitchMicroTask = (taskName: string) => {
    // Mark current micro-task as completed if it has time
    if (activeMicroTaskSession && activeMicroTaskSession.timeSpent > 0) {
      setMicroTaskSessions(prev => prev.map(s => 
        s.id === activeMicroTaskSession.id ? { ...s, completed: true } : s
      ));
    }
    
    // Switch to new micro-task
    const existingSession = microTaskSessions.find(s => s.title === taskName && !s.completed);
    if (!existingSession) {
      handleAddMicroTask(taskName);
    } else {
      setCurrentMicroTask(taskName);
    }
  };

  const getTimerStateClass = () => {
    if (timerState.isOnBreak) return 'timer-break';
    if (timerState.isRunning) return 'timer-active';
    return '';
  };

  const currentEarnings = currentTask?.is_billable && currentTask?.hourly_rate 
    ? (timerState.currentSessionTime / 3600) * Number(currentTask.hourly_rate)
    : 0;

  const totalSessionTime = timerState.currentSessionTime + timerState.breakTime;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Active Timer</h1>
          <p className="text-muted-foreground mt-2">Track your time with precision and purpose</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Today's Total</p>
            <p className="text-2xl font-bold text-success">
              {analytics?.total_work_hours ? `${analytics.total_work_hours}h` : '0h'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Tasks Completed</p>
            <p className="text-2xl font-bold text-primary">{analytics?.tasks_completed || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Timer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Task Info */}
          <Card className="glass p-6">
            {currentTask ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center",
                      currentTask.priority === 'high' ? 'bg-gradient-error' :
                      currentTask.priority === 'medium' ? 'bg-gradient-warning' :
                      'bg-gradient-primary'
                    )}>
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">{currentTask.title}</h2>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        {currentTask.hourly_rate && (
                          <span className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4" />
                            <span>${currentTask.hourly_rate}/hr</span>
                          </span>
                        )}
                        {currentTask.is_billable && (
                          <span className="bg-success/20 text-success px-2 py-1 rounded text-xs">Billable</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="text-lg font-semibold">
                      {currentTask.actual_hours || 0}h / {currentTask.estimated_hours}h
                    </p>
                    <div className="w-32 h-2 bg-surface-elevated rounded-full mt-2">
                      <div 
                        className="h-full bg-gradient-primary rounded-full"
                        style={{ width: `${Math.min(((currentTask.actual_hours || 0) / currentTask.estimated_hours) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Micro Task Input & Sessions */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Enter micro-task (e.g., Testing, Debugging, Documentation)"
                      value={currentMicroTask}
                      onChange={(e) => setCurrentMicroTask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && currentMicroTask.trim()) {
                          handleAddMicroTask(currentMicroTask);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddMicroTask(currentMicroTask)}
                      disabled={!currentMicroTask.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  
                  {microTaskSessions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Micro-tasks in this session:</h4>
                      {microTaskSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-2 bg-surface-elevated rounded">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => !session.completed && handleSwitchMicroTask(session.title)}
                              className={cn(
                                "text-sm font-medium",
                                session.title === currentMicroTask && !session.completed ? "text-primary" : "",
                                session.completed ? "text-muted-foreground line-through" : ""
                              )}
                            >
                              {session.title}
                            </button>
                            {session.title === currentMicroTask && !session.completed && (
                              <span className="text-xs text-primary">● Active</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(session.timeSpent)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Task Selected</h3>
                <p className="text-muted-foreground">Create a task to start tracking time</p>
              </div>
            )}
          </Card>

          {/* Timer Display */}
          <Card className={cn("glass p-8 text-center", getTimerStateClass())}>
            <div className="space-y-6">
              {/* Main Timer */}
              <div>
                <div className="text-6xl font-bold font-mono text-foreground mb-2">
                  {timerState.isOnBreak ? formatTime(timerState.breakTime) : formatTime(timerState.currentSessionTime)}
                </div>
                <p className="text-muted-foreground">
                  {timerState.isOnBreak ? 'On Break' :
                   timerState.isRunning ? 'Working' : 'Ready to Start'}
                </p>
                {timerState.isRunning && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total session: {formatTime(totalSessionTime)} 
                    {timerState.breakTime > 0 && ` (Work: ${formatTime(timerState.currentSessionTime)}, Break: ${formatTime(timerState.breakTime)})`}
                  </p>
                )}
              </div>

              {/* Real-time Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-sm text-muted-foreground">Work Time</p>
                  <p className="font-semibold">{formatTime(timerState.currentSessionTime)}</p>
                </div>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <DollarSign className="h-5 w-5 text-success mx-auto mb-1" />
                  <p className="text-sm text-muted-foreground">Session Earnings</p>
                  <p className="font-semibold">${currentEarnings.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <Coffee className="h-5 w-5 text-info mx-auto mb-1" />
                  <p className="text-sm text-muted-foreground">Break Time</p>
                  <p className="font-semibold">{formatTime(timerState.breakTime)}</p>
                </div>
              </div>

              {/* Timer Controls - Simplified Flow */}
              <div className="flex items-center justify-center space-x-4">
                {!timerState.isRunning ? (
                  <Button
                    size="lg"
                    onClick={handleStart}
                    className="px-8 py-4 text-lg font-medium bg-gradient-success hover:shadow-lg"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Start Work
                  </Button>
                ) : timerState.isOnBreak ? (
                  <>
                    <Button
                      size="lg"
                      onClick={handleResumeWork}
                      className="px-8 py-4 text-lg font-medium bg-gradient-primary hover:shadow-lg"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Resume Work
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleStop}
                    >
                      <Square className="h-5 w-5 mr-2" />
                      Stop Session
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      onClick={handleBreak}
                      className="px-6 py-4 text-lg font-medium bg-gradient-info hover:shadow-lg"
                    >
                      <Coffee className="h-5 w-5 mr-2" />
                      Take Break
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleStop}
                    >
                      <Square className="h-5 w-5 mr-2" />
                      Stop Session
                    </Button>
                  </>
                )}
              </div>

              {/* Current Micro Task Display */}
              {timerState.isRunning && currentMicroTask && (
                <div className="bg-surface-elevated p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Currently working on:</p>
                  <p className="font-medium">{currentMicroTask}</p>
                  {activeMicroTaskSession && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Time on this task: {formatTime(activeMicroTaskSession.timeSpent)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Selection */}
          <Card className="glass p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Select Task</h2>
                <p className="text-sm text-muted-foreground">Choose what to work on</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {tasks.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "w-full p-3 text-left bg-surface-elevated rounded-lg transition-colors",
                    selectedTaskId === task.id ? "ring-2 ring-primary bg-primary/10" : "hover:bg-surface-elevated/80"
                  )}
                >
                  <h3 className="font-medium text-sm truncate">{task.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {task.actual_hours || 0}h / {task.estimated_hours}h
                    </span>
                    {task.is_billable && (
                      <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">
                        ${task.hourly_rate}/hr
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Today's Summary */}
          <Card className="glass p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Today's Summary</h2>
                <p className="text-sm text-muted-foreground">Performance overview</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                <span className="text-sm text-muted-foreground">Total Time</span>
                <span className="font-semibold">{analytics?.total_work_hours || 0}h</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                <span className="text-sm text-muted-foreground">Focus Time</span>
                <span className="font-semibold text-success">{Math.floor((analytics?.focus_time_minutes || 0) / 60)}h {(analytics?.focus_time_minutes || 0) % 60}m</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                <span className="text-sm text-muted-foreground">Tasks Completed</span>
                <span className="font-semibold">{analytics?.tasks_completed || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
                <span className="text-sm text-muted-foreground">Productivity Score</span>
                <span className="font-semibold text-primary">{analytics?.productivity_score || 0}%</span>
              </div>
            </div>
          </Card>

          {/* Productivity Tips */}
          <Card className="glass p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-info flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Smart Insights</h2>
                <p className="text-sm text-muted-foreground">AI recommendations</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm font-medium text-success">Great Focus!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You've been in deep work for 45 minutes. Consider a short break.
                </p>
              </div>
              <div className="p-3 bg-info/10 border border-info/20 rounded-lg">
                <p className="text-sm font-medium text-info">Time Estimate</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on your pace, you'll finish this task 15 minutes early.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TimerInterface;