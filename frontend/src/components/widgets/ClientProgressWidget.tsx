import { useState, useEffect } from 'react';
import { useSession } from '../../lib/auth-client';
import { useApiClient } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { 
  TrendingUp,
  Settings,
  Calendar,
  Target,
  Award
} from 'lucide-react';

interface ClientProgressWidgetProps {
  config?: {
    title?: string;
    showDetails?: boolean;
  };
  onConfigure?: () => void;
}

interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalHours: number;
  thisWeekHours: number;
  completionRate: number;
  projectProgress: Array<{
    id: string;
    name: string;
    progress: number;
    status: string;
    dueDate?: string;
    completedTasks: number;
    totalTasks: number;
  }>;
}

export function ClientProgressWidget({ config = {}, onConfigure }: ClientProgressWidgetProps) {
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const [stats, setStats] = useState<ProjectStats>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalHours: 0,
    thisWeekHours: 0,
    completionRate: 0,
    projectProgress: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    title = "Your Progress",
    showDetails = true
  } = config;

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadClientStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch tasks for this user
        const tasksResponse = await apiClient.fetch(`/api/tasks/recent?userId=${session.user.id}&limit=100`);
        
        // Fetch time entries
        const timeResponse = await apiClient.fetch(`/api/timers/recent?userId=${session.user.id}&limit=100`);

        if (tasksResponse.success) {
          const tasks = tasksResponse.tasks || [];
          const completed = tasks.filter((t: any) => t.status === 'completed').length;
          const totalHours = tasks.reduce((sum: number, t: any) => sum + (t.actualHours || 0), 0);
          
          // Calculate this week's hours from time entries
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const thisWeekEntries = timeResponse.entries?.filter((entry: any) => 
            new Date(entry.startTime) >= oneWeekAgo
          ) || [];
          const thisWeekHours = thisWeekEntries.reduce((sum: number, entry: any) => 
            sum + (entry.duration || 0), 0) / 3600;

          // Group tasks by project (if project field exists)
          const projectGroups = tasks.reduce((acc: any, task: any) => {
            const projectName = task.project || 'General';
            if (!acc[projectName]) {
              acc[projectName] = { tasks: [], completed: 0, total: 0 };
            }
            acc[projectName].tasks.push(task);
            acc[projectName].total++;
            if (task.status === 'completed') {
              acc[projectName].completed++;
            }
            return acc;
          }, {});

          const projectProgress = Object.entries(projectGroups).map(([name, data]: [string, any]) => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
            status: data.completed === data.total ? 'completed' : 'active',
            completedTasks: data.completed,
            totalTasks: data.total,
            dueDate: undefined
          }));

          setStats({
            totalProjects: projectProgress.length,
            activeProjects: projectProgress.filter(p => p.status === 'active').length,
            completedProjects: projectProgress.filter(p => p.status === 'completed').length,
            totalTasks: tasks.length,
            completedTasks: completed,
            totalHours: Math.round(totalHours * 10) / 10,
            thisWeekHours: Math.round(thisWeekHours * 10) / 10,
            completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
            projectProgress: projectProgress.slice(0, 5) // Show top 5 projects
          });
        }

      } catch (err: any) {
        console.error('Error loading client stats:', err);
        setError(err.message || 'Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    loadClientStats();
  }, [session?.user?.id, apiClient]);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>{title}</span>
            </div>
            {onConfigure && (
              <Button variant="ghost" size="sm" onClick={onConfigure}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <TrendingUp className="h-6 w-6 animate-pulse text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>{title}</span>
            </div>
            {onConfigure && (
              <Button variant="ghost" size="sm" onClick={onConfigure}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <Badge variant="outline" className="bg-primary/10">
            {stats.completionRate}% Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {stats.completedTasks} / {stats.totalTasks} tasks
              </span>
            </div>
            <Progress value={stats.completionRate} className="h-3" />
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <div className="text-2xl font-bold text-primary">{stats.totalHours}h</div>
              <div className="text-xs text-muted-foreground">Total Time</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/20">
              <div className="text-2xl font-bold text-green-600">{stats.thisWeekHours}h</div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </div>
          </div>

          {/* Project Progress */}
          {showDetails && stats.projectProgress.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">Project Progress</span>
              </div>
              {stats.projectProgress.map((project) => (
                <div key={project.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{project.name}</span>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={project.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {project.completedTasks}/{project.totalTasks}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="pt-2 border-t">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="flex items-center space-x-1">
                <Target className="h-3 w-3" />
                <span>View Details</span>
              </Button>
              <Button variant="outline" size="sm" className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Schedule</span>
              </Button>
            </div>
          </div>

          {stats.totalTasks === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No projects yet</p>
              <p className="text-xs">Your progress will appear here once tasks are assigned</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}