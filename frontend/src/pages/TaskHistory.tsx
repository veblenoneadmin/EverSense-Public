import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  CheckCircle2, XCircle, Search, Filter, Clock,
  User, FolderOpen, CalendarDays, ChevronDown, ChevronUp,
  Users,
} from 'lucide-react';
import { VS } from '../lib/theme';

interface HistoryTask {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'cancelled';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  projectId?: string;
  project?: string;
  estimatedHours: number;
  actualHours: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  assignee?: string;
  assignees?: { id: string; name: string; email: string }[];
  tags: string[];
}

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: VS.purple,
  High:   VS.red,
  Medium: VS.yellow,
  Low:    VS.teal,
};

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

function avatarGradient(name?: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtHours(h: number) {
  if (!h) return '0m';
  const mins = Math.round(h * 60);
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs === 0) return `${m}m`;
  if (m === 0) return `${hrs}h`;
  return `${hrs}h ${m}m`;
}

export function TaskHistory() {
  const { data: session } = useSession();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const apiClient = useApiClient();

  const [tasks, setTasks] = useState<HistoryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'title_asc'>('date_desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isAdminOrOwner = currentOrg?.role === 'OWNER' || currentOrg?.role === 'ADMIN';
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    if (!session?.user?.id || !currentOrg?.id) return;
    fetchHistory();
  }, [session?.user?.id, currentOrg?.id, showAllTasks]);

  const fetchHistory = async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    try {
      setLoading(true);
      const userParam = (isAdminOrOwner && !showAllTasks) ? `&userId=${session.user.id}` : '';
      const [completedRes, cancelledRes] = await Promise.all([
        apiClient.fetch(`/api/tasks?status=completed&limit=200${userParam}`),
        apiClient.fetch(`/api/tasks?status=cancelled&limit=200${userParam}`),
      ]);
      const completed = (completedRes.tasks || []).map((t: any) => ({ ...t, tags: t.tags || [] }));
      const cancelled = (cancelledRes.tasks || []).map((t: any) => ({ ...t, tags: t.tags || [] }));
      setTasks([...completed, ...cancelled]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const filtered = tasks
    .filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(t.priority)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const cancelledCount = tasks.filter(t => t.status === 'cancelled').length;

  if (!session || orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5 sm:p-7">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: VS.text0 }}>Task History</h1>
          <p className="text-[13px] mt-0.5" style={{ color: VS.text2 }}>
            {completedCount} completed · {cancelledCount} cancelled
          </p>
        </div>
        {isAdminOrOwner && (
          <button
            onClick={() => setShowAllTasks(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all hover:opacity-90"
            style={showAllTasks
              ? { background: VS.blue, border: `1px solid ${VS.blue}`, color: '#fff' }
              : { background: VS.bg1, border: `2px solid ${VS.border2}`, color: VS.text1, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }
            }
          >
            {showAllTasks ? <><User className="h-3.5 w-3.5" /> My Tasks</> : <><Users className="h-3.5 w-3.5" /> All Tasks</>}
          </button>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Completed', value: completedCount, color: VS.teal,   icon: CheckCircle2 },
          { label: 'Cancelled', value: cancelledCount, color: VS.red,    icon: XCircle },
          { label: 'Total Hours', value: fmtHours(tasks.reduce((s, t) => s + (t.actualHours || 0), 0)), color: VS.blue, icon: Clock },
          { label: 'Est. Hours', value: fmtHours(tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)), color: VS.purple, icon: CalendarDays },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums" style={{ color: VS.text0 }}>{value}</div>
              <div className="text-[11px]" style={{ color: VS.text2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text0 }}
          />
        </div>

        {/* Status tabs */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${VS.border}` }}>
          {(['all', 'completed', 'cancelled'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 text-[12px] font-medium transition-all capitalize"
              style={statusFilter === s
                ? { background: s === 'completed' ? VS.teal : s === 'cancelled' ? VS.red : VS.accent, color: '#fff' }
                : { background: VS.bg2, color: VS.text2 }
              }
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Filter */}
        <div className="relative">
          <button
            onClick={() => setShowFilter(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors"
            style={{
              background: priorityFilter.length > 0 ? `${VS.blue}22` : VS.bg2,
              border: `1px solid ${priorityFilter.length > 0 ? VS.blue : VS.border}`,
              color: priorityFilter.length > 0 ? VS.blue : VS.text1,
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            Priority
            {priorityFilter.length > 0 && (
              <span className="h-4 w-4 rounded-full text-[10px] flex items-center justify-center font-bold" style={{ background: VS.blue, color: '#fff' }}>
                {priorityFilter.length}
              </span>
            )}
          </button>
          {showFilter && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
              <div className="absolute top-full mt-2 left-0 z-20 rounded-xl p-3 space-y-1.5" style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 160 }}>
                {(['Urgent', 'High', 'Medium', 'Low'] as const).map(p => {
                  const active = priorityFilter.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] transition-all"
                      style={{ background: active ? `${PRIORITY_COLOR[p]}22` : 'transparent', color: active ? PRIORITY_COLOR[p] : VS.text1, border: `1px solid ${active ? PRIORITY_COLOR[p] + '55' : 'transparent'}` }}
                    >
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[p] }} />
                      {p}
                    </button>
                  );
                })}
                {priorityFilter.length > 0 && (
                  <button onClick={() => setPriorityFilter([])} className="w-full text-[11px] py-1 rounded text-center mt-1" style={{ color: VS.text2, background: VS.bg3 }}>
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-lg text-[12px] focus:outline-none"
          style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      {/* ── Task list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: VS.accent }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
          <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: VS.border2 }} />
          <p className="text-[14px] font-medium" style={{ color: VS.text2 }}>No tasks found</p>
          <p className="text-[12px] mt-1" style={{ color: VS.text2 }}>Completed and cancelled tasks will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const isCompleted = task.status === 'completed';
            const statusColor = isCompleted ? VS.teal : VS.red;
            const StatusIcon = isCompleted ? CheckCircle2 : XCircle;
            const isExpanded = expandedId === task.id;
            const people = task.assignees && task.assignees.length > 0
              ? task.assignees
              : task.assignee ? [{ id: '', name: task.assignee, email: '' }] : [];

            return (
              <div
                key={task.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
              >
                {/* Main row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                >
                  {/* Status icon */}
                  <StatusIcon className="h-4 w-4 shrink-0" style={{ color: statusColor }} />

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold truncate" style={{ color: VS.text0 }}>{task.title}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                        style={{ background: `${PRIORITY_COLOR[task.priority]}18`, color: PRIORITY_COLOR[task.priority] }}
                      >
                        {task.priority}
                      </span>
                      {task.project && (
                        <span className="text-[11px] flex items-center gap-1 shrink-0" style={{ color: VS.text2 }}>
                          <FolderOpen className="h-3 w-3" /> {task.project}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px]" style={{ color: VS.text2 }}>
                        {isCompleted ? 'Completed' : 'Cancelled'} {fmtDate(task.completedAt || task.updatedAt)}
                      </span>
                      {task.actualHours > 0 && (
                        <span className="text-[11px] flex items-center gap-1" style={{ color: VS.text2 }}>
                          <Clock className="h-3 w-3" /> {fmtHours(task.actualHours)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Avatars */}
                  <div className="flex -space-x-2 shrink-0">
                    {people.slice(0, 3).map((a, i) => (
                      <div
                        key={a.id || i}
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2"
                        style={{ background: avatarGradient(a.name || a.email) }}
                        title={a.name || a.email}
                      >
                        {getInitials(a.name || a.email)}
                      </div>
                    ))}
                    {people.length === 0 && (
                      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: VS.bg3 }}>
                        <User className="h-3.5 w-3.5" style={{ color: VS.text2 }} />
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 hidden sm:inline"
                    style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}33` }}
                  >
                    {isCompleted ? 'Completed' : 'Cancelled'}
                  </span>

                  {/* Expand */}
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: VS.text2 }} />
                    : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: VS.text2 }} />
                  }
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: `1px solid ${VS.border}` }}>
                    {task.description && (
                      <p className="text-[13px] leading-relaxed" style={{ color: VS.text1 }}>{task.description}</p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg p-2.5" style={{ background: VS.bg2 }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: VS.text2 }}>Created</div>
                        <div className="text-[12px] font-medium" style={{ color: VS.text1 }}>{fmtDate(task.createdAt)}</div>
                      </div>
                      <div className="rounded-lg p-2.5" style={{ background: VS.bg2 }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: VS.text2 }}>{isCompleted ? 'Completed' : 'Cancelled'}</div>
                        <div className="text-[12px] font-medium" style={{ color: VS.text1 }}>{fmtDate(task.completedAt || task.updatedAt)}</div>
                      </div>
                      <div className="rounded-lg p-2.5" style={{ background: VS.bg2 }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: VS.text2 }}>Est. Hours</div>
                        <div className="text-[12px] font-medium" style={{ color: VS.text1 }}>{fmtHours(task.estimatedHours)}</div>
                      </div>
                      <div className="rounded-lg p-2.5" style={{ background: VS.bg2 }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: VS.text2 }}>Actual Hours</div>
                        <div className="text-[12px] font-medium" style={{ color: VS.text1 }}>{fmtHours(task.actualHours)}</div>
                      </div>
                    </div>
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: VS.bg2, color: VS.text2, border: `1px solid ${VS.border}` }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {people.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px]" style={{ color: VS.text2 }}>Assignees:</span>
                        {people.map((a, i) => (
                          <span key={a.id || i} className="text-[12px] flex items-center gap-1.5" style={{ color: VS.text1 }}>
                            <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: avatarGradient(a.name || a.email) }}>
                              {getInitials(a.name || a.email)}
                            </div>
                            {a.name || a.email}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
