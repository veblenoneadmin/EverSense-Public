import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTimeLogs, useDeleteTimeLog } from '@/hooks/useDatabase';
import TimeLogForm from '@/components/Timesheets/TimeLogForm';
import { toast } from 'sonner';
import { 
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Download,
  Filter,
  Play,
  Pause,
  Square,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

const TimesheetsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();

  const { data: timeLogs = [], isLoading } = useTimeLogs();
  const deleteTimeLog = useDeleteTimeLog();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/20 text-warning';
      case 'approved': return 'bg-success/20 text-success';
      case 'rejected': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const totalMinutes = timeLogs.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  const totalHours = totalMinutes / 60;
  const billableHours = timeLogs.filter(entry => entry.is_billable).reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) / 60;
  const totalEarnings = timeLogs.reduce((sum, entry) => {
    if (entry.is_billable && entry.hourly_rate && entry.duration_minutes) {
      return sum + ((entry.duration_minutes / 60) * entry.hourly_rate);
    }
    return sum;
  }, 0);

  const handleDeleteTimeLog = async (timeLog: any) => {
    try {
      await deleteTimeLog.mutateAsync(timeLog.id);
    } catch (error) {
      console.error('Error deleting time log:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Timesheets</h1>
          <p className="text-muted-foreground mt-2">Track and manage your time entries</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => toast.success("Timesheet export would be generated here")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            className="bg-gradient-primary hover:shadow-lg"
            onClick={() => navigate('/timer')}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-3xl font-bold">{totalHours}h</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billable Hours</p>
                <p className="text-3xl font-bold text-success">{billableHours}h</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-3xl font-bold text-success">${totalEarnings.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Rate</p>
                <p className="text-3xl font-bold">${Math.round(totalEarnings / billableHours)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects or tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </Card>

      {/* Timesheet Entries */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeLogs.map((entry) => (
              <div key={entry.id} className="p-4 bg-surface-elevated rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(entry.timestamp || entry.created_at), 'MMM dd, yyyy')}
                    </div>
                    {entry.is_billable && (
                      <Badge className="bg-success/20 text-success" variant="outline">
                        Billable
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-semibold">{Math.round((entry.duration_minutes || 0) / 60 * 100) / 100}h</p>
                  </div>
                  {entry.location && (
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-semibold">{entry.location}</p>
                    </div>
                  )}
                  {entry.hourly_rate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Rate</p>
                      <p className="font-semibold">${entry.hourly_rate}/h</p>
                    </div>
                  )}
                </div>

                {entry.notes && (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{entry.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{Math.round((entry.duration_minutes || 0) / 60 * 100) / 100} hours</span>
                    </div>
                    {entry.is_billable && entry.hourly_rate && (
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4 text-success" />
                        <span className="text-sm text-success">
                          ${((entry.duration_minutes || 0) / 60 * entry.hourly_rate).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <TimeLogForm timeLog={entry} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this time log entry.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteTimeLog(entry)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {timeLogs.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Time Entries</h3>
              <p className="text-muted-foreground mb-6">Start tracking your time to see entries here.</p>
              <Button 
                className="bg-gradient-primary hover:shadow-lg"
                onClick={() => navigate('/timer')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Time Entry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimesheetsPage;