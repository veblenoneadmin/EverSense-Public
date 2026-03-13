import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { useApiTasks } from '../hooks/useApiTasks';
import { useTimer } from '../hooks/useTimer';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  Search,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
  X,
  Play,
  Pause,
  Square,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';
import { logger } from '../lib/logger';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  estimatedHours: number;
  actualHours: number;
  dueDate?: string;
  assignee?: string;
  project?: string;
  projectId?: string;
  isBillable: boolean;
  hourlyRate?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  color: string;
}

export function TasksAndTimer() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  // Timer hooks
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

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  // Timer state
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');


  // Task form state
  const [taskFormLoading, setTaskFormLoading] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    projectId: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    estimatedHours: 0,
    dueDate: '',
    tags: '',
    isBillable: false,
    hourlyRate: 0
  });
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    projectId: '',
    estimatedHours: 0,
    dueDate: '',
    tags: '',
    isBillable: false,
    hourlyRate: 0
  });

  // Timer error handling
  const [showError, setShowError] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  logger.debug('TasksAndTimer component initialized', {
    userId: session?.user?.id,
    activeTimer: activeTimer?.id,
    isRunning
  });

  // Set initial task when tasks load or when no task is selected
  useEffect(() => {
    if (activeTasks.length > 0 && !selectedTaskId && !activeTimer) {
      setSelectedTaskId(activeTasks[0].id);
    }
  }, [activeTasks, selectedTaskId, activeTimer]);

  // Handle timer notes update
  const handleUpdateNotes = async (notes: string) => {
    if (!activeTimer) return;

    try {
      await updateTimer({ description: notes });
      setSessionNotes(notes);
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  // Timer control handlers
  const handleStartTimer = async () => {
    if (!selectedTaskId) return;

    const selectedTask = activeTasks.find(task => task.id === selectedTaskId);
    if (!selectedTask) return;

    try {
      await startTimer(selectedTaskId, sessionNotes, 'work');
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;

    try {
      await stopTimer();
      setSessionNotes('');
      setSelectedTaskId('');
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  // Error handling for timer
  useEffect(() => {
    const hasError = tasksError || timerError;
    if (hasError && !dismissedErrors.has(hasError)) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [tasksError, timerError, dismissedErrors]);

  const dismissError = () => {
    const currentError = tasksError || timerError;
    if (currentError) {
      setDismissedErrors(prev => new Set(prev).add(currentError));
    }
    setShowError(false);
  };

  // Fetch tasks and projects
  useEffect(() => {
    fetchTasks();
  }, [session, currentOrg]);

  useEffect(() => {
    fetchProjects();
  }, [session, currentOrg]);

  const fetchTasks = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const data = await apiClient.fetch('/api/tasks', { method: 'GET' });

      console.log('📋 Tasks API Response:', data);

      if (data?.tasks && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      } else if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.warn('Unexpected tasks response format:', data);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    if (!session?.user?.id) return;

    try {
      const data = await apiClient.fetch('/api/projects', { method: 'GET' });

      if (data?.projects && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else if (Array.isArray(data)) {
        setProjects(data);
      } else {
        console.warn('Unexpected projects response format:', data);
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  // Task management functions
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success bg-success/10 border-success/20';
      case 'in_progress': return 'text-primary bg-primary/10 border-primary/20';
      case 'on_hold': return 'text-warning bg-warning/10 border-warning/20';
      default: return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'on_hold': return <AlertCircle className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  // Convert Tailwind color classes to hex colors
  const tailwindToHex = (tailwindClass: string): string => {
    const colorMap: { [key: string]: string } = {
      'bg-primary': '#3b82f6',    // blue-500
      'bg-secondary': '#6b7280',  // gray-500
      'bg-success': '#10b981',    // emerald-500
      'bg-warning': '#f59e0b',    // amber-500
      'bg-danger': '#ef4444',     // red-500
      'bg-info': '#06b6d4',       // cyan-500
      'bg-purple': '#8b5cf6',     // violet-500
      'bg-pink': '#ec4899',       // pink-500
      'bg-indigo': '#6366f1',     // indigo-500
      'bg-green': '#22c55e',      // green-500
      'bg-red': '#ef4444',        // red-500
      'bg-blue': '#3b82f6',       // blue-500
      'bg-yellow': '#eab308',     // yellow-500
      'bg-orange': '#f97316',     // orange-500
      'bg-teal': '#14b8a6',       // teal-500
      'bg-cyan': '#06b6d4',       // cyan-500
    };
    return colorMap[tailwindClass] || '#6b7280';
  };

  // Get project color by projectId
  const getProjectColor = (projectId?: string): string => {
    if (!projectId) {
      return '#6b7280'; // Default gray color
    }

    const project = projects.find(p => p.id === projectId);

    if (!project?.color) {
      return '#6b7280';
    }

    // If it's already a hex color, return as is
    if (project.color.startsWith('#')) {
      return project.color;
    }

    // If it's a Tailwind class, convert to hex
    const hexColor = tailwindToHex(project.color);
    return hexColor;
  };


  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      const data = await apiClient.fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (data.message) {
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !currentOrg?.id) return;

    try {
      setTaskFormLoading(true);

      // Generate title based on selected project
      const selectedProject = projects.find(p => p.id === newTaskForm.projectId);
      const title = selectedProject ? `${selectedProject.name} Task` : 'General Task';

      const taskData = {
        title: title,
        description: newTaskForm.description,
        userId: session.user.id,
        orgId: currentOrg.id,
        priority: newTaskForm.priority,
        projectId: newTaskForm.projectId || undefined,
        estimatedHours: newTaskForm.estimatedHours,
        dueDate: newTaskForm.dueDate ? new Date(newTaskForm.dueDate + 'T00:00:00.000Z').toISOString() : undefined,
        tags: newTaskForm.tags ? newTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        isBillable: newTaskForm.isBillable,
        hourlyRate: newTaskForm.isBillable ? newTaskForm.hourlyRate : undefined
      };

      const data = await apiClient.fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });

      if (data.task) {
        await fetchTasks(); // Refresh the task list
        setNewTaskForm({
          projectId: '',
          description: '',
          priority: 'Medium',
          estimatedHours: 0,
          dueDate: '',
          tags: '',
          isBillable: false,
          hourlyRate: 0
        });
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setTaskFormLoading(false);
    }
  };


  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !session?.user?.id) return;

    try {
      setTaskFormLoading(true);

      const taskData = {
        title: editTaskForm.title,
        description: editTaskForm.description,
        priority: editTaskForm.priority,
        projectId: editTaskForm.projectId || undefined,
        estimatedHours: editTaskForm.estimatedHours,
        dueDate: editTaskForm.dueDate ? new Date(editTaskForm.dueDate + 'T00:00:00.000Z').toISOString() : undefined,
        tags: editTaskForm.tags ? editTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        isBillable: editTaskForm.isBillable,
        hourlyRate: editTaskForm.isBillable ? editTaskForm.hourlyRate : undefined
      };

      const data = await apiClient.fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify(taskData)
      });

      if (data.task) {
        await fetchTasks(); // Refresh the task list
        setEditingTask(null);
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setTaskFormLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesProject = filterProject === 'all' || task.projectId === filterProject;

    return matchesSearch && matchesStatus && matchesPriority && matchesProject;
  });

  if (loading || tasksLoading || timerLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks & Time Tracker</h1>
        <div className="flex items-center space-x-4">
          {isRunning && (
            <Badge variant={isRunning && !isPaused ? "default" : isPaused ? "destructive" : "secondary"}>
              {isRunning && !isPaused ? "Running" : isPaused ? "Paused" : "Stopped"}
            </Badge>
          )}
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Single Timer Tab - Tasks functionality integrated */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <div className="flex-1 py-2 px-4 rounded-md transition-colors font-medium text-sm bg-background text-foreground shadow-sm">
          <Clock className="h-4 w-4 mr-2 inline" />
          Timer & Tasks
        </div>
      </div>

      {/* Error Messages */}
      {showError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{tasksError || timerError}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissError}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timer & Tasks Content */}
      <div className="space-y-6">
        {/* Task Filters */}
        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full rounded-lg border border-border bg-background"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background"
              >
                <option value="all">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>

              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background"
              >
                <option value="all">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Project Filter */}
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background"
              >
                <option value="all">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
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
                        if (isPaused) {
                          resumeTimer();
                        } else {
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
                      size="lg"
                      variant="destructive"
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
                  onBlur={() => handleUpdateNotes(sessionNotes)}
                  placeholder="Add notes about this work session..."
                  className="w-full p-3 rounded-lg border border-border bg-background min-h-[80px] resize-none"
                  disabled={!isRunning}
                />
              </div>
            </CardContent>
          </Card>

          {/* All Tasks List with Timer Integration */}
          <Card className="glass-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Tasks & Timer</h2>
                </div>
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-primary hover:bg-gradient-primary/90 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                  <p className="text-muted-foreground mb-4">
                    {tasks.length === 0
                      ? "Get started by creating your first task"
                      : "Try adjusting your filters or search terms"
                    }
                  </p>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gradient-primary hover:bg-gradient-primary/90 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          {/* Project indicator and title */}
                          <div className="flex items-start space-x-3">
                            {task.projectId && (
                              <div
                                className="w-1 h-16 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getProjectColor(task.projectId) }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg mb-1">{task.title}</h3>
                              {task.description && (
                                <p className="text-muted-foreground text-sm">{task.description}</p>
                              )}
                            </div>
                          </div>

                          {/* Task metadata */}
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge className={cn("border", getPriorityColor(task.priority))}>
                              {task.priority}
                            </Badge>

                            <Badge className={cn("border flex items-center gap-1", getStatusColor(task.status))}>
                              {getStatusIcon(task.status)}
                              {task.status.replace('_', ' ')}
                            </Badge>

                            {task.project && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4 mr-1" />
                                {task.project}
                              </div>
                            )}

                            {task.assignee && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <User className="h-4 w-4 mr-1" />
                                {task.assignee}
                              </div>
                            )}

                            {task.dueDate && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}

                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 mr-1" />
                              {task.actualHours || 0}h / {task.estimatedHours || 0}h
                            </div>

                            {task.isBillable && (
                              <div className="flex items-center text-sm text-success">
                                <DollarSign className="h-4 w-4 mr-1" />
                                Billable
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Timer Controls for each task */}
                        <div className="flex flex-col items-end space-y-2 ml-4">
                          {/* Timer status and time */}
                          {activeTimer?.taskId === task.id ? (
                            <div className="text-center">
                              <div className="text-2xl font-mono font-bold text-primary mb-2">
                                {formattedElapsedTime}
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => {
                                    if (isPaused) {
                                      resumeTimer();
                                    } else {
                                      pauseTimer();
                                    }
                                  }}
                                  size="sm"
                                  variant={isPaused ? "default" : "secondary"}
                                >
                                  {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                </Button>
                                <Button
                                  onClick={handleStopTimer}
                                  size="sm"
                                  variant="destructive"
                                >
                                  <Square className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <Button
                                onClick={() => {
                                  setSelectedTaskId(task.id);
                                  setTimeout(() => handleStartTimer(), 100);
                                }}
                                size="sm"
                                disabled={isRunning}
                                className="flex items-center space-x-1"
                              >
                                <Play className="h-3 w-3" />
                                <span>Start</span>
                              </Button>
                            </div>
                          )}

                          {/* Task actions */}
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTask(task);
                                setEditTaskForm({
                                  title: task.title,
                                  description: task.description,
                                  priority: task.priority,
                                  projectId: task.projectId || '',
                                  estimatedHours: task.estimatedHours,
                                  dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
                                  tags: task.tags.join(', '),
                                  isBillable: task.isBillable,
                                  hourlyRate: task.hourlyRate || 0
                                });
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Session Notes for active timer */}
                      {activeTimer?.taskId === task.id && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Session Notes</label>
                            <textarea
                              value={sessionNotes}
                              onChange={(e) => setSessionNotes(e.target.value)}
                              onBlur={() => handleUpdateNotes(sessionNotes)}
                              placeholder="Add notes about this work session..."
                              className="w-full p-3 rounded-lg border border-border bg-background min-h-[60px] resize-none"
                              disabled={!isRunning}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Task Creation/Editing Modal */}
      {isModalOpen && createPortal(
        <div
          className="modal-overlay glass"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
              setEditingTask(null);
            }
          }}
        >
          <div
            className="modal-content glass shadow-elevation"
            style={{
              maxWidth: '600px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              backgroundColor: '#1a1a1a',
              borderRadius: '12px',
              border: '1px solid #333'
            }}
          >
            {/* Enhanced Header */}
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #646cff, #8b5cf6)',
              borderRadius: '8px 8px 0 0',
              padding: '24px',
              color: 'white'
            }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold m-0">
                    {editingTask ? 'Edit Task' : 'Create New Task'}
                  </h2>
                  <p className="text-white/80 text-sm m-0 mt-1">
                    {editingTask ? 'Update task details' : 'Set up a new task to track progress'}
                  </p>
                </div>
              </div>
              <button
                className="modal-close bg-white/20 hover:bg-white/30 rounded-lg p-2"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTask(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="modal-form" style={{ padding: '24px' }}>
              <div className="space-y-6">
                {editingTask ? (
                  /* Title Field - Only for editing existing tasks */
                  <div className="form-group">
                    <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                      <Target className="w-4 h-4" />
                      Task Title *
                    </label>
                    <input
                      type="text"
                      value={editTaskForm.title}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="Enter task title..."
                      required
                      disabled={taskFormLoading}
                    />
                  </div>
                ) : null}

                {/* Project Selection - Primary field for new tasks */}
                <div className="form-group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                    <CheckSquare className="w-4 h-4" />
                    Project {!editingTask ? '*' : ''}
                  </label>
                  <select
                    value={editingTask ? editTaskForm.projectId : newTaskForm.projectId}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditTaskForm(prev => ({ ...prev, projectId: e.target.value }));
                      } else {
                        setNewTaskForm(prev => ({ ...prev, projectId: e.target.value }));
                      }
                    }}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={taskFormLoading}
                    required={!editingTask}
                  >
                    <option value="" className="bg-surface-elevated">
                      {editingTask ? 'Select a project (optional)' : 'Select a project to create task for *'}
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-surface-elevated">
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {!editingTask && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">
                        Task title will be automatically generated based on the selected project
                      </p>
                      {newTaskForm.projectId && (
                        <div className="mt-1 p-2 bg-muted/30 border border-muted rounded text-sm">
                          <span className="text-muted-foreground">Generated title: </span>
                          <span className="font-medium">
                            {projects.find(p => p.id === newTaskForm.projectId)?.name} Task
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                    <Edit2 className="w-4 h-4" />
                    Description
                  </label>
                  <textarea
                    value={editingTask ? editTaskForm.description : newTaskForm.description}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditTaskForm(prev => ({ ...prev, description: e.target.value }));
                      } else {
                        setNewTaskForm(prev => ({ ...prev, description: e.target.value }));
                      }
                    }}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    placeholder="Describe the task goals and requirements..."
                    rows={3}
                    disabled={taskFormLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Priority */}
                  <div className="form-group">
                    <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                      <AlertCircle className="w-4 h-4" />
                      Priority
                    </label>
                    <select
                      value={editingTask ? editTaskForm.priority : newTaskForm.priority}
                      onChange={(e) => {
                        if (editingTask) {
                          setEditTaskForm(prev => ({ ...prev, priority: e.target.value as Task['priority'] }));
                        } else {
                          setNewTaskForm(prev => ({ ...prev, priority: e.target.value as Task['priority'] }));
                        }
                      }}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      disabled={taskFormLoading}
                    >
                      <option value="Low" className="bg-surface-elevated">Low Priority</option>
                      <option value="Medium" className="bg-surface-elevated">Medium Priority</option>
                      <option value="High" className="bg-surface-elevated">High Priority</option>
                      <option value="Urgent" className="bg-surface-elevated">Urgent Priority</option>
                    </select>
                  </div>

                  {/* Estimated Hours */}
                  <div className="form-group">
                    <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                      <Clock className="w-4 h-4" />
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      value={editingTask ? editTaskForm.estimatedHours : newTaskForm.estimatedHours}
                      onChange={(e) => {
                        if (editingTask) {
                          setEditTaskForm(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) || 0 }));
                        } else {
                          setNewTaskForm(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) || 0 }));
                        }
                      }}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="0"
                      min="0"
                      step="0.5"
                      disabled={taskFormLoading}
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div className="form-group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                    <Calendar className="w-4 h-4" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editingTask ? editTaskForm.dueDate : newTaskForm.dueDate}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditTaskForm(prev => ({ ...prev, dueDate: e.target.value }));
                      } else {
                        setNewTaskForm(prev => ({ ...prev, dueDate: e.target.value }));
                      }
                    }}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={taskFormLoading}
                  />
                </div>

                {/* Billing Information */}
                <div className="form-group space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isBillable"
                      checked={editingTask ? editTaskForm.isBillable : newTaskForm.isBillable}
                      onChange={(e) => {
                        if (editingTask) {
                          setEditTaskForm(prev => ({ ...prev, isBillable: e.target.checked }));
                        } else {
                          setNewTaskForm(prev => ({ ...prev, isBillable: e.target.checked }));
                        }
                      }}
                      className="rounded border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                      disabled={taskFormLoading}
                    />
                    <label htmlFor="isBillable" className="text-sm font-semibold text-white flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      This task is billable
                    </label>
                  </div>

                  {(editingTask ? editTaskForm.isBillable : newTaskForm.isBillable) && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                        <DollarSign className="w-4 h-4" />
                        Hourly Rate ($)
                      </label>
                      <input
                        type="number"
                        value={editingTask ? editTaskForm.hourlyRate : newTaskForm.hourlyRate}
                        onChange={(e) => {
                          if (editingTask) {
                            setEditTaskForm(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }));
                          } else {
                            setNewTaskForm(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }));
                          }
                        }}
                        className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        disabled={taskFormLoading}
                      />
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="form-group">
                  <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                    <CheckSquare className="w-4 h-4" />
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={editingTask ? editTaskForm.tags : newTaskForm.tags}
                    onChange={(e) => {
                      if (editingTask) {
                        setEditTaskForm(prev => ({ ...prev, tags: e.target.value }));
                      } else {
                        setNewTaskForm(prev => ({ ...prev, tags: e.target.value }));
                      }
                    }}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="urgent, frontend, client"
                    disabled={taskFormLoading}
                  />
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="modal-actions flex justify-end gap-3 pt-6 mt-6 border-t border-border">
                <button
                  type="button"
                  className="px-6 py-2 bg-surface-elevated hover:bg-muted border border-border rounded-lg text-white transition-all"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                  }}
                  disabled={taskFormLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg text-white font-medium transition-all flex items-center gap-2 shadow-glow"
                  style={{ background: 'linear-gradient(135deg, #646cff, #8b5cf6)' }}
                  disabled={taskFormLoading || (editingTask ? !editTaskForm.title : !newTaskForm.projectId)}
                >
                  {taskFormLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {editingTask ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingTask ? (
                        <>
                          <Edit2 size={16} />
                          Update Task
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Create Task
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}