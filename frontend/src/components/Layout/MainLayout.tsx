import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession, authSignOut } from '../../lib/auth-client';
import Sidebar from './Sidebar';
import { LogOut, ChevronDown, Bell, CheckCheck, X, CheckSquare, AlertTriangle, Clock, CalendarDays, Users, Video, Info, Menu } from 'lucide-react';
import { useSSE } from '../../hooks/useSSE';

import { VS } from '../../lib/theme';

function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function nowClock() {
  return new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Australia/Sydney' });
}

const pageTitles: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/brain-dump':  'Brain Dump',
  '/tasks':       'Tasks',
  '/timer':       'Timer',
  '/attendance':  'Attendance',
  '/projects':    'Projects',
  '/timesheets':  'Time Logs',
  '/clients':     'Clients',
  '/members':     'Members',
  '/reports':     'Reports',
  '/kpi-reports': 'KPI Reports',
  '/admin':       'Administration',
  '/settings':    'Settings',
};

const MainLayout: React.FC = () => {
  const { data: session } = useSession();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');

  // Notifications
  type Notif = { id: string; title: string; body: string | null; link: string | null; type: string; isRead: boolean; createdAt: string };
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Wall clock
  const [currentTime, setCurrentTime] = useState(nowClock());

  // Attendance timer
  const [attendanceActive, setAttendanceActive] = useState<{ timeIn: string } | null>(null);
  const [navOnBreak, setNavOnBreak] = useState(false);
  const [navElapsed, setNavElapsed] = useState(0);
  const navTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user?.id) return;
      try {
        const res = await fetch('/api/organizations');
        if (res.ok) {
          const data = await res.json();
          if (data.organizations?.length > 0) {
            setUserRole(data.organizations[0].role || '');
            setOrgId(data.organizations[0].id || '');
          }
        }
      } catch { /* ignore */ }
    };
    if (session) fetchRole();
  }, [session]);

  // Wall clock tick
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(nowClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch attendance status
  const fetchStatus = useCallback(async () => {
    if (!session?.user?.id || !orgId) return;
    try {
      const q = new URLSearchParams({ userId: session!.user!.id, orgId }).toString();
      const res = await fetch(`/api/attendance/status?${q}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAttendanceActive(data.active);
        setNavOnBreak(!!localStorage.getItem('att_break_start'));
      }
    } catch { /* ignore */ }
  }, [session?.user?.id, orgId]);

  useEffect(() => {
    if (!session?.user?.id || !orgId) return;
    fetchStatus();
    window.addEventListener('attendance-change', fetchStatus);
    return () => window.removeEventListener('attendance-change', fetchStatus);
  }, [session?.user?.id, orgId, fetchStatus]);

  // Fetch notifications
  const fetchNotifs = useCallback(async () => {
    if (!session?.user?.id || !orgId) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch { /* ignore */ }
  }, [session?.user?.id, orgId]);

  useEffect(() => {
    if (!session?.user?.id || !orgId) return;
    fetchNotifs();
  }, [session?.user?.id, orgId, fetchNotifs]);

  // SSE — real-time push updates (replaces polling intervals)
  useSSE(orgId || undefined, (event) => {
    if (event === 'attendance')   fetchStatus();
    if (event === 'notification') fetchNotifs();
  });

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleNotifClick = async (notif: { id: string; link: string | null; isRead: boolean }) => {
    if (!notif.isRead) {
      await fetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (notif.link) window.location.href = notif.link;
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // Live elapsed tick — pause on break or clock-out, subtract break time
  useEffect(() => {
    if (navTimerRef.current) clearInterval(navTimerRef.current);
    if (!attendanceActive) return; // keep last navElapsed, just stop ticking
    if (navOnBreak) return; // on break — freeze the counter

    const tick = () => {
      const gross = Math.floor((Date.now() - new Date(attendanceActive.timeIn).getTime()) / 1000);
      const breakAccum = Number(localStorage.getItem('att_break_accum') || 0);
      setNavElapsed(Math.max(0, gross - breakAccum));
    };
    tick();
    navTimerRef.current = setInterval(tick, 1000);
    return () => { if (navTimerRef.current) clearInterval(navTimerRef.current); };
  }, [attendanceActive, navOnBreak]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      // Redirect to login after logout
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Redirect anyway even if there's an error
      window.location.href = '/login';
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]?.toUpperCase()).filter(Boolean).join('').slice(0, 2) || 'U';

  const pageTitle = pageTitles[location.pathname] ?? 'EverSense Ai';
  const email = session?.user?.email ?? '';
  const displayName = session?.user?.name || email.split('@')[0] || 'User';

  const notifTypeMeta: Record<string, { icon: React.ElementType; color: string }> = {
    task:     { icon: CheckSquare,  color: VS.accent },
    comment:  { icon: CheckSquare,  color: '#c586c0' },
    due_soon: { icon: Clock,        color: '#dcdcaa' },
    overdue:  { icon: AlertTriangle,color: '#f44747' },
    project:  { icon: Info,         color: '#4ec9b0' },
    calendar: { icon: CalendarDays, color: '#4ec9b0' },
    meeting:  { icon: Video,        color: '#569cd6' },
    member:   { icon: Users,        color: '#6a9955' },
    reminder: { icon: Clock,        color: '#ce9178' },
    info:     { icon: Info,         color: VS.text2  },
  };

  return (
    <div className="min-h-screen" style={{ background: VS.bg0 }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Top Navbar */}
      <header
        className="fixed top-0 right-0 z-40 flex h-14 items-center justify-between px-3 md:px-6 md:left-60 left-0"
        style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}
      >
        {/* Left — hamburger (mobile) + page title */}
        <div className="flex items-center gap-2">
          <button
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
            style={{ color: sidebarOpen ? VS.text0 : VS.text2, background: sidebarOpen ? VS.bg2 : 'transparent' }}
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-sm font-semibold" style={{ color: VS.text2 }}>{pageTitle}</h1>
        </div>

        {/* Center — wall clock + attendance elapsed (absolutely centered, hidden on small screens) */}
        <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-3">
          <span className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: VS.text1 }}>
            {currentTime}
          </span>

          {navElapsed > 0 && (
            <>
              <span style={{ color: VS.border }}>|</span>
              <div className="flex items-center gap-1.5">
                {attendanceActive && !navOnBreak && (
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: VS.teal }} />
                )}
                {navOnBreak && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: `${VS.red}22`, color: VS.red }}>
                    Break
                  </span>
                )}
                <span
                  className="text-[13px] font-mono font-semibold tabular-nums"
                  style={{ color: attendanceActive && !navOnBreak ? VS.teal : VS.text2 }}
                >
                  {fmtElapsed(navElapsed)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right — notifications + user dropdown */}
        <div className="flex items-center gap-2">

          {/* Bell icon */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(v => !v); setShowDropdown(false); }}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
              style={{ background: showNotifications ? VS.bg3 : 'transparent', color: VS.text1 }}
              onMouseEnter={e => { if (!showNotifications) (e.currentTarget as HTMLElement).style.background = VS.bg2; }}
              onMouseLeave={e => { if (!showNotifications) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: VS.red, minWidth: 16 }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] sm:w-80 rounded-xl z-20 overflow-hidden flex flex-col"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', maxHeight: 420 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: `1px solid ${VS.border}` }}>
                    <span className="text-[12px] font-semibold" style={{ color: VS.text0 }}>Notifications</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="flex items-center gap-1 text-[11px] transition-colors"
                          style={{ color: VS.accent }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                        >
                          <CheckCheck className="h-3 w-3" />
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="flex h-5 w-5 items-center justify-center rounded"
                        style={{ color: VS.text2 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = VS.text0}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = VS.text2}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: VS.text2 }}>
                        <Bell className="h-6 w-6 opacity-30" />
                        <p className="text-[12px]">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map(n => {
                        const meta = notifTypeMeta[n.type] ?? notifTypeMeta.info;
                        const TypeIcon = meta.icon;
                        return (
                          <button
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors duration-100"
                            style={{
                              background: n.isRead ? 'transparent' : `${VS.accent}0f`,
                              borderBottom: `1px solid ${VS.border}`,
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = VS.bg2}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.isRead ? 'transparent' : `${VS.accent}0f`}
                          >
                            {/* Type icon */}
                            <div
                              className="mt-0.5 h-6 w-6 shrink-0 rounded-md flex items-center justify-center"
                              style={{ background: `${meta.color}20` }}
                            >
                              <TypeIcon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[12px] font-medium leading-snug truncate" style={{ color: n.isRead ? VS.text1 : VS.text0 }}>{n.title}</p>
                                {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: VS.accent }} />}
                              </div>
                              {n.body && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: VS.text2 }}>{n.body}</p>}
                              <p className="text-[10px] mt-1" style={{ color: VS.text2 }}>{timeAgo(n.createdAt)}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowDropdown(v => !v); setShowNotifications(false); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors duration-150"
              style={{ background: showDropdown ? VS.bg3 : 'transparent' }}
              onMouseEnter={e => { if (!showDropdown) (e.currentTarget as HTMLElement).style.background = VS.bg2; }}
              onMouseLeave={e => { if (!showDropdown) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Avatar */}
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, hsl(252 87% 62%), hsl(260 80% 70%))' }}
              >
                {getInitials(displayName)}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <p className="text-[12px] font-medium capitalize" style={{ color: VS.text0 }}>{displayName}</p>
                {userRole && (
                  <p className="text-[10px] capitalize" style={{ color: VS.text2 }}>{userRole.toLowerCase()}</p>
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: VS.text2 }} />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl z-20 overflow-hidden"
                  style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${VS.border}` }}>
                    <p className="text-[12px] font-medium capitalize" style={{ color: VS.text0 }}>{displayName}</p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: VS.text2 }}>{email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-150"
                    style={{ color: VS.text1 }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = `${VS.red}14`;
                      (e.currentTarget as HTMLElement).style.color = VS.red;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = VS.text1;
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="md:pl-60 pt-14 min-w-0">
        <div className="p-3 sm:p-5 md:p-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
