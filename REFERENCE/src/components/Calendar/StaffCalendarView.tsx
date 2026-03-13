import React from 'react';
import { useCalendarEvents, useAllUsers } from '@/hooks/useDatabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Users } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

const StaffCalendarView: React.FC = () => {
  const { data: allUsers } = useAllUsers();
  const { data: allEvents } = useCalendarEvents(); // This will need to be modified to get all events for admin

  const currentWeek = eachDayOfInterval({
    start: startOfWeek(new Date()),
    end: endOfWeek(new Date())
  });

  const getEventsForUserAndDay = (userId: string, day: Date) => {
    return allEvents?.filter(event => {
      const eventDate = parseISO(event.start_time);
      return event.user_id === userId && 
             format(eventDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
    }) || [];
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'focused_work': return 'bg-blue-100 text-blue-800';
      case 'meeting': return 'bg-green-100 text-green-800';
      case 'break': return 'bg-gray-100 text-gray-800';
      default: return 'bg-purple-100 text-purple-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Team Calendar</h2>
          <p className="text-muted-foreground">Overview of all staff schedules</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Week of {format(currentWeek[0], 'MMM d, yyyy')}</span>
        </div>
      </div>

      <div className="grid gap-6">
        {allUsers?.map(user => (
          <Card key={user.user_id} className="glass">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {user.first_name} {user.last_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{user.role}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {currentWeek.map(day => {
                  const dayEvents = getEventsForUserAndDay(user.user_id, day);
                  return (
                    <div key={day.toISOString()} className="space-y-2">
                      <div className="text-center">
                        <p className="text-xs font-medium text-muted-foreground">
                          {format(day, 'EEE')}
                        </p>
                        <p className="text-sm font-semibold">
                          {format(day, 'd')}
                        </p>
                      </div>
                      <div className="space-y-1 min-h-[100px]">
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className="text-xs p-2 rounded bg-surface-elevated border border-border"
                          >
                            <div className="flex items-center space-x-1 mb-1">
                              <Clock className="h-3 w-3" />
                              <span className="font-medium">
                                {format(parseISO(event.start_time), 'HH:mm')}
                              </span>
                            </div>
                            <p className="truncate" title={event.title}>
                              {event.title}
                            </p>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs mt-1 ${getEventTypeColor(event.time_block_type)}`}
                            >
                              {event.time_block_type?.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!allUsers?.length && (
        <Card className="glass p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Staff Found</h3>
          <p className="text-muted-foreground">
            No team members are currently registered in the system.
          </p>
        </Card>
      )}
    </div>
  );
};

export default StaffCalendarView;