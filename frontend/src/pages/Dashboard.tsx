import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pauseTaskTimer, resumeTaskTimer, stopTaskTimer } from '../lib/task-timer';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { ClientDashboard } from './ClientDashboard';
import { EverSenseLogo } from '../components/EverSenseLogo';
import {
  Clock, LogIn, LogOut, CheckCircle2, Timer, AlertTriangle,
  FolderOpen, Users, TrendingUp, TrendingDown, Minus,
  CheckSquare, BarChart3, ArrowRight, Circle,
  Target, Zap, CalendarClock, Activity,
} from 'lucide-react';

import { VS } from '../lib/theme';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtHours(s: number) {
  const h = s / 3600;
  return h < 0.1 ? '0h' : h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function fmtDate() {
  return new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Status display config
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: VS.text2,  bg: 'rgba(144,144,144,0.12)' },
  in_progress:  { label: 'In Progress', color: VS.blue,   bg: 'rgba(86,156,214,0.12)'  },
  completed:    { label: 'Completed',   color: VS.teal,   bg: 'rgba(78,201,176,0.12)'  },
  on_hold:      { label: 'On Hold',     color: VS.yellow, bg: 'rgba(220,220,170,0.12)' },
  cancelled:    { label: 'Cancelled',   color: VS.orange, bg: 'rgba(206,145,120,0.12)' },
};

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: VS.teal   },
  medium: { label: 'Medium', color: VS.yellow },
  high:   { label: 'High',   color: VS.red    },
  urgent: { label: 'Urgent', color: VS.purple },
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, icon: Icon, trend,
}: {
  label: string; value: string | number; sub?: string; color: string;
  icon: React.ElementType; trend?: { pct: number; dir: 'up' | 'down' | 'neutral' };
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>{label}</span>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: VS.text0 }}>{value}</div>
        {sub && <div className="text-[11px] mt-1" style={{ color: VS.text2 }}>{sub}</div>}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-[11px]">
          {trend.dir === 'up'   && <TrendingUp   className="h-3 w-3" style={{ color: VS.teal }} />}
          {trend.dir === 'down' && <TrendingDown  className="h-3 w-3" style={{ color: VS.red  }} />}
          {trend.dir === 'neutral' && <Minus      className="h-3 w-3" style={{ color: VS.text2 }} />}
          <span style={{ color: trend.dir === 'up' ? VS.teal : trend.dir === 'down' ? VS.red : VS.text2 }}>
            {trend.pct}% vs yesterday
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const { data: session } = useSession();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const navigate = useNavigate();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<{
    completedToday: number; completedTrend?: { pct: number; dir: 'up'|'down'|'neutral' };
    timeToday: number;      timeTrend?:      { pct: number; dir: 'up'|'down'|'neutral' };
    weekSeconds: number;
    overdue: number;
    activeProjects: number; projectsDueSoon: number;
    teamMembers: number;    activeToday: number;
    productivity: number;   productivityTrend?: { pct: number; dir: 'up'|'down'|'neutral' };
    projectStats: { total: number; active: number; completed: number; overdue: number };
  } | null>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Attendance state ───────────────────────────────────────────────────────
  const [attendanceActive, setAttendanceActive] = useState<{ id: string; timeIn: string } | null>(null);
  const [attendanceElapsed, setAttendanceElapsed] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [onBreak, setOnBreak] = useState(() => !!localStorage.getItem('att_break_start'));
  const [breakAccum, setBreakAccum] = useState(() => Number(localStorage.getItem('att_break_accum') || 0));
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [breakUsed, setBreakUsed] = useState(() => localStorage.getItem('att_break_used') === new Date().toISOString().slice(0, 10));

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    if (!session?.user?.id || !currentOrg?.id) return;
    const uid = session.user.id;
    const oid = currentOrg.id;

    try {
      const [
        completedRes, timeTodayRes, projectsRes, teamRes,
        productivityRes, overdueRes, timerStatsRes, recentTasksRes,
        projectStatsRes, attendanceRes,
      ] = await Promise.allSettled([
        fetch(`/api/stats/tasks-completed-today?orgId=${oid}`, { credentials: 'include' }),
        fetch(`/api/stats/time-today?orgId=${oid}&userId=${uid}`, { credentials: 'include' }),
        fetch(`/api/stats/active-projects?orgId=${oid}`, { credentials: 'include' }),
        fetch(`/api/stats/team-members?orgId=${oid}`, { credentials: 'include' }),
        fetch(`/api/stats/productivity?orgId=${oid}&userId=${uid}`, { credentials: 'include' }),
        fetch(`/api/stats/overdue-tasks?orgId=${oid}`, { credentials: 'include' }),
        fetch(`/api/timers/stats?orgId=${oid}&userId=${uid}`, { credentials: 'include' }),
        fetch(`/api/tasks/recent?orgId=${oid}&limit=12`, { credentials: 'include' }),
        fetch(`/api/projects/stats?orgId=${oid}`, { credentials: 'include' }),
        fetch(`/api/attendance/status?userId=${uid}&orgId=${oid}`, { credentials: 'include' }),
      ]);

      const safe = async (r: PromiseSettledResult<Response>) => {
        if (r.status === 'rejected') return {};
        try { return r.value.ok ? await r.value.json() : {}; } catch { return {}; }
      };

      const [cd, tt, proj, team, prod, ov, ts, rt, ps, att] = await Promise.all([
        safe(completedRes), safe(timeTodayRes), safe(projectsRes), safe(teamRes),
        safe(productivityRes), safe(overdueRes), safe(timerStatsRes), safe(recentTasksRes),
        safe(projectStatsRes), safe(attendanceRes),
      ]);

      const mkTrend = (d: any) => d?.trend ? {
        pct: Math.round(Number(d.trend.percentage)),
        dir: d.trend.direction as 'up'|'down'|'neutral',
      } : undefined;

      setStats({
        completedToday: cd.count ?? 0,
        completedTrend: mkTrend(cd),
        timeToday: tt.seconds ?? 0,
        timeTrend: mkTrend(tt),
        weekSeconds: ts.weekTotalSeconds ?? 0,
        overdue: ov.count ?? 0,
        activeProjects: proj.count ?? 0,
        projectsDueSoon: proj.dueSoon ?? 0,
        teamMembers: team.count ?? 0,
        activeToday: team.activeToday ?? 0,
        productivity: prod.score ?? 0,
        productivityTrend: mkTrend(prod),
        projectStats: {
          total:     ps.total     ?? 0,
          active:    ps.active    ?? 0,
          completed: ps.completed ?? 0,
          overdue:   ps.overdue   ?? 0,
        },
      });

      setTasks(rt.tasks ?? []);
      if (att.activeLog) setAttendanceActive(att.activeLog);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, [session?.user?.id, currentOrg?.id]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Attendance tick (subtracts break time, pauses on break) ───────────────
  useEffect(() => {
    if (!attendanceActive) { setAttendanceElapsed(0); return; }
    if (onBreak) return; // freeze while on break
    const tick = () => {
      const gross = Math.floor((Date.now() - new Date(attendanceActive.timeIn).getTime()) / 1000);
      const currentBreak = onBreak && localStorage.getItem('att_break_start')
        ? Math.floor((Date.now() - Number(localStorage.getItem('att_break_start'))) / 1000) : 0;
      setAttendanceElapsed(Math.max(0, gross - breakAccum - currentBreak));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attendanceActive, onBreak, breakAccum]);

  const handleTimeIn = async () => {
    if (!session?.user?.id) return;
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/attendance/time-in', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(currentOrg?.id && { orgId: currentOrg.id }) }),
      });
      if (res.ok) {
        setAttendanceActive((await res.json()).log);
        window.dispatchEvent(new CustomEvent('attendance-change'));
      }
    } catch { /* ignore */ }
    finally { setAttendanceLoading(false); }
  };

  const handleTimeOut = async () => {
    if (!session?.user?.id) return;
    setAttendanceLoading(true);
    // Calculate total break including any active break
    let totalBreak = breakAccum;
    if (onBreak) {
      const started = Number(localStorage.getItem('att_break_start') || Date.now());
      totalBreak += Math.floor((Date.now() - started) / 1000);
    }
    localStorage.removeItem('att_break_start');
    localStorage.removeItem('att_break_accum');
    // keep att_break_used so the 1-per-day limit persists if they clock back in today
    setOnBreak(false);
    setBreakAccum(0);
    try {
      const res = await fetch('/api/attendance/time-out', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(currentOrg?.id && { orgId: currentOrg.id }), breakDuration: totalBreak }),
      });
      if (res.ok) {
        stopTaskTimer();
        setAttendanceActive(null);
        fetchDashboard();
        window.dispatchEvent(new CustomEvent('attendance-change'));
      }
    } catch { /* ignore */ }
    finally { setAttendanceLoading(false); }
  };

  const handleBreak = () => {
    if (!attendanceActive) return;
    if (breakUsed && !onBreak) return; // already used today
    if (!onBreak) {
      localStorage.setItem('att_break_start', String(Date.now()));
      localStorage.setItem('att_break_used', todayStr());
      setOnBreak(true);
      setBreakUsed(true);
      pauseTaskTimer();
    } else {
      const started = Number(localStorage.getItem('att_break_start') || Date.now());
      const secs = Math.floor((Date.now() - started) / 1000);
      const newAccum = breakAccum + secs;
      localStorage.setItem('att_break_accum', String(newAccum));
      localStorage.removeItem('att_break_start');
      setBreakAccum(newAccum);
      setOnBreak(false);
      resumeTaskTimer();
    }
    window.dispatchEvent(new CustomEvent('attendance-change'));
  };

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!session || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: VS.bg0 }}>
        <div className="flex flex-col items-center gap-4">
          <EverSenseLogo width={560} height={110} />
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: VS.accent }} />
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: VS.bg0 }}>
        <div className="flex flex-col items-center gap-4">
          <EverSenseLogo width={560} height={110} />
          <p style={{ color: '#909090', fontSize: 13, marginTop: 8 }}>
            Unable to load your organisation. Please refresh or contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // CLIENT role — render dedicated client view (session + org are guaranteed here)
  if (currentOrg.role === 'CLIENT') return <ClientDashboard />;

  const userName = session?.user?.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || 'User';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // ── Task breakdown by status ───────────────────────────────────────────────
  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);

  // ── Overdue tasks from list ────────────────────────────────────────────────
  const overdueTasks = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed' && t.status !== 'cancelled'
  ).slice(0, 5);

  // ── Priority breakdown ─────────────────────────────────────────────────────
  const priorityCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    const p = (t.priority ?? 'low').toLowerCase();
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-6" style={{ background: VS.bg0, minHeight: '100vh' }}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 rounded-lg w-64" style={{ background: VS.bg2 }} />
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl" style={{ background: VS.bg1 }} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 rounded-xl" style={{ background: VS.bg1 }} />
            <div className="h-64 rounded-xl" style={{ background: VS.bg1 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: VS.text0 }}>
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>{fmtDate()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] shrink-0"
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text2 }}
          >
            <Activity className="h-3.5 w-3.5" style={{ color: VS.teal }} />
            {currentOrg.name}
          </div>
          {session?.user?.email === 'admin@eversense.ai' && (
            <button
              onClick={() => navigate('/super-admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold shrink-0 transition-all hover:opacity-80"
              style={{ background: 'rgba(220,220,170,0.12)', border: '1px solid rgba(220,220,170,0.3)', color: VS.yellow }}
            >
              ★ Super Admin
            </button>
          )}
        </div>
      </div>

      {/* ── Attendance clock-in/out ── */}
      <div
        className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
      >
        <div className="flex items-center gap-4">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: attendanceActive ? 'rgba(78,201,176,0.12)' : VS.bg2 }}
          >
            <Clock className="h-5 w-5" style={{ color: attendanceActive ? VS.teal : VS.text2 }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: VS.text2 }}>
              {attendanceActive ? 'Session Running' : 'Not Clocked In'}
            </p>
            <p className="text-xl font-mono font-bold tabular-nums leading-tight mt-0.5" style={{ color: attendanceActive ? VS.teal : VS.bg3 }}>
              {attendanceActive ? fmtDuration(attendanceElapsed) : '--:--:--'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {attendanceActive && (
            <div className="text-right hidden sm:block">
              <p className="text-[11px]" style={{ color: VS.text2 }}>Clocked in at</p>
              <p className="text-[13px] font-medium tabular-nums" style={{ color: VS.text1 }}>
                {fmtTime(attendanceActive.timeIn)}
              </p>
            </div>
          )}
          {attendanceActive && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleBreak}
                disabled={attendanceLoading || (breakUsed && !onBreak)}
                title={breakUsed && !onBreak ? 'You can only take 1 break per day' : undefined}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                style={onBreak
                  ? { background: 'rgba(78,201,176,0.12)', color: VS.teal, border: `1px solid rgba(78,201,176,0.25)` }
                  : { background: 'rgba(255,180,0,0.10)', color: '#f0b429', border: '1px solid rgba(255,180,0,0.25)' }
                }
              >
                {onBreak ? '▶ Resume' : '⏸ Break'}
              </button>
              {breakUsed && !onBreak && (
                <span className="text-[10px]" style={{ color: VS.red }}>1 break per day limit reached</span>
              )}
            </div>
          )}
          <button
            onClick={attendanceActive ? handleTimeOut : handleTimeIn}
            disabled={attendanceLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all shrink-0 disabled:opacity-50"
            style={attendanceActive
              ? { background: 'rgba(244,71,71,0.12)', color: VS.red,  border: `1px solid rgba(244,71,71,0.25)` }
              : { background: 'rgba(78,201,176,0.12)', color: VS.teal, border: `1px solid rgba(78,201,176,0.25)` }
            }
          >
            {attendanceActive
              ? <><LogOut  className="h-4 w-4" />{attendanceLoading ? 'Clocking out…' : 'Clock Out'}</>
              : <><LogIn   className="h-4 w-4" />{attendanceLoading ? 'Clocking in…'  : 'Clock In'}</>
            }
          </button>
        </div>
      </div>

      {/* ── KPI stats + analytics grid ── */}
      <><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Completed Today"
          value={stats?.completedToday ?? 0}
          icon={CheckCircle2}
          color={VS.teal}
          trend={stats?.completedTrend}
        />
        <StatCard
          label="Time Today"
          value={fmtHours(stats?.timeToday ?? 0)}
          sub={stats?.timeToday ? fmtDuration(stats.timeToday) : undefined}
          icon={Timer}
          color={VS.blue}
          trend={stats?.timeTrend}
        />
        <StatCard
          label="This Week"
          value={fmtHours(stats?.weekSeconds ?? 0)}
          icon={CalendarClock}
          color={VS.accent}
        />
        <StatCard
          label="Overdue Tasks"
          value={stats?.overdue ?? 0}
          sub={stats?.overdue === 0 ? 'All caught up!' : 'Need attention'}
          icon={AlertTriangle}
          color={stats?.overdue === 0 ? VS.teal : VS.red}
        />
        <StatCard
          label="Active Projects"
          value={stats?.activeProjects ?? 0}
          sub={stats?.projectsDueSoon ? `${stats.projectsDueSoon} due this week` : undefined}
          icon={FolderOpen}
          color={VS.orange}
        />
        <StatCard
          label="Productivity"
          value={`${stats?.productivity ?? 0}%`}
          icon={TrendingUp}
          color={VS.purple}
          trend={stats?.productivityTrend}
        />
      </div>

      {/* ── Main analytics grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT column (2/3 wide) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Task Status Breakdown */}
          <div
            className="rounded-xl p-5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4" style={{ color: VS.accent }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Task Status Overview</h2>
              <span className="ml-auto text-[11px]" style={{ color: VS.text2 }}>{tasks.length} total</span>
            </div>
            <div className="space-y-3">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                const count = statusCounts[key] ?? 0;
                const pct   = Math.round((count / (tasks.length || 1)) * 100);
                const barW  = Math.round((count / maxStatusCount) * 100);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-[12px] font-medium" style={{ color: VS.text1 }}>
                      {cfg.label}
                    </div>
                    <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: VS.bg2 }}>
                      <div
                        className="h-full rounded-md transition-all duration-700 flex items-center px-2"
                        style={{ width: `${barW}%`, minWidth: count > 0 ? 24 : 0, background: `${cfg.color}30`, borderLeft: `3px solid ${cfg.color}` }}
                      />
                    </div>
                    <div className="w-14 text-right shrink-0">
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: VS.text0 }}>{count}</span>
                      <span className="text-[10px] ml-1" style={{ color: VS.text2 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Tasks */}
          <div
            className="rounded-xl p-5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="h-4 w-4" style={{ color: VS.blue }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Recent Tasks</h2>
              <a
                href="/tasks"
                className="ml-auto flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
                style={{ color: VS.accent }}
              >
                View all <ArrowRight className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-1">
              {tasks.slice(0, 10).length === 0 ? (
                <div className="py-8 text-center text-[13px]" style={{ color: VS.text2 }}>No tasks yet</div>
              ) : tasks.slice(0, 10).map((task: any, i) => {
                const sCfg = STATUS_CFG[task.status] ?? STATUS_CFG.not_started;
                const pCfg = PRIORITY_CFG[(task.priority ?? 'low').toLowerCase()] ?? PRIORITY_CFG.low;
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                  && task.status !== 'completed' && task.status !== 'cancelled';
                return (
                  <div
                    key={task.id ?? i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.03]"
                  >
                    <Circle className="h-2 w-2 shrink-0" style={{ color: pCfg.color, fill: pCfg.color }} />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] truncate"
                        style={{ color: task.status === 'completed' ? VS.text2 : VS.text0, textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}
                      >
                        {task.title}
                      </div>
                      {task.projectName && (
                        <div className="text-[11px] truncate" style={{ color: VS.text2 }}>{task.projectName}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOverdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${VS.red}18`, color: VS.red }}>Overdue</span>
                      )}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: sCfg.bg, color: sCfg.color }}
                      >
                        {sCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT column (1/3) ── */}
        <div className="space-y-6">

          {/* Project Health */}
          <div
            className="rounded-xl p-5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="h-4 w-4" style={{ color: VS.orange }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Project Health</h2>
              <a href="/projects" className="ml-auto flex items-center gap-1 text-[11px] hover:opacity-70" style={{ color: VS.accent }}>
                View <ArrowRight className="h-3 w-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total',     value: stats?.projectStats.total     ?? 0, color: VS.text1  },
                { label: 'Active',    value: stats?.projectStats.active    ?? 0, color: VS.teal   },
                { label: 'Completed', value: stats?.projectStats.completed ?? 0, color: VS.blue   },
                { label: 'Overdue',   value: stats?.projectStats.overdue   ?? 0, color: VS.red    },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-lg p-3 text-center"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}
                >
                  <div className="text-xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Distribution */}
          <div
            className="rounded-xl p-5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4" style={{ color: VS.purple }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Task Priority Mix</h2>
            </div>
            <div className="space-y-2.5">
              {(['urgent', 'high', 'medium', 'low'] as const).map(p => {
                const cfg = PRIORITY_CFG[p];
                const count = priorityCounts[p] ?? 0;
                const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
                return (
                  <div key={p} className="flex items-center gap-3">
                    <div className="w-16 text-[12px] font-medium capitalize" style={{ color: VS.text1 }}>{cfg.label}</div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: VS.bg2 }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: cfg.color }}
                      />
                    </div>
                    <div className="w-8 text-right text-[12px] font-bold tabular-nums" style={{ color: VS.text0 }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{ background: VS.bg1, border: `1px solid rgba(244,71,71,0.25)` }}
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4" style={{ color: VS.red }} />
                <h2 className="text-[13px] font-bold" style={{ color: VS.red }}>Overdue Tasks</h2>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${VS.red}18`, color: VS.red }}>
                  {stats?.overdue ?? overdueTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {overdueTasks.map((task: any, i) => (
                  <div key={task.id ?? i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: VS.red }} />
                    <div className="min-w-0">
                      <div className="text-[12px] truncate" style={{ color: VS.text1 }}>{task.title}</div>
                      {task.dueDate && (
                        <div className="text-[11px]" style={{ color: VS.red }}>
                          Due {new Date(task.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Activity */}
          <div
            className="rounded-xl p-5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4" style={{ color: VS.yellow }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Team Activity</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: VS.text1 }}>Total Members</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: VS.text0 }}>{stats?.teamMembers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: VS.text1 }}>Active Today</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: VS.teal }}>{stats?.activeToday ?? 0}</span>
              </div>
              <div className="h-px" style={{ background: VS.border }} />
              {stats && stats.teamMembers > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1.5" style={{ color: VS.text2 }}>
                    <span>Participation rate</span>
                    <span>{Math.round(((stats.activeToday ?? 0) / stats.teamMembers) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: VS.bg2 }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round(((stats.activeToday ?? 0) / stats.teamMembers) * 100)}%`,
                        background: `linear-gradient(90deg, ${VS.teal}, ${VS.accent})`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div
            className="rounded-xl p-5"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4" style={{ color: VS.yellow }} />
              <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Quick Actions</h2>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Start Timer',   href: '/timer',    color: VS.teal,   icon: Timer        },
                { label: 'Add Task',      href: '/tasks',    color: VS.blue,   icon: CheckSquare  },
                { label: 'New Project',   href: '/projects', color: VS.orange, icon: FolderOpen   },
                { label: 'View Reports',  href: '/reports',  color: VS.purple, icon: BarChart3    },
              ].map(a => {
                const Icon = a.icon;
                return (
                  <a
                    key={a.href}
                    href={a.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.04]"
                    style={{ border: `1px solid ${VS.border}`, textDecoration: 'none' }}
                  >
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${a.color}18`, border: `1px solid ${a.color}33` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: a.color }} />
                    </div>
                    <span className="text-[13px] font-medium" style={{ color: VS.text1 }}>{a.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-auto" style={{ color: VS.text2 }} />
                  </a>
                );
              })}
            </div>
          </div>

        </div>
      </div>
      </>
    </div>
  );
}
