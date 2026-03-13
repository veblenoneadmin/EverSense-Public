import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock,
  Play,
  Pause,
  Square,
  CheckCircle,
  AlertCircle,
  Calendar,
  Target,
  MessageSquare,
  Plus,
  Timer,
  BookOpen
} from 'lucide-react';
import BrainDumpInterface from '@/components/BrainDump/BrainDumpInterface';
import CalendarInterface from '@/components/Calendar/CalendarInterface';
import { 
  useTasks, 
  useUpdateTask, 
  useStartTimer, 
  useStopTimer,
  useGoals,
  useClientRequests,
  useUserPresence,
  useUpdateUserPresence
} from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const StaffWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { data: tasks } = useTasks();
  const { data: goals } = useGoals();
  const { data: requests } = useClientRequests();
  const updateTask = useUpdateTask();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const updatePresence = useUpdateUserPresence();

  const todayTasks = tasks?.filter(task => 
    task.status !== 'completed' && 
    (!task.due_date || new Date(task.due_date) <= new Date())
  ) || [];

  const overdueTasks = tasks?.filter(task => 
    task.status !== 'completed' && 
    task.due_date && new Date(task.due_date) < new Date()
  ) || [];

  const assignedRequests = requests?.filter(request => request.assigned_to === user?.id) || [];

  // Get goals for sidebar display

  // Timer effect
  useEffect(() => {
    if (activeTimer && timerStart) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - timerStart.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTimer, timerStart]);

  // Update presence on mount
  useEffect(() => {
    updatePresence.mutate({
      is_online: true,
      current_status: 'online',
      last_seen: new Date().toISOString()
    });
  }, []);

  const handleStartTimer = async (taskId: string) => {
    try {
      await startTimer.mutateAsync({ taskId });
      setActiveTimer(taskId);
      setTimerStart(new Date());
      setElapsedTime(0);
      toast({
        title: "Timer Started",
        description: "Time tracking has begun for this task.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start timer.",
        variant: "destructive",
      });
    }
  };

  const handleStopTimer = async (taskId: string) => {
    try {
      await stopTimer.mutateAsync({ taskId });
      setActiveTimer(null);
      setTimerStart(null);
      setElapsedTime(0);
      toast({
        title: "Timer Stopped",
        description: "Time has been logged for this task.",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to stop timer.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateTask.mutateAsync({ 
        id: taskId, 
        updates: { status: 'completed' }
      });
      if (activeTimer === taskId) {
        await handleStopTimer(taskId);
      }
      toast({
        title: "Task Completed",
        description: "Great job! Task marked as completed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-error';
      case 'medium': return 'border-warning';
      case 'low': return 'border-success';
      default: return 'border-muted';
    }
  };

  const getGoalHealthColor = (health: string) => {
    switch (health) {
      case 'green': return 'text-success';
      case 'amber': return 'text-warning';
      case 'red': return 'text-error';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Main Workspace */}
          <div className="lg:col-span-3 space-y-6">
            {/* Brain Dump Section */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>Brain Dump</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BrainDumpInterface />
              </CardContent>
            </Card>

            {/* Today's Tasks */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <span>Today's Tasks</span>
                    <Badge variant="outline">{todayTasks.length}</Badge>
                  </div>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {todayTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className={`p-4 border rounded-lg bg-surface-elevated/50 ${getPriorityColor(task.priority)} ${
                          activeTimer === task.id ? 'timer-active' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant="outline" className="capitalize">
                                {task.priority}
                              </Badge>
                              {task.estimated_hours && (
                                <Badge variant="secondary">
                                  {task.estimated_hours}h est.
                                </Badge>
                              )}
                              {task.due_date && (
                                <Badge variant="outline" className="text-xs">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {activeTimer === task.id ? (
                              <>
                                <div className="flex items-center space-x-2 bg-timer-active/20 px-3 py-1 rounded-md">
                                  <Clock className="h-4 w-4 text-timer-active" />
                                  <span className="font-mono text-sm text-timer-active">
                                    {formatTime(elapsedTime)}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStopTimer(task.id)}
                                  className="bg-timer-active/20 border-timer-active hover:bg-timer-active/30"
                                >
                                  <Square className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartTimer(task.id)}
                                disabled={!!activeTimer}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteTask(task.id)}
                              className="bg-success/20 border-success hover:bg-success/30"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {todayTasks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No tasks for today. Great job!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <Card className="glass border-error/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-error">
                    <AlertCircle className="h-5 w-5" />
                    <span>Overdue Tasks</span>
                    <Badge variant="destructive">{overdueTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="p-3 border border-error/20 rounded bg-error/5">
                        <h4 className="font-medium text-foreground">{task.title}</h4>
                        <p className="text-sm text-error">
                          Due: {new Date(task.due_date!).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {overdueTasks.length > 3 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{overdueTasks.length - 3} more overdue tasks
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Monthly Goals */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Monthly Goals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="space-y-3">
                   {goals && goals.length > 0 ? goals.slice(0, 3).map((goal) => (
                     <div key={goal.id} className="p-3 bg-surface-elevated/50 rounded-lg">
                       <div className="flex items-center justify-between mb-2">
                         <h4 className="text-sm font-medium text-foreground">
                           {goal.title}
                         </h4>
                         <Badge 
                           variant="outline" 
                           className={getGoalHealthColor(goal.health_status)}
                         >
                           {Math.round((goal.current_value / goal.target_value) * 100)}%
                         </Badge>
                       </div>
                       <div className="w-full bg-muted rounded-full h-2">
                         <div 
                           className="bg-primary h-2 rounded-full transition-all"
                           style={{ 
                             width: `${Math.min((goal.current_value / goal.target_value) * 100, 100)}%` 
                           }}
                         />
                       </div>
                       <p className="text-xs text-muted-foreground mt-1">
                         {goal.current_value} / {goal.target_value}
                       </p>
                     </div>
                   )) : (
                     <div className="text-center py-4 text-muted-foreground">
                       <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                       <p className="text-sm">No goals set</p>
                     </div>
                   )}
                </div>
              </CardContent>
            </Card>

            {/* Client Requests Inbox */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Client Requests</span>
                  {assignedRequests.length > 0 && (
                    <Badge variant="outline">{assignedRequests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {assignedRequests.slice(0, 5).map((request) => (
                      <div key={request.id} className="p-3 bg-surface-elevated/50 rounded-lg">
                        <h4 className="text-sm font-medium text-foreground">
                          {request.title}
                        </h4>
                         <p className="text-xs text-muted-foreground mt-1">
                           Request #{request.request_number}
                         </p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge 
                            variant="outline" 
                            className={
                              request.priority === 'urgent' ? 'border-error' :
                              request.priority === 'high' ? 'border-warning' : 
                              'border-muted'
                            }
                          >
                            {request.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {request.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    {assignedRequests.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No pending requests</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Upcoming Calendar */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Upcoming</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Calendar events will appear here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Global Timer Strip */}
        {activeTimer && (
          <div className="fixed bottom-0 left-0 right-0 bg-timer-active/10 border-t border-timer-active backdrop-blur-md p-4">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Timer className="h-5 w-5 text-timer-active animate-pulse" />
                  <span className="font-medium text-foreground">Timer Active</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Task:</span>
                  <span className="font-medium text-foreground">
                    {todayTasks.find(t => t.id === activeTimer)?.title}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="font-mono text-lg text-timer-active">
                  {formatTime(elapsedTime)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStopTimer(activeTimer)}
                  className="bg-timer-active/20 border-timer-active hover:bg-timer-active/30"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Timer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffWorkspace;