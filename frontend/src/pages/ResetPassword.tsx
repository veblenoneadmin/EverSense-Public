import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';

const panelStyle = {
  filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))',
};

const inputStyle = {
  backgroundColor: '#3c3c3c',
  border: '1px solid #3c3c3c',
  borderRadius: '4px',
  color: '#cccccc',
  fontFamily: 'monospace',
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
      <div className="w-full max-w-sm relative z-10" style={panelStyle}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4" style={{ backgroundColor: '#323233', borderRadius: '8px 8px 0 0', height: '32px', borderBottom: '1px solid #3c3c3c' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
          </div>
          <span className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>EverSense Ai — reset-password.ts</span>
          <div className="w-12" />
        </div>
        {/* Editor panel */}
        <div style={{ backgroundColor: '#252526', border: '1px solid #3c3c3c', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
          {/* Tab bar */}
          <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'stretch' }}>
            <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: '#cccccc', borderBottom: '1px solid #007acc', backgroundColor: '#1e1e1e', fontFamily: 'monospace' }}>
              <EverSenseLogo height={16} width={94} />
              reset-password.ts
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

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const token = searchParams.get('token');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid or missing reset token');
        setCheckingToken(false);
        return;
      }
      try {
        const response = await fetch(`/api/password-reset/verify-reset-token?token=${token}`);
        if (response.ok) {
          setIsValidToken(true);
        } else {
          setError('This reset link has expired or is invalid. Please request a new one.');
        }
      } catch {
        setError('Unable to verify reset token. Please try again.');
      } finally {
        setCheckingToken(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters long'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/password-reset/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6" style={{ border: '2px solid #3c3c3c', borderTopColor: '#007acc' }} />
          <p className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>// verifying token...</p>
        </div>
      </Shell>
    );
  }

  if (!isValidToken && !success) {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <div className="text-2xl">✗</div>
          <p className="text-sm" style={{ color: '#f47171', fontFamily: 'monospace' }}>{error}</p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: '#007acc', fontFamily: 'monospace' }}
          >
            Request new reset link
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {!success ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs mb-1" style={{ color: '#858585', fontFamily: 'monospace' }}>
            // create a new password
          </div>

          {/* New password */}
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium" style={{ color: '#9cdcfe', fontFamily: 'monospace' }}>
              // new password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#007acc')}
                onBlur={e => (e.target.style.borderColor = '#3c3c3c')}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#858585' }}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-xs font-medium" style={{ color: '#9cdcfe', fontFamily: 'monospace' }}>
              // confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#007acc')}
                onBlur={e => (e.target.style.borderColor = '#3c3c3c')}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#858585' }}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && confirmPassword.length > 0 && (
              <p className="text-xs" style={{ fontFamily: 'monospace', color: password === confirmPassword ? '#4ec9b0' : '#f47171' }}>
                {password === confirmPassword ? '✓ passwords match' : '✗ passwords do not match'}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 text-xs rounded" style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f47171', fontFamily: 'monospace' }}>
              ✗ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || password !== confirmPassword || password.length < 6}
            className="w-full py-2 text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: (loading || password !== confirmPassword || password.length < 6) ? '#0a4d7a' : '#0e639c',
              color: '#ffffff',
              border: '1px solid #1177bb',
              borderRadius: '4px',
              cursor: (loading || password !== confirmPassword || password.length < 6) ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
            }}
            onMouseEnter={e => { if (!loading && password === confirmPassword && password.length >= 6) (e.currentTarget.style.backgroundColor = '#1177bb'); }}
            onMouseLeave={e => { if (!loading && password === confirmPassword && password.length >= 6) (e.currentTarget.style.backgroundColor = '#0e639c'); }}
          >
            {loading ? '▶ Updating...' : '▶ Update Password'}
          </button>
        </form>
      ) : (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-10 w-10" style={{ color: '#4ec9b0' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#cccccc', fontFamily: 'monospace' }}>✓ Password updated</p>
            <p className="text-xs mt-1" style={{ color: '#858585', fontFamily: 'monospace' }}>// redirecting to sign in...</p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: '#007acc', fontFamily: 'monospace' }}
          >
            Go to Sign In
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </Shell>
  );
}
