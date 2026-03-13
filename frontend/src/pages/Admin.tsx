import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import {
  Users, UserPlus, Mail, Trash2, Edit3, Crown,
  UserCog, Shield, Clock, CheckSquare, X, Check, Eye, EyeOff, UserCheck,
} from 'lucide-react';

import { VS } from '../lib/theme';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrgUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: Array<{
    id: string;
    role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
    org: { name: string; slug: string };
  }>;
  _count: { macroTasks: number };
}

interface Invite {
  id: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  expiresAt: string;
  invitedBy: { name: string; email: string };
}

// ── Role config ────────────────────────────────────────────────────────────────
const ROLE_CFG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  OWNER: { color: VS.yellow,  bg: 'rgba(220,220,170,0.12)', icon: Crown,   label: 'Owner'  },
  ADMIN: { color: VS.blue,    bg: 'rgba(86,156,214,0.12)',  icon: Shield,  label: 'Admin'  },
  STAFF: { color: VS.teal,    bg: 'rgba(78,201,176,0.12)',  icon: UserCog, label: 'Staff'  },
  CLIENT:{ color: VS.text2,   bg: 'rgba(144,144,144,0.12)', icon: Users,   label: 'Client' },
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 };

// ── Component ──────────────────────────────────────────────────────────────────
export function Admin() {
  const [activeTab, setActiveTab]   = useState<'users' | 'invites'>('users');
  const [users, setUsers]           = useState<OrgUser[]>([]);
  const [invites, setInvites]       = useState<Invite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState<'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [inviting, setInviting]       = useState(false);

  // Edit role
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editingRole, setEditingRole] = useState<'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [saving, setSaving]           = useState(false);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deletingAllUsers, setDeletingAllUsers] = useState(false);
  const [resettingTimeLogs, setResettingTimeLogs] = useState(false);

  // Add user form
  const [showAddUser, setShowAddUser]       = useState(false);
  const [addName, setAddName]               = useState('');
  const [addEmail, setAddEmail]             = useState('');
  const [addPassword, setAddPassword]       = useState('');
  const [addRole, setAddRole]               = useState<'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT'>('STAFF');
  const [showPassword, setShowPassword]     = useState(false);
  const [addingUser, setAddingUser]         = useState(false);

  const { data: session } = useSession();
  const apiClient = useApiClient();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchData = async () => {
    setLoading(true);
    const [uResult, iResult] = await Promise.allSettled([
      apiClient.fetch('/api/admin/users'),
      apiClient.fetch('/api/admin/invites'),
    ]);
    if (uResult.status === 'fulfilled') {
      setUsers(uResult.value.users ?? []);
    } else {
      console.error('❌ Failed to fetch users:', uResult.reason);
    }
    if (iResult.status === 'fulfilled') {
      setInvites(iResult.value.invites ?? []);
    } else {
      console.error('❌ Failed to fetch invites:', iResult.reason);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session?.user?.id) fetchData();
  }, [session?.user?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiClient.fetch('/api/admin/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      setShowInvite(false);
      fetchData();
      showToast('Invitation sent successfully!');
    } catch (err: any) { showToast(err.message || 'Failed to send invitation', false); }
    finally { setInviting(false); }
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await apiClient.fetch(`/api/admin/users/${editingUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: editingRole }),
      });
      setEditingUser(null);
      fetchData();
      showToast('Role updated successfully!');
    } catch (err: any) { showToast(err.message || 'Failed to update role', false); }
    finally { setSaving(false); }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingId(userId);
    try {
      await apiClient.fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      fetchData();
      showToast('Member removed from organization.');
    } catch (err: any) { showToast(err.message || 'Failed to remove member.', false); }
    finally { setRemovingId(null); }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await apiClient.fetch(`/api/admin/invites/${inviteId}/revoke`, { method: 'POST' });
      fetchData();
      showToast('Invitation revoked.');
    } catch (err: any) { showToast(err.message || 'Failed to revoke invitation.', false); }
  };

  const handleSyncAdmins = async () => {
    setSyncing(true);
    try {
      const data = await apiClient.fetch('/api/admin/sync-admins', { method: 'POST' });
      fetchData();
      showToast(`✅ Synced! Added ${data.stats.added} admin(s), ${data.stats.skipped} already in org`);
    } catch (err: any) {
      console.error('Sync error:', err);
      showToast(err.message || 'Failed to sync admins', false);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteAllUsers = async () => {
    if (!confirm('Remove ALL members (non-owners) from this organization? This cannot be undone.')) return;
    setDeletingAllUsers(true);
    try {
      const data = await apiClient.fetch('/api/admin/users/bulk-delete', { method: 'POST' });
      fetchData();
      showToast(data.message || 'All members removed.');
    } catch (err: any) { showToast(err.message || 'Failed to delete all users', false); }
    finally { setDeletingAllUsers(false); }
  };

  const handleResetTimeLogs = async () => {
    if (!confirm('Delete ALL time logs for this organization? This will permanently erase all time tracking data and cannot be undone.')) return;
    setResettingTimeLogs(true);
    try {
      const data = await apiClient.fetch('/api/admin/timelogs/reset', { method: 'POST' });
      showToast(data.message || 'All time logs reset.');
    } catch (err: any) { showToast(err.message || 'Failed to reset time logs', false); }
    finally { setResettingTimeLogs(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const data = await apiClient.fetch('/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({ name: addName, email: addEmail, password: addPassword, role: addRole }),
      });
      setShowAddUser(false);
      setAddName(''); setAddEmail(''); setAddPassword(''); setAddRole('STAFF');
      fetchData();
      showToast(data.message || 'User created successfully!');
    } catch (err: any) { showToast(err.message || 'Failed to create user', false); }
    finally { setAddingUser(false); }
  };

  // ── KPI stats ───────────────────────────────────────────────────────────────
  const pendingInvites = invites.filter(i => i.status === 'PENDING').length;
  const totalTasks     = users.reduce((a, u) => a + (u._count?.macroTasks ?? 0), 0);

  // ── Permission helpers ──────────────────────────────────────────────────────
  const myRole         = users.find(u => u.id === session?.user?.id)?.memberships[0]?.role ?? 'STAFF';
  const isSuperAdmin   = session?.user?.email === 'admin@eversense.ai';
  const canUseDangerZone = isSuperAdmin || myRole === 'OWNER';

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded-lg" style={{ background: VS.bg2 }} />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl" style={{ background: VS.bg1 }} />)}
        </div>
        <div className="h-96 rounded-xl" style={{ background: VS.bg1 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[300] flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium shadow-2xl"
          style={{
            background: toast.ok ? 'rgba(78,201,176,0.15)' : 'rgba(244,71,71,0.15)',
            border: `1px solid ${toast.ok ? VS.teal : VS.red}55`,
            color: toast.ok ? VS.teal : VS.red,
          }}
        >
          {toast.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>User Management</h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>
            Manage team members, roles, and invitations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAdmins}
            disabled={syncing}
            title="Add all ADMIN/OWNER users from other orgs to this organization"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: VS.bg2, border: `1px solid ${VS.border2}`, color: VS.blue }}
          >
            <Users className="h-4 w-4" />
            {syncing ? 'Syncing...' : 'Sync Admins'}
          </button>
          <button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ background: VS.bg2, border: `1px solid ${VS.border2}`, color: VS.text0 }}
          >
            <UserCheck className="h-4 w-4" />
            Add User
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ background: VS.accent, color: '#fff' }}
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Members',   value: users.length,    icon: Users,       color: VS.blue   },
          { label: 'Pending Invites', value: pendingInvites,  icon: Mail,        color: VS.yellow },
          { label: 'Total Tasks',     value: totalTasks,      icon: CheckSquare, color: VS.teal   },
          { label: 'Total Invites',   value: invites.length,  icon: Clock,       color: VS.purple },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums" style={{ color: VS.text0 }}>{value}</div>
              <div className="text-[11px]" style={{ color: VS.text2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: VS.bg2, border: `1px solid ${VS.border}` }}>
        {([['users', 'Members', Users], ['invites', 'Invitations', Mail]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all"
            style={activeTab === key
              ? { background: VS.bg3, color: VS.text0, border: `1px solid ${VS.border2}` }
              : { color: VS.text2 }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ background: VS.bg2, color: VS.text2 }}
            >
              {key === 'users' ? users.length : invites.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Members + Clients tables ── */}
      {activeTab === 'users' && (() => {
        const membersList = users.filter(u => (u.memberships[0]?.role ?? 'CLIENT') !== 'CLIENT');
        const clientsList = users.filter(u => (u.memberships[0]?.role ?? 'CLIENT') === 'CLIENT');
        const renderRow = (user: any, i: number) => {
          const role = user.memberships[0]?.role ?? 'CLIENT';
          const cfg  = ROLE_CFG[role] ?? ROLE_CFG.CLIENT;
          const Icon = cfg.icon;
          const initials = (user.name || user.email).charAt(0).toUpperCase();
          const isOwner = role === 'OWNER';
          const isProtectedAdmin = user.email === 'admin@eversense.ai';
          // Caller can delete if: target not OWNER, not protected, and (caller is super admin/owner OR target is STAFF)
          const canDelete = !isProtectedAdmin && (isSuperAdmin || (!isOwner && (canUseDangerZone || role === 'STAFF')));
          return (
            <div
              key={user.id}
              className="grid gap-4 px-5 py-4 items-center transition-colors hover:bg-white/[0.02]"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                borderTop: i === 0 ? 'none' : `1px solid ${VS.border}`,
              }}
            >
              {/* Member info */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold"
                  style={{ background: `${cfg.color}22`, color: cfg.color }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: VS.text0 }}>
                    {user.name || 'No name'}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: VS.text2 }}>{user.email}</div>
                </div>
              </div>

              {/* Role */}
              <div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
              </div>

              {/* Status */}
              <div>
                <span
                  className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={user.emailVerified
                    ? { background: 'rgba(78,201,176,0.12)', color: VS.teal }
                    : { background: 'rgba(220,220,170,0.12)', color: VS.yellow }
                  }
                >
                  {user.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>

              {/* Activity */}
              <div className="text-[12px]" style={{ color: VS.text2 }}>
                <div>{user._count?.macroTasks ?? 0} tasks</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {!isOwner && !isProtectedAdmin && (
                  <button
                    onClick={() => { setEditingUser(user); setEditingRole(role as any); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/5"
                    style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.blue }}
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit Role
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleRemoveMember(user.id)}
                    disabled={removingId === user.id}
                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 disabled:opacity-40"
                    style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.red }}
                    title="Remove member"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {isOwner && (
                  <span className="text-[11px]" style={{ color: VS.text2 }}>Owner</span>
                )}
              </div>
            </div>
          );
        };

        return (
          <>
            {/* Members Table */}
            <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
              <div
                className="grid gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: VS.bg2, color: VS.text2 }}
              >
                <span>Member</span>
                <span>Role</span>
                <span>Status</span>
                <span>Activity</span>
                <span>Actions</span>
              </div>

              {membersList.length === 0 ? (
                <div className="py-12 text-center text-[13px]" style={{ color: VS.text2 }}>
                  No members found
                </div>
              ) : membersList.map((user, i) => renderRow(user, i))}
            </div>

            {/* Clients Table */}
            <div className="mt-6 text-lg font-semibold" style={{ color: VS.text0 }}>Clients</div>
            <div className="rounded-xl overflow-hidden mt-2" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
              <div
                className="grid gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: VS.bg2, color: VS.text2 }}
              >
                <span>Client</span>
                <span>Role</span>
                <span>Status</span>
                <span>Activity</span>
                <span>Actions</span>
              </div>

              {clientsList.length === 0 ? (
                <div className="py-12 text-center text-[13px]" style={{ color: VS.text2 }}>
                  No clients found
                </div>
              ) : clientsList.map((user, i) => renderRow(user, i))}
            </div>
          </>
        );
      })()}

      {/* ── Invitations table ── */}
      {activeTab === 'invites' && (
        <div className="rounded-xl overflow-hidden" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
          <div
            className="grid gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: VS.bg2, color: VS.text2 }}
          >
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Invited By</span>
            <span>Actions</span>
          </div>

          {invites.length === 0 ? (
            <div className="py-12 text-center">
              <Mail className="h-10 w-10 mx-auto mb-3" style={{ color: VS.text2 }} />
              <p className="text-[13px] font-medium" style={{ color: VS.text1 }}>No invitations yet</p>
              <p className="text-[12px] mt-1" style={{ color: VS.text2 }}>Invite team members to get started</p>
              <button
                onClick={() => setShowInvite(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: VS.accent, color: '#fff' }}
              >
                <UserPlus className="h-4 w-4" /> Send Invitation
              </button>
            </div>
          ) : invites.map((inv, i) => {
            const cfg = ROLE_CFG[inv.role] ?? ROLE_CFG.CLIENT;
            const statusStyle = {
              PENDING:  { bg: 'rgba(220,220,170,0.12)', color: VS.yellow },
              ACCEPTED: { bg: 'rgba(78,201,176,0.12)',  color: VS.teal   },
              EXPIRED:  { bg: 'rgba(144,144,144,0.12)', color: VS.text2  },
              REVOKED:  { bg: 'rgba(244,71,71,0.12)',   color: VS.red    },
            }[inv.status] ?? { bg: VS.bg2, color: VS.text2 };
            return (
              <div
                key={inv.id}
                className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', borderTop: i === 0 ? 'none' : `1px solid ${VS.border}` }}
              >
                <div className="text-[13px] truncate" style={{ color: VS.text1 }}>{inv.email}</div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <div>
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {inv.status}
                  </span>
                </div>
                <div className="text-[12px] truncate" style={{ color: VS.text2 }}>
                  {inv.invitedBy.name || inv.invitedBy.email}
                </div>
                <div>
                  {inv.status === 'PENDING' && (
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/5"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.red }}
                    >
                      <Trash2 className="h-3 w-3" /> Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowInvite(false); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" style={{ color: VS.accent }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Invite Team Member</h3>
              </div>
              <button onClick={() => setShowInvite(false)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="OWNER">Owner — full organization control</option>
                  <option value="ADMIN">Admin — manage members &amp; settings</option>
                  <option value="STAFF">Staff — standard member</option>
                  <option value="CLIENT">Client — limited view access</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-white/5"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={inviting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ background: VS.accent, color: '#fff' }}>
                  <Mail className="h-4 w-4" />
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Role Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" style={{ color: VS.blue }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Change Role</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: VS.bg2 }}>
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{ background: `${ROLE_CFG[editingUser.memberships[0]?.role ?? 'CLIENT'].color}22`, color: ROLE_CFG[editingUser.memberships[0]?.role ?? 'CLIENT'].color }}>
                  {(editingUser.name || editingUser.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: VS.text0 }}>{editingUser.name || 'No name'}</div>
                  <div className="text-[11px]" style={{ color: VS.text2 }}>{editingUser.email}</div>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>New Role</label>
                <select
                  value={editingRole}
                  onChange={e => setEditingRole(e.target.value as any)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="OWNER">Owner — full organization control</option>
                  <option value="ADMIN">Admin — manage members &amp; settings</option>
                  <option value="STAFF">Staff — standard member</option>
                  <option value="CLIENT">Client — limited view access</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/5"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                  Cancel
                </button>
                <button onClick={handleUpdateRole} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:opacity-90"
                  style={{ background: VS.blue, color: '#fff' }}>
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Danger Zone (super admin / owner only) ── */}
      {canUseDangerZone && <div
        className="rounded-xl p-5"
        style={{ background: 'rgba(244,71,71,0.04)', border: `1px solid ${VS.red}33` }}
      >
        <h2 className="text-[14px] font-bold mb-1" style={{ color: VS.red }}>Danger Zone</h2>
        <p className="text-[12px] mb-4" style={{ color: VS.text2 }}>
          These actions are permanent and cannot be undone. Proceed with extreme caution.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDeleteAllUsers}
            disabled={deletingAllUsers}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40 transition-all hover:opacity-90"
            style={{ background: 'rgba(244,71,71,0.14)', border: `1px solid ${VS.red}55`, color: VS.red }}
          >
            <Trash2 className="h-4 w-4" />
            {deletingAllUsers ? 'Removing...' : 'Delete All Users'}
          </button>
          <button
            onClick={handleResetTimeLogs}
            disabled={resettingTimeLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40 transition-all hover:opacity-90"
            style={{ background: 'rgba(244,71,71,0.14)', border: `1px solid ${VS.red}55`, color: VS.red }}
          >
            <Clock className="h-4 w-4" />
            {resettingTimeLogs ? 'Resetting...' : 'Reset All Time Logs'}
          </button>
        </div>
      </div>}

      {/* ── Add User Modal ── */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddUser(false); }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" style={{ color: VS.teal }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Add User Manually</h3>
              </div>
              <button onClick={() => setShowAddUser(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              <p className="text-[12px]" style={{ color: VS.text2 }}>
                Creates the account immediately — no email invite required. The user can log in right away.
              </p>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Full Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Email Address</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="jane@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={addPassword}
                    onChange={e => setAddPassword(e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, paddingRight: '2.5rem' }}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: VS.text2 }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Role</label>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value as any)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="OWNER">Owner — full organization control</option>
                  <option value="ADMIN">Admin — manage members &amp; settings</option>
                  <option value="STAFF">Staff — standard member</option>
                  <option value="CLIENT">Client — limited view access</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/5"
                  style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={addingUser}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:opacity-90"
                  style={{ background: VS.teal, color: VS.bg0 }}>
                  <UserCheck className="h-4 w-4" />
                  {addingUser ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
