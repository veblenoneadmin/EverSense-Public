import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateTask, useUpdateTask } from '@/hooks/useDatabase';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import { Plus, Save, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { sanitizeInput, validationSchemas } from '@/lib/security';
import { toast } from 'sonner';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task?: any;
  mode?: 'create' | 'edit';
}

interface TaskFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimated_hours: number;
  hourly_rate: number;
  is_billable: boolean;
  due_date?: string;
  project_id?: string;
  client_id?: string;
}

const TaskForm: React.FC<TaskFormProps> = ({ isOpen, onClose, task, mode = 'create' }) => {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { addTaskToCalendar } = useCalendarIntegration();

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<TaskFormData>({
    defaultValues: task ? {
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimated_hours: task.estimated_hours,
      hourly_rate: task.hourly_rate,
      is_billable: task.is_billable,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
    } : {
      priority: 'medium',
      estimated_hours: 1,
      hourly_rate: 75,
      is_billable: true,
    }
  });

  const isBillable = watch('is_billable');

  const onSubmit = async (data: TaskFormData) => {
    try {
      const sanitizedData = {
        ...data,
        title: sanitizeInput.text(data.title),
        description: sanitizeInput.text(data.description || ''),
      };

      if (!sanitizedData.title.trim()) {
        toast.error('Task title is required');
        return;
      }

      if (mode === 'create') {
        const newTask = await createTask.mutateAsync({
          ...sanitizedData,
          status: 'not_started',
          actual_hours: 0,
          billable_hours: 0,
        });
        
        if (sanitizedData.due_date && newTask) {
          await addTaskToCalendar.mutateAsync({
            taskId: Array.isArray(newTask) ? newTask[0]?.id : newTask?.id,
            title: sanitizedData.title,
            dueDate: sanitizedData.due_date,
            estimatedHours: sanitizedData.estimated_hours
          });
        }
        
        toast.success('Task created successfully');
      } else {
        await updateTask.mutateAsync({
          id: task.id,
          updates: sanitizedData,
        });
        
        if (sanitizedData.due_date && sanitizedData.due_date !== task.due_date?.split('T')[0]) {
          await addTaskToCalendar.mutateAsync({
            taskId: task.id,
            title: sanitizedData.title,
            dueDate: sanitizedData.due_date,
            estimatedHours: sanitizedData.estimated_hours
          });
        }
        
        toast.success('Task updated successfully');
      }
      
      reset();
      onClose();
    } catch (error) {
      logger.error('Task save failed', { mode, taskId: task?.id });
      toast.error('Unable to save task. Please try again.');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              {mode === 'create' ? <Plus className="h-4 w-4 text-white" /> : <Save className="h-4 w-4 text-white" />}
            </div>
            <span>{mode === 'create' ? 'Create New Task' : 'Edit Task'}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                {...register('title', { required: 'Title is required' })}
                placeholder="Enter task title..."
                className="bg-surface-elevated border-border"
              />
              {errors.title && (
                <p className="text-error text-sm mt-1 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe the task details..."
                className="bg-surface-elevated border-border min-h-[100px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select onValueChange={(value) => setValue('priority', value as any)} defaultValue={watch('priority')}>
                <SelectTrigger className="bg-surface-elevated border-border">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimated_hours">Estimated Hours *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="estimated_hours"
                  type="number"
                  step="0.25"
                  min="0"
                  {...register('estimated_hours', { required: 'Estimated hours is required', min: 0.25 })}
                  className="pl-10 bg-surface-elevated border-border"
                />
              </div>
              {errors.estimated_hours && (
                <p className="text-error text-sm mt-1">{errors.estimated_hours.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                {...register('due_date')}
                className="bg-surface-elevated border-border"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="space-y-4 p-4 bg-surface-elevated rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_billable" className="text-base">Billable Task</Label>
                <p className="text-sm text-muted-foreground">Track time for client billing</p>
              </div>
              <Switch
                id="is_billable"
                checked={isBillable}
                onCheckedChange={(checked) => setValue('is_billable', checked)}
              />
            </div>

            {isBillable && (
              <div>
                <Label htmlFor="hourly_rate">Hourly Rate *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="hourly_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('hourly_rate', { required: isBillable ? 'Hourly rate is required for billable tasks' : false })}
                    className="pl-10 bg-surface border-border"
                  />
                </div>
                {errors.hourly_rate && (
                  <p className="text-error text-sm mt-1">{errors.hourly_rate.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createTask.isPending || updateTask.isPending}
              className="bg-gradient-primary hover:shadow-lg"
            >
              {createTask.isPending || updateTask.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {mode === 'create' ? <Plus className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {mode === 'create' ? 'Create Task' : 'Update Task'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskForm;