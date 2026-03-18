import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';
import {
  Users, Building2, CheckSquare, FolderOpen, UserPlus, Trash2,
  Crown, Shield, UserCog, X, AlertTriangle, LayoutDashboard,
  RefreshCw, ChevronDown, ChevronUp, Search, ArrowLeft,
  Terminal, Settings, Activity, Trash,
} from 'lucide-react';

import { VS } from '../lib/theme';

const SUPER_ADMIN_EMAIL = 'admin@eversense.ai';

async function saFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
  return res.json();
}

const ROLE_CFG: Record<string, { color: string; label: string }> = {
  OWNER:           { color: VS.yellow,  label: 'Owner'          },
  ADMIN:           { color: VS.blue,    label: 'Admin'          },
  STAFF:           { color: VS.teal,    label: 'Staff'          },
  CLIENT:          { color: VS.text2,   label: 'Client'         },
  HALL_OF_JUSTICE: { color: '#f59e0b',  label: 'Hall of Justice' },
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 };

type Section = 'overview' | 'users' | 'companies' | 'leads' | 'errors' | 'settings';

interface Stats {
  totalUsers: number; totalOrgs: number; totalTasks: number;
  totalProjects: number; totalClients: number; recentUsers: number;
}
interface OrgUser {
  id: string; email: string; name: string | null; emailVerified: boolean; createdAt: string;
  memberships: Array<{ role: string; org: { id: string; name: string; slug: string } }>;
  _count: { macroTasks: number };
}
interface Org {
  id: string; name: string; slug: string; createdAt: string;
  memberCount: number; taskCount: number;
  owner: { id: string; email: string; name: string | null } | null;
}
interface ErrorEntry {
  level: string; source: string; message: string; detail: string | null; ts: string;
}
interface PendingInvite {
  id: string; email: string; orgId: string; orgName: string; orgSlug: string;
  expiresAt: string; createdAt: string; token: string;
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-tight" style={{ color: VS.text0 }}>{value}</div>
        <div className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color }}>{sub}</div>}
      </div>
    </div>
  );
}

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] shadow-xl"
      style={{ background: ok ? 'rgba(78,201,176,0.15)' : 'rgba(244,71,71,0.15)', border: `1px solid ${ok ? VS.teal : VS.red}`, color: ok ? VS.teal : VS.red }}>
      {ok ? '✓' : '✕'} {msg}
      <button onClick={onClose}><X className="h-3.5 w-3.5 ml-1 opacity-60 hover:opacity-100" /></button>
    </div>
  );
}

function ConfirmDialog({ title, body, onConfirm, onCancel }: {
  title: string; body: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-full max-w-sm rounded-xl p-6 shadow-2xl" style={{ background: VS.bg1, border: `1px solid ${VS.border2}` }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5" style={{ color: VS.red }} />
          <h3 className="text-[15px] font-bold" style={{ color: VS.text0 }}>{title}</h3>
        </div>
        <p className="text-[13px] mb-6" style={{ color: VS.text1 }}>{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/[0.05] transition-all"
            style={{ border: `1px solid ${VS.border}`, color: VS.text1 }}>Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={{ background: 'rgba(244,71,71,0.15)', border: `1px solid rgba(244,71,71,0.4)`, color: VS.red }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName]   = useState('');
  const [role, setRole]   = useState('STAFF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await saFetch('/api/super-admin/invite', {
        method: 'POST',
        body: JSON.stringify({ email, name: name || undefined, role }),
      });
      if (data.error) { setError(data.error); return; }
      onSuccess(data.message || 'Invitation sent'); onClose();
    } catch { setError('Failed to send invitation'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: VS.bg1, border: `1px solid ${VS.border2}` }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${VS.border}` }}>
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" style={{ color: VS.accent }} />
            <h2 className="text-[15px] font-bold" style={{ color: VS.text0 }}>Invite User</h2>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="h-4 w-4" style={{ color: VS.text1 }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: VS.text2 }}>Email *</label>
            <input className={inputCls} style={inputStyle} type="email" required placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: VS.text2 }}>Name (optional)</label>
            <input className={inputCls} style={inputStyle} type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: VS.text2 }}>Role</label>
            <select className={inputCls} style={inputStyle} value={role} onChange={e => setRole(e.target.value)}>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>
          {error && <p className="text-[12px]" style={{ color: VS.red }}>{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/[0.05] transition-all"
              style={{ border: `1px solid ${VS.border}`, color: VS.text1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-all"
              style={{ background: VS.accent, color: '#fff', border: 'none' }}>{loading ? 'Sending…' : 'Send Invite'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [company, setCompany]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await saFetch('/api/super-admin/create-lead-account', {
        method: 'POST',
        body: JSON.stringify({ email, name: name || undefined, companyName: company }),
      });
      if (data.error) { setError(data.error); return; }
      onSuccess(data.message || 'Lead account created'); onClose();
    } catch { setError('Failed to create lead account'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: VS.bg1, border: `1px solid ${VS.border2}` }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${VS.border}` }}>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" style={{ color: VS.yellow }} />
            <h2 className="text-[15px] font-bold" style={{ color: VS.text0 }}>Add Lead Account</h2>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="h-4 w-4" style={{ color: VS.text1 }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: VS.text2 }}>Company Name *</label>
            <input className={inputCls} style={inputStyle} type="text" required placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: VS.text2 }}>Owner Email *</label>
            <input className={inputCls} style={inputStyle} type="email" required placeholder="owner@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: VS.text2 }}>Owner Name (optional)</label>
            <input className={inputCls} style={inputStyle} type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <p className="text-[11px] px-3 py-2 rounded-lg" style={{ background: VS.bg3, color: VS.text2 }}>
            A new organization will be created and an invitation sent to the owner email with <span style={{ color: VS.yellow }}>Owner</span> role.
          </p>
          {error && <p className="text-[12px]" style={{ color: VS.red }}>{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/[0.05] transition-all"
              style={{ border: `1px solid ${VS.border}`, color: VS.text1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-all"
              style={{ background: `${VS.yellow}22`, border: `1px solid ${VS.yellow}55`, color: VS.yellow }}>
              {loading ? 'Creating…' : 'Create Lead Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar nav item ───────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, badge, onClick }: {
  icon: React.ElementType; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-left transition-all"
      style={active
        ? { background: `${VS.accent}22`, color: VS.text0, border: `1px solid ${VS.accent}44` }
        : { color: VS.text2, border: '1px solid transparent' }}
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: active ? VS.accent : VS.text2 }} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${VS.red}22`, color: VS.red }}>{badge}</span>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SuperAdmin() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const [section, setSection] = useState<Section>('overview');
  const [stats, setStats]         = useState<Stats | null>(null);
  const [users, setUsers]         = useState<OrgUser[]>([]);
  const [orgs, setOrgs]           = useState<Org[]>([]);
  const [errors, setErrors]       = useState<ErrorEntry[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const [search, setSearch]           = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showInvite, setShowInvite]   = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [confirm, setConfirm]         = useState<{ type: 'user'|'org'|'invite'; id: string; label: string } | null>(null);

  const isSuperAdmin = session?.user?.email === SUPER_ADMIN_EMAIL;

  const showToast = useCallback((msg: string, ok: boolean) => setToast({ msg, ok }), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, uRes, oRes, eRes, piRes] = await Promise.all([
        saFetch('/api/super-admin/stats'),
        saFetch('/api/super-admin/users'),
        saFetch('/api/super-admin/orgs-detailed'),
        saFetch('/api/super-admin/errors'),
        saFetch('/api/super-admin/pending-owner-invites'),
      ]);
      if (sRes.totalUsers !== undefined) setStats(sRes);
      if (uRes.users) setUsers(uRes.users);
      if (oRes.orgs) setOrgs(oRes.orgs);
      if (eRes.errors) setErrors(eRes.errors);
      if (piRes.invites) setPendingInvites(piRes.invites);
    } catch { showToast('Failed to load data', false); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { if (isSuperAdmin) loadAll(); }, [isSuperAdmin, loadAll]);

  async function handleDeleteUser(userId: string) {
    try {
      const data = await saFetch(`/api/super-admin/users/${userId}`, { method: 'DELETE' });
      if (data.error) { showToast(data.error, false); return; }
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast('User deleted', true);
    } catch { showToast('Failed to delete user', false); }
    setConfirm(null);
  }

  async function handleDeleteInvite(inviteId: string) {
    try {
      const data = await saFetch(`/api/super-admin/invites/${inviteId}`, { method: 'DELETE' });
      if (data.error) { showToast(data.error, false); return; }
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      showToast('Invitation deleted', true);
    } catch { showToast('Failed to delete invitation', false); }
    setConfirm(null);
  }

  async function handleDeleteOrg(orgId: string) {
    try {
      const data = await saFetch(`/api/super-admin/orgs/${orgId}`, { method: 'DELETE' });
      if (data.error) { showToast(data.error, false); return; }
      setOrgs(prev => prev.filter(o => o.id !== orgId));
      showToast('Organization deleted', true);
    } catch { showToast('Failed to delete organization', false); }
    setConfirm(null);
  }

  async function handleClearErrors() {
    await saFetch('/api/super-admin/errors/clear', { method: 'POST' });
    setErrors([]);
    showToast('Error log cleared', true);
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: VS.bg0 }}>
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-3" style={{ color: VS.red, opacity: 0.5 }} />
          <p className="text-[15px] font-semibold" style={{ color: VS.text1 }}>Access Denied</p>
          <p className="text-[13px] mt-1 mb-4" style={{ color: VS.text2 }}>Super admin access required</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-lg text-[13px]"
            style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
            Back to App
          </button>
        </div>
      </div>
    );
  }

  const owners = users.filter(u => u.memberships.some(m => m.role === 'OWNER'));
  const filteredUsers = users.filter(u => !search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.name ?? '').toLowerCase().includes(search.toLowerCase()));
  const filteredOrgs  = orgs.filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase()));
  const filteredLeads = owners.filter(u => !search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.name ?? '').toLowerCase().includes(search.toLowerCase()));

  const navItems: { id: Section; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview',   label: 'Overview',       icon: LayoutDashboard },
    { id: 'users',      label: 'User Management', icon: Users,     badge: users.length },
    { id: 'companies',  label: 'Companies',       icon: Building2, badge: orgs.length },
    { id: 'leads',      label: 'Lead Accounts',   icon: Crown,     badge: owners.length },
    { id: 'errors',     label: 'Error Logs',      icon: Terminal,  badge: errors.length },
    { id: 'settings',   label: 'Admin Settings',  icon: Settings },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: VS.bg0, fontFamily: 'inherit' }}>

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 flex flex-col" style={{ background: VS.bg1, borderRight: `1px solid ${VS.border}`, minHeight: '100vh' }}>
        {/* Logo / title */}
        <div className="px-4 py-4 flex items-center gap-2.5" style={{ borderBottom: `1px solid ${VS.border}` }}>
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${VS.yellow}22`, border: `1px solid ${VS.yellow}44` }}>
            <Crown className="h-3.5 w-3.5" style={{ color: VS.yellow }} />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight" style={{ color: VS.text0 }}>Super Admin</p>
            <p className="text-[10px] leading-tight" style={{ color: VS.text2 }}>EverSense Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={section === item.id}
              badge={item.badge}
              onClick={() => { setSection(item.id); setSearch(''); }}
            />
          ))}
        </nav>

        {/* Back to app */}
        <div className="p-3" style={{ borderTop: `1px solid ${VS.border}` }}>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-all hover:bg-white/[0.04]"
            style={{ color: VS.text2, border: `1px solid transparent` }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to App
          </button>
          <div className="mt-2 px-3 py-2">
            <p className="text-[11px] truncate" style={{ color: VS.text2 }}>{session?.user?.email}</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: VS.text0 }}>
              {navItems.find(n => n.id === section)?.label ?? 'Super Admin'}
            </h1>
            <p className="text-[11px]" style={{ color: VS.text2 }}>Platform-wide management</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-all hover:bg-white/[0.05] disabled:opacity-50"
              style={{ border: `1px solid ${VS.border}`, color: VS.text1 }}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {(section === 'users' || section === 'overview') && (
              <button onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                style={{ background: VS.accent, color: '#fff', border: 'none' }}>
                <UserPlus className="h-3.5 w-3.5" />
                Invite User
              </button>
            )}
            {section === 'leads' && (
              <button onClick={() => setShowAddLead(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                style={{ background: `${VS.yellow}22`, border: `1px solid ${VS.yellow}55`, color: VS.yellow }}>
                <Crown className="h-3.5 w-3.5" />
                Add Lead Account
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid #3c3c3c', borderTopColor: VS.accent }} />
            </div>
          ) : (

            /* ── OVERVIEW ── */
            section === 'overview' ? (
              <div className="space-y-6">
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                    <StatCard label="Total Users"    value={stats.totalUsers}    icon={Users}          color={VS.blue}   sub={`+${stats.recentUsers} this month`} />
                    <StatCard label="Companies"      value={stats.totalOrgs}     icon={Building2}      color={VS.teal}   />
                    <StatCard label="Total Tasks"    value={stats.totalTasks}    icon={CheckSquare}    color={VS.accent} />
                    <StatCard label="Projects"       value={stats.totalProjects} icon={FolderOpen}     color={VS.orange} />
                    <StatCard label="Clients"        value={stats.totalClients}  icon={UserCog}        color={VS.purple} />
                    <StatCard label="Lead Accounts"  value={owners.length}       icon={Crown}          color={VS.yellow} />
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent users */}
                  <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4" style={{ color: VS.teal }} />
                      <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Recent Sign-ups</h2>
                    </div>
                    <div className="space-y-2">
                      {users.slice(0, 8).map(u => (
                        <div key={u.id} className="flex items-center gap-3 py-1.5">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: `${VS.accent}22`, color: VS.accent }}>
                            {(u.name || u.email)[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] truncate" style={{ color: VS.text0 }}>{u.name || u.email}</p>
                            <p className="text-[11px] truncate" style={{ color: VS.text2 }}>{u.name ? u.email : ''}</p>
                          </div>
                          <span className="text-[11px]" style={{ color: VS.text2 }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Recent errors */}
                  <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid ${errors.length > 0 ? 'rgba(244,71,71,0.3)' : VS.border}` }}>
                    <div className="flex items-center gap-2 mb-4">
                      <Terminal className="h-4 w-4" style={{ color: errors.length > 0 ? VS.red : VS.text2 }} />
                      <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>Recent Errors</h2>
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${VS.red}18`, color: VS.red }}>{errors.length}</span>
                    </div>
                    {errors.length === 0 ? (
                      <p className="text-[13px] py-4 text-center" style={{ color: VS.text2 }}>No errors logged</p>
                    ) : (
                      <div className="space-y-2">
                        {errors.slice(0, 5).map((e, i) => (
                          <div key={i} className="rounded-lg px-3 py-2" style={{ background: VS.bg2 }}>
                            <p className="text-[12px] font-mono truncate" style={{ color: VS.red }}>{e.message}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: VS.text2 }}>{e.source} · {new Date(e.ts).toLocaleTimeString()}</p>
                          </div>
                        ))}
                        {errors.length > 5 && (
                          <button onClick={() => setSection('errors')} className="text-[12px] w-full text-center py-1 hover:opacity-70" style={{ color: VS.accent }}>
                            View all {errors.length} errors →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            /* ── USER MANAGEMENT ── */
            ) : section === 'users' ? (
              <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                <div className="flex items-center gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: `1px solid ${VS.border}` }}>
                  <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>All Users ({users.length})</h2>
                  <div className="relative ml-auto flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
                    <input className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc]/50"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text0 }}
                      placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                        {['Name', 'Email', 'Role', 'Company', 'Tasks', 'Verified', 'Joined', ''].map(h => (
                          <th key={h} className="px-5 py-3 text-left font-medium" style={{ color: VS.text2 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={8} className="py-10 text-center" style={{ color: VS.text2 }}>No users found</td></tr>
                      )}
                      {filteredUsers.map(u => {
                        const top = u.memberships[0];
                        const rc  = ROLE_CFG[top?.role ?? ''] ?? { color: VS.text2, label: top?.role ?? '—' };
                        const exp = expandedUser === u.id;
                        return (
                          <>
                            <tr key={u.id} className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                              style={{ borderBottom: exp ? 'none' : `1px solid ${VS.border}` }}
                              onClick={() => setExpandedUser(exp ? null : u.id)}>
                              <td className="px-5 py-3 font-medium" style={{ color: VS.text0 }}>
                                <div className="flex items-center gap-1.5">
                                  {exp ? <ChevronUp className="h-3 w-3 shrink-0" style={{ color: VS.text2 }} /> : <ChevronDown className="h-3 w-3 shrink-0" style={{ color: VS.text2 }} />}
                                  {u.name || '—'}
                                </div>
                              </td>
                              <td className="px-5 py-3" style={{ color: VS.text1 }}>{u.email}</td>
                              <td className="px-5 py-3">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `${rc.color}18`, color: rc.color }}>{rc.label}</span>
                              </td>
                              <td className="px-5 py-3" style={{ color: VS.text2 }}>{top?.org.name ?? '—'}</td>
                              <td className="px-5 py-3 tabular-nums" style={{ color: VS.text1 }}>{u._count.macroTasks}</td>
                              <td className="px-5 py-3" style={{ color: u.emailVerified ? VS.teal : VS.orange }}>{u.emailVerified ? '✓' : '—'}</td>
                              <td className="px-5 py-3" style={{ color: VS.text2 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                              <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                                {u.email !== SUPER_ADMIN_EMAIL && (
                                  <button onClick={() => setConfirm({ type: 'user', id: u.id, label: u.email })}
                                    className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-all" style={{ color: VS.red }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                            {exp && (
                              <tr key={`${u.id}-x`} style={{ borderBottom: `1px solid ${VS.border}` }}>
                                <td colSpan={8} className="px-12 pb-3">
                                  <div className="text-[12px] space-y-1" style={{ color: VS.text2 }}>
                                    <p><span style={{ color: VS.text1 }}>ID:</span> {u.id}</p>
                                    {u.memberships.map(m => (
                                      <p key={m.org.id}><span style={{ color: ROLE_CFG[m.role]?.color ?? VS.text2 }}>{m.role}</span> in <span style={{ color: VS.text1 }}>{m.org.name}</span> <span>({m.org.slug})</span></p>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            /* ── COMPANIES ── */
            ) : section === 'companies' ? (
              <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                <div className="flex items-center gap-3 px-5 py-4 flex-wrap" style={{ borderBottom: `1px solid ${VS.border}` }}>
                  <h2 className="text-[13px] font-bold" style={{ color: VS.text0 }}>All Companies ({orgs.length})</h2>
                  <div className="relative ml-auto flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
                    <input className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc]/50"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text0 }}
                      placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                        {['Company', 'Slug', 'Owner', 'Members', 'Tasks', 'Created', ''].map(h => (
                          <th key={h} className="px-5 py-3 text-left font-medium" style={{ color: VS.text2 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrgs.length === 0 && (
                        <tr><td colSpan={7} className="py-10 text-center" style={{ color: VS.text2 }}>No companies found</td></tr>
                      )}
                      {filteredOrgs.map(o => (
                        <tr key={o.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid ${VS.border}` }}>
                          <td className="px-5 py-3 font-medium" style={{ color: VS.text0 }}>
                            <div className="flex items-center gap-2">
                              {o.slug === 'veblen' && <Crown className="h-3 w-3 shrink-0" style={{ color: VS.yellow }} />}
                              {o.name}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-[12px]" style={{ color: VS.text2 }}>{o.slug}</td>
                          <td className="px-5 py-3" style={{ color: VS.text1 }}>{o.owner?.email ?? '—'}</td>
                          <td className="px-5 py-3 tabular-nums" style={{ color: VS.text1 }}>{o.memberCount}</td>
                          <td className="px-5 py-3 tabular-nums" style={{ color: VS.text1 }}>{o.taskCount}</td>
                          <td className="px-5 py-3" style={{ color: VS.text2 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-right">
                            {o.slug !== 'veblen' && (
                              <button onClick={() => setConfirm({ type: 'org', id: o.id, label: o.name })}
                                className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition-all" style={{ color: VS.red }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            /* ── LEAD ACCOUNTS ── */
            ) : section === 'leads' ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-[13px]" style={{ color: VS.text2 }}>Owner-role accounts across all companies</p>
                  <button onClick={() => setShowAddLead(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
                    style={{ background: `${VS.yellow}22`, border: `1px solid ${VS.yellow}55`, color: VS.yellow }}>
                    <Crown className="h-3.5 w-3.5" />
                    Add Lead Account
                  </button>
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
                    <input className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc]/50"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text0 }}
                      placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>

                {/* Pending invites */}
                {pendingInvites.filter(i => !search || i.email.toLowerCase().includes(search.toLowerCase()) || i.orgName.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-semibold mb-3 uppercase tracking-wider" style={{ color: VS.text2 }}>
                      Pending Invitations ({pendingInvites.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {pendingInvites.filter(i => !search || i.email.toLowerCase().includes(search.toLowerCase()) || i.orgName.toLowerCase().includes(search.toLowerCase())).map(inv => (
                        <div key={inv.id} className="rounded-xl p-4" style={{ background: VS.bg1, border: `1px solid ${VS.orange}44` }}>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                                style={{ background: `${VS.orange}22`, color: VS.orange }}>
                                {inv.email[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold truncate" style={{ color: VS.text0 }}>{inv.email}</p>
                                <p className="text-[11px] truncate" style={{ color: VS.text2 }}>Invite pending</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 whitespace-nowrap" style={{ background: `${VS.orange}18`, color: VS.orange }}>Pending</span>
                          </div>
                          <div className="space-y-1 text-[12px]" style={{ color: VS.text2 }}>
                            <div className="flex justify-between">
                              <span>Company</span>
                              <span style={{ color: VS.teal }}>{inv.orgName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Expires</span>
                              <span style={{ color: new Date(inv.expiresAt) < new Date() ? VS.red : VS.text1 }}>
                                {new Date(inv.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${VS.border}` }}>
                            <button onClick={() => setConfirm({ type: 'invite', id: inv.id, label: inv.email })}
                              className="flex items-center gap-1.5 text-[12px] opacity-50 hover:opacity-100 transition-all" style={{ color: VS.red }}>
                              <Trash2 className="h-3 w-3" /> Delete invitation
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active owners */}
                {filteredLeads.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-semibold mb-3 uppercase tracking-wider" style={{ color: VS.text2 }}>
                      Active Owners ({filteredLeads.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredLeads.map(u => {
                        const ownerMem = u.memberships.find(m => m.role === 'OWNER');
                        return (
                          <div key={u.id} className="rounded-xl p-4" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                                  style={{ background: `${VS.yellow}22`, color: VS.yellow }}>
                                  {(u.name || u.email)[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold truncate" style={{ color: VS.text0 }}>{u.name || '—'}</p>
                                  <p className="text-[11px] truncate" style={{ color: VS.text2 }}>{u.email}</p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ background: `${VS.yellow}18`, color: VS.yellow }}>Owner</span>
                            </div>
                            <div className="space-y-1 text-[12px]" style={{ color: VS.text2 }}>
                              <div className="flex justify-between">
                                <span>Company</span>
                                <span style={{ color: VS.teal }}>{ownerMem?.org.name ?? '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tasks</span>
                                <span style={{ color: VS.text1 }}>{u._count.macroTasks}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Joined</span>
                                <span style={{ color: VS.text1 }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {u.email !== SUPER_ADMIN_EMAIL && (
                              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${VS.border}` }}>
                                <button onClick={() => setConfirm({ type: 'user', id: u.id, label: u.email })}
                                  className="flex items-center gap-1.5 text-[12px] opacity-50 hover:opacity-100 transition-all" style={{ color: VS.red }}>
                                  <Trash2 className="h-3 w-3" /> Delete account
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredLeads.length === 0 && pendingInvites.length === 0 && (
                  <div className="rounded-xl p-10 text-center" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                    <Crown className="h-8 w-8 mx-auto mb-2 opacity-30" style={{ color: VS.yellow }} />
                    <p className="text-[13px]" style={{ color: VS.text2 }}>No lead accounts found</p>
                  </div>
                )}
              </div>

            /* ── ERROR LOGS ── */
            ) : section === 'errors' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-[13px]" style={{ color: VS.text2 }}>Real-time API error log (last 200 entries)</p>
                  {errors.length > 0 && (
                    <button onClick={handleClearErrors}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-all"
                      style={{ background: 'rgba(244,71,71,0.1)', border: `1px solid rgba(244,71,71,0.3)`, color: VS.red }}>
                      <Trash className="h-3.5 w-3.5" /> Clear log
                    </button>
                  )}
                </div>
                {errors.length === 0 ? (
                  <div className="rounded-xl p-10 text-center" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                    <Terminal className="h-8 w-8 mx-auto mb-2 opacity-30" style={{ color: VS.text2 }} />
                    <p className="text-[13px]" style={{ color: VS.text2 }}>No errors logged — system is clean</p>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid rgba(244,71,71,0.25)` }}>
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${VS.border}` }}>
                          {['Time', 'Source', 'Message', 'Detail'].map(h => (
                            <th key={h} className="px-5 py-3 text-left font-medium" style={{ color: VS.text2 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {errors.map((e, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: `1px solid ${VS.border}` }}>
                            <td className="px-5 py-2.5 font-mono text-[11px] whitespace-nowrap" style={{ color: VS.text2 }}>
                              {new Date(e.ts).toLocaleString()}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-[11px]" style={{ color: VS.orange }}>{e.source}</td>
                            <td className="px-5 py-2.5" style={{ color: VS.red }}>{e.message}</td>
                            <td className="px-5 py-2.5 text-[11px] font-mono max-w-xs truncate" style={{ color: VS.text2 }}>{e.detail ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            /* ── ADMIN SETTINGS ── */
            ) : section === 'settings' ? (
              <div className="space-y-4 max-w-2xl">
                <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                  <h2 className="text-[13px] font-bold mb-4" style={{ color: VS.text0 }}>Platform Info</h2>
                  <div className="space-y-3 text-[13px]">
                    {[
                      { label: 'Super Admin Email', value: SUPER_ADMIN_EMAIL },
                      { label: 'Primary Org Slug',  value: 'veblen' },
                      { label: 'Total Users',        value: stats?.totalUsers ?? '—' },
                      { label: 'Total Companies',    value: stats?.totalOrgs ?? '—' },
                      { label: 'New Users (30d)',    value: stats?.recentUsers ?? '—' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${VS.border}` }}>
                        <span style={{ color: VS.text2 }}>{row.label}</span>
                        <span className="font-medium" style={{ color: VS.text0 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-5" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                  <h2 className="text-[13px] font-bold mb-3" style={{ color: VS.text0 }}>Danger Zone</h2>
                  <p className="text-[12px] mb-4" style={{ color: VS.text2 }}>Destructive actions. Use with caution.</p>
                  <button onClick={handleClearErrors}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all"
                    style={{ background: 'rgba(244,71,71,0.1)', border: `1px solid rgba(244,71,71,0.3)`, color: VS.red }}>
                    <Trash className="h-3.5 w-3.5" /> Clear Error Log
                  </button>
                </div>
              </div>
            ) : null
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {showInvite  && <InviteModal    onClose={() => setShowInvite(false)}  onSuccess={msg => { showToast(msg, true); loadAll(); }} />}
      {showAddLead && <AddLeadModal   onClose={() => setShowAddLead(false)} onSuccess={msg => { showToast(msg, true); loadAll(); }} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.type === 'user' ? 'Delete User' : confirm.type === 'org' ? 'Delete Company' : 'Delete Invitation'}
          body={confirm.type === 'invite' ? `Cancel the invitation for "${confirm.label}"? This cannot be undone.` : `Permanently delete "${confirm.label}"? This cannot be undone.`}
          onConfirm={() => confirm.type === 'user' ? handleDeleteUser(confirm.id) : confirm.type === 'org' ? handleDeleteOrg(confirm.id) : handleDeleteInvite(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  );
}
