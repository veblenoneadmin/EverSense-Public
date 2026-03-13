import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Target,
  Building2,
  Edit,
  MoreHorizontal,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalendarEvents } from '@/hooks/useDatabase';
import EventDialog from './EventDialog';

const CalendarInterface: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  
  const { data: calendarEvents = [] } = useCalendarEvents();

  // Transform calendar events to match the expected format
  const events = calendarEvents.map(event => ({
    id: event.id,
    title: event.title,
    date: new Date(event.start_time),
    time: new Date(event.start_time).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }),
    duration: event.all_day ? 'All Day' : Math.round(
      (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / (1000 * 60)
    ) + 'min',
    type: event.time_block_type,
    project: 'Personal',
    color: event.color,
    originalEvent: event
  }));

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const hasEvents = (date: Date) => {
    return events.some(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      event.date.toDateString() === date.toDateString()
    );
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isSelected = selectedDate?.toDateString() === date.toDateString();
      const eventsForDay = getEventsForDate(date);

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          className={cn(
            "p-3 min-h-[100px] border-r border-b border-border/20 cursor-pointer transition-all duration-200",
            "hover:bg-surface-elevated/80 hover:shadow-lg",
            "bg-card/50 backdrop-blur-sm",
            isToday(date) && "bg-primary/10 border-primary/30 ring-2 ring-primary/20",
            isSelected && "bg-primary/20 ring-2 ring-primary/40",
            "flex flex-col relative group"
          )}
        >
          <span className={cn(
            "text-sm font-semibold mb-2",
            isToday(date) && "text-primary font-bold bg-primary/20 rounded-full w-6 h-6 flex items-center justify-center",
            !isToday(date) && "text-foreground"
          )}>
            {day}
          </span>
          <div className="flex-1 space-y-1">
            {eventsForDay.slice(0, 3).map((event, index) => (
              <EventDialog 
                key={event.id}
                event={event.originalEvent}
                trigger={
                  <div
                    className={cn(
                      "text-xs p-2 rounded-md mb-1 text-white cursor-pointer transition-all duration-200",
                      "hover:shadow-lg hover:scale-105 transform",
                      "flex items-center justify-between group/event backdrop-blur-sm",
                      "border border-white/20"
                    )}
                    style={{ backgroundColor: event.color }}
                  >
                    <div className="flex-1 truncate">
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs opacity-80">{event.time}</div>
                    </div>
                    <Edit className="h-3 w-3 opacity-0 group-hover/event:opacity-100 transition-opacity ml-2" />
                  </div>
                }
              />
            ))}
            {eventsForDay.length > 3 && (
              <div className="text-xs text-muted-foreground bg-surface-elevated/80 rounded px-2 py-1">
                +{eventsForDay.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Calendar</h1>
          <p className="text-muted-foreground mt-2">Schedule and manage your time effectively</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" className="border-border hover:bg-surface-elevated">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="border-border hover:bg-surface-elevated">
            <Settings className="h-4 w-4 mr-2" />
            View
          </Button>
          <EventDialog 
            selectedDate={selectedDate || new Date()} 
            trigger={
              <Button className="bg-gradient-primary hover:bg-primary/90 text-white shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                New Event
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Enhanced Calendar */}
        <div className="lg:col-span-3">
          <Card className="glass border-0 shadow-2xl">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="h-8 w-8 p-0 border-border hover:bg-surface-elevated"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-foreground">
                      {currentDate.toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {events.length} events this month
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="h-8 w-8 p-0 border-border hover:bg-surface-elevated"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant={view === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('month')}
                    className={view === 'month' ? 'bg-primary' : 'border-border'}
                  >
                    Month
                  </Button>
                  <Button
                    variant={view === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('week')}
                    className={view === 'week' ? 'bg-primary' : 'border-border'}
                  >
                    Week
                  </Button>
                  <Button
                    variant={view === 'day' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('day')}
                    className={view === 'day' ? 'bg-primary' : 'border-border'}
                  >
                    Day
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-px border-b border-border/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-3 text-center font-semibold text-muted-foreground bg-surface/50">
                    {day}
                  </div>
                ))}
              </div>

              {/* Enhanced Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-border/20">
                {renderCalendarGrid()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Today's Events */}
          <Card className="glass p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Today's Schedule
            </h3>
            <div className="space-y-3">
              {events.filter(event => isToday(event.date)).map(event => (
                <EventDialog 
                  key={event.id}
                  event={event.originalEvent}
                  trigger={
                    <div className="p-3 bg-surface-elevated rounded-lg cursor-pointer hover:bg-surface-elevated/80 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{event.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.time} • {event.duration}
                          </p>
                          <div className="flex items-center space-x-1 mt-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{event.project}</span>
                          </div>
                        </div>
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: event.color }}
                        ></div>
                      </div>
                    </div>
                  }
                />
              ))}
              {events.filter(event => isToday(event.date)).length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No events scheduled for today
                </p>
              )}
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="glass p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2" />
              This Week
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Events</span>
                <span className="font-semibold">{events.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Focus Hours</span>
                <span className="font-semibold text-success">12h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Meetings</span>
                <span className="font-semibold text-primary">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Free Time</span>
                <span className="font-semibold text-warning">4h</span>
              </div>
            </div>
          </Card>

          {/* Mini Calendar Navigation */}
          <Card className="glass p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Navigation</h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => setCurrentDate(new Date())}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Today
              </Button>
              <EventDialog 
                selectedDate={selectedDate || new Date()}
                trigger={
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Quick Add
                  </Button>
                }
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
              >
                <Target className="h-4 w-4 mr-2" />
                This Week
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
              >
                <Clock className="h-4 w-4 mr-2" />
                Upcoming
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalendarInterface;