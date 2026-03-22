import { useState, useEffect, useRef } from 'react';
import { useSession, authClient } from '../lib/auth-client';
import { useOrganization } from '../contexts/OrganizationContext';

import {
  User,
  Bell,
  Shield,
  Palette,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Save,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  Plug,
  CheckCircle,
  Key,
  ExternalLink,
  Coffee,
} from 'lucide-react';

import { VS } from '../lib/theme';
import { useApiClient } from '../lib/api-client';

export function Settings() {
  const { data: session } = useSession();
  const apiClient = useApiClient();
  const { currentOrg } = useOrganization();
  const [userRole, setUserRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState('profile');

  // Extract real user data from session
  const userName = session?.user?.name || '';
  const nameWords = userName.split(' ');
  const firstName = nameWords[0] || '';
  const lastName = nameWords.slice(1).join(' ') || '';

  // Form states with real user data
  const [profile, setProfile] = useState({
    firstName: firstName,
    lastName: lastName,
    email: session?.user?.email || '',
    phone: '',
    location: '',
    bio: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    hourlyRate: 0
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    weeklyReports: true,
    marketingEmails: false
  });

  // Profile save state
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Integrations state
  const [intStatus, setIntStatus] = useState<{ firefliesConfigured: boolean; firefliesKeyMasked: string | null; googleConnected: boolean } | null>(null);
  const [ffKey, setFfKey] = useState('');
  const [ffSaving, setFfSaving] = useState(false);
  const [ffMsg, setFfMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  // Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(session?.user?.image ?? null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Attendance policy state (admin/owner only)
  const isPrivileged = ['OWNER', 'ADMIN', 'HALL_OF_JUSTICE'].includes(userRole || '');
  const [attPolicy, setAttPolicy] = useState({ breakLimitH: 0, breakLimitM: 30, breakCountPerDay: 1 });
  const [attSaving, setAttSaving] = useState(false);
  const [attMsg, setAttMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoClockoutMinutes, setAutoClockoutMinutes] = useState(90);
  const [clockoutSaving, setClockoutSaving] = useState(false);
  const [clockoutMsg, setClockoutMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync avatar from session
  useEffect(() => {
    if (session?.user?.image) setAvatarUrl(session.user.image);
  }, [session?.user?.image]);

  // Update profile data when session changes
  useEffect(() => {
    if (session?.user) {
      const userName = session.user.name || '';
      const nameWords = userName.split(' ');
      const firstName = nameWords[0] || '';
      const lastName = nameWords.slice(1).join(' ') || '';

      setProfile(prev => ({
        ...prev,
        firstName: firstName,
        lastName: lastName,
        email: session.user.email || '',
      }));
    }
  }, [session]);

  // Load role + attendance policy when org changes
  useEffect(() => {
    if (!currentOrg?.id) return;
    // Fetch role via attendance logs endpoint (returns role)
    fetch(`/api/attendance/logs?orgId=${currentOrg.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) setUserRole(d.role); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!currentOrg?.id || !isPrivileged) return;
    apiClient.fetch(`/api/attendance/policy?orgId=${currentOrg.id}`)
      .then(d => {
        const secs = d.breakLimitSecs ?? 1800;
        setAttPolicy({
          breakLimitH: Math.floor(secs / 3600),
          breakLimitM: Math.round((secs % 3600) / 60),
          breakCountPerDay: d.breakCountPerDay ?? 1,
        });
      })
      .catch(() => {});

    if (isPrivileged && currentOrg?.id) {
      apiClient.fetch(`/api/attendance/settings?orgId=${currentOrg.id}`)
        .then((d: { autoClockoutMinutes: number }) => setAutoClockoutMinutes(d.autoClockoutMinutes ?? 90))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, isPrivileged]);

  // Load integrations status + handle Google OAuth return
  useEffect(() => {
    apiClient.fetch('/api/integrations/status').then(d => setIntStatus(d)).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'integrations') {
      setActiveTab('integrations');
      const g = params.get('google');
      if (g === 'connected') setGoogleMsg('Google Calendar connected successfully!');
      else if (g === 'denied') setGoogleMsg('Google authorization was cancelled.');
      else if (g === 'error') setGoogleMsg('Google authorization failed. Please try again.');
      // Clean the URL
      window.history.replaceState({}, '', '/settings');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log('Settings page loaded with user:', session?.user?.name);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    ...(isPrivileged ? [{ id: 'attendance', label: 'Attendance', icon: Coffee }] : []),
  ];

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const fullName = [profile.firstName.trim(), profile.lastName.trim()].filter(Boolean).join(' ');
      const res = await authClient.updateUser({ name: fullName });
      if (res.error) {
        setProfileMsg({ type: 'error', text: res.error.message || 'Failed to save changes.' });
      } else {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
      }
    } catch (err: unknown) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save changes.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (!passwordForm.current) { setPasswordMsg({ type: 'error', text: 'Current password is required.' }); return; }
    if (passwordForm.newPass.length < 8) { setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { setPasswordMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setPasswordSaving(true);
    try {
      const res = await authClient.changePassword({ currentPassword: passwordForm.current, newPassword: passwordForm.newPass, revokeOtherSessions: false });
      if (res.error) {
        setPasswordMsg({ type: 'error', text: res.error.message || 'Failed to change password.' });
      } else {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
        setPasswordForm({ current: '', newPass: '', confirm: '' });
      }
    } catch (err: unknown) {
      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: VS.text2,
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    background: VS.bg2,
    border: `1px solid ${VS.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: VS.text0,
    fontSize: 13,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const inputWithIconStyle: React.CSSProperties = {
    ...inputStyle,
    paddingLeft: 36,
  };

  const cardStyle: React.CSSProperties = {
    background: VS.bg1,
    border: `1px solid ${VS.border}`,
    borderRadius: 12,
    padding: 24,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: VS.text0,
    marginBottom: 16,
    marginTop: 0,
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: VS.border,
    margin: '16px 0',
  };

  const saveButtonStyle: React.CSSProperties = {
    background: VS.accent,
    color: 'white',
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      {/* Profile Picture */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Profile Picture</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar preview */}
          <div style={{ height: 72, width: 72, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: `linear-gradient(135deg, ${VS.accent}, ${VS.purple})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>
                  {profile.firstName[0]}{profile.lastName[0]}
                </span>
            }
          </div>

          {/* Hidden file input */}
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (avatarInputRef.current) avatarInputRef.current.value = '';
              const reader = new FileReader();
              reader.onload = ev => {
                const original = ev.target?.result as string;
                // Resize to 128×128 on a canvas to keep payload small
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 128; canvas.height = 128;
                  const ctx = canvas.getContext('2d')!;
                  // Cover-crop: centre the image
                  const scale = Math.max(128 / img.width, 128 / img.height);
                  const w = img.width * scale, h = img.height * scale;
                  ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  setAvatarUrl(dataUrl);
                  setAvatarMsg(null);
                  // Auto-save
                  setAvatarSaving(true);
                  fetch('/api/users/avatar', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl }),
                  })
                    .then(r => r.json())
                    .then(d => {
                      if (d.success) {
                        setAvatarMsg({ type: 'success', text: 'Photo updated. Refreshing…' });
                        setTimeout(() => window.location.reload(), 800);
                      } else {
                        setAvatarMsg({ type: 'error', text: d.error || 'Failed to save.' });
                      }
                    })
                    .catch(() => setAvatarMsg({ type: 'error', text: 'Upload failed.' }))
                    .finally(() => setAvatarSaving(false));
                };
                img.src = original;
              };
              reader.readAsDataURL(file);
            }}
          />

          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => avatarInputRef.current?.click()} disabled={avatarSaving}
                style={{ background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 8,
                  color: VS.text0, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6, opacity: avatarSaving ? 0.6 : 1 }}>
                <Camera style={{ width: 14, height: 14 }} />
                {avatarSaving ? 'Uploading…' : 'Upload Photo'}
              </button>
              {avatarUrl && (
                <button disabled={avatarSaving}
                  onClick={() => {
                    setAvatarSaving(true); setAvatarMsg(null);
                    fetch('/api/users/avatar', { method: 'DELETE', credentials: 'include' })
                      .then(r => r.json())
                      .then(d => {
                        if (d.success) {
                          setAvatarMsg({ type: 'success', text: 'Photo removed. Refreshing…' });
                          setTimeout(() => window.location.reload(), 800);
                        } else {
                          setAvatarMsg({ type: 'error', text: d.error || 'Failed.' });
                        }
                      })
                      .catch(() => setAvatarMsg({ type: 'error', text: 'Failed to remove.' }))
                      .finally(() => setAvatarSaving(false));
                  }}
                  style={{ background: 'transparent', border: `1px solid ${VS.border}`, borderRadius: 8,
                    color: VS.text2, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                  Remove
                </button>
              )}
            </div>
            {avatarMsg && (
              <p style={{ fontSize: 12, marginTop: 8, color: avatarMsg.type === 'success' ? VS.teal : VS.red }}>
                {avatarMsg.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div style={cardStyle}>
        <p style={sectionTitleStyle}>Personal Information</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input
              type="text"
              value={profile.firstName}
              onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input
              type="text"
              value={profile.lastName}
              onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <div style={{ position: 'relative' }}>
            <Mail
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 14,
                height: 14,
                color: VS.text2,
              }}
            />
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
              style={inputWithIconStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Phone</label>
            <div style={{ position: 'relative' }}>
              <Phone
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 14,
                  height: 14,
                  color: VS.text2,
                }}
              />
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                style={inputWithIconStyle}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <div style={{ position: 'relative' }}>
              <MapPin
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 14,
                  height: 14,
                  color: VS.text2,
                }}
              />
              <input
                type="text"
                value={profile.location}
                onChange={(e) => setProfile(prev => ({ ...prev, location: e.target.value }))}
                style={inputWithIconStyle}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
            rows={3}
            style={{
              ...inputStyle,
              resize: 'none',
              lineHeight: 1.5,
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select
              value={profile.timezone}
              onChange={(e) => setProfile(prev => ({ ...prev, timezone: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Default Hourly Rate</label>
            <div style={{ position: 'relative' }}>
              <DollarSign
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 14,
                  height: 14,
                  color: VS.text2,
                }}
              />
              <input
                type="number"
                value={profile.hourlyRate}
                onChange={(e) => setProfile(prev => ({ ...prev, hourlyRate: Number(e.target.value) }))}
                style={inputWithIconStyle}
              />
            </div>
          </div>
        </div>

        {profileMsg && (
          <p style={{ fontSize: 13, marginBottom: 12, color: profileMsg.type === 'success' ? VS.teal : VS.red }}>
            {profileMsg.text}
          </p>
        )}
        <button onClick={handleSaveProfile} disabled={profileSaving} style={{ ...saveButtonStyle, opacity: profileSaving ? 0.6 : 1 }}>
          <Save style={{ width: 14, height: 14 }} />
          {profileSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div style={cardStyle}>
      <p style={sectionTitleStyle}>Notification Preferences</p>
      <div>
        {Object.entries(notifications).map(([key, value], idx) => (
          <div key={key}>
            {idx > 0 && <div style={dividerStyle} />}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: idx === 0 ? 0 : 4,
                paddingBottom: 4,
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: VS.text0, margin: 0, marginBottom: 2 }}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </p>
                <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>
                  {key === 'emailNotifications' && 'Receive email notifications for important updates'}
                  {key === 'pushNotifications' && 'Get push notifications on your devices'}
                  {key === 'taskReminders' && 'Reminders for upcoming task deadlines'}
                  {key === 'weeklyReports' && 'Weekly productivity and time tracking reports'}
                  {key === 'marketingEmails' && 'Product updates and promotional content'}
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="sr-only peer"
                />
                <div
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: value ? VS.accent : VS.bg3,
                    border: `1px solid ${value ? VS.accent : VS.border}`,
                    position: 'relative',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: value ? 20 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <button onClick={() => {}} style={saveButtonStyle}>
          <Save style={{ width: 14, height: 14 }} />
          Save Preferences
        </button>
      </div>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'preferences':
        return (
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>App Preferences</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Theme</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date Format</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                  <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                  <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
            <p style={{ textAlign: 'center', color: VS.text2, fontSize: 13, margin: 0 }}>
              More preference options coming soon...
            </p>
          </div>
        );
      case 'billing':
        return (
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Billing &amp; Subscription</p>
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <DollarSign
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 16px',
                  color: VS.text2,
                  display: 'block',
                }}
              />
              <p style={{ color: VS.text2, fontSize: 13, margin: 0 }}>Billing features coming soon...</p>
            </div>
          </div>
        );
      case 'security':
        return (
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Change Password</p>

            {/* Current Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={passwordForm.current}
                  onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                  placeholder="Enter current password"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 0, display: 'flex' }}>
                  {showCurrent ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={passwordForm.newPass}
                  onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
                  placeholder="At least 8 characters"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 0, display: 'flex' }}>
                  {showNew ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 0, display: 'flex' }}>
                  {showConfirm ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                </button>
              </div>
            </div>

            {/* Feedback message */}
            {passwordMsg && (
              <p style={{ fontSize: 13, marginBottom: 16, color: passwordMsg.type === 'success' ? VS.teal : VS.red }}>
                {passwordMsg.text}
              </p>
            )}

            <button onClick={handleChangePassword} disabled={passwordSaving} style={{ ...saveButtonStyle, opacity: passwordSaving ? 0.6 : 1 }}>
              <Save style={{ width: 14, height: 14 }} />
              {passwordSaving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        );
      case 'integrations':
        return (
          <div className="space-y-6">
            {/* Google Calendar */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" alt="Google Calendar" style={{ width: 24, height: 24 }} />
                <p style={sectionTitleStyle}>Google Calendar</p>
              </div>
              <p style={{ fontSize: 12, color: VS.text2, marginBottom: 16, marginTop: 0 }}>
                Connect your Google account to create calendar events with Google Meet links.
              </p>

              {googleMsg && (
                <p style={{ fontSize: 13, marginBottom: 12, color: googleMsg.includes('successfully') ? VS.teal : VS.red }}>
                  {googleMsg}
                </p>
              )}

              {intStatus?.googleConnected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: VS.teal, fontSize: 13 }}>
                    <CheckCircle style={{ width: 16, height: 16 }} />
                    Google Calendar connected
                  </div>
                  <button
                    onClick={async () => {
                      await apiClient.fetch('/api/integrations/google', { method: 'DELETE' });
                      setIntStatus(s => s ? { ...s, googleConnected: false } : s);
                      setGoogleMsg('Google Calendar disconnected.');
                    }}
                    style={{ background: 'transparent', border: `1px solid ${VS.border}`, borderRadius: 6, color: VS.text2, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <a
                  href="/api/integrations/google/connect"
                  style={{ ...saveButtonStyle, textDecoration: 'none', display: 'inline-flex' }}
                >
                  <ExternalLink style={{ width: 14, height: 14 }} />
                  Connect Google Calendar
                </a>
              )}
            </div>

            {/* Fireflies */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Key style={{ width: 18, height: 18, color: VS.accent }} />
                <p style={sectionTitleStyle}>Fireflies API Key</p>
              </div>
              <p style={{ fontSize: 12, color: VS.text2, marginBottom: 16, marginTop: 0 }}>
                Enter your Fireflies.ai API key to enable meeting transcript sync for your organization.
              </p>

              {intStatus?.firefliesConfigured && (
                <p style={{ fontSize: 12, color: VS.teal, marginBottom: 12 }}>
                  Current key: {intStatus.firefliesKeyMasked}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={ffKey}
                  onChange={e => setFfKey(e.target.value)}
                  placeholder={intStatus?.firefliesConfigured ? 'Enter new key to replace...' : 'Paste your Fireflies API key...'}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  disabled={ffSaving || !ffKey.trim()}
                  onClick={async () => {
                    setFfSaving(true); setFfMsg(null);
                    try {
                      await apiClient.fetch('/api/integrations/fireflies', { method: 'PUT', body: JSON.stringify({ apiKey: ffKey }) });
                      setFfMsg({ type: 'success', text: 'API key saved.' });
                      setFfKey('');
                      const d = await apiClient.fetch('/api/integrations/status');
                      setIntStatus(d);
                    } catch (e: unknown) {
                      setFfMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save key.' });
                    } finally { setFfSaving(false); }
                  }}
                  style={{ ...saveButtonStyle, opacity: (ffSaving || !ffKey.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}
                >
                  <Save style={{ width: 14, height: 14 }} />
                  {ffSaving ? 'Saving...' : 'Save Key'}
                </button>
              </div>

              {ffMsg && (
                <p style={{ fontSize: 13, marginTop: 10, color: ffMsg.type === 'success' ? VS.teal : VS.red }}>
                  {ffMsg.text}
                </p>
              )}

              {intStatus?.firefliesConfigured && (
                <button
                  onClick={async () => {
                    await apiClient.fetch('/api/integrations/fireflies', { method: 'DELETE' });
                    setIntStatus(s => s ? { ...s, firefliesConfigured: false, firefliesKeyMasked: null } : s);
                    setFfMsg({ type: 'success', text: 'API key removed.' });
                  }}
                  style={{ marginTop: 10, background: 'transparent', border: `1px solid ${VS.border}`, borderRadius: 6, color: VS.red, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
                >
                  Remove Key
                </button>
              )}
            </div>
          </div>
        );
      case 'attendance':
        return (
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Break Policy</p>
            <p style={{ fontSize: 12, color: VS.text2, marginBottom: 20, marginTop: 0 }}>
              Set the maximum break duration and how many breaks staff can take per day.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Max break duration */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: VS.text2, marginBottom: 8 }}>
                  Max Break Duration
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', width: 100 }}>
                    <input
                      type="number" min={0} max={9} value={attPolicy.breakLimitH}
                      onChange={e => setAttPolicy(p => ({ ...p, breakLimitH: Math.max(0, Math.min(9, parseInt(e.target.value) || 0)) }))}
                      style={{ width: '100%', background: VS.bg3, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: '8px 32px 8px 12px', fontSize: 13, color: VS.text0, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>h</span>
                  </div>
                  <div style={{ position: 'relative', width: 100 }}>
                    <input
                      type="number" min={0} max={59} value={attPolicy.breakLimitM}
                      onChange={e => setAttPolicy(p => ({ ...p, breakLimitM: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) }))}
                      style={{ width: '100%', background: VS.bg3, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: '8px 32px 8px 12px', fontSize: 13, color: VS.text0, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>m</span>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: VS.text2, marginTop: 6 }}>
                  Break time beyond this limit will be shown as "Over Break" in the time logs.
                </p>
              </div>

              {/* Breaks per day */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: VS.text2, marginBottom: 8 }}>
                  Breaks Allowed Per Day
                </label>
                <input
                  type="number" min={1} max={10} value={attPolicy.breakCountPerDay}
                  onChange={e => setAttPolicy(p => ({ ...p, breakCountPerDay: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) }))}
                  style={{ width: 100, background: VS.bg3, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: VS.text0, outline: 'none' }}
                />
                <p style={{ fontSize: 11, color: VS.text2, marginTop: 6 }}>
                  Staff can take this many breaks per day before the Break button is disabled.
                </p>
              </div>

              {attMsg && (
                <p style={{ fontSize: 13, color: attMsg.type === 'success' ? VS.teal : VS.red }}>{attMsg.text}</p>
              )}

              <div>
                <button
                  onClick={async () => {
                    if (!currentOrg?.id) return;
                    setAttSaving(true); setAttMsg(null);
                    try {
                      const breakLimitSecs = attPolicy.breakLimitH * 3600 + attPolicy.breakLimitM * 60;
                      await apiClient.fetch(`/api/attendance/policy?orgId=${currentOrg.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ breakLimitSecs, breakCountPerDay: attPolicy.breakCountPerDay }),
                      });
                      setAttMsg({ type: 'success', text: 'Break policy saved.' });
                    } catch (e: any) {
                      setAttMsg({ type: 'error', text: e.message || 'Failed to save.' });
                    } finally {
                      setAttSaving(false);
                    }
                  }}
                  disabled={attSaving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: VS.accent, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: attSaving ? 'not-allowed' : 'pointer', opacity: attSaving ? 0.7 : 1 }}
                >
                  <Save size={14} /> {attSaving ? 'Saving…' : 'Save Policy'}
                </button>
              </div>
            </div>

            {/* Auto Clock-Out */}
            <div style={{ background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 12, padding: 24, marginTop: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: VS.text0, margin: '0 0 4px' }}>Auto Clock-Out</h3>
              <p style={{ fontSize: 12, color: VS.text2, marginBottom: 20 }}>
                Automatically clock out staff who forget to clock out after the set duration.
              </p>

              {clockoutMsg && (
                <p style={{ fontSize: 13, color: clockoutMsg.type === 'success' ? VS.teal : VS.red, marginBottom: 12 }}>{clockoutMsg.text}</p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: VS.text1, whiteSpace: 'nowrap' }}>Clock out after</label>
                <div style={{ position: 'relative', width: 100 }}>
                  <input
                    type="number" min={15} max={1440}
                    value={autoClockoutMinutes}
                    onChange={e => setAutoClockoutMinutes(Math.max(15, Math.min(1440, parseInt(e.target.value) || 90)))}
                    style={{ width: '100%', background: VS.bg3, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: '8px 36px 8px 12px', fontSize: 13, color: VS.text0, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>min</span>
                </div>
                <span style={{ fontSize: 12, color: VS.text2 }}>
                  ({Math.floor(autoClockoutMinutes / 60)}h {autoClockoutMinutes % 60}m)
                </span>
              </div>

              <button
                onClick={async () => {
                  if (!currentOrg?.id) return;
                  setClockoutSaving(true); setClockoutMsg(null);
                  try {
                    await apiClient.fetch(`/api/attendance/settings?orgId=${currentOrg.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ autoClockoutMinutes }),
                    });
                    setClockoutMsg({ type: 'success', text: 'Auto clock-out duration saved.' });
                  } catch (e: any) {
                    setClockoutMsg({ type: 'error', text: e.message || 'Failed to save.' });
                  } finally {
                    setClockoutSaving(false);
                  }
                }}
                disabled={clockoutSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: VS.accent, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: clockoutSaving ? 'not-allowed' : 'pointer', opacity: clockoutSaving ? 0.7 : 1 }}
              >
                <Save size={14} /> {clockoutSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: VS.text0, margin: 0 }}>Settings</h1>
        <p style={{ color: VS.text2, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Manage your account preferences and configuration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div
            style={{
              background: VS.bg1,
              border: `1px solid ${VS.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: isActive ? `${VS.accent}15` : 'transparent',
                    color: isActive ? VS.accent : VS.text2,
                    borderLeft: isActive ? `2px solid ${VS.accent}` : '2px solid transparent',
                    border: 'none',
                    borderLeftStyle: 'solid',
                    borderLeftWidth: 2,
                    borderLeftColor: isActive ? VS.accent : 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
