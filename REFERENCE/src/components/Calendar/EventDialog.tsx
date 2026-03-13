import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Plus } from 'lucide-react';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '@/hooks/useDatabase';

interface EventDialogProps {
  trigger?: React.ReactNode;
  event?: any;
  selectedDate?: Date;
  onClose?: () => void;
}

const EventDialog: React.FC<EventDialogProps> = ({ 
  trigger, 
  event, 
  selectedDate,
  onClose 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: event?.title || '',
    start_time: event?.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : 
                selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9, 0).toISOString().slice(0, 16) : 
                new Date().toISOString().slice(0, 16),
    end_time: event?.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : 
              selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 10, 0).toISOString().slice(0, 16) :
              new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    all_day: event?.all_day || false,
    time_block_type: event?.time_block_type || 'focused_work',
    color: event?.color || '#3b82f6',
    recurrence_rule: event?.recurrence_rule || '',
    is_flexible: event?.is_flexible !== undefined ? event.is_flexible : true,
  });

  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const eventData = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
      };

      if (event) {
        await updateEvent.mutateAsync({ id: event.id, updates: eventData });
      } else {
        await createEvent.mutateAsync(eventData);
      }
      
      setIsOpen(false);
      onClose?.();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const timeBlockTypes = [
    { value: 'focused_work', label: 'Focused Work' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'break', label: 'Break' },
    { value: 'admin', label: 'Administrative' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-primary hover:shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            {event ? 'Edit Event' : 'Create Event'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter event title"
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.all_day}
              onCheckedChange={(checked) => setFormData({ ...formData, all_day: checked })}
            />
            <Label>All Day Event</Label>
          </div>

          {!formData.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select 
              value={formData.time_block_type} 
              onValueChange={(value) => setFormData({ ...formData, time_block_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeBlockTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10"
              />
              <span className="text-sm text-muted-foreground">{formData.color}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_flexible}
              onCheckedChange={(checked) => setFormData({ ...formData, is_flexible: checked })}
            />
            <Label>Flexible Timing</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-gradient-primary"
              disabled={createEvent.isPending || updateEvent.isPending}
            >
              {event ? 'Update' : 'Create'} Event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventDialog;