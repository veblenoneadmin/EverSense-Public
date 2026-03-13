import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiTasks } from '../hooks/useApiTasks';
import { useTimer } from '../hooks/useTimer';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Play,
  Pause,
  Square,
  Clock,
  Target,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { logger } from '../lib/logger';

export function Timer() {
  const { data: session } = useSession();
  const { activeTasks, loading: tasksLoading, error: tasksError } = useApiTasks();
  const {
    activeTimer,
    loading: timerLoading,
    error: timerError,
    formattedElapsedTime,
    startTimer,
    stopTimer,
    updateTimer,
    pauseTimer,
    resumeTimer,
    isRunning,
    isPaused
  } = useTimer();

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');

  logger.debug('Timer component initialized', { 
    userId: session?.user?.id, 
    activeTimer: activeTimer?.id,
    isRunning 
  });

  // Set initial task when tasks load or when no task is selected
  useEffect(() => {
    if (activeTasks.length > 0 && !selectedTaskId && !activeTimer) {
      setSelectedTaskId(activeTasks[0].id);
    }
    // If there's an active timer, set the selected task to match
    if (activeTimer && activeTimer.taskId) {
      setSelectedTaskId(activeTimer.taskId);
    }
  }, [activeTasks, selectedTaskId, activeTimer]);

  const handleStartTimer = async () => {
    try {
      let taskId = selectedTaskId;
      let description = sessionNotes;

      // If no tasks available, allow timer without a specific task
      if (activeTasks.length === 0) {
        taskId = 'general-work'; // Use a generic task ID
        description = sessionNotes || 'General work session';
      } else if (!selectedTaskId) {
        alert('Please select a task first');
        return;
      } else {
        const selectedTask = activeTasks.find(t => t.id === selectedTaskId);
        description = sessionNotes || `Working on ${selectedTask?.title || 'task'}`;
      }

      await startTimer(taskId, description, 'work');
      logger.info('Timer started', { taskId, description });
    } catch (error) {
      logger.error('Failed to start timer', { taskId: selectedTaskId }, error as Error);
      alert('Failed to start timer. Please try again.');
    }
  };

  const handleStopTimer = async () => {
    try {
      await stopTimer();
      logger.info('Timer stopped', { timerId: activeTimer?.id });
      setSessionNotes(''); // Clear notes after stopping
    } catch (error) {
      logger.error('Failed to stop timer', { timerId: activeTimer?.id }, error as Error);
      alert('Failed to stop timer. Please try again.');
    }
  };

  const handleUpdateNotes = async () => {
    if (!activeTimer || !sessionNotes.trim()) return;

    try {
      await updateTimer({ description: sessionNotes });
      logger.info('Timer notes updated', { timerId: activeTimer.id });
    } catch (error) {
      logger.error('Failed to update timer notes', { timerId: activeTimer.id }, error as Error);
    }
  };

  // Update notes when they change (debounced)
  useEffect(() => {
    if (!activeTimer || !sessionNotes.trim()) return;
    
    const timeoutId = setTimeout(() => {
      handleUpdateNotes();
    }, 2000); // 2 second debounce
    
    return () => clearTimeout(timeoutId);
  }, [sessionNotes, activeTimer]);


  const currentTask = activeTasks.find(t => t.id === selectedTaskId) || activeTasks[0];
  const showLoading = tasksLoading || timerLoading;
  const showError = tasksError || timerError;

  // DEBUG: Log the current state to help diagnose issues
  console.log('🔍 Timer Debug:', {
    session: !!session,
    tasksLoading,
    timerLoading,
    showLoading,
    tasksError,
    timerError,
    showError,
    activeTasks: activeTasks.length,
    activeTimer: !!activeTimer
  });

  // Show login required message if no session
  if (!session) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-warning">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-warning">
              <AlertCircle className="h-4 w-4" />
              <span>Please log in to use the timer feature.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading timer...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time Tracker</h1>
        <Badge variant={isRunning && !isPaused ? "default" : isPaused ? "destructive" : "secondary"}>
          {isRunning && !isPaused ? "Running" : isPaused ? "Paused" : "Stopped"}
        </Badge>
      </div>

      {/* Error Messages */}
      {showError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{tasksError || timerError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Timer Display */}
        <Card className="glass-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Active Session</h2>
              </div>
              {activeTimer && (
                <Badge variant="outline">{activeTimer.category}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timer Display */}
            <div className="text-center">
              <div className={cn(
                "text-6xl font-mono font-bold transition-colors duration-300",
                isRunning && !isPaused ? "text-primary" : isPaused ? "text-warning" : "text-muted-foreground"
              )}>
                {formattedElapsedTime}
              </div>
              {activeTimer && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground transition-opacity duration-300">
                    {activeTimer.taskTitle}
                  </p>
                  {isPaused && (
                    <p className="text-xs text-warning mt-1 flex items-center justify-center gap-1">
                      <Pause className="h-3 w-3" />
                      Timer Paused
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Timer Controls */}
            <div className="flex justify-center space-x-4">
              {!isRunning ? (
                <Button
                  onClick={handleStartTimer}
                  size="lg"
                  disabled={activeTasks.length > 0 && !selectedTaskId}
                  className="flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Start Timer</span>
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      console.log('🔘 Button clicked, isPaused:', isPaused);
                      if (isPaused) {
                        console.log('📞 Calling resumeTimer');
                        resumeTimer();
                      } else {
                        console.log('📞 Calling pauseTimer');
                        pauseTimer();
                      }
                    }}
                    size="lg"
                    variant={isPaused ? "default" : "secondary"}
                    className="flex items-center space-x-2"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4" />
                        <span>Pause</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStopTimer}
                    variant="destructive"
                    size="lg"
                    className="flex items-center space-x-2"
                  >
                    <Square className="h-4 w-4" />
                    <span>Stop</span>
                  </Button>
                </>
              )}
            </div>

            {/* Session Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Session Notes</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="What are you working on? (auto-saves)"
                className="w-full h-20 p-3 glass-surface rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={!isRunning && !activeTimer}
              />
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <Card className="glass-surface">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Select Task</h2>
                <p className="text-sm text-muted-foreground">Choose what to work on</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active tasks available</p>
                <p className="text-sm">You can still start a general work timer</p>
                <p className="text-xs mt-2">Create tasks later to organize your time better</p>
              </div>
            ) : (
              activeTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  disabled={isRunning}
                  className={cn(
                    "w-full p-3 text-left glass-surface rounded-lg transition-all duration-200 hover:shadow-md",
                    selectedTaskId === task.id ? "ring-2 ring-primary bg-primary/10 shadow-glow" : "",
                    isRunning ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <h3 className="font-medium text-sm truncate">{task.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {task.actualHours || 0}h / {task.estimatedHours || 0}h
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {task.priority}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {task.description}
                    </p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Task Info */}
      {currentTask && (
        <Card className="glass-surface">
          <CardHeader>
            <h3 className="text-lg font-semibold">Current Task Details</h3>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Task</span>
                </div>
                <p className="text-sm">{currentTask.title}</p>
                {currentTask.description && (
                  <p className="text-xs text-muted-foreground">{currentTask.description}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Time Progress</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Logged: {currentTask.actualHours || 0}h</span>
                    <span>Est: {currentTask.estimatedHours || 0}h</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, ((currentTask.actualHours || 0) / (currentTask.estimatedHours || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Priority</span>
                </div>
                <Badge 
                  variant={currentTask.priority === 'High' || currentTask.priority === 'Urgent' ? 'destructive' : 'secondary'}
                >
                  {currentTask.priority}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}