import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';
import { CheckCircle, ArrowRight, User, Building2, Phone, Briefcase, Globe, Users, Moon, Sun } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';
import { DARK_PALETTE, LIGHT_PALETTE, applyTheme, type Theme } from '../lib/theme';

// ── VS Code Dark theme ─────────────────────────────────────────────────────────
const C = {
  bg:      '#1e1e1e',
  panel:   '#252526',
  tab:     '#2d2d2d',
  input:   '#3c3c3c',
  border:  '#3c3c3c',
  border2: '#454545',
  text:    '#cccccc',
  text2:   '#858585',
  accent:  '#007acc',
  teal:    '#4ec9b0',
  blue:    '#9cdcfe',
  yellow:  '#dcdcaa',
};

const STEPS = [
  { id: 'welcome',  label: 'Welcome',      file: 'welcome.ts'  },
  { id: 'personal', label: 'Your Profile', file: 'profile.ts'  },
  { id: 'company',  label: 'Company',      file: 'company.ts'  },
  { id: 'theme',    label: 'Theme',        file: 'theme.ts'    },
];

const INDUSTRIES = [
  'Technology', 'Marketing & Advertising', 'Finance & Accounting',
  'Healthcare', 'Education', 'Construction & Real Estate',
  'Retail & E-commerce', 'Legal', 'Consulting', 'Design & Creative',
  'Media & Entertainment', 'Non-profit', 'Manufacturing', 'Other',
];

const COMPANY_SIZES = [
  'Just me', '2–10', '11–50', '51–200', '201–500', '500+',
];

function inp(label: string, id: string, value: string, onChange: (v: string) => void, opts?: {
  type?: string; placeholder?: string; required?: boolean; icon?: React.ElementType;
}) {
  const Icon = opts?.icon;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium" style={{ color: C.blue, fontFamily: 'monospace' }}>
        // {label}{opts?.required ? '' : ' (optional)'}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: C.text2 }} />}
        <input
          id={id}
          type={opts?.type ?? 'text'}
          placeholder={opts?.placeholder}
          required={opts?.required}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full py-2 text-sm outline-none transition-colors"
          style={{
            backgroundColor: C.input, border: `1px solid ${C.border}`,
            borderRadius: '4px', color: C.text, fontFamily: 'monospace',
            paddingLeft: Icon ? '32px' : '12px', paddingRight: '12px',
          }}
          onFocus={e => (e.target.style.borderColor = C.accent)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        />
      </div>
    </div>
  );
}

// ── Shell wrapper ──────────────────────────────────────────────────────────────
function Shell({ children, stepIdx }: { children: React.ReactNode; stepIdx: number }) {
  const filename = STEPS[stepIdx]?.file ?? 'onboarding.ts';
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: C.bg }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,122,204,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,122,204,0.04) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ top: '20%', left: '15%', width: '380px', height: '380px', background: 'rgba(0,122,204,0.08)' }} />
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ bottom: '20%', right: '15%', width: '340px', height: '340px', background: 'rgba(0,122,204,0.06)', animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10" style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4" style={{ backgroundColor: '#323233', borderRadius: '8px 8px 0 0', height: '32px', borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
          </div>
          <span className="text-xs" style={{ color: C.text2, fontFamily: 'monospace' }}>EverSense Ai — {filename}</span>
          <div className="w-12" />
        </div>

        {/* Editor panel */}
        <div style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
          {/* Tab bar */}
          <div style={{ backgroundColor: C.tab, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: C.text, borderBottom: `1px solid ${C.accent}`, backgroundColor: C.bg, fontFamily: 'monospace' }}>
              <EverSenseLogo height={16} width={94} />
              {filename}
            </div>
            {/* Step dots */}
            <div className="flex items-center gap-1.5 pr-4">
              {STEPS.map((s, i) => (
                <div key={i} title={s.label}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ backgroundColor: i < stepIdx ? C.teal : i === stepIdx ? C.accent : C.border }}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center gap-1 mb-1">
              <EverSenseLogo width={240} height={57} />
            </div>
            {children}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 text-xs" style={{ backgroundColor: C.accent, color: '#ffffff', height: '22px', fontFamily: 'monospace' }}>
          <span>⎇ main</span>
          <span>{STEPS[stepIdx]?.label} — Step {stepIdx + 1} of {STEPS.length}</span>
        </div>
      </div>
    </div>
  );
}

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  backgroundColor: disabled ? '#0a4d7a' : C.accent,
  color: '#fff', border: `1px solid #1177bb`, borderRadius: '4px',
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'monospace',
  opacity: disabled ? 0.7 : 1,
});

