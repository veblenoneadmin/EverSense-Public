import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  Building2,
  Plus,
  Calendar,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Activity,
  Edit3,
  Trash2,
  CheckSquare,
  Zap,
  Eye,
  X,
  User,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { ProjectModal } from '../components/ProjectModal';

import { VS } from '../lib/theme';

const PROJECT_STATUS: Record<string, { label: string; accent: string; bg: string; text: string }> = {
  planning:  { label: 'Planning',  accent: VS.blue,   bg: 'rgba(86,156,214,0.12)',  text: VS.blue   },
  active:    { label: 'Active',    accent: VS.teal,   bg: 'rgba(78,201,176,0.12)',  text: VS.teal   },
  on_hold:   { label: 'On Hold',   accent: VS.red,    bg: 'rgba(244,71,71,0.12)',   text: VS.red    },
  completed: { label: 'Completed', accent: VS.green,  bg: 'rgba(106,153,85,0.12)',  text: VS.green  },
  cancelled: { label: 'Cancelled', accent: VS.orange, bg: 'rgba(206,145,120,0.12)', text: VS.orange },
};

const PROJECT_PRIORITY: Record<string, { label: string; text: string; border: string }> = {
  high:   { label: 'HIGH', text: VS.red,    border: VS.red    },
  medium: { label: 'MED',  text: VS.yellow, border: VS.yellow },
  low:    { label: 'LOW',  text: VS.teal,   border: VS.teal   },
};

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'To Do',       color: VS.text2  },
  in_progress: { label: 'In Progress', color: VS.blue   },
  on_hold:     { label: 'On Hold',     color: VS.orange },
  completed:   { label: 'Done',        color: VS.green  },
  cancelled:   { label: 'Cancelled',   color: VS.red    },
};

const TASK_PRIORITY: Record<string, { label: string; color: string }> = {
  High:   { label: 'HIGH', color: VS.red    },
  Medium: { label: 'MED',  color: VS.yellow },
  Low:    { label: 'LOW',  color: VS.teal   },
};

interface DatabaseProject {
  id: string;
  name: string;
  description: string | null;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  client?: { id: string; name: string; email: string } | null;
  clientId?: string | null;
  clientName?: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  spent: number;
  progress: number;
  estimatedHours: number;
  hoursLogged: number;
  color: string;
  createdAt: string;
  updatedAt: string;
  orgId: string;
  teamMembers?: string[];
  tasks?: { total: number; completed: number; inProgress: number; pending: number };
  tags?: string[];
}

interface OverviewTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  estimatedHours: number;
  requiredSkills: string[];
  assignee: {
    userId: string;
    name: string;
    email: string;
    image: string | null;
    workload?: number;
    skillScore?: number;
    topSkillName?: string | null;
    topSkillLevel?: number;
  } | null;
}

const parseClientFromDescription = (description: string | null): string | null => {
  if (!description) return null;
  const match = description.match(/^CLIENT:([^|]+)\|DESC:/);
  return match ? match[1] : null;
};

const parseDescriptionFromCombined = (description: string | null): string => {
  if (!description) return '';
  const match = description.match(/^CLIENT:[^|]+\|DESC:(.*)$/);
  return match ? match[1] : description;
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':    return <Activity className="h-4 w-4" />;
    case 'completed': return <CheckCircle2 className="h-4 w-4" />;
    case 'on_hold':   return <AlertCircle className="h-4 w-4" />;
    case 'planning':  return <Target className="h-4 w-4" />;
    default:          return <Building2 className="h-4 w-4" />;
  }
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const inputCls = 'px-3 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 };

// ── Overview Modal ─────────────────────────────────────────────────────────────
function OverviewModal({
  project,
  tasks,
  loading,
  onClose,
  onRegenerate,
  regenerating,
}: {
  project: DatabaseProject;
  tasks: OverviewTask[];
  loading: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const sCfg = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;

  const taskStats = {
    total:      tasks.length,
    done:       tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    todo:       tasks.filter(t => t.status === 'not_started').length,
    assigned:   tasks.filter(t => t.assignee).length,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${VS.border}` }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${sCfg.accent}, ${sCfg.accent}99)` }}>
              {getStatusIcon(project.status)}
            </div>
            <div>
              <p className="text-[15px] font-bold" style={{ color: VS.text0 }}>{project.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: sCfg.bg, color: sCfg.text, border: `1px solid ${sCfg.accent}44` }}>
                  {sCfg.label}
                </span>
                <span className="text-[11px]" style={{ color: VS.text2 }}>
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: VS.text2 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = VS.bg3; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-px shrink-0"
          style={{ background: VS.border, borderBottom: `1px solid ${VS.border}` }}>
          {[
            { label: 'Total Tasks', value: taskStats.total,      color: VS.blue   },
            { label: 'Assigned',    value: taskStats.assigned,   color: VS.teal   },
            { label: 'In Progress', value: taskStats.inProgress, color: VS.yellow },
            { label: 'Done',        value: taskStats.done,       color: VS.green  },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-3" style={{ background: VS.bg2 }}>
              <p className="text-[18px] font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: VS.text2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: VS.accent }} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckSquare className="h-8 w-8 mb-3" style={{ color: VS.text2 }} />
              <p className="text-sm font-medium" style={{ color: VS.text1 }}>No tasks yet</p>
              <p className="text-xs mt-1" style={{ color: VS.text2 }}>Click "Generate Tasks" to auto-create tasks for this project</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                  {['Task', 'Skills', 'Priority', 'Assignee', 'Hours', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: VS.text2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, i) => {
                  const tStatus = TASK_STATUS[task.status]   || { label: task.status, color: VS.text2 };
                  const tPri    = TASK_PRIORITY[task.priority] || { label: task.priority?.toUpperCase() || '—', color: VS.text2 };
                  return (
                    <tr key={task.id}
                      style={{ background: i % 2 === 0 ? 'transparent' : `${VS.bg2}66`, borderBottom: `1px solid ${VS.border}22` }}>
                      {/* Task title */}
                      <td className="px-4 py-3" style={{ maxWidth: 200 }}>
                        <p className="font-medium truncate" style={{ color: VS.text0 }}>{task.title}</p>
                        {task.description && (
                          <p className="truncate mt-0.5" style={{ color: VS.text2 }}>{task.description}</p>
                        )}
                      </td>
                      {/* Required skills */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {task.requiredSkills.length ? task.requiredSkills.map(s => (
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{ background: `${VS.purple}22`, color: VS.purple, border: `1px solid ${VS.purple}44` }}>
                              {s}
                            </span>
                          )) : <span style={{ color: VS.text2 }}>—</span>}
                        </div>
                      </td>
                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: tPri.color }}>{tPri.label}</span>
                      </td>
                      {/* Assignee */}
                      <td className="px-4 py-3">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg, hsl(252 87% 62%), hsl(260 80% 70%))' }}>
                              {getInitials(task.assignee.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium" style={{ color: VS.text0, maxWidth: 100 }}>{task.assignee.name}</p>
                              {task.assignee.topSkillName && (
                                <p className="truncate" style={{ color: VS.teal, maxWidth: 100 }}>
                                  {task.assignee.topSkillName} {'★'.repeat(task.assignee.topSkillLevel || 0)}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5" style={{ color: VS.text2 }}>
                            <User className="h-3.5 w-3.5" />
                            Unassigned
                          </div>
                        )}
                      </td>
                      {/* Estimated hours */}
                      <td className="px-4 py-3" style={{ color: VS.text1 }}>
                        {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: `${tStatus.color}18`, color: tStatus.color, border: `1px solid ${tStatus.color}44` }}>
                          {tStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderTop: `1px solid ${VS.border}` }}>
          <p className="text-[11px]" style={{ color: VS.text2 }}>
            Staff are auto-assigned based on skill rating and current workload
          </p>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: VS.accent }}
          >
            {regenerating ? (
              <><div className="h-3 w-3 border border-white/40 border-t-white rounded-full animate-spin" /> Generating...</>
            ) : (
              <><Zap className="h-3.5 w-3.5" /> Regenerate Tasks</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Projects() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  const [projects, setProjects] = useState<DatabaseProject[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; email?: string; company?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<DatabaseProject | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [userRole, setUserRole] = useState<string>('');

  // ── Tasks dropdown per card ──
  const [expandedTasksId, setExpandedTasksId] = useState<string | null>(null);
  const [projectTasksMap, setProjectTasksMap] = useState<Record<string, { id: string; title: string; status: string; priority: string; assignee?: string }[]>>({});
  const [tasksFetchingId, setTasksFetchingId] = useState<string | null>(null);

  const toggleProjectTasks = async (projectId: string) => {
    if (expandedTasksId === projectId) { setExpandedTasksId(null); return; }
    setExpandedTasksId(projectId);
    if (projectTasksMap[projectId]) return; // already cached
    setTasksFetchingId(projectId);
    try {
      const data = await apiClient.fetch(`/api/tasks?projectId=${projectId}`);
      setProjectTasksMap(m => ({ ...m, [projectId]: data.tasks || [] }));
    } catch { /* ignore */ }
    finally { setTasksFetchingId(null); }
  };

  // ── Overview / generate state ──
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [overviewProject, setOverviewProject] = useState<DatabaseProject | null>(null);
  const [overviewTasks, setOverviewTasks] = useState<OverviewTask[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchClients = async () => {
    try {
      const data = await apiClient.fetch('/api/clients/slim');
      if (data.success) setClients(data.clients || []);
    } catch { /* ignore */ }
  };

  const fetchProjects = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      // Backend handles CLIENT role filtering via membership check
      const data = await apiClient.fetch(`/api/projects?userId=${session.user.id}&limit=100`);
      if (data.success) setProjects(data.projects || []);
      else setProjects([]);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (session?.user?.id) {
      // Sync role from OrganizationContext for UI gating (hide/show buttons)
      const role = currentOrg?.role || '';
      setUserRole(role);
      fetchProjects();
      fetchClients();
    }
  }, [session?.user?.id, currentOrg?.id, currentOrg?.role]);

  const handleDeleteProject = async (project: DatabaseProject) => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      const data = await apiClient.fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (data.success) await fetchProjects();
    } catch { alert('Failed to delete project.'); }
  };

  const handleUpdateProject = async (projectData: any) => {
    if (!editingProject) return;
    try {
      const clientName         = projectData.clientName || '';
      const description        = projectData.description || '';
      const combinedDescription = clientName ? `CLIENT:${clientName}|DESC:${description}` : description;
      const data = await apiClient.fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectData.name, description: combinedDescription,
          priority: projectData.priority || 'medium', status: projectData.status || 'planning',
          budget: projectData.budget ? parseFloat(projectData.budget) : undefined,
          startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
          endDate: projectData.endDate ? new Date(projectData.endDate).toISOString() : undefined,
          color: projectData.color || 'bg-primary',
          clientId: projectData.clientId || undefined,
        }),
      });
      if (data.success) { await fetchProjects(); setEditingProject(null); }
    } catch { /* ignore */ }
  };

  const handleCreateProject = async (projectData: any) => {
    try {
      const orgId              = currentOrg?.id || 'org_1757046595553';
      const clientName         = projectData.clientName || '';
      const description        = projectData.description || '';
      const combinedDescription = clientName ? `CLIENT:${clientName}|DESC:${description}` : description;
      const data = await apiClient.fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId, name: projectData.name, description: combinedDescription,
          priority: projectData.priority || 'medium', status: projectData.status || 'planning',
          budget: projectData.budget ? parseFloat(projectData.budget) : undefined,
          startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
          endDate: projectData.endDate ? new Date(projectData.endDate).toISOString() : undefined,
          color: projectData.color || 'bg-primary',
          clientId: projectData.clientId || undefined,
        }),
      });
      if (data.success) { await fetchProjects(); setShowNewProjectModal(false); }
    } catch { /* ignore */ }
  };

  // ── Generate tasks for a project ──────────────────────────────────────────
  const handleGenerateTasks = async (project: DatabaseProject) => {
    setGeneratingId(project.id);
    try {
      const data = await apiClient.fetch(`/api/projects/${project.id}/generate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (data.success) {
        setOverviewProject(project);
        setOverviewTasks(data.tasks || []);
        await fetchProjects();
      } else {
        alert(data.error || 'Failed to generate tasks');
      }
    } catch {
      alert('Failed to generate tasks. Please try again.');
    } finally {
      setGeneratingId(null);
    }
  };

  // ── Load existing tasks for a project ─────────────────────────────────────
  const handleViewOverview = async (project: DatabaseProject) => {
    setOverviewProject(project);
    setOverviewTasks([]);
    setOverviewLoading(true);
    try {
      const data = await apiClient.fetch(`/api/projects/${project.id}/overview`);
      if (data.success) setOverviewTasks(data.tasks || []);
    } catch { /* ignore */ }
    finally { setOverviewLoading(false); }
  };

  // ── Regenerate tasks from overview modal ──────────────────────────────────
  const handleRegenerate = async () => {
    if (!overviewProject) return;
    setRegenerating(true);
    try {
      const data = await apiClient.fetch(`/api/projects/${overviewProject.id}/generate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (data.success) {
        // Reload the full overview (includes previously generated tasks too)
        const ov = await apiClient.fetch(`/api/projects/${overviewProject.id}/overview`);
        if (ov.success) setOverviewTasks(ov.tasks || []);
        await fetchProjects();
      }
    } catch { /* ignore */ }
    finally { setRegenerating(false); }
  };

  const filteredProjects = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterPriority !== 'all' && p.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total:     projects.length,
    active:    projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalHours: projects.reduce((s, p) => s + p.hoursLogged, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Header bar ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4"
        style={{ borderBottom: `1px solid ${VS.border}` }}
      >
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: VS.text0 }}>
            Projects
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded align-middle"
              style={{ background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}` }}>
              Portfolio
            </span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: VS.text2 }}>
            {filteredProjects.length}{filteredProjects.length !== projects.length ? ` / ${projects.length}` : ''} projects
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls} style={inputStyle}>
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={inputCls} style={inputStyle}>
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {userRole !== 'CLIENT' && (
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: VS.accent }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px shrink-0"
        style={{ background: VS.border, borderBottom: `1px solid ${VS.border}` }}
      >
        {[
          { label: 'Total',     value: stats.total,     icon: Building2,    color: VS.blue   },
          { label: 'Active',    value: stats.active,    icon: Activity,     color: VS.teal   },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: VS.green  },
          { label: 'Hrs Logged', value: `${stats.totalHours}h`, icon: Clock, color: VS.yellow },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 px-5 py-3" style={{ background: VS.bg1 }}>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${s.color}18`, border: `1px solid ${s.color}44` }}>
                <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-base font-bold leading-tight" style={{ color: VS.text0 }}>{s.value}</p>
                <p className="text-[10px]" style={{ color: VS.text2 }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Projects grid ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {filteredProjects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ border: `1px dashed ${VS.border}` }}
          >
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: VS.bg3 }}>
              <Building2 className="h-6 w-6" style={{ color: VS.text2 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: VS.text1 }}>No projects found</p>
            <p className="text-xs mt-1" style={{ color: VS.text2 }}>
              {filterStatus !== 'all' || filterPriority !== 'all' ? 'Try adjusting your filters' : 'Create your first project to get started'}
            </p>
            {userRole !== 'CLIENT' && (
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ background: VS.accent }}
              >
                <Plus className="h-3.5 w-3.5" /> New Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map(project => {
              const sCfg    = PROJECT_STATUS[project.status] || PROJECT_STATUS.planning;
              const pCfg    = PROJECT_PRIORITY[project.priority] || PROJECT_PRIORITY.medium;
              const client  = project.client?.name || parseClientFromDescription(project.description);
              const desc    = parseDescriptionFromCombined(project.description);
              const isOver  = project.endDate && new Date(project.endDate) < new Date() && project.status !== 'completed' && project.status !== 'cancelled';
              const isGenerating = generatingId === project.id;

              return (
                <div
                  key={project.id}
                  className="rounded-2xl overflow-hidden transition-all duration-150 relative group"
                  style={{
                    background:  VS.bg2,
                    border:      `1px solid ${sCfg.accent}44`,
                    borderTop:   `3px solid ${sCfg.accent}`,
                    boxShadow:   '0 4px 20px rgba(0,0,0,0.4)',
                    opacity:     isGenerating ? 0.7 : 1,
                  }}
                >
                  {/* Generating overlay */}
                  {isGenerating && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl"
                      style={{ background: 'rgba(0,0,0,0.55)' }}>
                      <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: VS.teal }} />
                      <p className="text-[12px] font-semibold" style={{ color: VS.teal }}>Generating tasks…</p>
                    </div>
                  )}

                  {/* ── Card header ── */}
                  <div className="px-4 pt-5 pb-3">
                    <div className="flex items-start gap-2">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ background: `linear-gradient(135deg, ${sCfg.accent}, ${sCfg.accent}99)` }}
                      >
                        {getStatusIcon(project.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold leading-snug" style={{ color: VS.text0 }}>{project.name}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: VS.text2 }}>
                          {client || 'No client assigned'}
                        </p>
                      </div>

                      {/* Context menu */}
                      <div className="relative shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                          className="h-6 w-6 flex items-center justify-center rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          style={{ color: VS.text2, background: VS.bg3 }}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {openMenuId === project.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden py-1 min-w-[150px]"
                              style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                            >
                              {/* Generate Tasks — owner/admin only */}
                              {(userRole === 'OWNER' || userRole === 'ADMIN') && (
                                <button
                                  onClick={() => { setOpenMenuId(null); handleGenerateTasks(project); }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                  style={{ color: VS.teal }}
                                >
                                  <Zap className="h-3 w-3" /> Generate Tasks
                                </button>
                              )}
                              {/* View Overview */}
                              <button
                                onClick={() => { setOpenMenuId(null); handleViewOverview(project); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                style={{ color: VS.blue }}
                              >
                                <Eye className="h-3 w-3" /> View Overview
                                <ChevronRight className="h-3 w-3 ml-auto" />
                              </button>
                              {/* Edit & Delete — owner/admin only */}
                              {(userRole === 'OWNER' || userRole === 'ADMIN') && (
                                <>
                                  <div style={{ height: 1, background: VS.border, margin: '2px 0' }} />
                                  <button
                                    onClick={() => { setEditingProject(project); setOpenMenuId(null); }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                                    style={{ color: VS.text0 }}
                                  >
                                    <Edit3 className="h-3 w-3" /> Edit project
                                  </button>
                                  <div style={{ height: 1, background: VS.border, margin: '2px 0' }} />
                                  <button
                                    onClick={() => { setOpenMenuId(null); handleDeleteProject(project); }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-500/10 transition-colors"
                                    style={{ color: VS.red }}
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-[12px] mt-2.5 line-clamp-2 leading-relaxed" style={{ color: VS.text2 }}>
                      {desc || '\u00a0'}
                    </p>

                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: sCfg.bg, color: sCfg.text, border: `1px solid ${sCfg.accent}44` }}>
                        {sCfg.label}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                        style={{ background: `${pCfg.border}18`, color: pCfg.text, border: `1px solid ${pCfg.border}44` }}>
                        {pCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* ── Progress ── */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px]" style={{ color: VS.text2 }}>Progress</span>
                      <span className="text-[11px] font-semibold" style={{ color: VS.text1 }}>{project.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: VS.bg3 }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${sCfg.accent}, ${sCfg.accent}88)` }}
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px dashed ${VS.border}` }} />

                  {/* ── Stats row ── */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                        <CheckSquare className="h-3.5 w-3.5" />
                        {project.tasks?.completed || 0}/{project.tasks?.total || 0}
                      </span>
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                        <Clock className="h-3.5 w-3.5" />
                        {Number(project.hoursLogged) % 1 === 0 ? project.hoursLogged : Number(project.hoursLogged).toFixed(1)}h
                      </span>
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: isOver ? VS.red : VS.text2 }}>
                      {project.endDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {fmtDate(project.endDate)}
                        </span>
                      ) : '—'}
                    </span>
                  </div>

                  {/* ── Tasks toggle ── */}
                  <div style={{ borderTop: `1px dashed ${VS.border}` }}>
                    <button
                      onClick={() => toggleProjectTasks(project.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] transition-colors hover:bg-white/5"
                      style={{ color: expandedTasksId === project.id ? VS.accent : VS.text2 }}
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5" />
                        Tasks ({project.tasks?.total || 0})
                      </span>
                      {tasksFetchingId === project.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : expandedTasksId === project.id
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </button>

                    {expandedTasksId === project.id && (
                      <div className="px-4 pb-3 space-y-1.5">
                        {(projectTasksMap[project.id] || []).length === 0 ? (
                          <p className="text-[11px] py-1" style={{ color: VS.text2 }}>No tasks yet</p>
                        ) : (projectTasksMap[project.id] || []).map(task => {
                          const tsCfg = TASK_STATUS[task.status] || { label: task.status, color: VS.text2 };
                          const tpCfg = TASK_PRIORITY[task.priority] || { label: task.priority, color: VS.text2 };
                          return (
                            <div key={task.id}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                              style={{ background: VS.bg3, border: `1px solid ${VS.border}` }}
                            >
                              <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: tsCfg.color }} />
                              <span className="flex-1 text-[12px] truncate" style={{ color: VS.text1 }}>{task.title}</span>
                              <span className="text-[10px] font-semibold shrink-0" style={{ color: tpCfg.color }}>{tpCfg.label}</span>
                              <span className="text-[10px] shrink-0" style={{ color: tsCfg.color }}>{tsCfg.label}</span>
                              {task.assignee && (
                                <span className="text-[10px] truncate max-w-[70px] shrink-0" style={{ color: VS.text2 }}>{task.assignee}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit modals ── */}
      <ProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSave={handleCreateProject}
        clients={clients}
      />
      <ProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSave={handleUpdateProject}
        clients={clients}
        project={editingProject ? {
          id: editingProject.id,
          name: editingProject.name,
          description: parseDescriptionFromCombined(editingProject.description),
          color: editingProject.color,
          status: editingProject.status,
          startDate: editingProject.startDate,
          endDate: editingProject.endDate,
          createdAt: new Date(editingProject.createdAt),
          updatedAt: new Date(editingProject.updatedAt),
          clientName: parseClientFromDescription(editingProject.description) || undefined,
        } : undefined}
      />

      {/* ── Project Overview Modal ── */}
      {overviewProject && (
        <OverviewModal
          project={overviewProject}
          tasks={overviewTasks}
          loading={overviewLoading}
          onClose={() => { setOverviewProject(null); setOverviewTasks([]); }}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
        />
      )}

      {/* Click-outside for context menus */}
      {openMenuId && <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
}
