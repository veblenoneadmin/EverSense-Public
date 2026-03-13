import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { useSSE } from '../hooks/useSSE';
import { pauseTaskTimer, resumeTaskTimer, stopTaskTimer } from '../lib/task-timer';
import {
  Clock, Calendar, Download, Search, LogIn, LogOut,
  Coffee, Zap, BarChart3, Users, AlertTriangle, Filter, X,
} from 'lucide-react';

import { VS } from '../lib/theme';

const BREAK_LIMIT = 1800; // 30 minutes in seconds

// ── Interfaces ────────────────────────────────────────────────────────────────
interface LeaveRecord {
  id: string;
  userId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  memberName: string;
  memberEmail: string;
  memberImage: string | null;
  memberRole: string;
}

interface AttendanceLog {
  id: string;
  date: string;
  timeIn: string;
  timeOut: string | null;
  duration: number;
  durationMins: number | null;
  breakDuration: number;
  overBreak: number;
  overtime: number;
  notes: string | null;
  isActive: boolean;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberImage: string | null;
  memberRole: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(s: number | null): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

const ROLE_STYLE: Record<string, { color: string }> = {
  OWNER: { color: VS.yellow  },
  ADMIN: { color: VS.purple  },
  STAFF: { color: VS.teal    },
  CLIENT:{ color: VS.text2   },
};

// ── StatCard (same pattern as Dashboard) ─────────────────────────────────────
function StatCard({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: VS.text2 }}>{label}</span>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none"
          style={{ color: VS.text0 }}>{value}</div>
        {sub && <div className="text-[11px] mt-1" style={{ color: VS.text2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── MemberAvatar ──────────────────────────────────────────────────────────────
function MemberAvatar({ name, image, size = 26 }: { name: string; image?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const colors   = [VS.blue, VS.purple, VS.teal, VS.yellow, VS.orange, VS.accent];
  const color    = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return image
    ? <img src={image} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{
        width: size, height: size, borderRadius: '50%', background: `${color}28`,
        border: `1px solid ${color}55`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700,
        color, flexShrink: 0,
      }}>{initials}</div>;
}

// ── Main component ────────────────────────────────────────────────────────────
export function TimeLogs() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id || '';

  const [logs, setLogs]             = useState<AttendanceLog[]>([]);
  const [allMembers, setAllMembers] = useState<{ id: string; name: string; email: string; image: string | null; role: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [userRole, setUserRole]     = useState('STAFF');
  const [isClient, setIsClient]     = useState(false);
  const [leaves, setLeaves]         = useState<LeaveRecord[]>([]);

  // Clock state
  const [clockedIn, setClockedIn]   = useState(false);
  const [activeLog, setActiveLog]   = useState<{ id: string; timeIn: string } | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsed, setElapsed]       = useState(0);

  // Break state — shared localStorage keys with Dashboard
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [onBreak, setOnBreak]       = useState(() => !!localStorage.getItem('att_break_start'));
  const [breakAccum, setBreakAccum] = useState(() => Number(localStorage.getItem('att_break_accum') || 0));
  const [breakUsed, setBreakUsed]   = useState(() => localStorage.getItem('att_break_used') === new Date().toISOString().slice(0, 10));
  const [breakElapsed, setBreakElapsed] = useState(0); // live seconds since break started

  // Filters
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterMember, setFilterMember]   = useState('all');
  const [filterStatus, setFilterStatus]   = useState<'all' | 'active' | 'completed'>('all');
  // Default to Today
  const [activePreset, setActivePreset]   = useState<'today' | 'week' | 'month' | 'all' | null>('today');
  const [dateTo, setDateTo]               = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFrom, setDateFrom]           = useState(() => new Date().toISOString().slice(0, 10));

  const applyPreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    setActivePreset(preset);
    const today = new Date().toISOString().slice(0, 10);
    if (preset === 'today') {
      setDateFrom(today); setDateTo(today);
    } else if (preset === 'week') {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Monday
      d.setDate(d.getDate() + diff);
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
    } else if (preset === 'month') {
      const d = new Date();
      setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
      setDateTo(today);
    } else {
      setDateFrom(''); setDateTo('');
    }
  };

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (showLoader = true) => {
    if (!session?.user?.id) return;
    if (showLoader) setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (orgId) headers['x-org-id'] = orgId;
      const res = await fetch(`/api/attendance/logs${orgId ? `?orgId=${orgId}` : ''}`, {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setIsPrivileged(data.isPrivileged ?? false);
        setUserRole(data.role ?? 'STAFF');
        setLogs(data.logs || []);
        setAllMembers(data.allMembers || []);
        setLeaves(data.leaves || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [session?.user?.id, orgId]);

  // ── Fetch clock status ─────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (orgId) headers['x-org-id'] = orgId;
      const res = await fetch('/api/attendance/status', { credentials: 'include', headers });
      if (res.ok) {
        const data = await res.json();
        setClockedIn(data.clockedIn);
        setActiveLog(data.activeLog || null);
      }
    } catch (err) {
      console.error('Failed to fetch clock status:', err);
    }
  }, [orgId]);

