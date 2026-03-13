import { useState, useEffect } from 'react';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  projectId?: string;
  estimatedTime?: number; // in minutes
  actualTime: number; // in minutes
  timeEntries: TimeEntry[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  tags: string[];
}

export interface TimeEntry {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  startDate?: string | null;
  endDate?: string | null;
  createdAt: Date;
  updatedAt: Date;
  clientName?: string;
}

const STORAGE_KEYS = {
  TASKS: 'vebtask-tasks',
  PROJECTS: 'vebtask-projects',
  TIME_ENTRIES: 'vebtask-time-entries',
  ACTIVE_TIMERS: 'vebtask-active-timers'
};

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTimers, setActiveTimers] = useState<Map<string, Date>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    const savedTimers = localStorage.getItem(STORAGE_KEYS.ACTIVE_TIMERS);

    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks).map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        timeEntries: task.timeEntries.map((entry: any) => ({
          ...entry,
          startTime: new Date(entry.startTime),
          endTime: entry.endTime ? new Date(entry.endTime) : undefined
        }))
      }));
      setTasks(parsedTasks);
    } else {
      // Initialize with demo data
      setTasks(getInitialTasks());
    }

    if (savedProjects) {
      const parsedProjects = JSON.parse(savedProjects).map((project: any) => ({
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt)
      }));
      setProjects(parsedProjects);
    } else {
      // Initialize with demo data
      setProjects(getInitialProjects());
    }

    if (savedTimers) {
      const parsedTimers = new Map(
        Object.entries(JSON.parse(savedTimers)).map(([key, value]) => [
          key,
          new Date(value as string)
        ])
      );
      setActiveTimers(parsedTimers);
    }

    setLoading(false);
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  }, [tasks, loading]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }
  }, [projects, loading]);

  useEffect(() => {
    if (!loading) {
      const timersObj = Object.fromEntries(
        Array.from(activeTimers.entries()).map(([key, value]) => [key, value.toISOString()])
      );
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TIMERS, JSON.stringify(timersObj));
    }
  }, [activeTimers, loading]);

  // Task CRUD operations
  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'actualTime' | 'timeEntries'>) => {
    const newTask: Task = {
      id: generateId(),
      ...taskData,
      actualTime: 0,
      timeEntries: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, ...updates, updatedAt: new Date() }
        : task
    ));
  };

  const deleteTask = (taskId: string) => {
    // Stop timer if running
    stopTimer(taskId);
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // Project CRUD operations
  const addProject = (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProject: Project = {
      id: generateId(),
      ...projectData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setProjects(prev => [...prev, newProject]);
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, ...updates, updatedAt: new Date() }
        : project
    ));
  };

  const deleteProject = (projectId: string) => {
    // Remove project from all tasks
    setTasks(prev => prev.map(task => 
      task.projectId === projectId 
        ? { ...task, projectId: undefined, updatedAt: new Date() }
        : task
    ));
    setProjects(prev => prev.filter(project => project.id !== projectId));
  };

  // Timer operations
  const startTimer = (taskId: string) => {
    // Stop any other running timers first
    const runningTimers = Array.from(activeTimers.keys());
    runningTimers.forEach(id => {
      if (id !== taskId) {
        stopTimer(id);
      }
    });

    setActiveTimers(prev => new Map(prev.set(taskId, new Date())));
  };

  const stopTimer = (taskId: string) => {
    const startTime = activeTimers.get(taskId);
    if (startTime) {
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes

      const timeEntry: TimeEntry = {
        id: generateId(),
        taskId,
        startTime,
        endTime,
        duration
      };

      // Add time entry to task
      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            actualTime: task.actualTime + duration,
            timeEntries: [...task.timeEntries, timeEntry],
            updatedAt: new Date()
          };
        }
        return task;
      }));

      // Remove from active timers
      setActiveTimers(prev => {
        const newTimers = new Map(prev);
        newTimers.delete(taskId);
        return newTimers;
      });
    }
  };

  const pauseTimer = (taskId: string) => {
    stopTimer(taskId);
  };

  const isTimerRunning = (taskId: string) => {
    return activeTimers.has(taskId);
  };

  const getTimerDuration = (taskId: string) => {
    const startTime = activeTimers.get(taskId);
    if (startTime) {
      return Math.floor((Date.now() - startTime.getTime()) / 1000); // seconds
    }
    return 0;
  };

  // Statistics
  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const totalTime = tasks.reduce((sum, task) => sum + task.actualTime, 0);
    
    return { total, completed, inProgress, todo, totalTime };
  };

  const getProjectStats = () => {
    return projects.map(project => {
      const projectTasks = tasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const totalTime = projectTasks.reduce((sum, task) => sum + task.actualTime, 0);
      
      return {
        ...project,
        taskCount: projectTasks.length,
        completedTasks,
        completionRate: projectTasks.length > 0 ? completedTasks / projectTasks.length : 0,
        totalTime
      };
    });
  };

  return {
    tasks,
    projects,
    activeTimers,
    loading,
    addTask,
    updateTask,
    deleteTask,
    addProject,
    updateProject,
    deleteProject,
    startTimer,
    stopTimer,
    pauseTimer,
    isTimerRunning,
    getTimerDuration,
    getTaskStats,
    getProjectStats
  };
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function getInitialTasks(): Task[] {
  return [
    {
      id: '1',
      title: 'Fix authentication issues',
      description: 'Resolve CORS and database connectivity problems',
      status: 'completed',
      priority: 'high',
      projectId: '1',
      estimatedTime: 120,
      actualTime: 135,
      timeEntries: [
        {
          id: 't1',
          taskId: '1',
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() - 1800000),
          duration: 30
        },
        {
          id: 't2',
          taskId: '1',
          startTime: new Date(Date.now() - 1800000),
          endTime: new Date(Date.now() - 1200000),
          duration: 105
        }
      ],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 1200000),
      tags: ['backend', 'urgent']
    },
    {
      id: '2',
      title: 'Update dashboard UI',
      description: 'Rebuild the dashboard with all features but simple CSS',
      status: 'in-progress',
      priority: 'high',
      projectId: '1',
      estimatedTime: 180,
      actualTime: 105,
      timeEntries: [
        {
          id: 't3',
          taskId: '2',
          startTime: new Date(Date.now() - 7200000),
          endTime: new Date(Date.now() - 6000000),
          duration: 20
        },
        {
          id: 't4',
          taskId: '2',
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() - 2700000),
          duration: 85
        }
      ],
      createdAt: new Date(Date.now() - 43200000),
      updatedAt: new Date(Date.now() - 2700000),
      tags: ['frontend', 'ui']
    },
    {
      id: '3',
      title: 'Review client requirements',
      description: 'Go through the new client requirements document',
      status: 'todo',
      priority: 'medium',
      projectId: '2',
      estimatedTime: 60,
      actualTime: 0,
      timeEntries: [],
      createdAt: new Date(Date.now() - 21600000),
      updatedAt: new Date(Date.now() - 21600000),
      tags: ['analysis', 'client']
    },
    {
      id: '4',
      title: 'Write project documentation',
      description: 'Create comprehensive documentation for the VebTask project',
      status: 'todo',
      priority: 'low',
      projectId: '3',
      estimatedTime: 240,
      actualTime: 0,
      timeEntries: [],
      createdAt: new Date(Date.now() - 10800000),
      updatedAt: new Date(Date.now() - 10800000),
      tags: ['documentation']
    }
  ];
}

function getInitialProjects(): Project[] {
  return [
    {
      id: '1',
      name: 'VebTask',
      description: 'Task and time management application',
      color: '#646cff',
      status: 'active',
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(Date.now() - 3600000)
    },
    {
      id: '2',
      name: 'Client Project',
      description: 'Custom solution for enterprise client',
      color: '#10b981',
      status: 'planning',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 21600000)
    },
    {
      id: '3',
      name: 'Documentation',
      description: 'Project documentation and guides',
      color: '#f59e0b',
      status: 'completed',
      createdAt: new Date(Date.now() - 43200000),
      updatedAt: new Date(Date.now() - 10800000)
    }
  ];
}