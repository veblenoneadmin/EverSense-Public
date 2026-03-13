import { widgetService } from './WidgetService';
import type { Widget } from './WidgetInterface';

// Import widget components
import { StatWidget } from '../../components/widgets/StatWidget';
import { ActiveTimersWidget } from '../../components/widgets/ActiveTimersWidget';
import { RecentTasksWidget } from '../../components/widgets/RecentTasksWidget';
import { TimerWidget } from '../../components/widgets/TimerWidget';
import { ClientProgressWidget } from '../../components/widgets/ClientProgressWidget';
import { ClientNotificationsWidget } from '../../components/widgets/ClientNotificationsWidget';

// Define all available widgets
const widgets: Widget[] = [
  // Statistics Widgets
  {
    id: 'tasks-completed-today',
    name: 'Tasks Completed Today',
    description: 'Number of tasks completed today',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'Completed Today',
      size: 'small',
      color: 'green',
      icon: 'check-circle',
      refreshInterval: 300 // 5 minutes
    },
    isConfigurable: true,
    permissions: ['view_tasks']
  },
  {
    id: 'total-time-today',
    name: 'Total Time Today',
    description: 'Total time tracked today',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'Time Today',
      size: 'small',
      color: 'blue',
      icon: 'clock',
      refreshInterval: 60 // 1 minute
    },
    isConfigurable: true,
    permissions: ['view_time_logs']
  },
  {
    id: 'active-projects',
    name: 'Active Projects',
    description: 'Number of active projects',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'Active Projects',
      size: 'small',
      color: 'purple',
      icon: 'folder',
      refreshInterval: 1800 // 30 minutes
    },
    isConfigurable: true,
    permissions: ['view_projects']
  },
  {
    id: 'team-members',
    name: 'Team Members',
    description: 'Number of team members in organization',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'Team Members',
      size: 'small',
      color: 'orange',
      icon: 'users',
      refreshInterval: 3600 // 1 hour
    },
    isConfigurable: true,
    permissions: ['view_members']
  },
  
  // Time Tracking Widgets
  {
    id: 'active-timers',
    name: 'Active Timers',
    description: 'Currently running time trackers',
    category: 'overview',
    component: ActiveTimersWidget as any,
    defaultConfig: {
      title: 'Active Timers',
      size: 'medium',
      color: 'blue',
      icon: 'timer',
      refreshInterval: 5 // 5 seconds for real-time updates
    },
    isConfigurable: true,
    permissions: ['view_time_logs', 'manage_time_logs']
  },
  
  // Task Management Widgets
  {
    id: 'recent-tasks',
    name: 'Recent Tasks',
    description: 'Recently worked on or due tasks',
    category: 'lists',
    component: RecentTasksWidget as any,
    defaultConfig: {
      title: 'Recent Tasks',
      size: 'medium',
      color: 'indigo',
      icon: 'list',
      refreshInterval: 300 // 5 minutes
    },
    isConfigurable: true,
    permissions: ['view_tasks']
  },
  
  // Weekly Overview
  {
    id: 'weekly-hours',
    name: 'Weekly Hours',
    description: 'Total hours tracked this week',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'This Week',
      size: 'small',
      color: 'teal',
      icon: 'calendar',
      refreshInterval: 1800 // 30 minutes
    },
    isConfigurable: true,
    permissions: ['view_time_logs']
  },
  
  // Productivity Stats
  {
    id: 'productivity-score',
    name: 'Productivity Score',
    description: 'Weekly productivity score based on completed tasks',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'Productivity',
      size: 'small',
      color: 'pink',
      icon: 'trending-up',
      refreshInterval: 3600 // 1 hour
    },
    isConfigurable: true,
    permissions: ['view_tasks', 'view_time_logs']
  },
  
  // Overdue Tasks
  {
    id: 'overdue-tasks',
    name: 'Overdue Tasks',
    description: 'Number of overdue tasks',
    category: 'statistics',
    component: StatWidget as any,
    defaultConfig: {
      title: 'Overdue',
      size: 'small',
      color: 'red',
      icon: 'alert-triangle',
      refreshInterval: 600 // 10 minutes
    },
    isConfigurable: true,
    permissions: ['view_tasks']
  },
  
  // Timer Widget - Direct access to timer functionality
  {
    id: 'timer-widget',
    name: 'Timer Widget',
    description: 'Start, stop, and manage time tracking',
    category: 'overview',
    component: TimerWidget as any,
    defaultConfig: {
      title: 'Time Tracker',
      refreshInterval: 1 // 1 second for real-time updates
    },
    isConfigurable: true,
    permissions: ['manage_time_logs']
  },
  
  // Client Progress Widget - Unique for CLIENT role users
  {
    id: 'client-progress',
    name: 'Client Progress',
    description: 'Personal progress overview for clients',
    category: 'overview',
    component: ClientProgressWidget as any,
    defaultConfig: {
      title: 'Your Progress',
      refreshInterval: 300 // 5 minutes
    },
    isConfigurable: true,
    permissions: ['view_tasks', 'view_time_logs']
  },
  
  // Client Notifications Widget - Updates and milestones for clients
  {
    id: 'client-notifications',
    name: 'Client Notifications',
    description: 'Project updates and notifications for clients',
    category: 'overview',
    component: ClientNotificationsWidget as any,
    defaultConfig: {
      title: 'Updates & Notifications',
      refreshInterval: 300 // 5 minutes
    },
    isConfigurable: true,
    permissions: ['view_tasks']
  }
];

