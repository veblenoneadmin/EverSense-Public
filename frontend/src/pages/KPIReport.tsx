import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { useApiClient } from '../lib/api-client';
import {
  Star, TrendingUp, TrendingDown, Minus, AlertTriangle, Coffee,
  Users, Clock, CheckSquare, Target, BarChart3,
  Download, RefreshCw, ChevronDown, ChevronUp,
  DollarSign, Flame, AlertCircle, ArrowRight,
  Activity, Search, CalendarDays, X,
} from 'lucide-react';

import { VS } from '../lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserKPI {
  user: { id: string; name: string; email: string; image?: string };
  role: string;
  currentHours: number;
  previousHours: number;
  hoursTrend: number | null;
  utilizationRate: number;
  completedTasks: number;
  inProgressTasks: number;
  totalTasks: number;
  overdueTaskCount: number;
  taskCompletionRate: number;
  billableHours: number;
  billableRatio: number;
  estimationAccuracy: number | null;
  sessionCount: number;
  avgSessionLength: number;
  activeDays: number;
  classification: 'star' | 'overworked' | 'underperformer' | 'coaster' | 'solid' | 'inactive' | 'client';
  classificationReason: string;
  score: number | null;
}

interface ProjectHealth {
  id: string; name: string; status: string; color: string;
  budget: number; spent: number; budgetUsed: number | null;
  estimatedHours: number; hoursLogged: number; hoursUsed: number | null;
  progress: number; isOverBudget: boolean; isOverTime: boolean;
  taskCount: number; completedTaskCount: number;
}

interface OrgKPIs {
  totalHours: number; previousHours: number; hoursTrend: number | null;
  totalCompleted: number; totalTasks: number; totalOverdue: number;
  taskCompletionRate: number; billableHours: number; billableRatio: number;
  activeMembers: number; totalMembers: number;
  classificationCounts: Record<string, number>;
}

interface KPIData {
  period: string; label: string;
  dateRange: { start: string; end: string };
  orgKPIs: OrgKPIs;
  users: UserKPI[];
  projectHealth: ProjectHealth[];
}

type Period = 'daily' | 'weekly' | 'monthly';

// ─── Classification Config ────────────────────────────────────────────────────
const CLASS_CFG: Record<string, {
  label: string; color: string; icon: React.ElementType;
}> = {
  star:           { label: 'Star Performer', color: VS.yellow,  icon: Star          },
  overworked:     { label: 'Overworked',     color: VS.red,     icon: Flame         },
  underperformer: { label: 'Underperformer', color: VS.purple,  icon: TrendingDown  },
  coaster:        { label: 'Coasting',       color: VS.text2,   icon: Coffee        },
  solid:          { label: 'Solid',          color: VS.teal,    icon: CheckSquare   },
  inactive:       { label: 'Inactive',       color: VS.border2, icon: AlertCircle   },
};

// ─── Small helpers ────────────────────────────────────────────────────────────
function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px]" style={{ color: VS.text2 }}>—</span>;
  const isUp = value > 0, isFlat = value === 0;
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold"
      style={{ color: isFlat ? VS.text2 : isUp ? VS.teal : VS.red }}>
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: VS.bg2 }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  );
}

function Avatar({ name, image, size = 32 }: { name: string; image?: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const palette = [VS.blue, VS.purple, VS.teal, VS.yellow, VS.orange, VS.accent];
  const ci = (name?.charCodeAt(0) ?? 0) % palette.length;
  return image && !imgError
    ? <img src={image} alt={name} onError={() => setImgError(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: palette[ci], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>;
}

function ScoreRing({ score }: { score: number }) {
  const r = 18, circ = 2 * Math.PI * r;
  const color = score >= 80 ? VS.yellow : score >= 60 ? VS.teal : score >= 40 ? VS.text2 : VS.red;
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke={VS.bg2} strokeWidth="3" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function KPIReport() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'hours' | 'completion'>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [userRole, setUserRole] = useState<string>('STAFF');

  // Fetch current user's role in this org
  useEffect(() => {
    if (!session?.user?.id || !currentOrg?.id) return;
    apiClient.fetch('/api/organizations')
      .then((d: any) => {
        const org = d.organizations?.find((o: any) => o.id === currentOrg.id);
        if (org?.role) setUserRole(org.role);
      })
      .catch(() => {});
  }, [session?.user?.id, currentOrg?.id]);

  const fetchData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/kpi-report?orgId=${currentOrg.id}`;
      if (customStart && customEnd) {
        url += `&start=${customStart}&end=${customEnd}`;
      } else {
        url += `&period=${period}`;
      }
      const result = await apiClient.fetch(url);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, period, customStart, customEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpi = data?.orgKPIs;

  const isStaff = userRole === 'STAFF';

  const filteredUsers = (data?.users ?? [])
    .filter(u => u.classification !== 'client')
    // Staff can only see their own KPI
    .filter(u => !isStaff || u.user.id === session?.user?.id)
    .filter(u => !filterClass || u.classification === filterClass)
    .filter(u => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return u.user.name?.toLowerCase().includes(q) || u.user.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'hours') return b.currentHours - a.currentHours;
      return b.taskCompletionRate - a.taskCompletionRate;
    });

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ['Name', 'Role', 'Classification', 'Score', 'Hours', 'Utilization%', 'Completed', 'Completion%', 'Overdue', 'Billable%', 'Notes'],
      ...data.users.map(u => [
        u.user.name, u.role, u.classification, String(u.score ?? ''), String(u.currentHours),
        String(u.utilizationRate), String(u.completedTasks), String(u.taskCompletionRate),
        String(u.overdueTaskCount), String(u.billableRatio), u.classificationReason,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `kpi-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-6">
        <div className="h-8 rounded-lg w-56" style={{ background: VS.bg2 }} />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl" style={{ background: VS.bg1 }} />)}
        </div>
        <div className="h-64 rounded-xl" style={{ background: VS.bg1 }} />
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="text-center">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3" style={{ color: VS.red }} />
        <div className="text-[14px] mb-4" style={{ color: VS.text1 }}>{error}</div>
        <button onClick={fetchData}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold"
          style={{ background: `${VS.accent}18`, color: VS.accent, border: `1px solid ${VS.accent}33` }}>
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>
            {isStaff ? 'My KPI Report' : 'KPI Intelligence Report'}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>
            {data?.label} · {currentOrg?.name} · {isStaff ? 'Your personal performance' : 'Auto-classifying team performance'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period switcher */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${VS.border}` }}>
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button key={p} onClick={() => { setPeriod(p); setCustomStart(''); setCustomEnd(''); }}
                className="px-3 py-1.5 text-[12px] font-semibold transition-colors"
                style={{
                  background: !customStart && period === p ? VS.accent : VS.bg1,
                  color: !customStart && period === p ? '#fff' : VS.text2,
                  borderRight: p !== 'monthly' ? `1px solid ${VS.border}` : 'none',
                }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={fetchData}
            className="flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-white/5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}`, color: VS.text2 }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {!isStaff && (
            <button onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{ background: `${VS.accent}18`, color: VS.accent, border: `1px solid ${VS.accent}33` }}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px]"
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text2 }}>
            <Activity className="h-3.5 w-3.5" style={{ color: VS.teal }} />
            {currentOrg?.name}
          </div>
        </div>
      </div>

      {/* ── KPI strip (org-wide — hidden for staff) ── */}
      {!isStaff && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: 'Total Hours',     value: `${kpi?.totalHours ?? 0}h`,        icon: Clock,         color: VS.blue,   trend: kpi?.hoursTrend ?? null },
          { label: 'Tasks Completed', value: `${kpi?.totalCompleted ?? 0}`,      icon: CheckSquare,   color: VS.teal,   trend: null },
          { label: 'Completion Rate', value: `${kpi?.taskCompletionRate ?? 0}%`, icon: Target,        color: VS.yellow, trend: null },
          { label: 'Overdue Tasks',   value: `${kpi?.totalOverdue ?? 0}`,        icon: AlertTriangle, color: (kpi?.totalOverdue ?? 0) > 0 ? VS.red : VS.teal, trend: null },
          { label: 'Billable Hours',  value: `${kpi?.billableHours ?? 0}h`,      icon: DollarSign,    color: VS.orange, trend: null },
          { label: 'Active Members',  value: `${kpi?.activeMembers ?? 0}/${kpi?.totalMembers ?? 0}`, icon: Users, color: VS.purple, trend: null },
        ] as Array<{ label: string; value: string; icon: React.ElementType; color: string; trend: number | null }>).map(({ label, value, icon: Icon, color, trend }) => (
          <div key={label} className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>{label}</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: VS.text0 }}>{value}</div>
            </div>
            {trend !== null && (
              <div className="flex items-center gap-1"><TrendBadge value={trend} /><span className="text-[11px]" style={{ color: VS.text2 }}>vs prev period</span></div>
            )}
          </div>
        ))}
      </div>}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: User cards ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Filters panel — hidden for staff */}
          {!isStaff && <div className="rounded-xl p-4 space-y-3" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: VS.accent }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Filters</h2>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: VS.text2 }} />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 rounded-lg text-[12px] outline-none transition-colors"
                style={{
                  background: VS.bg2,
                  border: `1px solid ${searchQuery ? VS.accent + '66' : VS.border}`,
                  color: VS.text0,
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: VS.text2 }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: VS.text2 }} />
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg text-[12px] outline-none transition-colors"
                style={{
                  background: VS.bg2,
                  border: `1px solid ${customStart ? VS.accent + '66' : VS.border}`,
                  color: customStart ? VS.text0 : VS.text2,
                  colorScheme: 'dark',
                }}
              />
              <span className="text-[11px]" style={{ color: VS.text2 }}>to</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={e => setCustomEnd(e.target.value)}
                className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg text-[12px] outline-none transition-colors"
                style={{
                  background: VS.bg2,
                  border: `1px solid ${customEnd ? VS.accent + '66' : VS.border}`,
                  color: customEnd ? VS.text0 : VS.text2,
                  colorScheme: 'dark',
                }}
              />
              {(customStart || customEnd) && (
                <button onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text2 }}>
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {/* Classification chips */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(CLASS_CFG).map(([key, cfg]) => {
                const count = kpi?.classificationCounts?.[key] ?? 0;
                const Icon = cfg.icon;
                const active = filterClass === key;
                return (
                  <button key={key} onClick={() => setFilterClass(active ? null : key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{
                      background: active ? `${cfg.color}20` : VS.bg2,
                      border: `1px solid ${active ? cfg.color + '55' : VS.border}`,
                      color: active ? cfg.color : VS.text2,
                    }}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${cfg.color}22`, color: cfg.color }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>}

          {/* Sort + count */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
              {isStaff ? 'My Performance' : `Team Members (${filteredUsers.length})`}
            </span>
            {!isStaff && <div className="flex items-center gap-1">
              <span className="text-[11px] mr-1" style={{ color: VS.text2 }}>Sort:</span>
              {(['score', 'hours', 'completion'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                  style={{
                    background: sortBy === s ? VS.accent : VS.bg2,
                    color: sortBy === s ? '#fff' : VS.text2,
                    border: `1px solid ${sortBy === s ? VS.accent : VS.border}`,
                  }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>}
          </div>

          {/* User list */}
          {filteredUsers.length === 0 && (
            <div className="py-12 text-center text-[13px]" style={{ color: VS.text2 }}>
              No members match the selected filter.
            </div>
          )}
          <div className="space-y-2">
            {filteredUsers.map(u => {
              const cfg = CLASS_CFG[u.classification];
              const Icon = cfg.icon;
              const isExpanded = expandedUser === u.user.id;
              return (
                <div key={u.user.id} className="rounded-xl overflow-hidden transition-all"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedUser(isExpanded ? null : u.user.id)}>
                    <Avatar name={u.user.name || u.user.email} image={u.user.image} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: VS.text0 }}>
                          {u.user.name || u.user.email}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}33`, color: cfg.color }}>
                          <Icon className="h-2.5 w-2.5" /> {cfg.label}
                        </span>
                        <span className="text-[11px]" style={{ color: VS.text2 }}>{u.role}</span>
                      </div>
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: VS.text2 }}>{u.classificationReason}</div>
                      <div className="mt-1.5"><MiniBar value={u.utilizationRate} color={cfg.color} /></div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-[14px] font-bold tabular-nums" style={{ color: VS.text0 }}>{u.currentHours}h</div>
                        <TrendBadge value={u.hoursTrend} />
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="text-[14px] font-bold tabular-nums" style={{ color: VS.text0 }}>{u.taskCompletionRate}%</div>
                        <div className="text-[10px]" style={{ color: VS.text2 }}>Done</div>
                      </div>
                      {u.score !== null && <ScoreRing score={u.score} />}
                      <div style={{ color: VS.text2 }}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${VS.border}` }}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {([
                          { label: 'Utilization',  value: `${u.utilizationRate}%`,  sub: 'vs expected',          color: u.utilizationRate >= 90 ? VS.teal : u.utilizationRate >= 70 ? VS.yellow : VS.red },
                          { label: 'Completed',    value: `${u.completedTasks}`,    sub: `of ${u.totalTasks}`,   color: VS.blue   },
                          { label: 'Overdue',      value: `${u.overdueTaskCount}`,  sub: 'tasks past due',       color: u.overdueTaskCount > 0 ? VS.red : VS.teal },
                          { label: 'Billable',     value: `${u.billableRatio}%`,    sub: `${u.billableHours}h`,  color: VS.orange  },
                          { label: 'Avg Session',  value: `${u.avgSessionLength}h`, sub: `${u.sessionCount} sessions`, color: VS.purple },
                          { label: 'Active Days',  value: `${u.activeDays}`,        sub: 'days logged',          color: VS.yellow  },
                          { label: 'In Progress',  value: `${u.inProgressTasks}`,   sub: 'active tasks',         color: VS.accent  },
                          ...(u.estimationAccuracy !== null ? [{ label: 'Est. Accuracy', value: `${u.estimationAccuracy}%`, sub: 'estimate accuracy', color: (u.estimationAccuracy ?? 0) >= 80 ? VS.teal : VS.yellow }] : []),
                        ] as Array<{ label: string; value: string; sub: string; color: string }>).map(({ label, value, sub, color }) => (
                          <div key={label} className="rounded-lg p-3"
                            style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}>
                            <div className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</div>
                            <div className="text-[11px] font-semibold mt-0.5" style={{ color: VS.text1 }}>{label}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: VS.text2 }}>{sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Summary panels ── */}
        <div className="space-y-6">

          {/* Classification breakdown */}
          <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4" style={{ color: VS.purple }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Classification Breakdown</h2>
            </div>
            <div className="space-y-2.5">
              {Object.entries(CLASS_CFG).map(([key, cfg]) => {
                const count = kpi?.classificationCounts?.[key] ?? 0;
                const total = kpi?.totalMembers ?? 1;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const Icon = cfg.icon;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.color }} />
                    <div className="w-24 text-[12px] font-medium shrink-0" style={{ color: VS.text1 }}>{cfg.label}</div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: VS.bg2 }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                    <div className="text-[12px] font-bold tabular-nums w-5 text-right" style={{ color: VS.text0 }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Health */}
          {(data?.projectHealth ?? []).length > 0 && (
            <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4" style={{ color: VS.orange }} />
                <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Project Health</h2>
                <a href="/projects" className="ml-auto flex items-center gap-1 text-[11px] hover:opacity-70"
                  style={{ color: VS.accent }}>
                  View <ArrowRight className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-4">
                {(data?.projectHealth ?? []).map(p => (
                  <div key={p.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span className="text-[12px] font-medium flex-1 truncate" style={{ color: VS.text1 }}>{p.name}</span>
                      {p.isOverBudget && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${VS.red}18`, color: VS.red }}>Over Budget</span>
                      )}
                      {p.isOverTime && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${VS.yellow}18`, color: VS.yellow }}>Over Time</span>
                      )}
                    </div>
                    {p.hoursUsed !== null && (
                      <div className="mb-1">
                        <div className="flex justify-between text-[10px] mb-1" style={{ color: VS.text2 }}>
                          <span>{p.hoursLogged}h / {p.estimatedHours}h</span>
                          <span>{p.hoursUsed}%</span>
                        </div>
                        <MiniBar value={p.hoursUsed} color={p.hoursUsed > 100 ? VS.red : VS.blue} />
                      </div>
                    )}
                    {p.budgetUsed !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] mb-1" style={{ color: VS.text2 }}>
                          <span>${p.spent} / ${p.budget}</span>
                          <span>{p.budgetUsed}%</span>
                        </div>
                        <MiniBar value={p.budgetUsed} color={p.budgetUsed > 100 ? VS.red : VS.teal} />
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px]" style={{ color: VS.text2 }}>
                        {p.completedTaskCount}/{p.taskCount} tasks · {p.progress}% done
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold capitalize"
                        style={{
                          background: p.status === 'active' ? `${VS.teal}18` : p.status === 'completed' ? `${VS.blue}18` : `${VS.text2}18`,
                          color: p.status === 'active' ? VS.teal : p.status === 'completed' ? VS.blue : VS.text2,
                        }}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue alerts */}
          {(kpi?.totalOverdue ?? 0) > 0 && (
            <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid rgba(244,71,71,0.25)` }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" style={{ color: VS.red }} />
                <h2 className="text-[13px] font-bold" style={{ color: VS.red }}>Overdue Tasks</h2>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: `${VS.red}18`, color: VS.red }}>{kpi?.totalOverdue}</span>
              </div>
              <div className="space-y-2">
                {filteredUsers.filter(u => u.overdueTaskCount > 0).slice(0, 6).map(u => (
                  <div key={u.user.id} className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: VS.red }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] truncate" style={{ color: VS.text1 }}>{u.user.name || u.user.email}</div>
                    </div>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: VS.red }}>
                      {u.overdueTaskCount} overdue
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default KPIReport;
