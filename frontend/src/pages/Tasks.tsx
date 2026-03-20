import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Plus,
  X,
  MoreHorizontal,
  Edit2,
  Trash2,
  Search,
  MessageSquare,
  Paperclip,
  Clock,
  Filter,
  SlidersHorizontal,
  Play,
  Square,
  Brain,
  Check,
  Users,
  User,
} from 'lucide-react';
import BrainDumpModal from '../components/BrainDumpModal';
import { TaskDetailPanel } from '../components/TaskDetailPanel';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  estimatedHours: number;
  actualHours: number;
  dueDate?: string;
  assignee?: string;
  assignees?: { id: string; name: string; email: string; image?: string | null }[];
  project?: string;
  projectId?: string;
  isBillable: boolean;
  hourlyRate?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isTeamTask?: boolean;
  mainAssigneeId?: string | null;
  parentTaskId?: string | null;
  checklistTotal?: number;
  checklistDone?: number;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  color: string;
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
}

import { VS } from '../lib/theme';

const COLUMNS: { id: Task['status']; label: string; accent: string; bg: string }[] = [
  { id: 'not_started', label: 'To Do',       accent: VS.blue,   bg: 'rgba(86,156,214,0.10)'  },
  { id: 'in_progress', label: 'In Progress', accent: VS.yellow, bg: 'rgba(220,220,170,0.10)' },
  { id: 'on_hold',     label: 'On Hold',     accent: VS.red,    bg: 'rgba(244,71,71,0.10)'   },
  { id: 'completed',   label: 'Done',        accent: VS.teal,   bg: 'rgba(78,201,176,0.10)'  },
  { id: 'cancelled',   label: 'Cancelled',   accent: VS.orange, bg: 'rgba(206,145,120,0.10)' },
];

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Low:    { label: 'LOW',      bg: 'linear-gradient(135deg,#1a2e24,#223320)', text: VS.teal,   border: VS.teal   },
  Medium: { label: 'MODERATE', bg: 'linear-gradient(135deg,#2d2a1a,#38341e)', text: VS.yellow, border: VS.yellow },
  High:   { label: 'HIGH',     bg: 'linear-gradient(135deg,#2d1919,#3a1c1c)', text: VS.red,    border: VS.red    },
  Urgent: { label: 'URGENT',   bg: 'linear-gradient(135deg,#251828,#301e35)', text: VS.purple, border: VS.purple },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: 'rgba(86,156,214,0.15)',  text: VS.blue   },
  in_progress: { label: 'In Progress', bg: 'rgba(220,220,170,0.15)', text: VS.yellow },
  on_hold:     { label: 'On Hold',     bg: 'rgba(244,71,71,0.15)',   text: VS.red    },
  completed:   { label: 'Done',        bg: 'rgba(78,201,176,0.15)',  text: VS.teal   },
  cancelled:   { label: 'Cancelled',   bg: 'rgba(206,145,120,0.15)', text: VS.orange },
};