// Register all widgets
export function initializeWidgets() {
  widgets.forEach(widget => {
    widgetService.registerWidget(widget);
  });
  
  console.log(`✅ Registered ${widgets.length} dashboard widgets`);
}

// Default dashboard layouts for new users
export const defaultDashboardLayouts = {
  // Standard layout for most users
  standard: [
    { widgetId: 'timer-widget', instanceId: 'timer-1', position: { x: 0, y: 0, width: 2, height: 2 } },
    { widgetId: 'tasks-completed-today', instanceId: 'completed-1', position: { x: 2, y: 0, width: 1, height: 1 } },
    { widgetId: 'total-time-today', instanceId: 'time-1', position: { x: 3, y: 0, width: 1, height: 1 } },
    { widgetId: 'recent-tasks', instanceId: 'tasks-1', position: { x: 0, y: 2, width: 2, height: 2 } },
    { widgetId: 'active-projects', instanceId: 'projects-1', position: { x: 2, y: 1, width: 1, height: 1 } },
    { widgetId: 'weekly-hours', instanceId: 'weekly-1', position: { x: 3, y: 1, width: 1, height: 1 } },
  ],
  
  // Minimal layout for staff or limited users
  minimal: [
    { widgetId: 'timer-widget', instanceId: 'timer-1', position: { x: 0, y: 0, width: 2, height: 2 } },
    { widgetId: 'recent-tasks', instanceId: 'tasks-1', position: { x: 2, y: 0, width: 2, height: 2 } },
  ],
  
  // CLIENT specific layout - unique dashboard experience
  client: [
    { widgetId: 'client-progress', instanceId: 'progress-1', position: { x: 0, y: 0, width: 2, height: 3 } },
    { widgetId: 'timer-widget', instanceId: 'timer-1', position: { x: 2, y: 0, width: 2, height: 2 } },
    { widgetId: 'client-notifications', instanceId: 'notifications-1', position: { x: 4, y: 0, width: 2, height: 3 } },
    { widgetId: 'tasks-completed-today', instanceId: 'completed-1', position: { x: 2, y: 2, width: 1, height: 1 } },
    { widgetId: 'total-time-today', instanceId: 'time-1', position: { x: 3, y: 2, width: 1, height: 1 } },
    { widgetId: 'recent-tasks', instanceId: 'tasks-1', position: { x: 0, y: 3, width: 6, height: 2 } },
  ],
  
  // Manager layout with team overview
  manager: [
    { widgetId: 'team-members', instanceId: 'team-1', position: { x: 0, y: 0, width: 1, height: 1 } },
    { widgetId: 'active-projects', instanceId: 'projects-1', position: { x: 1, y: 0, width: 1, height: 1 } },
    { widgetId: 'productivity-score', instanceId: 'productivity-1', position: { x: 2, y: 0, width: 1, height: 1 } },
    { widgetId: 'overdue-tasks', instanceId: 'overdue-1', position: { x: 3, y: 0, width: 1, height: 1 } },
    { widgetId: 'timer-widget', instanceId: 'timer-1', position: { x: 0, y: 1, width: 2, height: 2 } },
    { widgetId: 'recent-tasks', instanceId: 'tasks-1', position: { x: 2, y: 1, width: 2, height: 2 } },
  ]
};

