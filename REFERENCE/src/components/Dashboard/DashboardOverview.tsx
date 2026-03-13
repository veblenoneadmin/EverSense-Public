import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks, useUserAnalytics } from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { 
  Clock, 
  CheckSquare, 
  DollarSign, 
  TrendingUp,
  Timer,
  Target,
  Users,
  Calendar,
  Brain,
  Zap,
  Building2
} from 'lucide-react';

const DashboardOverview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: analytics } = useUserAnalytics();

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
  const todaysTasks = tasks.filter(task => {
    const today = new Date().toDateString();
    const taskDate = new Date(task.created_at).toDateString();
    return today === taskDate;
  });

  const userName = user?.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || 'User';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
  const stats = [
    {
      title: "Hours Today",
      value: analytics?.total_work_hours?.toFixed(1) || "0.0",
      change: "+2.1 vs yesterday",
      icon: Clock,
      color: "success",
      bgGradient: "bg-gradient-success"
    },
    {
      title: "Tasks Completed",
      value: completedTasks.length.toString(),
      change: `+${completedTasks.length} vs yesterday`, 
      icon: CheckSquare,
      color: "primary",
      bgGradient: "bg-gradient-primary"
    },
    {
      title: "Total Tasks",
      value: tasks.length.toString(),
      change: `${inProgressTasks.length} in progress`,
      icon: DollarSign,
      color: "warning",
      bgGradient: "bg-gradient-warning"
    },
    {
      title: "Productivity Score",
      value: `${Math.round(analytics?.productivity_score || 0)}%`,
      change: "+5% this week",
      icon: TrendingUp,
      color: "info",
      bgGradient: "bg-gradient-primary"
    }
  ];

  const recentActivity = [
    {
      id: 1,
      action: "Completed task: Website Redesign Review",
      time: "2 minutes ago",
      duration: "45 min",
      project: "Client Portal",
      billable: true
    },
    {
      id: 2,
      action: "Started break",
      time: "47 minutes ago",
      duration: "15 min",
      project: null,
      billable: false
    },
    {
      id: 3,
      action: "Processed brain dump: Daily Planning",
      time: "1 hour ago",
      duration: "8 min",
      project: "Personal",
      billable: false
    },
    {
      id: 4,
      action: "Completed task: API Integration Testing",
      time: "2 hours ago",
      duration: "1h 23min",
      project: "E-commerce Platform",
      billable: true
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Good morning, {displayName}! 👋</h1>
          <p className="text-muted-foreground mt-2">Ready to tackle today's challenges? You have {todaysTasks.length} tasks scheduled.</p>
        </div>
        <Card className="glass p-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center animate-pulse-glow">
              <Timer className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Currently Working On</p>
              <p className="text-lg font-bold text-success">UX Research Analysis</p>
              <p className="text-xs text-muted-foreground">Running for 23 minutes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="glass p-6 hover:shadow-elevation transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
                  <p className="text-xs text-success mt-1">{stat.change}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl ${stat.bgGradient} flex items-center justify-center`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Tasks */}
        <div className="lg:col-span-2">
          <Card className="glass p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Today's Priority Tasks</h2>
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">8 scheduled</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {tasksLoading ? (
                <div className="text-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center p-8">
                  <p className="text-muted-foreground">No tasks yet. Create your first task in the Brain Dump or Tasks section!</p>
                </div>
              ) : (
                tasks.slice(0, 3).map((task, index) => (
                  <div 
                    key={task.id} 
                    className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                      task.status === 'completed'
                        ? 'bg-success/10 border-success/20' 
                        : 'bg-surface-elevated border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            task.priority === 'high' ? 'bg-error' :
                            task.priority === 'medium' ? 'bg-warning' :
                            'bg-primary'
                          }`} />
                          <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h3>
                          {task.is_billable && <DollarSign className="h-4 w-4 text-success" />}
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <Building2 className="h-4 w-4" />
                            <span>{task.client_id || 'Internal'}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{task.estimated_hours || 0}h estimated</span>
                          </span>
                        </div>
                      </div>
                      {task.status === 'completed' && <CheckSquare className="h-5 w-5 text-success" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="glass p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/brain-dump')}
                className="w-full p-3 rounded-lg bg-gradient-primary text-white font-medium hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Brain className="h-5 w-5" />
                <span>Start Brain Dump</span>
              </button>
              <button 
                onClick={() => navigate('/timer')}
                className="w-full p-3 rounded-lg bg-surface-elevated hover:bg-surface border border-border font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Timer className="h-5 w-5" />
                <span>Start Timer</span>
              </button>
              <button 
                onClick={() => navigate('/calendar')}
                className="w-full p-3 rounded-lg bg-surface-elevated hover:bg-surface border border-border font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Calendar className="h-5 w-5" />
                <span>Schedule Tasks</span>
              </button>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="glass p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-surface-elevated">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.billable ? 'bg-success' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    {activity.project && (
                      <p className="text-xs text-muted-foreground mt-1">{activity.project}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                      {activity.duration && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{activity.duration}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;