import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/password-reset/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        setUserEmail(email);
        setEmailSent(true);
      } else {
        setError(result.message || 'Failed to send reset email');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      {/* Pulsing background orbs */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,122,204,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,122,204,0.04) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ top: '20%', left: '15%', width: '380px', height: '380px', background: 'rgba(0,122,204,0.08)' }} />
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ bottom: '20%', right: '15%', width: '340px', height: '340px', background: 'rgba(0,122,204,0.06)', animationDelay: '1s' }} />
      </div>

      {/* VS Code window panel */}
      <div className="w-full max-w-sm relative z-10" style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}>

        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4"
          style={{ backgroundColor: '#323233', borderRadius: '8px 8px 0 0', height: '32px', borderBottom: '1px solid #3c3c3c' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
          </div>
          <span className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>
            EverSense Ai — forgot-password.ts
          </span>
          <div className="w-12" />
        </div>

        {/* Editor panel */}
        <div style={{ backgroundColor: '#252526', border: '1px solid #3c3c3c', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>

          {/* Tab bar */}
          <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'stretch' }}>
            <div
              className="flex items-center gap-2 px-4 py-2 text-xs"
              style={{ color: '#cccccc', borderBottom: '1px solid #007acc', backgroundColor: '#1e1e1e', fontFamily: 'monospace' }}
            >
              <EverSenseLogo height={16} width={94} />
              forgot-password.ts
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">

            {/* Logo + Heading */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <EverSenseLogo width={336} height={80} />
              <div className="text-sm font-medium" style={{ color: '#858585' }}>
                {emailSent ? 'Check your inbox' : 'Reset your password'}
              </div>
            </div>

            {!emailSent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-medium" style={{ color: '#9cdcfe', fontFamily: 'monospace' }}>
                    // email address
                  </label>
                  <input
                    type="email"
                    id="email"
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: '#3c3c3c',
                      border: '1px solid #3c3c3c',
                      borderRadius: '4px',
                      color: '#cccccc',
                      fontFamily: 'monospace',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#007acc')}
                    onBlur={e => (e.target.style.borderColor = '#3c3c3c')}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="px-3 py-2 text-xs rounded"
                    style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f47171', fontFamily: 'monospace' }}
                  >
                    ✗ {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: loading ? '#0a4d7a' : '#0e639c',
                    color: '#ffffff',
                    border: '1px solid #1177bb',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#1177bb'); }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#0e639c'); }}
                >
                  {loading ? '▶ Sending...' : '▶ Send Reset Email'}
                </button>

                {/* Back to login */}
                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-xs transition-colors"
                    style={{ color: '#007acc', fontFamily: 'monospace' }}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Success state */}
                <div
                  className="px-3 py-3 text-xs rounded flex items-start gap-2"
                  style={{ backgroundColor: 'rgba(78,201,176,0.1)', border: '1px solid rgba(78,201,176,0.3)', color: '#4ec9b0', fontFamily: 'monospace' }}
                >
                  <MailCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">✓ Reset email sent</div>
                    <div style={{ color: '#858585' }}>to {userEmail}</div>
                  </div>
                </div>

                <div className="text-xs space-y-1" style={{ color: '#858585', fontFamily: 'monospace' }}>
                  <div>// Check your inbox (and spam folder)</div>
                  <div>// Link expires in 15 minutes</div>
                  <div>// Click the link to set a new password</div>
                </div>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-1 w-full py-2 text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: '#0e639c',
                    color: '#ffffff',
                    border: '1px solid #1177bb',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1177bb')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0e639c')}
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </Link>
              </div>
            )}

          </div>
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-3 text-xs"
          style={{ backgroundColor: '#007acc', color: '#ffffff', height: '22px', borderRadius: '0 0 8px 8px', fontFamily: 'monospace' }}
        >
          <span>⎇ main</span>
          <span>EverSense Ai v1.0</span>
        </div>
      </div>
    </div>
  );
}
