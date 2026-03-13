import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Clock,
  DollarSign,
  CheckCircle2,
  Clock4,
  AlertCircle,
  Play,
  Plus,
  Calendar,
  MessageSquare,
  FileText,
  TrendingUp,
  User
} from 'lucide-react';
import { 
  useTasks,
  useProjects,
  useCreateClientRequest,
  useClientRequests 
} from '@/hooks/useDatabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ClientPortal: React.FC = () => {
  const { user } = useAuth();
  const [requestForm, setRequestForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    department: '',
    files: []
  });

  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();
  const { data: requests } = useClientRequests();
  const createRequest = useCreateClientRequest();

  // Filter data for client visibility
  const visibleTasks = tasks?.filter(task => task.client_visible) || [];

  const clientProjects = projects?.filter(project => 
    project.client_id // Filter by client's projects
  ) || [];

  const myRequests = requests?.filter(request => 
    request.user_id === user?.id
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-success';
      case 'in_progress': return 'text-info';
      case 'in_review': return 'text-warning';
      case 'not_started': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-error text-error';
      case 'high': return 'border-warning text-warning';
      case 'medium': return 'border-info text-info';
      case 'low': return 'border-success text-success';
      default: return 'border-muted text-muted-foreground';
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestForm.title.trim() || !requestForm.description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('user_id', user?.id)
        .single();

      await createRequest.mutateAsync({
        ...requestForm,
        user_id: user?.id,
        client_id: userProfile?.client_id,
      });
      
      setRequestForm({
        title: '',
        description: '',
        priority: 'medium',
        department: '',
        files: []
      });
      
      toast({
        title: "Request Submitted",
        description: "Your request has been submitted successfully. You'll receive a confirmation email shortly.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Mock retainer data - this would come from retainer_blocks table
  const mockRetainer = {
    hoursPurchased: 40,
    hoursUsed: 24.5,
    hourlyRate: 150,
    outOfScopeCost: 2400
  };

  const retainerPercentage = (mockRetainer.hoursUsed / mockRetainer.hoursPurchased) * 100;
  const remainingHours = mockRetainer.hoursPurchased - mockRetainer.hoursUsed;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header with Retainer Meters */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Client Portal</h1>
              <p className="text-muted-foreground mt-2">
                Track your projects and submit new requests
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>

          {/* Retainer Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">Retainer Block</span>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {retainerPercentage.toFixed(1)}% used
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(retainerPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{mockRetainer.hoursUsed}h used</span>
                    <span>{remainingHours}h remaining</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Of {mockRetainer.hoursPurchased} hours purchased
                  </p>
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
                    <p className="text-sm text-muted-foreground">Out of Scope</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${mockRetainer.outOfScopeCost.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      At ${mockRetainer.hourlyRate}/hour
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-success/20">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${mockRetainer.hourlyRate}
                    </p>
                    <p className="text-xs text-muted-foreground">per hour</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="requests">My Requests</TabsTrigger>
            <TabsTrigger value="submit">Submit Request</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Project Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {clientProjects.slice(0, 3).map((project) => (
                      <div key={project.id} className="p-4 bg-surface-elevated/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-foreground">{project.name}</h4>
                          <Badge 
                            variant="outline" 
                            className={getStatusColor(project.status)}
                          >
                            {project.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {project.description}
                        </p>
                        {project.end_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(project.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                    
                    {clientProjects.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No active projects</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock4 className="h-5 w-5" />
                    <span>Recent Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {visibleTasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="p-3 bg-surface-elevated/50 rounded">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-foreground">
                              {task.title}
                            </h5>
                            <Badge 
                              variant="outline" 
                              className={getStatusColor(task.status)}
                            >
                              {task.status?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Updated {new Date(task.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      
                      {visibleTasks.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock4 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No recent activity</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Your Tasks</span>
                  <Badge variant="outline">{visibleTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {visibleTasks.map((task) => (
                      <div key={task.id} className="p-4 border border-border rounded-lg bg-surface-elevated/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-foreground">{task.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline" 
                              className={getStatusColor(task.status)}
                            >
                              {task.status?.replace('_', ' ')}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={getPriorityColor(task.priority)}
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Created: {new Date(task.created_at).toLocaleDateString()}
                          </span>
                          {task.due_date && (
                            <span>
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {visibleTasks.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No tasks to display</p>
                        <p className="text-sm mt-2">Tasks will appear here once work begins on your projects</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>My Requests</span>
                  <Badge variant="outline">{myRequests.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {myRequests.map((request) => (
                      <div key={request.id} className="p-4 border border-border rounded-lg bg-surface-elevated/50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-foreground">{request.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {request.request_number}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={getStatusColor(request.status)}
                            >
                              {request.status?.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {request.description}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Submitted: {new Date(request.created_at).toLocaleDateString()}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={getPriorityColor(request.priority)}
                          >
                            {request.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    {myRequests.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No requests submitted yet</p>
                        <p className="text-sm mt-2">Use the "Submit Request" tab to create your first request</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submit">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Submit New Request</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitRequest} className="space-y-6 max-w-2xl">
                  <div className="space-y-2">
                    <Label htmlFor="title">Request Title *</Label>
                    <Input
                      id="title"
                      value={requestForm.title}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief description of what you need"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={requestForm.description}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed description of your request, including any specific requirements or deadlines"
                      className="min-h-24"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <select
                        id="priority"
                        value={requestForm.priority}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full p-2 border border-border rounded-md bg-background"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <select
                        id="department"
                        value={requestForm.department}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full p-2 border border-border rounded-md bg-background"
                      >
                        <option value="">Select Department</option>
                        <option value="development">Development</option>
                        <option value="design">Design</option>
                        <option value="marketing">Marketing</option>
                        <option value="support">Support</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={createRequest.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {createRequest.isPending ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Upcoming Meetings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Calendar integration coming soon</p>
                  <p className="text-sm mt-2">You'll see your scheduled meetings and deadlines here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientPortal;