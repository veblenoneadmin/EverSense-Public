import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, UserPlus, Building2, LogIn, Eye, EyeOff, LogOut } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';
import { useSessionContext } from '../contexts/SessionContext';
import { authSignOut } from '../lib/auth-client';

interface InviteDetails {
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  organization: {
    name: string;
    slug: string;
    memberCount: number;
  };
  invitedBy: { name: string } | null;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  STAFF: 'Staff Member',
  CLIENT: 'Client',
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  backgroundColor: '#3c3c3c',
  border: '1px solid #555',
  borderRadius: 4,
  color: '#cccccc',
  fontSize: 13,
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,122,204,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,122,204,0.04) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ top: '20%', left: '15%', width: '380px', height: '380px', background: 'rgba(0,122,204,0.08)' }} />
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ bottom: '20%', right: '15%', width: '340px', height: '340px', background: 'rgba(0,122,204,0.06)', animationDelay: '1s' }} />
      </div>
      <div className="w-full max-w-sm relative z-10" style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4" style={{ backgroundColor: '#323233', borderRadius: '8px 8px 0 0', height: '32px', borderBottom: '1px solid #3c3c3c' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
          </div>
          <span className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>EverSense Ai — invite.ts</span>
          <div className="w-12" />
        </div>
        {/* Editor panel */}
        <div style={{ backgroundColor: '#252526', border: '1px solid #3c3c3c', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
          {/* Tab bar */}
          <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'stretch' }}>
            <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: '#cccccc', borderBottom: '1px solid #007acc', backgroundColor: '#1e1e1e', fontFamily: 'monospace' }}>
              <EverSenseLogo height={16} width={94} />
              invite.ts
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center gap-2 mb-2">
              <EverSenseLogo width={336} height={80} />
            </div>
            {children}
          </div>
        </div>
        {/* Status bar */}
        <div className="flex items-center justify-between px-3 text-xs" style={{ backgroundColor: '#007acc', color: '#ffffff', height: '22px', borderRadius: '0 0 8px 8px', fontFamily: 'monospace' }}>
          <span>⎇ main</span>
          <span>EverSense Ai v1.0</span>
        </div>
      </div>
    </div>
  );
}

export function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, isLoading: sessionLoading } = useSessionContext();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Create-account form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [mode, setMode] = useState<'create' | 'signin'>('create');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invite token.');
      setLoading(false);
      return;
    }

    fetch(`/api/invites/${token}/details`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setInvite(data.invite);
          if (data.invite.isExpired) {
            setError('This invite link has expired. Please ask the admin to send a new one.');
          } else if (data.invite.status !== 'PENDING') {
            setError(`This invite has already been ${data.invite.status.toLowerCase()}.`);
          }
        } else {
          setError(data.error || 'Invalid invite link.');
        }
      })
      .catch(() => setError('Unable to load invite details. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Accept invite (for already-logged-in users)
  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 2500);
      } else {
        setError(data.error || data.message || 'Failed to accept invite.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  // Create account + accept invite (for new users)
  const handleCreateAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Please enter your name.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setAccepting(true);
    try {
      // Single backend call: creates account via Better Auth's internal API,
      // accepts the invite, and forwards the session cookie — no two-step race condition.
      const res = await fetch('/api/invites/register-and-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, name: name.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 || data.code === 'EMAIL_EXISTS') {
          setError('An account with this email already exists. Please sign in instead.');
          setMode('signin');
        } else {
          setError(data.error || 'Failed to create account.');
        }
        return;
      }

      // Full reload so the session cookie is picked up by the React app
      setSuccess(true);
      setTimeout(() => { window.location.href = '/dashboard'; }, 2000);

    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading || sessionLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid #3c3c3c', borderTopColor: '#007acc' }} />
          <p className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>// loading invite...</p>
        </div>
      </Shell>
    );
  }

  // Success state
  if (success) {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-10 w-10" style={{ color: '#4ec9b0' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#cccccc', fontFamily: 'monospace' }}>✓ Welcome to {invite?.organization.name}!</p>
            <p className="text-xs mt-1" style={{ color: '#858585', fontFamily: 'monospace' }}>// redirecting to dashboard...</p>
          </div>
        </div>
      </Shell>
    );
  }

  // Error with no valid invite
  if (!invite || invite.isExpired || invite.status !== 'PENDING') {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <div className="text-2xl">✗</div>
          <p className="text-sm" style={{ color: '#f47171', fontFamily: 'monospace' }}>
            {error || 'This invite is no longer valid.'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: '#007acc', fontFamily: 'monospace' }}
          >
            Go to Sign In
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Shell>
    );
  }

  // Valid invite — user NOT logged in → show create account / sign in
  if (!session) {
    const loginUrl = `/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`;

    return (
      <Shell>
        <div className="space-y-4">
          {/* Org info */}
          <div className="px-3 py-3 rounded space-y-1.5" style={{ backgroundColor: 'rgba(0,122,204,0.08)', border: '1px solid rgba(0,122,204,0.25)' }}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0" style={{ color: '#007acc' }} />
              <span className="text-sm font-medium" style={{ color: '#cccccc', fontFamily: 'monospace' }}>
                {invite.organization.name}
              </span>
            </div>
            <div className="text-xs space-y-0.5 pl-6" style={{ color: '#858585', fontFamily: 'monospace' }}>
              <div>// role: <span style={{ color: '#4ec9b0' }}>{ROLE_LABEL[invite.role] || invite.role}</span></div>
              {invite.invitedBy && (
                <div>// invited by: <span style={{ color: '#9cdcfe' }}>{invite.invitedBy.name}</span></div>
              )}
              <div>// email: <span style={{ color: '#ce9178' }}>{invite.email}</span></div>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid #3c3c3c' }}>
            {(['create', 'signin'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: mode === m ? '#007acc' : '#2d2d2d',
                  color: mode === m ? '#fff' : '#858585',
                  border: 'none',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                {m === 'create' ? '+ Create Account' : '→ Sign In'}
              </button>
            ))}
          </div>

          {/* Create account form */}
          {mode === 'create' && (
            <form onSubmit={handleCreateAndAccept} className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#858585', fontFamily: 'monospace' }}>Email</label>
                <input
                  type="email"
                  value={invite.email}
                  readOnly
                  style={{ ...inp, color: '#6a9955', cursor: 'not-allowed', opacity: 0.8 }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#858585', fontFamily: 'monospace' }}>Your Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={inp}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#858585', fontFamily: 'monospace' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ ...inp, paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#858585', cursor: 'pointer', padding: 0 }}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#858585', fontFamily: 'monospace' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    style={{ ...inp, paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(p => !p)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#858585', cursor: 'pointer', padding: 0 }}
                  >
                    {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 text-xs rounded" style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f47171', fontFamily: 'monospace' }}>
                  ✗ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={accepting}
                className="w-full py-2 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                style={{
                  backgroundColor: accepting ? '#0a4d7a' : '#0e639c',
                  color: '#ffffff',
                  border: '1px solid #1177bb',
                  borderRadius: '4px',
                  cursor: accepting ? 'not-allowed' : 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                <UserPlus className="h-4 w-4" />
                {accepting ? '▶ Creating account...' : '▶ Create Account & Join'}
              </button>
            </form>
          )}

          {/* Sign in option */}
          {mode === 'signin' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>
                // Sign in with your existing account to accept this invitation.
              </p>
              {error && (
                <div className="px-3 py-2 text-xs rounded" style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f47171', fontFamily: 'monospace' }}>
                  ✗ {error}
                </div>
              )}
              <Link
                to={loginUrl}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium"
                style={{
                  backgroundColor: '#0e639c',
                  color: '#ffffff',
                  border: '1px solid #1177bb',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  textDecoration: 'none',
                }}
              >
                <LogIn className="h-4 w-4" />
                Sign In to Accept
              </Link>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // Logged in — email mismatch warning
  const emailMismatch = session.user.email !== invite.email;

  return (
    <Shell>
      <div className="space-y-4">
        {/* Invite info */}
        <div className="px-3 py-3 rounded space-y-2" style={{ backgroundColor: 'rgba(0,122,204,0.08)', border: '1px solid rgba(0,122,204,0.25)' }}>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" style={{ color: '#007acc' }} />
            <span className="text-sm font-medium" style={{ color: '#cccccc', fontFamily: 'monospace' }}>
              {invite.organization.name}
            </span>
          </div>
          <div className="text-xs space-y-0.5 pl-6" style={{ color: '#858585', fontFamily: 'monospace' }}>
            <div>// role: <span style={{ color: '#4ec9b0' }}>{ROLE_LABEL[invite.role] || invite.role}</span></div>
            {invite.invitedBy && (
              <div>// invited by: <span style={{ color: '#9cdcfe' }}>{invite.invitedBy.name}</span></div>
            )}
            <div>// members: <span style={{ color: '#b5cea8' }}>{invite.organization.memberCount}</span></div>
          </div>
        </div>

        {/* Email mismatch — offer sign-out so they can create the invited account */}
        {emailMismatch && (
          <div className="space-y-2">
            <div className="px-3 py-2 text-xs rounded" style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f47171', fontFamily: 'monospace' }}>
              ⚠ This invite is for <strong>{invite.email}</strong>, but you're signed in as <strong>{session.user.email}</strong>.
            </div>
            <button
              onClick={async () => {
                await authSignOut();
                window.location.assign(window.location.pathname + window.location.search);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded"
              style={{ backgroundColor: '#2d2d2d', border: '1px solid #555', color: '#cccccc', fontFamily: 'monospace', cursor: 'pointer' }}
            >
              <LogOut size={13} />
              Sign out &amp; create account for {invite.email}
            </button>
          </div>
        )}

        {/* Error */}
        {error && !emailMismatch && (
          <div className="px-3 py-2 text-xs rounded" style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f47171', fontFamily: 'monospace' }}>
            ✗ {error}
          </div>
        )}

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={accepting || emailMismatch}
          className="w-full py-2 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            backgroundColor: (accepting || emailMismatch) ? '#0a4d7a' : '#0e639c',
            color: '#ffffff',
            border: '1px solid #1177bb',
            borderRadius: '4px',
            cursor: (accepting || emailMismatch) ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
          onMouseEnter={e => { if (!accepting && !emailMismatch) (e.currentTarget.style.backgroundColor = '#1177bb'); }}
          onMouseLeave={e => { if (!accepting && !emailMismatch) (e.currentTarget.style.backgroundColor = '#0e639c'); }}
        >
          <UserPlus className="h-4 w-4" />
          {accepting ? '▶ Joining...' : '▶ Accept Invitation'}
        </button>

        <div className="text-center text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>
          // Signed in as <span style={{ color: '#ce9178' }}>{session.user.email}</span>
        </div>
      </div>
    </Shell>
  );
}
