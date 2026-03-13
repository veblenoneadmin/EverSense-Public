import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
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
  Save
} from 'lucide-react';
import { cn } from '../lib/utils';

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


export function Tasks() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [userRole, setUserRole] = useState<string>('CLIENT');
  const [newTaskForm, setNewTaskForm] = useState({
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    projectId: '',
    estimatedHours: 0,
    dueDate: '',
    tags: ''
  });
  const [taskFormLoading, setTaskFormLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    projectId: '',
    estimatedHours: 0,
    dueDate: '',
    tags: ''
  });

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch('/api/organizations');
          if (response.ok) {
            const data = await response.json();
            if (data.organizations && data.organizations.length > 0) {
              const role = data.organizations[0].role || 'CLIENT';
              setUserRole(role);
            } else {
              setUserRole('CLIENT');
            }
          }
        } catch (error) {
          console.error('Failed to fetch user role:', error);
          setUserRole('CLIENT');
        }
      }
    };
    
    if (session) {
      fetchUserRole();
    }
  }, [session]);

  // Fetch projects from API
  const fetchProjects = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;

    try {
      setProjectsLoading(true);
      const data = await apiClient.fetch(`/api/projects?limit=100`);
      if (data.success) {
        setProjects(data.projects || []);
      } else {
        console.error('Failed to fetch projects:', data.error);
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Fetch tasks from API
  const fetchTasks = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const data = await apiClient.fetch(`/api/tasks/recent?userId=${session.user.id}&limit=50`);
      if (data.success) {
        const tasksWithDefaults = (data.tasks || []).map((task: any) => ({
          ...task,
          tags: task.tags || []
        }));
        setTasks(tasksWithDefaults);
      } else {
        console.error('Failed to fetch tasks:', data.error);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [session?.user?.id]);

  useEffect(() => {
    if (showNewTaskForm && session?.user?.id && currentOrg?.id) {
      fetchProjects();
    }
  }, [showNewTaskForm, session?.user?.id, currentOrg?.id]);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    
    // If user is CLIENT, only show tasks assigned to them
    const matchesAssignment = userRole !== 'CLIENT' || 
                             task.assignee === 'Current User' || 
                             task.assignee === session?.user?.email;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignment;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'text-error bg-error/10 border-error/20';
      case 'High': return 'text-error bg-error/10 border-error/20';
      case 'Medium': return 'text-warning bg-warning/10 border-warning/20';
      case 'Low': return 'text-info bg-info/10 border-info/20';
      default: return 'text-muted-foreground bg-muted/10 border-border';
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
    console.log('🎨 getProjectColor called with projectId:', projectId);
    console.log('🎨 Available projects:', projects.map(p => ({ id: p.id, name: p.name, color: p.color })));

    if (!projectId) {
      console.log('🎨 No projectId, returning default gray');
      return '#6b7280'; // Default gray color
    }

    const project = projects.find(p => p.id === projectId);
    console.log('🎨 Found project:', project);

    if (!project?.color) {
      console.log('🎨 No project or color found, returning default gray');
      return '#6b7280';
    }

    // If it's already a hex color, return as is
    if (project.color.startsWith('#')) {
      console.log('🎨 Color is already hex:', project.color);
      return project.color;
    }

    // If it's a Tailwind class, convert to hex
    const hexColor = tailwindToHex(project.color);
    console.log('🎨 Converted Tailwind class', project.color, 'to hex:', hexColor);
    return hexColor;
  };


  const handleStatusUpdate = async (taskId: string, newStatus: Task['status']) => {
    try {
      const data = await apiClient.fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });

      if (data.message) {
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === taskId
              ? { ...task, status: newStatus, updatedAt: new Date().toISOString().split('T')[0] }
              : task
          )
        );
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
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
        tags: newTaskForm.tags ? newTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
      };

      const data = await apiClient.fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });

      if (data.task) {
        await fetchTasks(); // Refresh the task list
        setNewTaskForm({
          description: '',
          priority: 'Medium',
          projectId: '',
          estimatedHours: 0,
          dueDate: '',
          tags: ''
        });
        setShowNewTaskForm(false);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setTaskFormLoading(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTaskForm({
      description: task.description,
      priority: task.priority,
      projectId: task.projectId || '',
      estimatedHours: task.estimatedHours,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      tags: Array.isArray(task.tags) ? task.tags.join(', ') : (task.tags || '')
    });

    // Fetch projects when editing task if not already loaded
    if (projects.length === 0 && session?.user?.id && currentOrg?.id) {
      fetchProjects();
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !session?.user?.id) return;

    try {
      setTaskFormLoading(true);

      // Clean the form data and prepare valid request body
      const taskData: any = {};

      // Generate title based on selected project
      const selectedProject = projects.find(p => p.id === editTaskForm.projectId);
      const title = selectedProject ? `${selectedProject.name} Task` : 'General Task';
      taskData.title = title;

      // Description can be empty string
      taskData.description = editTaskForm.description || '';

      // Always include priority
      if (editTaskForm.priority) {
        taskData.priority = editTaskForm.priority;
      }

      // Always include estimatedHours (can be 0)
      taskData.estimatedHours = editTaskForm.estimatedHours || 0;

      // Include projectId if provided
      if (editTaskForm.projectId && editTaskForm.projectId.trim()) {
        taskData.projectId = editTaskForm.projectId.trim();
      } else {
        taskData.projectId = null;
      }

      // Handle dueDate - convert date to ISO datetime string or send null
      if (editTaskForm.dueDate && editTaskForm.dueDate.trim()) {
        taskData.dueDate = new Date(editTaskForm.dueDate + 'T00:00:00.000Z').toISOString();
      } else {
        taskData.dueDate = null;
      }

      // Handle tags - convert to array or null
      if (editTaskForm.tags && editTaskForm.tags.trim()) {
        taskData.tags = editTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      } else {
        taskData.tags = null;
      }

      console.log('📤 Sending task data:', taskData);

      const data = await apiClient.fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData)
      });

      if (data.task) {
        await fetchTasks(); // Refresh the task list
        setEditingTask(null);
        setEditTaskForm({
          description: '',
          priority: 'Medium',
          projectId: '',
          estimatedHours: 0,
          dueDate: '',
          tags: ''
        });
      }
    } catch (error: any) {
      console.error('Error updating task:', error);

      // Try to get more detailed error info
      if (error.message === 'Invalid request body') {
        alert(`Validation error: Please check the console for details`);
      } else {
        alert('Failed to update task. Please try again.');
      }
    } finally {
      setTaskFormLoading(false);
    }
  };

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">
            {userRole === 'CLIENT' ? 'My Tasks' : 'Task Management'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {userRole === 'CLIENT' 
              ? 'View and track tasks assigned to you' 
              : 'Organize, prioritize, and track your work'}
          </p>
        </div>
        {userRole !== 'CLIENT' && (
          <Button 
            onClick={() => setShowNewTaskForm(true)}
            className="bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow mr-4">
                <CheckSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center shadow-glow mr-4">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center shadow-glow mr-4">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.inProgress}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass shadow-elevation">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-xl bg-gradient-error flex items-center justify-center shadow-glow mr-4">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.overdue}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="glass shadow-elevation">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Status</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 glass-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Priority</option>
              <option value="Urgent">Urgent Priority</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card className="glass shadow-elevation">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tasks ({filteredTasks.length})</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No tasks found. Create your first task!</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                console.log('🎯 Rendering task:', { id: task.id, title: task.title, projectId: task.projectId, project: task.project });
                const taskColor = getProjectColor(task.projectId);
                console.log('🎯 Task color for', task.title, ':', taskColor);

                return (
                <div
                  key={task.id}
                  className="relative flex items-center p-4 border-b border-border last:border-b-0 hover:bg-surface-elevated/50 transition-colors"
                >
                  {/* Project Color Border */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 z-10"
                    style={{ backgroundColor: taskColor }}
                  />

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{task.title}</h3>
                        <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                          {task.priority}
                        </Badge>
                        <Badge className={cn("text-xs", getStatusColor(task.status))}>
                          {getStatusIcon(task.status)}
                          <span className="ml-1 capitalize">{task.status.replace('_', ' ')}</span>
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {task.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.actualHours}h / {task.estimatedHours}h
                        </span>
                        
                        {task.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assignee}
                          </span>
                        )}
                        
                        {task.isBillable && task.hourlyRate && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${task.hourlyRate}/hr
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-muted/20 text-muted-foreground text-xs rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="ml-4 w-20">
                      <div className="w-full h-2 bg-surface-elevated rounded-full">
                        <div 
                          className="h-full bg-gradient-primary rounded-full transition-all duration-300"
                          style={{ width: `${Math.min((task.actualHours / task.estimatedHours) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        {Math.round((task.actualHours / task.estimatedHours) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusUpdate(task.id, e.target.value as Task['status'])}
                    className="px-2 py-1 text-xs glass-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleEditTask(task)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>

                  {userRole !== 'CLIENT' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-error hover:text-error"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* New Task Form Modal */}
      {showNewTaskForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Create New Task</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewTaskForm(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project *</label>
                  <select
                    value={newTaskForm.projectId}
                    onChange={(e) => setNewTaskForm(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={taskFormLoading || projectsLoading}
                    required
                  >
                    <option value="" className="bg-surface-elevated">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-surface-elevated">
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {projectsLoading && (
                    <p className="text-xs text-muted-foreground mt-1">Loading projects...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newTaskForm.description}
                    onChange={(e) => setNewTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    placeholder="Describe the task goals and requirements..."
                    rows={3}
                    disabled={taskFormLoading}
                  />
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select
                      value={newTaskForm.priority}
                      onChange={(e) => setNewTaskForm(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      disabled={taskFormLoading}
                    >
                      <option value="Low" className="bg-surface-elevated">Low Priority</option>
                      <option value="Medium" className="bg-surface-elevated">Medium Priority</option>
                      <option value="High" className="bg-surface-elevated">High Priority</option>
                      <option value="Urgent" className="bg-surface-elevated">Urgent Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Estimated Hours</label>
                    <input
                      type="number"
                      value={newTaskForm.estimatedHours}
                      onChange={(e) => setNewTaskForm(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="0"
                      min="0"
                      step="0.5"
                      disabled={taskFormLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={(e) => setNewTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={taskFormLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newTaskForm.tags}
                    onChange={(e) => setNewTaskForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="urgent, frontend, client"
                    disabled={taskFormLoading}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewTaskForm(false)}
                    disabled={taskFormLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={taskFormLoading || !newTaskForm.projectId}
                    className="flex-1"
                  >
                    {taskFormLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Task
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Task Form Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Task</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTask(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project *</label>
                  <select
                    value={editTaskForm.projectId}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={taskFormLoading || projectsLoading}
                    required
                  >
                    <option value="" className="bg-surface-elevated">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-surface-elevated">
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {projectsLoading && (
                    <p className="text-xs text-muted-foreground mt-1">Loading projects...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editTaskForm.description}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    placeholder="Describe the task goals and requirements..."
                    rows={3}
                    disabled={taskFormLoading}
                  />
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select
                      value={editTaskForm.priority}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, priority: e.target.value as 'Low' | 'Medium' | 'High' | 'Urgent' }))}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      disabled={taskFormLoading}
                    >
                      <option value="Low" className="bg-surface-elevated">Low Priority</option>
                      <option value="Medium" className="bg-surface-elevated">Medium Priority</option>
                      <option value="High" className="bg-surface-elevated">High Priority</option>
                      <option value="Urgent" className="bg-surface-elevated">Urgent Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Estimated Hours</label>
                    <input
                      type="number"
                      value={editTaskForm.estimatedHours}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="0"
                      min="0"
                      step="0.5"
                      disabled={taskFormLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editTaskForm.dueDate}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    disabled={taskFormLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={editTaskForm.tags}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="urgent, frontend, client"
                    disabled={taskFormLoading}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingTask(null)}
                    disabled={taskFormLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={taskFormLoading || !editTaskForm.projectId}
                    className="flex-1"
                  >
                    {taskFormLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Update Task
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}