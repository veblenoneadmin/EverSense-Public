import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { pauseTaskTimer, resumeTaskTimer, stopTaskTimer } from '../lib/task-timer';
import { LogIn, LogOut, Clock, Calendar, AlertCircle, Timer, TrendingUp, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceLog {
  id: string;
  userId: string;
  orgId: string;
  timeIn: string;
  timeOut: string | null;
  duration: number;
  notes: string | null;
  date: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function nowTimeString(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
}

function StatCard({ label, value, sub, icon, gradient }: StatCardProps) {
  return (
    <div
      style={{
        background: 'hsl(240 6% 10%)',
        borderRadius: '16px',
        boxShadow: '0 4px 24px 0 rgba(0,0,0,0.45)',
        padding: '20px 24px 20px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        border: '1px solid hsl(240 6% 18%)',
      }}
    >
      {/* Icon chip */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '14px',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {icon}
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: 'hsl(240 5% 60%)', margin: 0, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </p>
        <p style={{ fontSize: 24, fontWeight: 700, color: 'hsl(0 0% 98%)', margin: '4px 0 2px', lineHeight: 1.2 }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 12, color: 'hsl(240 5% 55%)', margin: 0 }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Attendance() {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();

  const [active, setActive] = useState<AttendanceLog | null>(null);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [liveTime, setLiveTime] = useState(nowTimeString());
  const [onBreak, setOnBreak] = useState(() => !!localStorage.getItem('att_break_start'));
  const [breakAccum, setBreakAccum] = useState(() => Number(localStorage.getItem('att_break_accum') || 0));
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [breakUsed, setBreakUsed] = useState(() => localStorage.getItem('att_break_used') === new Date().toISOString().slice(0, 10));

  const userId = session?.user?.id;
  const orgId = currentOrg?.id;
  const buildQuery = () => {
    const params: Record<string, string> = { userId: userId! };
    if (orgId) params.orgId = orgId;
    return new URLSearchParams(params).toString();
  };

  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/attendance/status?${buildQuery()}`, { credentials: 'include' });
    if (res.ok) setActive((await res.json()).active);
  }, [userId, orgId]);

  const fetchToday = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/attendance/today?${buildQuery()}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setTodayLogs(data.logs);
      setTodayTotal(data.totalSeconds);
    }
  }, [userId, orgId]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    const res = await fetch(`/api/attendance/history?${buildQuery()}&limit=10`, { credentials: 'include' });
    if (res.ok) setHistory((await res.json()).logs);
  }, [userId, orgId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchToday(), fetchHistory()]);
    setLoading(false);
  }, [fetchStatus, fetchToday, fetchHistory]);

  useEffect(() => { if (userId) loadAll(); }, [userId, orgId, loadAll]);

  // Live clock tick
  useEffect(() => {
    const id = setInterval(() => setLiveTime(nowTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // Elapsed while clocked in (subtracts break time, pauses on break)
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    if (onBreak) return; // on break — freeze display
    const tick = () => {
      const gross = Math.floor((Date.now() - new Date(active.timeIn).getTime()) / 1000);
      setElapsed(Math.max(0, gross - breakAccum));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, onBreak, breakAccum]);

  const handleTimeIn = async () => {
    setActionLoading(true); setError(null);
    try {
      const res = await fetch('/api/attendance/time-in', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(orgId && { orgId }), notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clock in');
      setNotes('');
      await loadAll();
      window.dispatchEvent(new CustomEvent('attendance-change'));
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  const handleTimeOut = async () => {
    setActionLoading(true); setError(null);
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
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(orgId && { orgId }), notes: notes || undefined, breakDuration: totalBreak }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clock out');
      stopTaskTimer();
      setNotes('');
      await loadAll();
      window.dispatchEvent(new CustomEvent('attendance-change'));
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  };

  const handleBreak = () => {
    if (!active) return;
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

  const isClockedIn = !!active;
  const todayRunning = todayTotal + (isClockedIn ? elapsed : 0);

  if (!session) return (
    <div style={{ padding: 24 }}>
      <div style={{ background: 'hsl(38 92% 50% / 0.1)', border: '1px solid hsl(38 92% 50% / 0.3)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, color: 'hsl(38 92% 60%)' }}>
        <AlertCircle size={16} /> Please log in to use the attendance tracker.
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'hsl(250 84% 70%)' }}>
      <Clock size={28} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 15 }}>Loading attendance...</span>
    </div>
  );

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Page Header ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'hsl(0 0% 98%)', margin: 0 }}>
          Attendance Tracker
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(240 5% 55%)', margin: '4px 0 0' }}>
          Track your daily time in and time out
        </p>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────── */}
      {error && (
        <div style={{ background: 'hsl(0 84% 60% / 0.1)', border: '1px solid hsl(0 84% 60% / 0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'hsl(0 84% 70%)', marginBottom: 24, fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* ── Stat Cards Row ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 28 }}>
        <StatCard
          label="Status"
          value={isClockedIn ? 'Clocked In' : 'Clocked Out'}
          sub={isClockedIn ? `Since ${formatTime(active!.timeIn)}` : 'Not working'}
          icon={<CheckCircle2 size={26} color="#fff" />}
          gradient={isClockedIn
            ? 'linear-gradient(135deg, hsl(142 76% 36%) 0%, hsl(158 64% 52%) 100%)'
            : 'linear-gradient(135deg, hsl(240 5% 30%) 0%, hsl(240 5% 40%) 100%)'}
        />
        <StatCard
          label="Today's Hours"
          value={formatHoursMinutes(todayRunning)}
          sub={`${formatDuration(todayRunning)} total`}
          icon={<Timer size={26} color="#fff" />}
          gradient="linear-gradient(135deg, hsl(250 84% 54%) 0%, hsl(263 70% 67%) 100%)"
        />
        <StatCard
          label="Sessions Today"
          value={String(todayLogs.length || (isClockedIn ? 1 : 0))}
          sub="clock-in records"
          icon={<TrendingUp size={26} color="#fff" />}
          gradient="linear-gradient(135deg, hsl(199 89% 36%) 0%, hsl(199 89% 52%) 100%)"
        />
        <StatCard
          label="Current Time"
          value={liveTime}
          sub={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          icon={<Calendar size={26} color="#fff" />}
          gradient="linear-gradient(135deg, hsl(38 92% 40%) 0%, hsl(45 93% 55%) 100%)"
        />
      </div>

      {/* ── Main Two-Column ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Clock Panel */}
        <div style={{
          background: 'hsl(240 6% 10%)',
          borderRadius: 16,
          border: '1px solid hsl(240 6% 18%)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          {/* Card Header stripe */}
          <div style={{
            height: 4,
            background: isClockedIn
              ? 'linear-gradient(90deg, hsl(142 76% 36%), hsl(158 64% 52%))'
              : 'linear-gradient(90deg, hsl(250 84% 54%), hsl(263 70% 67%))',
          }} />

          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'hsl(240 5% 18%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={18} color="hsl(250 84% 70%)" />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'hsl(0 0% 95%)', margin: 0 }}>
                  {isClockedIn ? 'Session Running' : 'Ready to Clock In'}
                </h2>
                <p style={{ fontSize: 12, color: 'hsl(240 5% 55%)', margin: 0 }}>
                  {isClockedIn ? 'You are currently clocked in' : 'Press Time In to begin'}
                </p>
              </div>
            </div>

            {/* Big clock */}
            <div style={{ textAlign: 'center', margin: '8px 0 28px' }}>
              <div style={{
                fontSize: 60,
                fontWeight: 800,
                fontFamily: 'monospace',
                letterSpacing: '-2px',
                color: isClockedIn ? 'hsl(142 76% 52%)' : 'hsl(240 5% 40%)',
                lineHeight: 1,
                transition: 'color 0.4s ease',
              }}>
                {formatDuration(isClockedIn ? elapsed : 0)}
              </div>
              {isClockedIn && (
                <p style={{ fontSize: 13, color: 'hsl(240 5% 55%)', margin: '10px 0 0' }}>
                  Clocked in at <strong style={{ color: 'hsl(0 0% 80%)' }}>{formatTime(active!.timeIn)}</strong>
                </p>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'hsl(240 5% 60%)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                style={{
                  width: '100%',
                  background: 'hsl(240 5% 15%)',
                  border: '1px solid hsl(240 6% 22%)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'hsl(0 0% 90%)',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = 'hsl(250 84% 60%)')}
                onBlur={e => (e.target.style.borderColor = 'hsl(240 6% 22%)')}
              />
            </div>

            {/* Action Button */}
            {!isClockedIn ? (
              <button
                onClick={handleTimeIn}
                disabled={actionLoading}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  background: 'linear-gradient(135deg, hsl(142 76% 36%) 0%, hsl(158 64% 46%) 100%)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: '0 4px 20px hsl(142 76% 36% / 0.4)',
                  transition: 'opacity 0.2s, transform 0.1s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseOver={e => { if (!actionLoading) (e.currentTarget.style.transform = 'translateY(-1px)'); }}
                onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <LogIn size={18} />
                {actionLoading ? 'Clocking In...' : 'Time In'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Break / Resume */}
                <div>
                  <button
                    onClick={handleBreak}
                    disabled={actionLoading || (breakUsed && !onBreak)}
                    title={breakUsed && !onBreak ? 'You can only take 1 break per day' : undefined}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      background: onBreak
                        ? 'linear-gradient(135deg, hsl(142 76% 36%) 0%, hsl(158 64% 46%) 100%)'
                        : 'linear-gradient(135deg, hsl(40 96% 40%) 0%, hsl(35 92% 52%) 100%)',
                      border: 'none',
                      borderRadius: 12,
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: (actionLoading || (breakUsed && !onBreak)) ? 'not-allowed' : 'pointer',
                      opacity: (actionLoading || (breakUsed && !onBreak)) ? 0.4 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'opacity 0.2s, transform 0.1s',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseOver={e => { if (!actionLoading && !(breakUsed && !onBreak)) (e.currentTarget.style.transform = 'translateY(-1px)'); }}
                    onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {onBreak ? '▶ Resume' : '⏸ Take Break'}
                  </button>
                  {breakUsed && !onBreak && (
                    <p style={{ fontSize: 11, color: 'hsl(0 84% 65%)', margin: '6px 0 0', textAlign: 'center' }}>
                      You can only take 1 break per day
                    </p>
                  )}
                </div>
                {/* Time Out */}
                <button
                  onClick={handleTimeOut}
                  disabled={actionLoading}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    background: 'linear-gradient(135deg, hsl(0 84% 50%) 0%, hsl(14 91% 58%) 100%)',
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    opacity: actionLoading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 4px 20px hsl(0 84% 50% / 0.4)',
                    transition: 'opacity 0.2s, transform 0.1s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onMouseOver={e => { if (!actionLoading) (e.currentTarget.style.transform = 'translateY(-1px)'); }}
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <LogOut size={18} />
                  {actionLoading ? 'Clocking Out...' : 'Time Out'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Today's Log Panel */}
        <div style={{
          background: 'hsl(240 6% 10%)',
          borderRadius: 16,
          border: '1px solid hsl(240 6% 18%)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg, hsl(250 84% 54%), hsl(263 70% 67%))' }} />
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'hsl(240 5% 18%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={18} color="hsl(250 84% 70%)" />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'hsl(0 0% 95%)', margin: 0 }}>Today's Log</h2>
                <p style={{ fontSize: 12, color: 'hsl(240 5% 55%)', margin: 0 }}>
                  {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {/* Total badge */}
              <div style={{
                marginLeft: 'auto',
                background: 'hsl(250 84% 54% / 0.15)',
                border: '1px solid hsl(250 84% 54% / 0.3)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 13,
                fontWeight: 700,
                color: 'hsl(250 84% 75%)',
                fontFamily: 'monospace',
              }}>
                {formatDuration(todayRunning)}
              </div>
            </div>

            {/* Log list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {todayLogs.length === 0 && !isClockedIn ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(240 5% 45%)' }}>
                  <Clock size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No entries today yet</p>
                </div>
              ) : (
                todayLogs.map((log) => (
                  <div key={log.id} style={{
                    background: 'hsl(240 5% 14%)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid hsl(240 6% 20%)',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(0 0% 90%)', fontFamily: 'monospace' }}>
                          {formatTime(log.timeIn)}
                        </span>
                        <span style={{ color: 'hsl(240 5% 45%)', fontSize: 12 }}>→</span>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace',
                          color: log.timeOut ? 'hsl(0 0% 90%)' : 'hsl(142 76% 52%)' }}>
                          {log.timeOut ? formatTime(log.timeOut) : 'ongoing'}
                        </span>
                      </div>
                      {log.notes && (
                        <p style={{ fontSize: 11, color: 'hsl(240 5% 50%)', margin: '4px 0 0' }}>{log.notes}</p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
                      color: log.timeOut ? 'hsl(240 5% 55%)' : 'hsl(142 76% 52%)',
                      background: log.timeOut ? 'hsl(240 5% 18%)' : 'hsl(142 76% 36% / 0.15)',
                      border: `1px solid ${log.timeOut ? 'hsl(240 6% 22%)' : 'hsl(142 76% 36% / 0.3)'}`,
                      borderRadius: 8, padding: '3px 10px',
                    }}>
                      {log.timeOut ? formatDuration(log.duration) : formatDuration(elapsed)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── History Table ─────────────────────────────────────────── */}
      <div style={{
        background: 'hsl(240 6% 10%)',
        borderRadius: 16,
        border: '1px solid hsl(240 6% 18%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, hsl(199 89% 36%), hsl(199 89% 52%))' }} />
        <div style={{ padding: '24px 28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'hsl(0 0% 95%)', margin: '0 0 20px' }}>
            Recent History
          </h2>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'hsl(240 5% 45%)' }}>
              <Calendar size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ fontSize: 13, margin: 0 }}>No attendance records yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(240 6% 18%)' }}>
                    {['Date', 'Time In', 'Time Out', 'Duration', 'Notes'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '0 16px 14px 0',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'hsl(240 5% 50%)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((log, i) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: i < history.length - 1 ? '1px solid hsl(240 6% 14%)' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'hsl(240 5% 13%)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 16px 14px 0', color: 'hsl(0 0% 80%)', fontWeight: 500 }}>
                        {formatDateLabel(log.date)}
                      </td>
                      <td style={{ padding: '14px 16px 14px 0', fontFamily: 'monospace', color: 'hsl(0 0% 85%)' }}>
                        {formatTime(log.timeIn)}
                      </td>
                      <td style={{ padding: '14px 16px 14px 0', fontFamily: 'monospace', color: 'hsl(0 0% 85%)' }}>
                        {log.timeOut ? formatTime(log.timeOut) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px 14px 0' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'hsl(250 84% 72%)',
                          background: 'hsl(250 84% 54% / 0.12)',
                          border: '1px solid hsl(250 84% 54% / 0.25)',
                          borderRadius: 6,
                          padding: '3px 10px',
                        }}>
                          {formatDuration(log.duration)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px 14px 0', color: 'hsl(240 5% 50%)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.notes || <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