// ── Main component ─────────────────────────────────────────────────────────────
export function Onboarding() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  // Personal info
  const [fullName, setFullName]   = useState('');
  const [jobTitle, setJobTitle]   = useState('');
  const [phone, setPhone]         = useState('');

  // Company info
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry]       = useState('');
  const [size, setSize]               = useState('');
  const [website, setWebsite]         = useState('');

  // Theme
  const [selectedTheme, setSelectedTheme] = useState<Theme>('dark');

  useEffect(() => {
    if (session?.user) {
      setFullName(session.user.name || '');
      checkStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/wizard/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success && !data.data.needsOnboarding) {
        navigate('/dashboard', { replace: true });
      }
    } catch { /* keep default */ }
  };

  const completeStep = async (stepId: string) => {
    try {
      const res = await fetch('/api/wizard/complete-step', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepId }),
      });
      return (await res.json()).success ?? false;
    } catch { return false; }
  };

  // ── STEP 0: Welcome ──────────────────────────────────────────────────────────
  if (stepIdx === 0) {
    const handleContinue = async () => {
      setLoading(true);
      await completeStep('welcome');
      setLoading(false);
      setStepIdx(1);
    };

    return (
      <Shell stepIdx={0}>
        <div className="text-center space-y-5">
          <p className="text-xs" style={{ color: C.text2, fontFamily: 'monospace' }}>// account ready</p>
          <CheckCircle className="mx-auto" style={{ color: C.teal, width: 44, height: 44 }} />
          <div>
            <p className="text-base font-semibold" style={{ color: C.text, fontFamily: 'monospace' }}>
              Welcome, {session?.user?.name?.split(' ')[0] || 'there'}!
            </p>
            <p className="text-xs mt-1.5" style={{ color: C.text2, fontFamily: 'monospace' }}>
              // let's set up your profile in 2 quick steps.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: C.text2, fontFamily: 'monospace' }}>
            <div className="rounded p-2.5 text-left" style={{ background: C.input, border: `1px solid ${C.border}` }}>
              <div className="font-bold mb-1" style={{ color: C.blue }}>→ step 1</div>
              <div>Personal info</div>
            </div>
            <div className="rounded p-2.5 text-left" style={{ background: C.input, border: `1px solid ${C.border}` }}>
              <div className="font-bold mb-1" style={{ color: C.blue }}>→ step 2</div>
              <div>Company info</div>
            </div>
          </div>
          <button
            onClick={handleContinue} disabled={loading}
            className="w-full py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={btnPrimary(loading)}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1177bb'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = C.accent; }}
          >
            {loading ? '▶ Loading...' : <><span>▶ Get Started</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </Shell>
    );
  }

  // ── STEP 1: Personal Info ────────────────────────────────────────────────────
  if (stepIdx === 1) {
    const handleNext = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await fetch('/api/wizard/save-profile', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fullName, jobTitle, phone }),
        });
      } catch { /* continue */ }
      setLoading(false);
      setStepIdx(2);
    };

    return (
      <Shell stepIdx={1}>
        <form onSubmit={handleNext} className="space-y-4">
          <p className="text-xs" style={{ color: C.text2, fontFamily: 'monospace' }}>// tell us about yourself</p>

          {inp('full name', 'fullName', fullName, setFullName, { placeholder: 'Jane Smith', required: true, icon: User })}
          {inp('job title', 'jobTitle', jobTitle, setJobTitle, { placeholder: 'e.g. Project Manager', icon: Briefcase })}
          {inp('phone number', 'phone', phone, setPhone, { type: 'tel', placeholder: '+1 (555) 000-0000', icon: Phone })}

          <button
            type="submit" disabled={loading || !fullName.trim()}
            className="w-full py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 mt-2"
            style={btnPrimary(loading || !fullName.trim())}
            onMouseEnter={e => { if (!loading && fullName.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#1177bb'; }}
            onMouseLeave={e => { if (!loading && fullName.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = C.accent; }}
          >
            {loading ? '▶ Saving...' : <><span>▶ Next: Company Info</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </Shell>
    );
  }

  // ── STEP 2: Company Info ─────────────────────────────────────────────────────
  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/wizard/save-company', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, industry, size, website }),
      });
    } catch { /* continue */ }
    setLoading(false);
    setStepIdx(3);
  };

  const handleSkip = async () => {
    setStepIdx(3);
  };

  // ── STEP 3: Theme ─────────────────────────────────────────────────────────────
  const handleThemeFinish = async () => {
    setLoading(true);
    try {
      applyTheme(selectedTheme);
      await fetch('/api/wizard/save-theme', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedTheme }),
      });
      await completeStep('profile');
    } catch { /* continue */ }
    window.location.href = '/dashboard';
  };

  // ── STEP 3 render ────────────────────────────────────────────────────────────
  if (stepIdx === 3) {
    const themes: { id: Theme; label: string; desc: string; palette: typeof DARK_PALETTE }[] = [
      { id: 'dark',  label: 'VS Code Dark',  desc: 'Dark editor background, light syntax tokens', palette: DARK_PALETTE },
      { id: 'light', label: 'VS Code Light', desc: 'Clean white background, dark tokens',          palette: LIGHT_PALETTE },
    ];
    return (
      <Shell stepIdx={3}>
        <div className="space-y-4">
          <p className="text-xs" style={{ color: C.text2, fontFamily: 'monospace' }}>// choose your interface theme</p>
          <div className="space-y-3">
            {themes.map(t => {
              const p = t.palette;
              const selected = selectedTheme === t.id;
              return (
                <button
                  key={t.id} type="button"
                  onClick={() => setSelectedTheme(t.id)}
                  className="w-full text-left rounded-lg overflow-hidden transition-all"
                  style={{ border: `2px solid ${selected ? C.accent : C.border}`, outline: 'none' }}
                >
                  {/* Mini editor preview */}
                  <div className="p-3" style={{ background: p.bg1 }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: '#ff5f57' }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: '#febc2e' }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: '#28c840' }} />
                      <span className="ml-auto text-[9px]" style={{ color: p.text2, fontFamily: 'monospace' }}>theme.ts</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-mono pl-1">
                      <div><span style={{ color: p.blue }}>const</span> <span style={{ color: p.teal }}>theme</span> <span style={{ color: p.text1 }}>=</span> <span style={{ color: p.orange }}>'{t.id}'</span></div>
                      <div><span style={{ color: p.purple }}>// {t.desc}</span></div>
                      <div><span style={{ color: p.yellow }}>background</span><span style={{ color: p.text1 }}>:</span> <span style={{ color: p.green }}>'{p.bg0}'</span></div>
                    </div>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: p.bg0 }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: p.text0, fontFamily: 'monospace' }}>{t.label}</p>
                      <p className="text-[10px]" style={{ color: p.text2, fontFamily: 'monospace' }}>{t.desc}</p>
                    </div>
                    {selected ? <Sun className="h-4 w-4" style={{ color: C.accent }} /> : <Moon className="h-4 w-4" style={{ color: p.text2 }} />}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleThemeFinish} disabled={loading}
            className="w-full py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={btnPrimary(loading)}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1177bb'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = C.accent; }}
          >
            {loading ? '▶ Saving...' : <><span>▶ Go to Dashboard</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell stepIdx={2}>
      <form onSubmit={handleFinish} className="space-y-4">
        <p className="text-xs" style={{ color: C.text2, fontFamily: 'monospace' }}>// tell us about your company</p>

        {inp('company name', 'companyName', companyName, setCompanyName, { placeholder: 'Acme Inc.', icon: Building2 })}

        {/* Industry select */}
        <div className="space-y-1.5">
          <label htmlFor="industry" className="block text-xs font-medium" style={{ color: C.blue, fontFamily: 'monospace' }}>
            // industry (optional)
          </label>
          <select
            id="industry" value={industry} onChange={e => setIndustry(e.target.value)}
            className="w-full px-3 py-2 text-sm outline-none transition-colors"
            style={{ backgroundColor: C.input, border: `1px solid ${C.border}`, borderRadius: '4px', color: industry ? C.text : C.text2, fontFamily: 'monospace' }}
            onFocus={e => (e.target.style.borderColor = C.accent)}
            onBlur={e => (e.target.style.borderColor = C.border)}
          >
            <option value="" style={{ color: C.text2 }}>Select industry...</option>
            {INDUSTRIES.map(ind => <option key={ind} value={ind} style={{ color: C.text }}>{ind}</option>)}
          </select>
        </div>

        {/* Company size */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium" style={{ color: C.blue, fontFamily: 'monospace' }}>
            // team size (optional)
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {COMPANY_SIZES.map(s => (
              <button
                key={s} type="button"
                onClick={() => setSize(s === size ? '' : s)}
                className="py-1.5 text-xs rounded transition-all"
                style={{
                  backgroundColor: size === s ? `${C.accent}22` : C.input,
                  border: `1px solid ${size === s ? C.accent : C.border}`,
                  color: size === s ? C.text : C.text2, fontFamily: 'monospace',
                }}
              >
                <Users className="inline h-3 w-3 mr-1 opacity-60" />
                {s}
              </button>
            ))}
          </div>
        </div>

        {inp('website', 'website', website, setWebsite, { type: 'url', placeholder: 'https://acme.com', icon: Globe })}

        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
          style={btnPrimary(loading)}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1177bb'; }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = C.accent; }}
        >
          {loading ? '▶ Saving...' : <><span>▶ Go to Dashboard</span> <ArrowRight className="w-4 h-4" /></>}
        </button>

        <button
          type="button" onClick={handleSkip} disabled={loading}
          className="w-full text-xs text-center py-1"
          style={{ color: C.text2, fontFamily: 'monospace', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.color = C.text; }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.color = C.text2; }}
        >
          // skip for now
        </button>
      </form>
    </Shell>
  );
}
