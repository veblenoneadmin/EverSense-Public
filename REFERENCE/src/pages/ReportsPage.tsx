import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  DollarSign,
  Clock,
  Users,
  Target,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

const ReportsPage: React.FC = () => {
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date>();
  const [selectedDateTo, setSelectedDateTo] = useState<Date>();
  const [selectedReport, setSelectedReport] = useState('overview');

  // Mock report data
  const reportData = {
    overview: {
      totalRevenue: 234500,
      totalHours: 1850,
      activeProjects: 12,
      completedTasks: 245,
      revenueChange: 15.3,
      hoursChange: -2.1,
      projectsChange: 8.7,
      tasksChange: 12.4
    },
    timeTracking: {
      billableHours: 1420,
      nonBillableHours: 430,
      averageHourlyRate: 125,
      mostProductiveDay: 'Tuesday',
      totalBreakTime: 180
    },
    projectPerformance: [
      { name: 'Website Redesign', revenue: 85000, hours: 680, completion: 95, client: 'TechCorp Inc.' },
      { name: 'Mobile App', revenue: 65000, hours: 520, completion: 60, client: 'StartupXYZ' },
      { name: 'E-commerce Platform', revenue: 84500, hours: 650, completion: 100, client: 'RetailCorp' }
    ],
    clientAnalytics: [
      { name: 'TechCorp Inc.', revenue: 125000, hours: 980, projects: 4, satisfaction: 4.8 },
      { name: 'StartupXYZ', revenue: 75000, hours: 600, projects: 2, satisfaction: 4.6 },
      { name: 'RetailCorp', revenue: 95000, hours: 720, projects: 3, satisfaction: 4.9 }
    ]
  };

  const reportTypes = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'time', label: 'Time Tracking', icon: <Clock className="h-4 w-4" /> },
    { id: 'projects', label: 'Projects', icon: <Target className="h-4 w-4" /> },
    { id: 'clients', label: 'Clients', icon: <Users className="h-4 w-4" /> },
    { id: 'financial', label: 'Financial', icon: <DollarSign className="h-4 w-4" /> }
  ];

  const renderOverviewReport = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold">${reportData.overview.totalRevenue.toLocaleString()}</p>
                <div className="flex items-center space-x-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">+{reportData.overview.revenueChange}%</span>
                </div>
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
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-3xl font-bold">{reportData.overview.totalHours}h</p>
                <div className="flex items-center space-x-1 mt-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{reportData.overview.hoursChange}%</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-3xl font-bold">{reportData.overview.activeProjects}</p>
                <div className="flex items-center space-x-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">+{reportData.overview.projectsChange}%</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Tasks</p>
                <p className="text-3xl font-bold">{reportData.overview.completedTasks}</p>
                <div className="flex items-center space-x-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">+{reportData.overview.tasksChange}%</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Performance */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Project Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reportData.projectPerformance.map((project, index) => (
              <div key={index} className="p-4 bg-surface-elevated rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">{project.client}</p>
                  </div>
                  <Badge 
                    className={project.completion === 100 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'} 
                    variant="outline"
                  >
                    {project.completion}% Complete
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Revenue: </span>
                    <span className="font-semibold">${project.revenue.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hours: </span>
                    <span className="font-semibold">{project.hours}h</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate: </span>
                    <span className="font-semibold">${Math.round(project.revenue / project.hours)}/hr</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTimeTrackingReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billable Hours</p>
                <p className="text-3xl font-bold text-success">{reportData.timeTracking.billableHours}h</p>
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
                <p className="text-sm text-muted-foreground">Non-Billable Hours</p>
                <p className="text-3xl font-bold text-warning">{reportData.timeTracking.nonBillableHours}h</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Hourly Rate</p>
                <p className="text-3xl font-bold">${reportData.timeTracking.averageHourlyRate}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg">
              <span>Most Productive Day</span>
              <Badge className="bg-success/20 text-success" variant="outline">
                {reportData.timeTracking.mostProductiveDay}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg">
              <span>Total Break Time</span>
              <span className="font-semibold">{reportData.timeTracking.totalBreakTime} minutes</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (selectedReport) {
      case 'overview':
        return renderOverviewReport();
      case 'time':
        return renderTimeTrackingReport();
      case 'projects':
      case 'clients':
      case 'financial':
        return (
          <Card className="glass p-12 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Report Coming Soon</h3>
            <p className="text-muted-foreground">This report type is currently being developed.</p>
          </Card>
        );
      default:
        return renderOverviewReport();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Reports</h1>
          <p className="text-muted-foreground mt-2">Analyze your business performance and insights</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {reportTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedReport === type.id ? 'default' : 'outline'}
                onClick={() => setSelectedReport(type.id)}
                size="sm"
              >
                {type.icon}
                <span className="ml-2">{type.label}</span>
              </Button>
            ))}
          </div>
          
          <div className="flex gap-2 ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {selectedDateFrom ? format(selectedDateFrom, 'MMM dd') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDateFrom}
                  onSelect={setSelectedDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {selectedDateTo ? format(selectedDateTo, 'MMM dd') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDateTo}
                  onSelect={setSelectedDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      {renderContent()}
    </div>
  );
};

export default ReportsPage;