// Avatar color palette
const AVATAR_COLORS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#ec4899,#f43f5e)',
  'linear-gradient(135deg,#3b82f6,#6366f1)',
];

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(/[\s@.]+/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function avatarGradient(name?: string) {
  if (!name) return AVATAR_COLORS[0];
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function TaskAvatar({ name, email, image, size = 32 }: { name?: string; email?: string; image?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const label = name || email || '?';
  if (image && !imgError) {
    return <img src={image} alt={label} onError={() => setImgError(true)}
      className="rounded-full ring-2 ring-[#2d2d2d] object-cover"
      style={{ width: size, height: size, flexShrink: 0 }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white ring-2 ring-[#2d2d2d]"
      style={{ width: size, height: size, fontSize: size * 0.31, background: avatarGradient(label), flexShrink: 0 }}>
      {getInitials(label)}
    </div>
  );
}

// ── Input style shared ────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: '#3c3c3c', border: '1px solid #454545', color: '#d4d4d4' };

export function Tasks() {
  const { data: session } = useSession();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const apiClient = useApiClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const userRole = currentOrg?.role ?? 'CLIENT';
  const [searchTerm, setSearchTerm] = useState('');

  // Org members for assignee picker
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);

  // New task form
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewTaskForm, setShowNewTaskForm] = useState(() => searchParams.get('create') === '1');

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowNewTaskForm(true);
      setSearchParams({}, { replace: true });
    }
  }, []);
  const [newTaskColumnStatus, setNewTaskColumnStatus] = useState<Task['status']>('not_started');
  const [newTaskForm, setNewTaskForm] = useState({
    title: '', description: '', priority: 'Medium' as Task['priority'],
    projectId: '', estimatedHours: 0, dueDate: '', tags: '', assigneeIds: [] as string[],
    isTeamTask: false,
    subTasks: [] as { assigneeId: string; title: string }[],
  });
  const [taskFormLoading, setTaskFormLoading] = useState(false);

  // Edit task
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: '', description: '', priority: 'Medium' as Task['priority'],
    projectId: '', estimatedHours: 0, dueDate: '', tags: '', assigneeIds: [] as string[],
  });

  // Drag and drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  // Card menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Brain Dump modal
  const [showBrainDump, setShowBrainDump] = useState(false);

  // Task detail panel
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, { comments: number; attachments: number }>>({});

  // My tasks vs all tasks toggle (OWNER/ADMIN only)
  const isAdminOrOwner = currentOrg?.role === 'OWNER' || currentOrg?.role === 'ADMIN';

  // Clock-in gate for STAFF
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!currentOrg?.id || isAdminOrOwner) { setIsClockedIn(true); return; }
    fetch(`/api/attendance/status?orgId=${currentOrg.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setIsClockedIn(d?.clockedIn ?? false))
      .catch(() => setIsClockedIn(false));
  }, [currentOrg?.id, isAdminOrOwner]);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Filter
  const [showFilter, setShowFilter] = useState(false);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState('');

  // Sort
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState<
    'created_desc' | 'created_asc' | 'priority_desc' | 'priority_asc' | 'due_asc' | 'due_desc' | 'title_asc' | 'title_desc'
  >('priority_desc');

  // Timer — state is hydrated from localStorage so it survives refresh/restart
  const [timerTaskId, setTimerTaskId] = useState<string | null>(() => {
    try { return JSON.parse(localStorage.getItem('task_timer_active') || 'null')?.taskId ?? null; } catch { return null; }
  });
  const [timerStart, setTimerStart] = useState<number | null>(() => {
    try { return JSON.parse(localStorage.getItem('task_timer_active') || 'null')?.startTime ?? null; } catch { return null; }
  });
  const [timerAccum, setTimerAccum] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('task_timers') || '{}'); } catch { return {}; }
  });
  const [, setTick] = useState(0); // drives live display
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Active timers from other users (admin view)
  const [activeTimers, setActiveTimers] = useState<{ userId: string; taskId: string; startedAt: number; name: string }[]>([]);


  // ── fetch tasks ────────────────────────────────────────────────────────────
  const fetchTasks = async (showLoader = true) => {
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      if (showLoader) setLoading(true);
      const isAdmin = currentOrg?.role === 'OWNER' || currentOrg?.role === 'ADMIN';
      const taskUrl = (isAdmin && !showAllTasks)
        ? `/api/tasks?userId=${session.user.id}&limit=200`
        : '/api/tasks?limit=500';
      const [data, countsData] = await Promise.all([
        apiClient.fetch(taskUrl, { method: 'GET' }),
        apiClient.fetch('/api/tasks/counts', { method: 'GET' }).catch(() => ({ counts: {} })),
      ]);
      if (data.success) {
        setTasks((data.tasks || []).map((t: any) => ({ ...t, tags: t.tags || [] })));
      }
      if (countsData.counts) {
        const mapped: Record<string, { comments: number; attachments: number }> = {};
        for (const [id, c] of Object.entries(countsData.counts as Record<string, { comments: number; attachments: number }>)) {
          mapped[id] = { comments: c.comments ?? 0, attachments: c.attachments ?? 0 };
        }
        setTaskCounts(mapped);
      }
    } catch (err) { console.error('[Tasks] fetchTasks error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [session?.user?.id, currentOrg?.id, showAllTasks]);

  // ── fetch projects ─────────────────────────────────────────────────────────
  const fetchProjects = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      const data = await apiClient.fetch('/api/projects?limit=100');
      if (data.success) setProjects(data.projects || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (session?.user?.id && currentOrg?.id) fetchProjects();
  }, [session?.user?.id, currentOrg?.id]);

  useEffect(() => {
    if (showNewTaskForm || editingTask) fetchProjects();
  }, [showNewTaskForm, editingTask]);

  // ── fetch org members for assignee dropdown (load once on mount) ───────────
  useEffect(() => {
    if (!session?.user?.id || !currentOrg?.id) return;
    apiClient.fetch('/api/tasks/members')
      .then(d => { if (d.members) setOrgMembers(d.members); })
      .catch(() => {});
  }, [session?.user?.id, currentOrg?.id]);

  // ── tick interval — always running so own timer + other users' timers update live ──
  useEffect(() => {
    const active = (() => {
      try { return JSON.parse(localStorage.getItem('task_timer_active') || 'null'); } catch { return null; }
    })();
    const paused = !!localStorage.getItem('task_timer_paused');
    // Start interval unconditionally — drives both own timer display and
    // admin view of other users' live timers (orange strips on cards)
    if (!paused) {
      timerInterval.current = setInterval(() => setTick(t => t + 1), 1000);
    }
    // If own timer was running, restore timerStart from localStorage
    if (active?.taskId && active?.startTime && !paused) {
      // already set via useState initialiser — interval above handles ticking
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
  }, []);

  // ── poll org-wide active timers (admin only, every 5s) ────────────────────
  useEffect(() => {
    if (!isAdminOrOwner || !session?.user?.id || !currentOrg?.id) return;
    const poll = () => {
      apiClient.fetch('/api/tasks/active-timers')
        .then(d => { if (d.timers) setActiveTimers(d.timers); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [isAdminOrOwner, session?.user?.id, currentOrg?.id]);

  // ── timer: respond to attendance break/resume/clock-out ────────────────────
  useEffect(() => {
    // localStorage is already updated by the task-timer utility before the event fires.
    // These handlers just sync React state to match.
    const onPause = () => {
      if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null; }
      const accum: Record<string, number> = (() => {
        try { return JSON.parse(localStorage.getItem('task_timers') || '{}'); } catch { return {}; }
      })();
      setTimerAccum(accum);
      setTimerStart(null);

    };

    const onResume = () => {
      const active: { taskId: string; startTime: number } | null = (() => {
        try { return JSON.parse(localStorage.getItem('task_timer_active') || 'null'); } catch { return null; }
      })();
      if (!active?.taskId) return;
      setTimerTaskId(active.taskId);
      setTimerStart(active.startTime);

      if (timerInterval.current) clearInterval(timerInterval.current);
      timerInterval.current = setInterval(() => setTick(t => t + 1), 1000);
    };

    const onStop = () => {
      if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null; }
      const accum: Record<string, number> = (() => {
        try { return JSON.parse(localStorage.getItem('task_timers') || '{}'); } catch { return {}; }
      })();
      setTimerAccum(accum);
      setTimerTaskId(null);
      setTimerStart(null);

    };

    window.addEventListener('task-timer-pause',  onPause);
    window.addEventListener('task-timer-resume', onResume);
    window.addEventListener('task-timer-stop',   onStop);
    return () => {
      window.removeEventListener('task-timer-pause',  onPause);
      window.removeEventListener('task-timer-resume', onResume);
      window.removeEventListener('task-timer-stop',   onStop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── timer helpers ──────────────────────────────────────────────────────────
  const getTimerSeconds = (taskId: string) => {
    const accum = timerAccum[taskId] || 0;
    if (timerTaskId === taskId && timerStart !== null) {
      return accum + Math.floor((Date.now() - timerStart) / 1000);
    }
    return accum;
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatActualHours = (hours: number) => {
    if (!hours) return '0m';
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const handleStartTimer = async (taskId: string) => {
    // Stop any currently running timer first, saving its elapsed time
    if (timerTaskId && timerTaskId !== taskId) {
      await handleStopTimer(timerTaskId);
    }
    if (timerInterval.current) clearInterval(timerInterval.current);
    const startTime = Date.now();
    setTimerTaskId(taskId);
    setTimerStart(startTime);
    localStorage.setItem('task_timer_active', JSON.stringify({ taskId, startTime }));
    localStorage.setItem('task_timer_start', String(startTime));
    timerInterval.current = setInterval(() => setTick(t => t + 1), 1000);
    // Notify backend so admins can see this timer
    apiClient.fetch('/api/tasks/timer/start', {
      method: 'POST',
      body: JSON.stringify({ taskId, startedAt: startTime }),
    }).catch(() => {});
  };

  const handleMoveToInProgress = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'in_progress') return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t));
    try {
      await apiClient.fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  const handleStopTimer = async (taskId: string) => {
    if (timerInterval.current) { clearInterval(timerInterval.current); timerInterval.current = null; }

    // Read start time from localStorage BEFORE removing it
    const storedStart = (() => {
      try { return JSON.parse(localStorage.getItem('task_timer_start') || 'null'); } catch { return null; }
    })();
    localStorage.removeItem('task_timer_active');
    localStorage.removeItem('task_timer_start');

    const effectiveStart = storedStart ?? timerStart;
    const elapsed = effectiveStart !== null ? Math.floor((Date.now() - effectiveStart) / 1000) : 0;

    // Always read accumulated time from localStorage (source of truth) — avoids stale React closure
    const stored: Record<string, number> = (() => {
      try { return JSON.parse(localStorage.getItem('task_timers') || '{}'); } catch { return {}; }
    })();
    const newAccum = { ...stored, [taskId]: (stored[taskId] || 0) + elapsed };
    localStorage.setItem('task_timers', JSON.stringify(newAccum));
    setTimerAccum(newAccum);
    setTimerTaskId(null);
    setTimerStart(null);
    try {
      await Promise.all([
        apiClient.fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ actualHours: parseFloat((newAccum[taskId] / 3600).toFixed(2)) }),
        }),
        apiClient.fetch('/api/tasks/timer/stop', { method: 'POST', body: JSON.stringify({}) }).catch(() => {}),
      ]);
      await fetchTasks(false);
    } catch { /* silent */ }
  };

  // ── drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
    dragCounter.current = {};
  };

  const handleColumnDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) + 1;
    setDragOverCol(colId);
  };

  const handleColumnDragLeave = (_e: React.DragEvent, colId: string) => {
    dragCounter.current[colId] = (dragCounter.current[colId] || 1) - 1;
    if (dragCounter.current[colId] <= 0) {
      dragCounter.current[colId] = 0;
      setDragOverCol(prev => (prev === colId ? null : prev));
    }
  };

  const handleColumnDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, colId: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    dragCounter.current = {};
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === colId) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: colId } : t));
    try {
      await apiClient.fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: colId }),
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  // ── create task ────────────────────────────────────────────────────────────
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      setTaskFormLoading(true);
      const selectedProject = projects.find(p => p.id === newTaskForm.projectId);
      const title = newTaskForm.title.trim() || (selectedProject ? `${selectedProject.name} Task` : 'New Task');
      const data = await apiClient.fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: newTaskForm.description,
          userId: newTaskForm.assigneeIds[0] || session.user.id,
          assigneeIds: newTaskForm.assigneeIds.length > 0 ? newTaskForm.assigneeIds : [session.user.id],
          orgId: currentOrg.id,
          priority: newTaskForm.priority,
          status: newTaskColumnStatus,
          projectId: newTaskForm.projectId || undefined,
          estimatedHours: newTaskForm.estimatedHours,
          dueDate: newTaskForm.dueDate ? new Date(newTaskForm.dueDate + 'T00:00:00.000Z').toISOString() : undefined,
          tags: newTaskForm.tags ? newTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
          isTeamTask: newTaskForm.isTeamTask || undefined,
          subTasks: newTaskForm.isTeamTask ? newTaskForm.subTasks.filter(s => s.title && s.assigneeId) : undefined,
        }),
      });
      if (data.task) {
        await fetchTasks(false);
        setNewTaskForm({ title: '', description: '', priority: 'Medium', projectId: '', estimatedHours: 0, dueDate: '', tags: '', assigneeIds: [], isTeamTask: false, subTasks: [] });
        setShowNewTaskForm(false);
      }
    } catch { alert('Failed to create task.'); }
    finally { setTaskFormLoading(false); }
  };

  // ── update task ────────────────────────────────────────────────────────────
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      setTaskFormLoading(true);
      const selectedProject = projects.find(p => p.id === editTaskForm.projectId);
      const title = editTaskForm.title.trim() || (selectedProject ? `${selectedProject.name} Task` : 'General Task');
      const data = await apiClient.fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description: editTaskForm.description || '',
          priority: editTaskForm.priority,
          estimatedHours: editTaskForm.estimatedHours || 0,
          projectId: editTaskForm.projectId || null,
          dueDate: editTaskForm.dueDate ? new Date(editTaskForm.dueDate + 'T00:00:00.000Z').toISOString() : null,
          tags: editTaskForm.tags ? editTaskForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
          assigneeIds: editTaskForm.assigneeIds,
        }),
      });
      if (data.task) {
        await fetchTasks(false);
        setEditingTask(null);
      }
    } catch { alert('Failed to update task.'); }
    finally { setTaskFormLoading(false); }
  };

  // ── delete task ────────────────────────────────────────────────────────────
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const data = await apiClient.fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (data.message) setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch { alert('Failed to delete task.'); }
  };

  // ── open edit form ─────────────────────────────────────────────────────────
  const handleEditTask = (task: Task) => {
    setOpenMenuId(null);
    setEditingTask(task);
    setEditTaskForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      projectId: task.projectId || '',
      estimatedHours: task.estimatedHours,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      tags: Array.isArray(task.tags) ? task.tags.join(', ') : '',
      assigneeIds: task.assignees?.map(a => a.id) ?? [],
    });
  };

  // ── filter + sort ──────────────────────────────────────────────────────────
  const priorityRank: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

  const filtered = tasks
    .filter(t => {
      if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !(t.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterPriorities.length > 0 && !filterPriorities.includes(t.priority)) return false;
      if (filterProject && t.projectId !== filterProject) return false;
      if (filterOverdueOnly) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const over = t.dueDate && new Date(t.dueDate) < today && t.status !== 'completed' && t.status !== 'cancelled';
        if (!over) return false;
      }
      if (filterStaffId && !t.assignees?.some((a: { id: string }) => a.id === filterStaffId)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'created_asc':   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority_desc': return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
        case 'priority_asc':  return (priorityRank[a.priority] || 0) - (priorityRank[b.priority] || 0);
        case 'due_asc':       return (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
        case 'due_desc':      return (b.dueDate ? new Date(b.dueDate).getTime() : -Infinity) - (a.dueDate ? new Date(a.dueDate).getTime() : -Infinity);
        case 'title_asc':     return a.title.localeCompare(b.title);
        case 'title_desc':    return b.title.localeCompare(a.title);
        default:              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // created_desc
      }
    });

  const activeFilterCount = filterPriorities.length + (filterProject ? 1 : 0) + (filterOverdueOnly ? 1 : 0) + (filterStaffId ? 1 : 0);

  const tasksForCol = (colId: string) => filtered.filter(t => t.status === colId);

  // While session or org context is still initialising, show a spinner
  if (!session || orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
      </div>
    );
  }

  // Org resolved but no membership found
  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: VS.text2, fontSize: 14 }}>No organisation found. Please contact your administrator.</p>
      </div>
    );
  }

  // Tasks are still being fetched from the server
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
      </div>
    );
  }

  // Block STAFF who haven't clocked in
  if (isClockedIn === false && !isAdminOrOwner) {
    return (
      <div className="flex items-center justify-center h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div style={{
          background: VS.bg1,
          border: `1px solid ${VS.border}`,
          borderRadius: 16,
          padding: '48px 40px',
          textAlign: 'center',
          maxWidth: 400,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `${VS.accent}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Clock style={{ width: 28, height: 28, color: VS.accent }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: VS.text0, margin: '0 0 8px' }}>
            Clock In Required
          </h2>
          <p style={{ fontSize: 13, color: VS.text2, margin: '0 0 24px', lineHeight: 1.6 }}>
            You need to clock in before you can access the task board.
          </p>
          <a
            href="/attendance"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: VS.accent, color: 'white',
              padding: '10px 24px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Go to Attendance
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Top header bar ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4"
        style={{ borderBottom: `1px solid ${VS.border}` }}
      >
        {/* Left: title + meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: VS.text0 }}>
              {userRole === 'CLIENT' ? 'My Tasks' : (isAdminOrOwner && !showAllTasks ? 'My Tasks' : 'Task Board')}
              <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded align-middle"
                style={{ background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}` }}>
                {isAdminOrOwner && showAllTasks ? 'All Members' : 'My Tasks'}
              </span>
            </h1>
            <p className="text-xs mt-0.5" style={{ color: VS.text2 }}>
              {filtered.length}{filtered.length !== tasks.length ? ` / ${tasks.length}` : ''} tasks · {COLUMNS.length} stages
            </p>
          </div>
          {/* Active staff filter chip */}
          {filterStaffId && (() => {
            const staffMember = orgMembers.find(m => m.id === filterStaffId);
            return staffMember ? (
              <button
                onClick={() => { setFilterStaffId(''); setShowAllTasks(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:opacity-80"
                style={{ background: `${VS.accent}22`, border: `1px solid ${VS.accent}55`, color: VS.accent }}
                title="Clear staff filter"
              >
                <div
                  className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                  style={{ background: avatarGradient(staffMember.name || staffMember.email) }}
                >
                  {getInitials(staffMember.name || staffMember.email)}
                </div>
                {staffMember.name || staffMember.email}
                <X className="h-3 w-3" />
              </button>
            ) : null;
          })()}
          {isAdminOrOwner && (
            <button
              onClick={() => { setShowAllTasks(v => !v); setFilterStaffId(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all hover:opacity-90 active:scale-95"
              style={showAllTasks
                ? { background: VS.blue, border: `1px solid ${VS.blue}`, color: '#fff', boxShadow: `0 0 0 2px ${VS.blue}33` }
                : { background: VS.bg1, border: `2px solid ${VS.border2}`, color: VS.text1, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }
              }
            >
              {showAllTasks
                ? <><User className="h-3.5 w-3.5" /> My Tasks</>
                : <><Users className="h-3.5 w-3.5" /> All Tasks</>
              }
            </button>
          )}
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
              style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text0, width: 160, outline: 'none' }}
            />
          </div>

          {/* ── Filter dropdown ── */}
          <div className="relative">
            <button
              onClick={() => { setShowFilter(v => !v); setShowSort(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                background: activeFilterCount > 0 ? `${VS.blue}22` : VS.bg3,
                border: `1px solid ${activeFilterCount > 0 ? VS.blue + '88' : VS.border}`,
                color: activeFilterCount > 0 ? VS.blue : VS.text1,
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span
                  className="h-4 w-4 rounded-full text-[10px] flex items-center justify-center font-bold"
                  style={{ background: VS.blue, color: '#fff' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
                <div
                  className="absolute top-full mt-2 right-0 z-[200] rounded-xl p-4 space-y-4"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', minWidth: 240 }}
                >
                  {/* Priority */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: VS.text2 }}>Priority</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['Urgent', 'High', 'Medium', 'Low'] as const).map(p => {
                        const active = filterPriorities.includes(p);
                        const cfg = PRIORITY_CONFIG[p];
                        return (
                          <button
                            key={p}
                            onClick={() => setFilterPriorities(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                            style={{
                              background: active ? `${cfg.border}22` : VS.bg3,
                              border: `1px solid ${active ? cfg.border + '88' : VS.border}`,
                              color: active ? cfg.text : VS.text2,
                            }}
                          >
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: active ? cfg.text : VS.border }} />
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Project */}
                  {projects.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: VS.text2 }}>Project</p>
                      <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className={inputCls}
                        style={{ ...inputStyle, fontSize: 12 }}
                      >
                        <option value="">All projects</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Staff (admin/owner only) */}
                  {isAdminOrOwner && orgMembers.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: VS.text2 }}>Staff Member</p>
                      <div
                        className="rounded-lg overflow-hidden"
                        style={{ border: `1px solid ${VS.border}`, maxHeight: '160px', overflowY: 'auto' }}
                      >
                        {/* "All staff" option */}
                        <button
                          onClick={() => { setFilterStaffId(''); setShowAllTasks(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
                          style={{
                            background: !filterStaffId ? `${VS.accent}22` : 'transparent',
                            borderBottom: `1px solid ${VS.border}`,
                            color: !filterStaffId ? VS.text0 : VS.text2,
                          }}
                        >
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: VS.bg3, border: `1px dashed ${VS.border2}` }}
                          >
                            <Users className="h-3 w-3" style={{ color: VS.text2 }} />
                          </div>
                          <span className="flex-1 text-xs">All staff</span>
                          {!filterStaffId && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: VS.accent }} />}
                        </button>

                        {orgMembers.map((m, i) => {
                          const selected = filterStaffId === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                if (selected) {
                                  setFilterStaffId('');
                                  setShowAllTasks(false);
                                } else {
                                  setFilterStaffId(m.id);
                                  setShowAllTasks(true); // ensure all tasks are loaded so we can filter by this staff
                                }
                              }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
                              style={{
                                background: selected ? `${VS.accent}22` : 'transparent',
                                borderBottom: i < orgMembers.length - 1 ? `1px solid ${VS.border}` : 'none',
                                color: selected ? VS.text0 : VS.text1,
                              }}
                            >
                              <div
                                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                style={{ background: avatarGradient(m.name || m.email) }}
                              >
                                {getInitials(m.name || m.email)}
                              </div>
                              <span className="flex-1 text-xs truncate">{m.name || m.email}</span>
                              {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: VS.accent }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Overdue only */}
                  <button
                    onClick={() => setFilterOverdueOnly(v => !v)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] transition-all"
                    style={{
                      background: filterOverdueOnly ? `${VS.red}18` : 'transparent',
                      border: `1px solid ${filterOverdueOnly ? VS.red + '55' : VS.border}`,
                      color: filterOverdueOnly ? VS.red : VS.text2,
                    }}
                  >
                    <div
                      className="h-3.5 w-3.5 rounded flex items-center justify-center shrink-0"
                      style={{ background: filterOverdueOnly ? VS.red : VS.bg3, border: `1px solid ${filterOverdueOnly ? VS.red : VS.border2}` }}
                    >
                      {filterOverdueOnly && <Check className="h-2.5 w-2.5 text-white" style={{ strokeWidth: 3 }} />}
                    </div>
                    Overdue only
                  </button>

                  {/* Clear */}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { setFilterPriorities([]); setFilterProject(''); setFilterOverdueOnly(false); setFilterStaffId(''); }}
                      className="w-full text-[11px] py-1.5 rounded-lg text-center transition-colors hover:opacity-80"
                      style={{ color: VS.text1, background: VS.bg3, border: `1px solid ${VS.border}` }}
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Sort dropdown ── */}
          <div className="relative">
            <button
              onClick={() => { setShowSort(v => !v); setShowFilter(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                background: sortBy !== 'created_desc' ? `${VS.blue}22` : VS.bg3,
                border: `1px solid ${sortBy !== 'created_desc' ? VS.blue + '88' : VS.border}`,
                color: sortBy !== 'created_desc' ? VS.blue : VS.text1,
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Sort
            </button>

            {showSort && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                <div
                  className="absolute top-full mt-2 right-0 z-[200] rounded-xl py-2"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', minWidth: 210 }}
                >
                  {([
                    { value: 'created_desc',  label: 'Newest first' },
                    { value: 'created_asc',   label: 'Oldest first' },
                    { value: 'priority_desc', label: 'Priority (high → low)' },
                    { value: 'priority_asc',  label: 'Priority (low → high)' },
                    { value: 'due_asc',       label: 'Due date (soonest)' },
                    { value: 'due_desc',      label: 'Due date (latest)' },
                    { value: 'title_asc',     label: 'Title (A → Z)' },
                    { value: 'title_desc',    label: 'Title (Z → A)' },
                  ] as { value: typeof sortBy; label: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSort(false); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-[12px] text-left transition-colors hover:bg-white/5"
                      style={{ color: sortBy === opt.value ? VS.blue : VS.text1 }}
                    >
                      <div
                        className="h-3 w-3 rounded-full border flex items-center justify-center shrink-0"
                        style={{ borderColor: sortBy === opt.value ? VS.blue : VS.border2 }}
                      >
                        {sortBy === opt.value && (
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: VS.blue }} />
                        )}
                      </div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Generate with AI */}
          {userRole !== 'CLIENT' && (
            <button
              onClick={() => setShowBrainDump(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: `${VS.purple}22`, border: `1px solid ${VS.purple}55`, color: VS.purple }}
            >
              <Brain className="h-3.5 w-3.5" />
              Generate with AI
            </button>
          )}

          {/* Add New */}
          {userRole !== 'CLIENT' && (
            <button
              onClick={() => { setNewTaskColumnStatus('not_started'); setShowNewTaskForm(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: VS.accent }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add New
            </button>
          )}
        </div>
      </div>

      {/* ── Kanban columns ── */}
      <div className="flex-1 flex gap-4 overflow-x-auto p-5" style={{ alignItems: 'flex-start' }}>
        {COLUMNS.map(col => {
          const colTasks = tasksForCol(col.id);
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                width: 300,
                background: isOver ? col.bg : VS.bg1,
                border: `1px solid ${isOver ? col.accent + '66' : VS.border}`,
                borderTop: `3px solid ${col.accent}`,
              }}
              onDragEnter={e => handleColumnDragEnter(e, col.id)}
              onDragLeave={e => handleColumnDragLeave(e, col.id)}
              onDragOver={handleColumnDragOver}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* ── Column header ── */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-wide" style={{ color: VS.text0 }}>
                      {col.label.toUpperCase()}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: col.bg, color: col.accent }}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  {userRole !== 'CLIENT' && (
                    <button
                      onClick={() => { setNewTaskColumnStatus(col.id); setShowNewTaskForm(true); }}
                      className="h-6 w-6 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: col.bg, color: col.accent }}
                      title="Add task"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>
                  {colTasks.length} {colTasks.length === 1 ? 'task' : 'tasks'}
                  {colTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0) > 0 &&
                    ` · ${colTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)}h estimated`}
                </p>
              </div>

              {/* ── Cards ── */}
              <div
                className="flex-1 overflow-y-auto pb-3 px-3"
                style={{ maxHeight: 'calc(100vh - 260px)', paddingTop: '16px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {colTasks.map(task => {
                  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium;
                  const sCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
                  const isDragging = draggingId === task.id;
                  const date = formatDate(task.dueDate);
                  const _today = new Date(); _today.setHours(0, 0, 0, 0);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < _today && task.status !== 'completed' && task.status !== 'cancelled';
                  return (
                    /*
                     * Wrapper: draggable, position:relative (no overflow so badge can bleed above).
                     * Badge sits at top:0, transform:translateY(-50%) → centered ON the card's top border.
                     * Card div has overflow:hidden (for rounded corners) but badge is a sibling, not a child,
                     * so it is NOT clipped by the card's overflow:hidden.
                     */
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => setDetailTask(task)}
                      className="relative group cursor-grab active:cursor-grabbing"
                      style={{ opacity: isDragging ? 0.45 : 1 }}
                    >
                      {/* ── Card ── rendered FIRST so badge paints over it */}
                      <div
                        className="rounded-2xl overflow-hidden transition-all duration-150"
                        style={{
                          background: VS.bg2,
                          border: `1px solid ${pCfg.border}55`,
                          boxShadow: isDragging
                            ? `0 0 0 2px ${pCfg.border}50`
                            : '0 4px 20px rgba(0,0,0,0.4)',
                        }}
                      >
                        {/* Content */}
                        <div className="px-4 pt-6 pb-3">

                          {/* ⋯ context menu */}
                          {userRole !== 'CLIENT' && (
                            <div className="absolute top-[18px] right-3 z-20">
                              <button
                                onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === task.id ? null : task.id); }}
                                className="h-6 w-6 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                style={{ color: VS.text2, background: VS.bg3 }}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                              {openMenuId === task.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                  <div
                                    className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden py-1 min-w-[130px]"
                                    style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                                  >
                                    <button
                                      onClick={() => handleEditTask(task)}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                      style={{ color: VS.text0 }}
                                    >
                                      <Edit2 className="h-3 w-3" /> Edit task
                                    </button>
                                    <div style={{ height: 1, background: VS.border, margin: '2px 0' }} />
                                    <button
                                      onClick={() => { setOpenMenuId(null); handleDeleteTask(task.id); }}
                                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-500/10 transition-colors"
                                      style={{ color: VS.red }}
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Title */}
                          <p className="text-[15px] font-bold leading-snug mb-2 pr-6" style={{ color: VS.text0 }}>
                            {task.title}
                          </p>

                          {/* Description */}
                          <p className="text-[13px] leading-relaxed line-clamp-2 mb-4" style={{ color: VS.text2 }}>
                            {task.description || (task.project ? `Part of ${task.project}` : '\u00a0')}
                          </p>

                          {/* Avatars (left) + Status badge (right) */}
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-2">
                              {(() => {
                                const people = task.assignees && task.assignees.length > 0
                                  ? task.assignees
                                  : task.assignee
                                    ? [{ id: '', name: task.assignee, email: '' }]
                                    : [];
                                if (people.length === 0) return (
                                  <div
                                    className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-[#2d2d2d]"
                                    style={{ background: VS.bg3, color: VS.text2, border: `1px dashed ${VS.border2}` }}
                                  >?</div>
                                );
                                return (
                                  <>
                                    {people.slice(0, 4).map((a, i) => (
                                      <div key={a.id || i} className="relative group/avatar">
                                        <TaskAvatar name={a.name} email={a.email} image={a.image} size={32} />
                                        <div
                                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md text-[11px] whitespace-nowrap pointer-events-none opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150 z-50"
                                          style={{ background: VS.bg1, color: VS.text0, border: `1px solid ${VS.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                                        >
                                          {a.name || a.email}
                                        </div>
                                      </div>
                                    ))}
                                    {people.length > 4 && (
                                      <div
                                        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-[#2d2d2d]"
                                        style={{ background: VS.bg3, color: VS.text2 }}
                                      >
                                        +{people.length - 4}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            {col.id === 'not_started' && colTasks[0]?.id === task.id ? (
                              <span
                                className="text-[11px] font-semibold px-3 py-1 rounded-full"
                                style={{ background: 'rgba(78,201,176,0.15)', color: '#4ec9b0', border: '1px solid #4ec9b044' }}
                              >
                                Up Next
                              </span>
                            ) : (
                              <span
                                className="text-[11px] font-semibold px-3 py-1 rounded-full"
                                style={{ background: sCfg.bg, color: sCfg.text, border: `1px solid ${sCfg.text}44` }}
                              >
                                {sCfg.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Centered hover timer button ── */}
                        {userRole !== 'CLIENT' && (
                          <div
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none"
                          >
                            <span
                              onClick={e => { e.stopPropagation(); if (timerTaskId === task.id) { handleStopTimer(task.id); } else { handleMoveToInProgress(task.id); handleStartTimer(task.id); } }}
                              onDoubleClick={e => e.stopPropagation()}
                              className="flex items-center justify-center h-10 w-10 rounded-full backdrop-blur-sm transition-transform duration-150 hover:scale-110 pointer-events-auto cursor-pointer"
                              style={{
                                background: timerTaskId === task.id ? `${VS.teal}cc` : 'rgba(0,0,0,0.55)',
                                border: `2px solid ${timerTaskId === task.id ? VS.teal : 'rgba(255,255,255,0.2)'}`,
                                color: '#fff',
                                boxShadow: timerTaskId === task.id ? `0 0 16px ${VS.teal}66` : '0 4px 12px rgba(0,0,0,0.5)',
                              }}
                            >
                              {timerTaskId === task.id
                                ? <Square className="h-4 w-4 fill-current" />
                                : <Play className="h-4 w-4 fill-current ml-0.5" />}
                            </span>
                          </div>
                        )}

                        {/* ── Live timer strip — own timer ── */}
                        {timerTaskId === task.id && (
                          <div
                            className="mx-4 mb-2 rounded-lg flex items-center justify-between px-3 py-1.5"
                            style={{ background: `${VS.teal}18`, border: `1px solid ${VS.teal}44` }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 rounded-full animate-pulse"
                                style={{ background: VS.teal }}
                              />
                              <span className="text-[10px] uppercase tracking-wider" style={{ color: VS.teal }}>
                                Recording
                              </span>
                            </div>
                            <span
                              className="text-[13px] font-mono font-bold tabular-nums"
                              style={{ color: VS.teal }}
                            >
                              {formatTimer(getTimerSeconds(task.id))}
                            </span>
                          </div>
                        )}
                        {/* ── Live timer strips — other users (admin view) ── */}
                        {isAdminOrOwner && activeTimers
                          .filter(at => at.taskId === task.id && at.userId !== session?.user?.id)
                          .map(at => (
                            <div
                              key={at.userId}
                              className="mx-4 mb-2 rounded-lg flex items-center justify-between px-3 py-1.5"
                              style={{ background: `${VS.orange}15`, border: `1px solid ${VS.orange}44` }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: VS.orange }} />
                                <span className="text-[10px] uppercase tracking-wider truncate max-w-[80px]" style={{ color: VS.orange }}>
                                  {at.name.split(' ')[0]}
                                </span>
                              </div>
                              <span className="text-[13px] font-mono font-bold tabular-nums" style={{ color: VS.orange }}>
                                {formatTimer(Math.floor((Date.now() - at.startedAt) / 1000))}
                              </span>
                            </div>
                          ))
                        }

                        {/* ── Dashed separator ── */}
                        <div style={{ borderTop: `1px dashed ${VS.border}` }} />

                        {/* ── Stats row ── */}
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: VS.text2 }}>
                              <MessageSquare className="h-3.5 w-3.5" />
                              {taskCounts[task.id]?.comments ?? 0}
                            </span>
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: VS.text2 }}>
                              <Paperclip className="h-3.5 w-3.5" />
                              {taskCounts[task.id]?.attachments ?? 0}
                            </span>
                            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: timerTaskId === task.id ? VS.teal : VS.text2 }}>
                              <Clock className="h-3.5 w-3.5" />
                              {timerTaskId === task.id
                                ? formatTimer(getTimerSeconds(task.id))
                                : formatActualHours(task.actualHours || 0)}
                            </span>
                          </div>
                          <span
                            className="text-[12px] font-medium"
                            style={{ color: isOverdue ? VS.red : VS.text2 }}
                          >
                            {date || '—'}
                          </span>
                        </div>
                      </div>

                      {/* ── Priority badge: rendered AFTER card so it paints on top ── */}
                      <div
                        className="absolute left-1/2 z-30 px-4 py-[3px] rounded-full text-[11px] font-bold tracking-widest whitespace-nowrap"
                        style={{
                          top: 0,
                          transform: 'translate(-50%, -50%)',
                          background: pCfg.bg,
                          color: pCfg.text,
                          border: `1px solid ${pCfg.border}99`,
                          boxShadow: `0 2px 8px ${pCfg.border}40`,
                        }}
                      >
                        {pCfg.label}
                      </div>


                      {/* ── UP NEXT badge: shown on first To Do task while dragging ── */}
                      {col.id === 'not_started' && draggingId !== null && colTasks.filter(t => t.id !== draggingId)[0]?.id === task.id && (
                        <div
                          className="absolute right-3 z-30 px-3 py-[3px] rounded-full text-[10px] font-bold tracking-widest whitespace-nowrap"
                          style={{
                            top: 0,
                            transform: 'translateY(-50%)',
                            background: 'linear-gradient(135deg,#0d2a1f,#0f3324)',
                            color: '#4ec9b0',
                            border: '1px solid #4ec9b099',
                            boxShadow: '0 2px 8px #4ec9b040',
                          }}
                        >
                          ↑ UP NEXT
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                {/* Empty state */}
                {colTasks.length === 0 && !isOver && (
                  <div
                    className="flex flex-col items-center justify-center py-10 rounded-xl"
                    style={{ border: `1px dashed ${VS.border}` }}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center mb-2"
                      style={{ background: VS.bg3 }}
                    >
                      <Plus className="h-4 w-4" style={{ color: VS.text2 }} />
                    </div>
                    <p className="text-xs" style={{ color: VS.text2 }}>No tasks here</p>
                  </div>
                )}
              </div>

              {/* ── + Add New (bottom) ── */}
              {userRole !== 'CLIENT' && (
                <div className="px-3 pb-3">
                  <button
                    onClick={() => { setNewTaskColumnStatus(col.id); setShowNewTaskForm(true); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      border: `1px dashed ${VS.border}`,
                      color: VS.text2,
                      background: 'transparent',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = col.bg;
                      (e.currentTarget as HTMLElement).style.color = col.accent;
                      (e.currentTarget as HTMLElement).style.borderColor = col.accent + '88';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = VS.text2;
                      (e.currentTarget as HTMLElement).style.borderColor = VS.border;
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add New
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── New Task Modal ── */}
      {showNewTaskForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewTaskForm(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold" style={{ color: VS.text0 }}>New Task</h3>
                  {userRole !== 'STAFF' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Users className="h-3 w-3" style={{ color: newTaskForm.isTeamTask ? VS.teal : VS.text2 }} />
                      <span className="text-[11px] font-medium" style={{ color: newTaskForm.isTeamTask ? VS.teal : VS.text2 }}>Switch to Team Task</span>
                      <div
                        onClick={() => setNewTaskForm(p => ({ ...p, isTeamTask: !p.isTeamTask, subTasks: p.isTeamTask ? [] : [{ assigneeId: '', title: '' }], assigneeIds: [] }))}
                        className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 cursor-pointer"
                        style={{ background: newTaskForm.isTeamTask ? VS.teal : VS.bg3, border: `1px solid ${newTaskForm.isTeamTask ? VS.teal : VS.border}` }}
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full transition-transform duration-200"
                          style={{
                            background: newTaskForm.isTeamTask ? '#fff' : VS.text2,
                            transform: newTaskForm.isTeamTask ? 'translateX(14px)' : 'translateX(1px)',
                          }}
                        />
                      </div>
                    </label>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: VS.text2 }}>
                  Adding to{' '}
                  <span style={{ color: COLUMNS.find(c => c.id === newTaskColumnStatus)?.accent }}>
                    {COLUMNS.find(c => c.id === newTaskColumnStatus)?.label}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowNewTaskForm(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: VS.text1 }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Title</label>
                <input
                  type="text"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Task title..."
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Description</label>
                <textarea
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What needs to be done?"
                  rows={3}
                  className={inputCls + ' resize-none'}
                  style={inputStyle}
                />
              </div>

              {userRole !== 'STAFF' && !newTaskForm.isTeamTask && (
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>
                  Assignees
                  {newTaskForm.assigneeIds.length > 0 && (
                    <span className="ml-1.5 normal-case font-normal" style={{ color: VS.accent }}>
                      {newTaskForm.assigneeIds.length} selected
                    </span>
                  )}
                </label>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${VS.border}`, maxHeight: '152px', overflowY: 'auto' }}
                >
                  {orgMembers.length === 0 ? (
                    <div className="px-3 py-3 text-xs" style={{ color: VS.text2 }}>No members found</div>
                  ) : orgMembers.map((m, i) => {
                    const selected = newTaskForm.assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setNewTaskForm(p => ({
                          ...p,
                          assigneeIds: selected
                            ? p.assigneeIds.filter(id => id !== m.id)
                            : [...p.assigneeIds, m.id],
                        }))}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
                        style={{
                          background: selected ? `${VS.accent}22` : i % 2 === 0 ? VS.bg3 : 'transparent',
                          borderBottom: i < orgMembers.length - 1 ? `1px solid ${VS.border}` : 'none',
                          color: selected ? VS.text0 : VS.text1,
                        }}
                      >
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: avatarGradient(m.name || m.email) }}
                        >
                          {getInitials(m.name || m.email)}
                        </div>
                        <span className="flex-1 text-xs truncate">{m.name || m.email}</span>
                        {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: VS.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {/* ── Team Task sub-tasks builder ── */}
              {newTaskForm.isTeamTask && (
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${VS.accent}44`, background: `${VS.accent}08` }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${VS.accent}33` }}>
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: VS.accent }}>Sub-tasks</span>
                    <span className="text-[10px]" style={{ color: VS.text2 }}>Each member gets this on their board</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {newTaskForm.subTasks.map((sub, idx) => {
                      const m = orgMembers.find(x => x.id === sub.assigneeId);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: m ? `${VS.blue}22` : VS.bg3, color: VS.blue }}>
                            {m ? getInitials(m.name || m.email) : '?'}
                          </div>
                          <input
                            type="text"
                            placeholder="Sub-task title..."
                            value={sub.title}
                            onChange={e => setNewTaskForm(p => {
                              const updated = [...p.subTasks];
                              updated[idx] = { ...updated[idx], title: e.target.value };
                              return { ...p, subTasks: updated };
                            })}
                            className={inputCls}
                            style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '5px 8px' }}
                          />
                          <select
                            value={sub.assigneeId}
                            onChange={e => setNewTaskForm(p => {
                              const updated = [...p.subTasks];
                              updated[idx] = { ...updated[idx], assigneeId: e.target.value };
                              return { ...p, subTasks: updated };
                            })}
                            className={inputCls}
                            style={{ ...inputStyle, width: 120, fontSize: 11, padding: '5px 6px' }}
                          >
                            <option value="">Assign...</option>
                            {orgMembers.map(m2 => (
                              <option key={m2.id} value={m2.id}>{m2.name || m2.email}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setNewTaskForm(p => ({ ...p, subTasks: p.subTasks.filter((_, i) => i !== idx) }))}
                            style={{ color: VS.text2, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setNewTaskForm(p => ({ ...p, subTasks: [...p.subTasks, { assigneeId: '', title: '' }] }))}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-lg transition-colors"
                      style={{ color: VS.accent, border: `1px dashed ${VS.accent}55`, background: 'transparent', width: '100%', justifyContent: 'center' }}
                    >
                      <Plus className="h-3 w-3" /> Add sub-task
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Priority</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: PRIORITY_CONFIG[newTaskForm.priority]?.text || VS.text1 }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Est. Time</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={Math.floor(newTaskForm.estimatedHours)}
                        onChange={e => {
                          const h = Math.max(0, parseInt(e.target.value) || 0);
                          const m = Math.round((newTaskForm.estimatedHours % 1) * 60);
                          setNewTaskForm(p => ({ ...p, estimatedHours: h + m / 60 }));
                        }}
                        className={inputCls}
                        style={{ ...inputStyle, paddingRight: 28 }}
                        min="0"
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>h</span>
                    </div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={Math.round((newTaskForm.estimatedHours % 1) * 60)}
                        onChange={e => {
                          const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                          const h = Math.floor(newTaskForm.estimatedHours);
                          setNewTaskForm(p => ({ ...p, estimatedHours: h + m / 60 }));
                        }}
                        className={inputCls}
                        style={{ ...inputStyle, paddingRight: 28 }}
                        min="0" max="59"
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>m</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Project</label>
                  <select
                    value={newTaskForm.projectId}
                    onChange={e => setNewTaskForm(p => ({ ...p, projectId: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Due Date</label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>
                  Tags <span className="normal-case font-normal" style={{ color: VS.text2 }}>(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={newTaskForm.tags}
                  onChange={e => setNewTaskForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="frontend, urgent, client"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskFormLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: VS.accent, opacity: taskFormLoading ? 0.6 : 1 }}
                >
                  {taskFormLoading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Task Detail Panel ── */}
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          orgId={currentOrg?.id ?? ''}
          onClose={() => setDetailTask(null)}
          onTaskUpdated={fetchTasks}
          onCountsLoaded={(id, c, a) => setTaskCounts(prev => ({ ...prev, [id]: { comments: c, attachments: a } }))}
        />
      )}

      {/* ── Brain Dump Modal ── */}
      <BrainDumpModal
        isOpen={showBrainDump}
        onClose={() => setShowBrainDump(false)}
        onTasksImported={fetchTasks}
      />

      {/* ── Edit Task Modal ── */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingTask(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold" style={{ color: VS.text0 }}>Edit Task</h3>
                <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>Update task details</p>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: VS.text1 }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Title</label>
                <input
                  type="text"
                  value={editTaskForm.title}
                  onChange={e => setEditTaskForm(p => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Description</label>
                <textarea
                  value={editTaskForm.description}
                  onChange={e => setEditTaskForm(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={inputCls + ' resize-none'}
                  style={inputStyle}
                />
              </div>

              {userRole !== 'STAFF' && (
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>
                  Assignees
                  {editTaskForm.assigneeIds.length > 0 && (
                    <span className="ml-1.5 normal-case font-normal" style={{ color: VS.accent }}>
                      {editTaskForm.assigneeIds.length} selected
                    </span>
                  )}
                </label>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${VS.border}`, maxHeight: '152px', overflowY: 'auto' }}
                >
                  {orgMembers.length === 0 ? (
                    <div className="px-3 py-3 text-xs" style={{ color: VS.text2 }}>No members found</div>
                  ) : orgMembers.map((m, i) => {
                    const selected = editTaskForm.assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setEditTaskForm(p => ({
                          ...p,
                          assigneeIds: selected
                            ? p.assigneeIds.filter(id => id !== m.id)
                            : [...p.assigneeIds, m.id],
                        }))}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
                        style={{
                          background: selected ? `${VS.accent}22` : i % 2 === 0 ? VS.bg3 : 'transparent',
                          borderBottom: i < orgMembers.length - 1 ? `1px solid ${VS.border}` : 'none',
                          color: selected ? VS.text0 : VS.text1,
                        }}
                      >
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: avatarGradient(m.name || m.email) }}
                        >
                          {getInitials(m.name || m.email)}
                        </div>
                        <span className="flex-1 text-xs truncate">{m.name || m.email}</span>
                        {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: VS.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Priority</label>
                  <select
                    value={editTaskForm.priority}
                    onChange={e => setEditTaskForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: PRIORITY_CONFIG[editTaskForm.priority]?.text || VS.text1 }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Est. Time</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={Math.floor(editTaskForm.estimatedHours)}
                        onChange={e => {
                          const h = Math.max(0, parseInt(e.target.value) || 0);
                          const m = Math.round((editTaskForm.estimatedHours % 1) * 60);
                          setEditTaskForm(p => ({ ...p, estimatedHours: h + m / 60 }));
                        }}
                        className={inputCls}
                        style={{ ...inputStyle, paddingRight: 28 }}
                        min="0"
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>h</span>
                    </div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={Math.round((editTaskForm.estimatedHours % 1) * 60)}
                        onChange={e => {
                          const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                          const h = Math.floor(editTaskForm.estimatedHours);
                          setEditTaskForm(p => ({ ...p, estimatedHours: h + m / 60 }));
                        }}
                        className={inputCls}
                        style={{ ...inputStyle, paddingRight: 28 }}
                        min="0" max="59"
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>m</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Project</label>
                  <select
                    value={editTaskForm.projectId}
                    onChange={e => setEditTaskForm(p => ({ ...p, projectId: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  >
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Due Date</label>
                  <input
                    type="date"
                    value={editTaskForm.dueDate}
                    onChange={e => setEditTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                    className={inputCls}
                    style={{ ...inputStyle, color: VS.text1 }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Tags</label>
                <input
                  type="text"
                  value={editTaskForm.tags}
                  onChange={e => setEditTaskForm(p => ({ ...p, tags: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskFormLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: VS.accent, opacity: taskFormLoading ? 0.6 : 1 }}
                >
                  {taskFormLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