  // Reliably detect CLIENT role via /api/organizations (same as Sidebar)
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch('/api/organizations')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const role = data?.organizations?.[0]?.role || '';
        setIsClient(role === 'CLIENT');
      })
      .catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) { fetchLogs(); fetchStatus(); }
  }, [session?.user?.id, orgId, fetchLogs, fetchStatus]);

  // SSE — real-time push (replaces 30s polling interval), no loading spinner
  useSSE(orgId || undefined, (event) => {
    if (event === 'attendance') { fetchLogs(false); fetchStatus(); }
  });

  // ── Net elapsed timer (pauses on break) ───────────────────────────────────
  useEffect(() => {
    if (!clockedIn || !activeLog?.timeIn || onBreak) { if (!clockedIn) setElapsed(0); return; }
    const tick = () => {
      const gross = Math.floor((Date.now() - new Date(activeLog.timeIn).getTime()) / 1000);
      setElapsed(Math.max(0, gross - breakAccum));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockedIn, activeLog, onBreak, breakAccum]);

  // ── Live break timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!onBreak) { setBreakElapsed(0); return; }
    const breakStart = Number(localStorage.getItem('att_break_start') || Date.now());
    const tick = () => setBreakElapsed(Math.floor((Date.now() - breakStart) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [onBreak]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    setClockLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (orgId) headers['x-org-id'] = orgId;
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ ...(orgId && { orgId }) }),
      });
      if (res.ok) { await fetchStatus(); await fetchLogs(false); window.dispatchEvent(new CustomEvent('attendance-change')); }
      else { const d = await res.json(); alert(d.error || 'Failed to clock in'); }
    } catch (err) { console.error(err); } finally { setClockLoading(false); }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    let totalBreak = breakAccum;
    if (onBreak) {
      const started = Number(localStorage.getItem('att_break_start') || Date.now());
      totalBreak += Math.floor((Date.now() - started) / 1000);
    }
    localStorage.removeItem('att_break_start');
    localStorage.removeItem('att_break_accum');
    setOnBreak(false);
    setBreakAccum(0);
    setBreakElapsed(0);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (orgId) headers['x-org-id'] = orgId;
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ ...(orgId && { orgId }), breakDuration: totalBreak }),
      });
      if (res.ok) {
        stopTaskTimer();
        await fetchStatus(); await fetchLogs(false); window.dispatchEvent(new CustomEvent('attendance-change'));
      }
      else { const d = await res.json(); alert(d.error || 'Failed to clock out'); }
    } catch (err) { console.error(err); } finally { setClockLoading(false); }
  };

  const handleBreak = () => {
    if (!clockedIn) return;
    if (breakUsed && !onBreak) return;
    if (!onBreak) {
      localStorage.setItem('att_break_start', String(Date.now()));
      localStorage.setItem('att_break_used', todayStr());
      setOnBreak(true);
      setBreakUsed(true);
      pauseTaskTimer();
    } else {
      const started = Number(localStorage.getItem('att_break_start') || Date.now());
      const secs    = Math.floor((Date.now() - started) / 1000);
      const newAccum = breakAccum + secs;
      localStorage.setItem('att_break_accum', String(newAccum));
      localStorage.removeItem('att_break_start');
      setBreakAccum(newAccum);
      setOnBreak(false);
      setBreakElapsed(0);
      resumeTaskTimer();
    }
    window.dispatchEvent(new CustomEvent('attendance-change'));
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const uniqueMembers = [...new Map(logs.map(l => [l.memberId, { id: l.memberId, name: l.memberName }])).values()];

  // Used to determine "not clocked in" — mirrors filteredLogs date logic (active sessions always included)
  const dateRangeLogs = logs.filter((log: AttendanceLog) => {
    if (log.isActive) return true;
    const logInDate  = new Date(log.timeIn).toLocaleDateString('en-CA');
    const logOutDate = log.timeOut ? new Date(log.timeOut).toLocaleDateString('en-CA') : null;
    const inRange    = (d: string) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    return inRange(logInDate) || (logOutDate ? inRange(logOutDate) : false);
  });

  const filteredLogs = logs.filter((log: AttendanceLog) => {
    const matchSearch =
      log.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.date.includes(searchTerm);
    const matchMember = filterMember === 'all' || log.memberId === filterMember;
    // Use local date from timeIn/timeOut so overnight sessions (clocked in yesterday, out today) show correctly
    const logInDate  = new Date(log.timeIn).toLocaleDateString('en-CA');
    const logOutDate = log.timeOut ? new Date(log.timeOut).toLocaleDateString('en-CA') : null;
    const inRange    = (d: string) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    const matchDate  = log.isActive || inRange(logInDate) || (logOutDate ? inRange(logOutDate) : false);
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? log.isActive : !log.isActive);
    return matchSearch && matchMember && matchDate && matchStatus;
  });

  const filteredLeaves = leaves.filter((lv: LeaveRecord) => {
    const start = lv.startDate.slice(0, 10);
    const end   = lv.endDate.slice(0, 10);
    const overlaps = (!dateFrom || end >= dateFrom) && (!dateTo || start <= dateTo);
    const matchSearch = !searchTerm || lv.memberName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchMember = filterMember === 'all' || lv.userId === filterMember;
    // Leaves show regardless of status filter — they are neither "active" nor "completed" clock sessions
    return overlaps && matchSearch && matchMember;
  });

  // Members on leave today (used to replace "Not clocked in" with leave status)
  const today = new Date().toLocaleDateString('en-CA');
  const onLeaveToday = new Map<string, LeaveRecord>(
    leaves
      .filter(lv => lv.startDate.slice(0, 10) <= today && lv.endDate.slice(0, 10) >= today)
      .map(lv => [lv.userId, lv])
  );

  const completedLogs   = filteredLogs.filter(l => !l.isActive);
  const totalSeconds    = completedLogs.reduce((s, l) => s + (l.duration || 0), 0);
  const totalHours      = (totalSeconds / 3600).toFixed(1);
  const totalOvertimeSec = completedLogs.reduce((s, l) => s + (l.overtime || 0), 0);
  const overBreakCount  = completedLogs.filter(l => l.overBreak > 0).length;

  // Live break display inside the clock card
  const liveBreakTotal = breakAccum + (onBreak ? breakElapsed : 0);
  const isOverBreak    = liveBreakTotal > BREAK_LIMIT;
  const breakRemaining = Math.max(0, BREAK_LIMIT - liveBreakTotal);

  if (loading) {
    return (
      <div className="space-y-6" style={{ color: VS.text0 }}>
        <div>
          <div className="h-8 rounded-lg w-48 animate-pulse" style={{ background: VS.bg2 }} />
          <div className="h-4 rounded w-64 mt-2 animate-pulse" style={{ background: VS.bg2 }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: VS.bg1 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>Time Logs</h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>
            {isPrivileged
              ? `Team attendance records · ${userRole.charAt(0) + userRole.slice(1).toLowerCase()} view`
              : 'Your attendance records'}
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-opacity hover:opacity-70"
          style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text2 }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* ── Clock card — hidden for CLIENT accounts ── */}
      {!isClient && <div
        className="rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: VS.bg1,
          border: `1px solid ${clockedIn ? (onBreak ? 'rgba(220,220,170,0.3)' : 'rgba(78,201,176,0.3)') : VS.border}`,
        }}
      >
        {/* Left: icon + timer */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: clockedIn ? (onBreak ? 'rgba(220,220,170,0.12)' : 'rgba(78,201,176,0.12)') : VS.bg2 }}
            >
              {onBreak
                ? <Coffee className="h-5 w-5" style={{ color: VS.yellow }} />
                : <Clock  className="h-5 w-5" style={{ color: clockedIn ? VS.teal : VS.text2 }} />
              }
            </div>
            {clockedIn && !onBreak && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full"
                style={{ background: VS.teal }}>
                <span className="absolute inset-0 rounded-full animate-ping opacity-75"
                  style={{ background: VS.teal }} />
              </span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: VS.text2 }}>
              {!clockedIn ? 'Not Clocked In' : onBreak ? 'On Break' : 'Session Running'}
            </p>
            <p className="text-xl font-mono font-bold tabular-nums leading-tight mt-0.5"
              style={{ color: clockedIn && !onBreak ? VS.teal : onBreak ? VS.yellow : VS.bg3 }}>
              {clockedIn ? fmtClock(onBreak ? 0 : elapsed) : '--:--:--'}
            </p>
            {clockedIn && activeLog && !onBreak && (
              <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>
                Clocked in at {fmtTime(activeLog.timeIn)}
              </p>
            )}
          </div>
        </div>

        {/* Right: break timer + buttons */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Live break info */}
          {clockedIn && (
            <div className="text-right hidden sm:block">
              {onBreak ? (
                <>
                  <p className="text-[11px]" style={{ color: VS.text2 }}>Break elapsed</p>
                  <p className="text-[13px] font-mono font-semibold tabular-nums"
                    style={{ color: isOverBreak ? VS.red : VS.yellow }}>
                    {fmtClock(breakElapsed)}
                    {isOverBreak && <span className="ml-1 text-[10px]" style={{ color: VS.red }}>OVER</span>}
                  </p>
                </>
              ) : liveBreakTotal > 0 ? (
                <>
                  <p className="text-[11px]" style={{ color: VS.text2 }}>Break used</p>
                  <p className="text-[13px] font-mono font-semibold tabular-nums"
                    style={{ color: liveBreakTotal > BREAK_LIMIT ? VS.red : VS.text1 }}>
                    {fmtDuration(liveBreakTotal)}
                    {liveBreakTotal > BREAK_LIMIT && (
                      <span className="ml-1 text-[10px]" style={{ color: VS.red }}>
                        +{fmtDuration(liveBreakTotal - BREAK_LIMIT)} over
                      </span>
                    )}
                  </p>
                </>
              ) : null}
            </div>
          )}

          {/* Break button */}
          {clockedIn && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleBreak}
                disabled={clockLoading || (breakUsed && !onBreak)}
                title={
                  breakUsed && !onBreak
                    ? 'Break already used today (30-min limit)'
                    : onBreak
                      ? `Resume work${isOverBreak ? ' · You are over the 30-min limit' : ''}`
                      : 'Take a 30-min break'
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                style={onBreak
                  ? { background: 'rgba(78,201,176,0.12)', color: VS.teal,   border: `1px solid rgba(78,201,176,0.25)` }
                  : { background: 'rgba(220,220,170,0.10)', color: VS.yellow, border: '1px solid rgba(220,220,170,0.25)' }
                }
              >
                <Coffee className="h-4 w-4" />
                {onBreak ? 'Resume' : 'Break'}
              </button>
              {!onBreak && !breakUsed && (
                <span className="text-[10px]" style={{ color: VS.text2 }}>30 min limit</span>
              )}
              {breakUsed && !onBreak && (
                <span className="text-[10px]" style={{ color: VS.red }}>Break used today</span>
              )}
              {onBreak && !isOverBreak && (
                <span className="text-[10px]" style={{ color: VS.text2 }}>
                  {fmtDuration(breakRemaining)} remaining
                </span>
              )}
              {onBreak && isOverBreak && (
                <span className="text-[10px]" style={{ color: VS.red }}>
                  Over break limit!
                </span>
              )}
            </div>
          )}

          {/* Clock In / Out button */}
          <button
            onClick={clockedIn ? handleClockOut : handleClockIn}
            disabled={clockLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all shrink-0 disabled:opacity-50"
            style={clockedIn
              ? { background: 'rgba(244,71,71,0.12)', color: VS.red,  border: `1px solid rgba(244,71,71,0.25)` }
              : { background: 'rgba(78,201,176,0.12)', color: VS.teal, border: `1px solid rgba(78,201,176,0.25)` }
            }
          >
            {clockedIn
              ? <><LogOut className="h-4 w-4" />{clockLoading ? 'Clocking out…' : 'Clock Out'}</>
              : <><LogIn  className="h-4 w-4" />{clockLoading ? 'Clocking in…'  : 'Clock In'}</>
            }
          </button>
        </div>
      </div>}

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Hours"
          value={`${totalHours}h`}
          sub={`${completedLogs.length} sessions`}
          icon={Clock}
          color={VS.blue}
        />
        <StatCard
          label="Sessions"
          value={completedLogs.length}
          sub={filteredLogs.some(l => l.isActive) ? '1 active now' : undefined}
          icon={BarChart3}
          color={VS.teal}
        />
        <StatCard
          label="Total Overtime"
          value={totalOvertimeSec > 0 ? fmtDuration(totalOvertimeSec) : '0h'}
          sub={totalOvertimeSec > 0 ? `across ${completedLogs.filter(l => l.overtime > 0).length} sessions` : 'No overtime'}
          icon={Zap}
          color={totalOvertimeSec > 0 ? VS.orange : VS.text2}
        />
        <StatCard
          label={isPrivileged ? 'Over Break' : 'Members'}
          value={isPrivileged ? overBreakCount : new Set(filteredLogs.map(l => l.memberId)).size}
          sub={isPrivileged
            ? (overBreakCount > 0 ? 'sessions over 30-min limit' : 'No over-break sessions')
            : undefined}
          icon={isPrivileged ? AlertTriangle : Users}
          color={isPrivileged && overBreakCount > 0 ? VS.red : VS.text2}
        />
      </div>

      {/* ── Filters ── */}
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
      >
        {/* Row 1: preset buttons + status */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: VS.text2 }} />
          {(['today', 'week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className="px-3 py-1 rounded-md text-[12px] font-semibold transition-colors"
              style={activePreset === p
                ? { background: VS.accent, color: '#fff', border: `1px solid ${VS.accent}` }
                : { background: VS.bg2, color: VS.text2, border: `1px solid ${VS.border}` }
              }
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {(['all', 'active', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="px-3 py-1 rounded-md text-[12px] font-semibold transition-colors capitalize"
                style={filterStatus === s
                  ? { background: s === 'active' ? `${VS.teal}22` : s === 'completed' ? `${VS.blue}22` : VS.bg3,
                      color: s === 'active' ? VS.teal : s === 'completed' ? VS.blue : VS.text1,
                      border: `1px solid ${s === 'active' ? VS.teal + '55' : s === 'completed' ? VS.blue + '55' : VS.border}` }
                  : { background: 'transparent', color: VS.text2, border: `1px solid transparent` }
                }
              >
                {s === 'all' ? 'All' : s === 'active' ? '● Active' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: search + date range + member */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: VS.text2 }} />
            <input
              type="text"
              placeholder="Search by name, notes…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none focus:ring-1"
              style={{
                background: VS.bg2, border: `1px solid ${VS.border}`,
                color: VS.text0, '--tw-ring-color': VS.accent,
              } as React.CSSProperties}
            />
          </div>

          {/* Date from */}
          <div className="relative flex items-center gap-1">
            <label className="text-[11px] shrink-0" style={{ color: VS.text2 }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setActivePreset(null); }}
              className="px-2 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1, colorScheme: 'dark' }}
            />
            {dateFrom && (
              <button onClick={() => { setDateFrom(''); setActivePreset(null); }}>
                <X className="h-3.5 w-3.5" style={{ color: VS.text2 }} />
              </button>
            )}
          </div>

          {/* Date to */}
          <div className="relative flex items-center gap-1">
            <label className="text-[11px] shrink-0" style={{ color: VS.text2 }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setActivePreset(null); }}
              className="px-2 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1, colorScheme: 'dark' }}
            />
            {dateTo && (
              <button onClick={() => { setDateTo(''); setActivePreset(null); }}>
                <X className="h-3.5 w-3.5" style={{ color: VS.text2 }} />
              </button>
            )}
          </div>

          {isPrivileged && (
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              className="px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}
            >
              <option value="all">All Members</option>
              {uniqueMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>

        {/* Table header */}
        <div className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${VS.border}` }}>
          <span className="text-[13px] font-bold" style={{ color: VS.text0 }}>
            Attendance Records
            <span className="ml-2 text-[11px] font-normal" style={{ color: VS.text2 }}>
              {filteredLogs.length} {isPrivileged ? '· Team view' : '· Your records'}
            </span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                {isPrivileged && (
                  <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                    style={{ color: VS.text2 }}>Member</th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Date</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Clock In</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Clock Out</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Net Hours</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Break</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Over Break</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Overtime</th>
                <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wider"
                  style={{ color: VS.text2 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Members with no logs in date range — admin/owner only */}
              {isPrivileged && allMembers
                .filter(m => !dateRangeLogs.some(l => l.memberId === m.id))
                .filter(m => filterMember === 'all' || filterMember === m.id)
                .filter(m => !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.email.toLowerCase().includes(searchTerm.toLowerCase()))
                .filter(() => filterStatus === 'all' || filterStatus === 'completed')
                .map(m => {
                  const leaveToday = onLeaveToday.get(m.id);
                  const leaveLabel = leaveToday
                    ? (leaveToday.type?.toLowerCase().includes('sick') ? 'Sick Leave' : 'On Leave')
                    : 'Not clocked in';
                  const leaveColor = leaveToday ? VS.yellow : VS.text2;
                  return (
                    <tr key={`absent-${m.id}`}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: `1px solid ${VS.border}`, opacity: 0.55 }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MemberAvatar name={m.name} image={m.image} />
                          <div>
                            <p className="font-medium leading-tight" style={{ color: VS.text0 }}>{m.name}</p>
                            <p className="text-[10px] leading-tight" style={{ color: VS.text2 }}>{m.email}</p>
                            <span className="text-[10px] font-semibold capitalize"
                              style={{ color: (ROLE_STYLE[m.role] ?? ROLE_STYLE.STAFF).color }}>
                              {m.role.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>
                        {leaveToday ? `${new Date(leaveToday.startDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${new Date(leaveToday.endDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : '—'}
                      </td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                          style={{ background: `${leaveColor}18`, color: leaveColor, border: `1px solid ${leaveColor}30` }}>
                          {leaveLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              }
              {/* Leave rows from HRSense — all leaves in the filtered date range */}
              {filteredLeaves.map(lv => {
                  const isSick = lv.type?.toLowerCase().includes('sick');
                  const label  = isSick ? 'Sick Leave' : 'On Leave';
                  const color  = isSick ? VS.orange : VS.yellow;
                  return (
                    <tr key={`leave-${lv.id}`}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: `1px solid ${VS.border}` }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MemberAvatar name={lv.memberName} image={lv.memberImage} />
                          <div>
                            <p className="font-medium leading-tight" style={{ color: VS.text0 }}>{lv.memberName}</p>
                            <p className="text-[10px] leading-tight" style={{ color: VS.text2 }}>{lv.memberEmail}</p>
                            <span className="text-[10px] font-semibold capitalize"
                              style={{ color: (ROLE_STYLE[lv.memberRole] ?? ROLE_STYLE.STAFF).color }}>
                              {lv.memberRole.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: VS.text1 }}>
                        {new Date(lv.startDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        {lv.days > 1 && ` – ${new Date(lv.endDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                      </td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3">
                        <span style={{ color: color }}>{lv.days}d</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3" style={{ color: VS.text2 }}>—</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {filteredLogs.map((log: AttendanceLog) => {
                const isOwnActive = log.isActive && log.memberId === session?.user?.id;
                return (
                  <tr key={log.id}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: `1px solid ${VS.border}` }}
                  >

                    {/* Member */}
                    {isPrivileged && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MemberAvatar name={log.memberName} image={log.memberImage} />
                          <div>
                            <p className="font-medium leading-tight" style={{ color: VS.text0 }}>
                              {log.memberName}
                            </p>
                            <p className="text-[10px] leading-tight" style={{ color: VS.text2 }}>
                              {log.memberEmail}
                            </p>
                            <span className="text-[10px] font-semibold capitalize"
                              style={{ color: (ROLE_STYLE[log.memberRole] ?? ROLE_STYLE.STAFF).color }}>
                              {log.memberRole.toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Date */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: VS.text2 }} />
                        <span style={{ color: VS.text1 }}>{fmtDate(log.timeIn)}</span>
                      </div>
                    </td>

                    {/* Clock In */}
                    <td className="px-4 py-3 font-mono tabular-nums" style={{ color: VS.teal }}>
                      {fmtTime(log.timeIn)}
                    </td>

                    {/* Clock Out */}
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {log.timeOut
                        ? <span style={{ color: VS.red }}>{fmtTime(log.timeOut)}</span>
                        : <span className="italic text-[12px]" style={{ color: VS.text2 }}>Active</span>
                      }
                    </td>

                    {/* Net Hours */}
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {log.isActive
                        ? <span className="font-mono" style={{ color: VS.teal }}>
                            {isOwnActive ? fmtClock(elapsed) : '…'}
                          </span>
                        : <span style={{ color: VS.text0 }}>{fmtDuration(log.duration)}</span>
                      }
                    </td>

                    {/* Break */}
                    <td className="px-4 py-3 tabular-nums">
                      {log.breakDuration > 0
                        ? <span style={{ color: VS.yellow }}>{fmtDuration(log.breakDuration)}</span>
                        : <span style={{ color: VS.text2 }}>—</span>
                      }
                    </td>

                    {/* Over Break */}
                    <td className="px-4 py-3 tabular-nums">
                      {log.overBreak > 0
                        ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                            style={{ background: `${VS.red}18`, color: VS.red, border: `1px solid ${VS.red}30` }}
                          >
                            +{fmtDuration(log.overBreak)}
                          </span>
                        )
                        : <span style={{ color: VS.text2 }}>—</span>
                      }
                    </td>

                    {/* Overtime */}
                    <td className="px-4 py-3 tabular-nums">
                      {log.overtime > 0
                        ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                            style={{ background: `${VS.orange}18`, color: VS.orange, border: `1px solid ${VS.orange}30` }}
                          >
                            +{fmtDuration(log.overtime)}
                          </span>
                        )
                        : <span style={{ color: VS.text2 }}>—</span>
                      }
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                        style={log.isActive
                          ? { background: `${VS.teal}18`, color: VS.teal, border: `1px solid ${VS.teal}30` }
                          : { background: `${VS.text2}10`, color: VS.text2, border: `1px solid ${VS.border}` }
                        }
                      >
                        {log.isActive ? '● Active' : 'Completed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <Clock className="h-10 w-10" style={{ color: VS.text2 }} />
            <p className="text-[15px] font-semibold" style={{ color: VS.text1 }}>
              No attendance records found
            </p>
            <p className="text-[13px]" style={{ color: VS.text2 }}>
              {searchTerm || filterMember !== 'all'
                ? 'Try adjusting your filters'
                : 'Clock in to start recording your attendance'}
            </p>
            {!clockedIn && !isClient && (
              <button
                onClick={handleClockIn}
                disabled={clockLoading}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'rgba(78,201,176,0.12)', color: VS.teal, border: `1px solid rgba(78,201,176,0.25)` }}
              >
                <LogIn className="h-4 w-4" />Clock In Now
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
