import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus,
  Search,
  Filter,
  CheckSquare2,
  Circle,
  Clock,
  Calendar,
  Target,
  AlertCircle,
  DollarSign,
  Building2,
  Timer,
  MoreHorizontal,
  Edit,
  Trash2,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks, useUpdateTask } from '@/hooks/useDatabase';
import TaskForm from './TaskForm';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

const TaskInterface: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const { data: tasks = [], isLoading } = useTasks();
  const updateTaskMutation = useUpdateTask();

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await updateTaskMutation.mutateAsync({
        id: taskId,
        updates: { status: newStatus }
      });
    } catch (error) {
      logger.error('Task status update failed', { taskId, newStatus });
      toast.error('Unable to update task status. Please try again.');
    }
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error bg-error/10 border-error/20';
      case 'medium': return 'text-warning bg-warning/10 border-warning/20';
      case 'low': return 'text-info bg-info/10 border-info/20';
      default: return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success bg-success/10 border-success/20';
      case 'in_progress': return 'text-primary bg-primary/10 border-primary/20';
      case 'paused': return 'text-warning bg-warning/10 border-warning/20';
      case 'not_started': return 'text-muted-foreground bg-muted/10 border-border';
      default: return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckSquare2 className="h-4 w-4" />;
      case 'in_progress': return <Timer className="h-4 w-4" />;
      case 'paused': return <Clock className="h-4 w-4" />;
      case 'not_started': return <Circle className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Task Management</h1>
          <p className="text-muted-foreground mt-2">Organize and track your work efficiently</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:shadow-lg"
          onClick={() => setShowTaskForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Filters & Search */}
      <Card className="glass p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-surface-elevated border-border"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground"
            >
              <option value="all">All Status</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground"
            >
              <option value="all">All Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            
            <Button variant="outline" className="border-border">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{tasks.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-warning flex items-center justify-center">
              <Timer className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in_progress').length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-success flex items-center justify-center">
              <CheckSquare2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-info flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold">
                {tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0).toFixed(1)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="glass p-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))
        ) : filteredTasks.map((task) => (
          <Card key={task.id} className="glass p-6 hover:shadow-elevation transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className={cn("flex items-center space-x-2 px-2 py-1 rounded text-xs font-medium border", getPriorityColor(task.priority))}>
                    <AlertCircle className="h-3 w-3" />
                    <span>{task.priority.toUpperCase()}</span>
                  </div>
                  <div className={cn("flex items-center space-x-2 px-2 py-1 rounded text-xs font-medium border", getStatusColor(task.status))}>
                    {getStatusIcon(task.status)}
                    <span>{formatStatus(task.status)}</span>
                  </div>
                  {task.is_billable && (
                    <div className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-success/10 border border-success/20 text-success">
                      <DollarSign className="h-3 w-3" />
                      <span>Billable</span>
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-foreground mb-2">{task.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{task.description}</p>
                
                <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{task.actual_hours || 0}h / {task.estimated_hours}h</span>
                  </div>
                  {task.due_date && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {task.is_billable && task.hourly_rate && (
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4" />
                      <span>${task.hourly_rate}/hr</span>
                    </div>
                  )}
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{Math.round(((task.actual_hours || 0) / task.estimated_hours) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-elevated rounded-full">
                    <div 
                      className="h-full bg-gradient-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(((task.actual_hours || 0) / task.estimated_hours) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center space-x-2 ml-6">
                {task.status !== 'completed' && (
                  <Button 
                    size="sm" 
                    className="bg-gradient-success hover:shadow-lg"
                    onClick={() => navigate('/timer')}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Timer
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-border"
                  onClick={() => handleEditTask(task)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="border-border">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTasks.length === 0 && !isLoading && (
        <Card className="glass p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-gradient-primary/20 flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No tasks found</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' 
                ? "Try adjusting your search or filters"
                : "Create your first task to get started"
              }
            </p>
            <Button 
              className="bg-gradient-primary hover:shadow-lg"
              onClick={() => {
                if (searchTerm || filterStatus !== 'all' || filterPriority !== 'all') {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterPriority('all');
                } else {
                  setShowTaskForm(true);
                }
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {searchTerm || filterStatus !== 'all' || filterPriority !== 'all' ? "Clear Filters" : "Create Task"}
            </Button>
          </div>
        </Card>
      )}

      <TaskForm 
        isOpen={showTaskForm}
        onClose={() => {
          setShowTaskForm(false);
          setEditingTask(null);
        }}
        task={editingTask}
        mode={editingTask ? 'edit' : 'create'}
      />
    </div>
  );
};

export default TaskInterface;