// Widget data fetchers - these would connect to your actual APIs
export const widgetDataFetchers = {
  'tasks-completed-today': async (orgId: string, _userId: string) => {
    try {
      const response = await fetch(`/api/stats/tasks-completed-today?orgId=${orgId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.count || 0,
        label: 'Completed Today',
        trend: data.trend ? {
          value: data.trend.percentage,
          direction: data.trend.direction,
          label: 'vs yesterday'
        } : undefined,
        format: 'number'
      };
    } catch (error) {
      console.error('Failed to fetch tasks completed today:', error);
      return { value: 0, label: 'Completed Today', format: 'number' };
    }
  },
  
  'total-time-today': async (orgId: string, userId: string) => {
    try {
      const response = await fetch(`/api/stats/time-today?orgId=${orgId}&userId=${userId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.seconds || 0,
        label: 'Today',
        format: 'duration',
        trend: data.trend ? {
          value: data.trend.percentage,
          direction: data.trend.direction,
          label: 'vs yesterday'
        } : undefined
      };
    } catch (error) {
      console.error('Failed to fetch time today:', error);
      return { value: 0, label: 'Today', format: 'duration' };
    }
  },
  
  'active-timers': async (orgId: string, userId: string) => {
    try {
      const response = await fetch(`/api/timers/active?orgId=${orgId}&userId=${userId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        timers: data.timers || [],
        totalActiveTime: data.totalActiveTime || 0
      };
    } catch (error) {
      console.error('Failed to fetch active timers:', error);
      return { timers: [], totalActiveTime: 0 };
    }
  },
  
  'recent-tasks': async (orgId: string, _userId: string) => {
    try {
      const response = await fetch(`/api/tasks/recent?orgId=${orgId}&limit=10`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        tasks: data.tasks || [],
        totalTasks: data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch recent tasks:', error);
      return { tasks: [], totalTasks: 0 };
    }
  },
  
  'active-projects': async (orgId: string, _userId: string) => {
    try {
      const response = await fetch(`/api/stats/active-projects?orgId=${orgId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.count || 0,
        label: 'Active Projects',
        format: 'number'
      };
    } catch (error) {
      console.error('Failed to fetch active projects:', error);
      return { value: 0, label: 'Active Projects', format: 'number' };
    }
  },
  
  'team-members': async (orgId: string, _userId: string) => {
    try {
      const response = await fetch(`/api/stats/team-members?orgId=${orgId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.count || 0,
        label: 'Team Members',
        format: 'number'
      };
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      return { value: 0, label: 'Team Members', format: 'number' };
    }
  },
  
  'weekly-hours': async (orgId: string, userId: string) => {
    try {
      const response = await fetch(`/api/timers/stats?orgId=${orgId}&userId=${userId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.weekTotalSeconds || 0,
        label: 'This Week',
        format: 'duration'
      };
    } catch (error) {
      console.error('Failed to fetch weekly hours:', error);
      return { value: 0, label: 'This Week', format: 'duration' };
    }
  },
  
  'productivity-score': async (orgId: string, userId: string) => {
    try {
      const response = await fetch(`/api/stats/productivity?orgId=${orgId}&userId=${userId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.score || 0,
        label: 'Productivity',
        format: 'percentage'
      };
    } catch (error) {
      console.error('Failed to fetch productivity score:', error);
      return { value: 0, label: 'Productivity', format: 'percentage' };
    }
  },
  
  'overdue-tasks': async (orgId: string, _userId: string) => {
    try {
      const response = await fetch(`/api/stats/overdue-tasks?orgId=${orgId}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return {
        value: data.count || 0,
        label: 'Overdue',
        format: 'number'
      };
    } catch (error) {
      console.error('Failed to fetch overdue tasks:', error);
      return { value: 0, label: 'Overdue', format: 'number' };
    }
  },
  
  'timer-widget': async (_orgId: string, _userId: string) => {
    try {
      // Timer widget manages its own data through useTimer hook
      return {
        initialized: true,
        message: 'Timer widget is self-managed'
      };
    } catch (error) {
      console.error('Failed to initialize timer widget:', error);
      return { initialized: false, message: 'Timer widget initialization failed' };
    }
  },
  
  'client-progress': async (_orgId: string, _userId: string) => {
    try {
      // Client progress widget manages its own data through internal API calls
      return {
        initialized: true,
        message: 'Client progress widget is self-managed'
      };
    } catch (error) {
      console.error('Failed to initialize client progress widget:', error);
      return { initialized: false, message: 'Client progress widget initialization failed' };
    }
  },
  
  'client-notifications': async (_orgId: string, _userId: string) => {
    try {
      // Client notifications widget manages its own data through internal API calls
      return {
        initialized: true,
        message: 'Client notifications widget is self-managed'
      };
    } catch (error) {
      console.error('Failed to initialize client notifications widget:', error);
      return { initialized: false, message: 'Client notifications widget initialization failed' };
    }
  }
};