import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Clock, 
  DollarSign, 
  Activity,
  Timer,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Pause,
  BarChart3,
  Download,
  UserCheck,
  Zap
} from 'lucide-react';
import { 
  useUserPresence, 
  useAllUsers,
  useTasks,
  useProjects,
  useClientRequests,
  useTimeLogs 
} from '@/hooks/useDatabase';

const AdminCommandCenter: React.FC = () => {
  const [selectedView, setSelectedView] = useState('overview');
  const [costMode, setCostMode] = useState<'billable' | 'cost'>('billable');
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: presence } = useUserPresence();
  const { data: allUsers } = useAllUsers();
  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();
  const { data: requests } = useClientRequests();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const onlineUsers = presence?.filter(p => p.is_online) || [];
  const activeTimers = presence?.filter(p => p.timer_status === 'running') || [];
  
  const todayTasks = tasks?.filter(task => {
    const today = new Date().toDateString();
    return new Date(task.created_at).toDateString() === today;
  }) || [];

  const completedToday = todayTasks.filter(task => task.status === 'completed');
  
  const urgentRequests = requests?.filter(request => 
    request.priority === 'urgent' && request.status === 'submitted'
  ) || [];

  const calculateRunningCost = () => {
    return activeTimers.reduce((total, userPresence) => {
      const profile = userPresence.profiles;
      if (!profile) return total;
      
      const hourlyRate = costMode === 'billable' 
        ? (profile.hourly_rate || 75) 
        : (profile.cost_rate || 50);
      
      const secondsRunning = userPresence.timer_start 
        ? Math.floor((Date.now() - new Date(userPresence.timer_start).getTime()) / 1000)
        : 0;
      
      return total + (hourlyRate / 3600 * secondsRunning);
    }, 0);
  };

  const getTotalBillableHours = () => {
    // This would need to be calculated from time_logs for today
    return activeTimers.reduce((total, userPresence) => {
      const hoursRunning = userPresence.timer_start 
        ? (Date.now() - new Date(userPresence.timer_start).getTime()) / (1000 * 60 * 60)
        : 0;
      return total + hoursRunning;
    }, 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-success';
      case 'busy': return 'text-warning';
      case 'away': return 'text-info';
      default: return 'text-muted-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Admin Command Center</h1>
            <p className="text-muted-foreground mt-2">
              Live monitoring and control • {currentTime.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant={costMode === 'billable' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCostMode('billable')}
            >
              Billable Rates
            </Button>
            <Button
              variant={costMode === 'cost' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCostMode('cost')}
            >
              Cost Rates
            </Button>
          </div>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-success/20">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">People Online</p>
                  <p className="text-2xl font-bold text-foreground">{onlineUsers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-timer-active/20">
                  <Timer className="h-6 w-6 text-timer-active" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Timers</p>
                  <p className="text-2xl font-bold text-foreground">{activeTimers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-primary/20">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Hours</p>
                  <p className="text-2xl font-bold text-foreground">
                    {getTotalBillableHours().toFixed(1)}h
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-warning/20">
                  <DollarSign className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Running Cost</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(calculateRunningCost())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Wall of User Cards */}
        <Card className="glass mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Live User Activity</span>
              </div>
              <Badge variant="outline" className="text-sm">
                Real-time updates
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {onlineUsers.map((userPresence) => {
                const user = userPresence.profiles;
                if (!user) return null;
                
                const isActive = userPresence.timer_status === 'running';
                const runningTime = userPresence.timer_start 
                  ? Math.floor((Date.now() - new Date(userPresence.timer_start).getTime()) / 1000)
                  : 0;
                
                const hourlyRate = costMode === 'billable' 
                  ? (user.hourly_rate || 75) 
                  : (user.cost_rate || 50);
                
                const currentCost = isActive ? (hourlyRate / 3600 * runningTime) : 0;

                return (
                  <div 
                    key={userPresence.user_id} 
                    className={`p-4 border rounded-lg bg-surface-elevated/50 transition-all ${
                      isActive ? 'timer-active' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                          userPresence.current_status === 'online' ? 'bg-success' :
                          userPresence.current_status === 'busy' ? 'bg-warning' :
                          userPresence.current_status === 'away' ? 'bg-info' : 'bg-muted'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">
                          {user.first_name} {user.last_name}
                        </h4>
                        <p className={`text-xs capitalize ${getStatusColor(userPresence.current_status)}`}>
                          {userPresence.current_status}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {user.role}
                        </Badge>
                      </div>
                    </div>

                    {isActive && userPresence.current_task_id && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-foreground">
                          Working on task
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center space-x-1">
                            <Timer className="h-3 w-3 text-timer-active" />
                            <span className="text-xs font-mono text-timer-active">
                              {formatTime(runningTime)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatCurrency(currentCost)}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Rate: {formatCurrency(hourlyRate)}/hr</span>
                      <div className="flex items-center space-x-1">
                        {isActive ? (
                          <Zap className="h-3 w-3 text-timer-active" />
                        ) : (
                          <Pause className="h-3 w-3" />
                        )}
                        <span>{isActive ? 'Working' : 'Idle'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {onlineUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No users currently online</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Tabs */}
        <Tabs value={selectedView} onValueChange={setSelectedView}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Today's Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tasks Completed</span>
                      <Badge variant="outline" className="bg-success/20 text-success">
                        {completedToday.length} / {todayTasks.length}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Projects</span>
                      <Badge variant="outline">
                        {projects?.filter(p => p.status === 'active').length || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending Requests</span>
                      <Badge variant="outline">
                        {requests?.filter(r => r.status === 'submitted').length || 0}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Alerts & Warnings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {urgentRequests.map((request) => (
                      <div key={request.id} className="p-3 bg-error/10 border border-error/20 rounded">
                        <h4 className="text-sm font-medium text-foreground">
                          Urgent: {request.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {request.request_number}
                        </p>
                      </div>
                    ))}
                    
                    {urgentRequests.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50 text-success" />
                        <p className="text-sm">No urgent issues</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Project Dashboard</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Project management dashboard coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Client Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Client management dashboard coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserCheck className="h-5 w-5" />
                  <span>Pending Approvals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Approval workflow coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Reports & Analytics</span>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Advanced reporting dashboard coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCommandCenter;