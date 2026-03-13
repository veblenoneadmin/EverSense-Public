import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../lib/auth-client';
import {
  Plus, Trash2, Star, Users, Layers, ChevronDown, ChevronUp,
  Search, X, Check, Sparkles,
} from 'lucide-react';

import { VS } from '../lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Skill { id: string; name: string; category: string; _count?: { staffSkills: number } }
interface StaffSkill { id: string; skillId: string; name: string; category: string; level: number; yearsExp: number; notes: string | null }
interface TeamMember { userId: string; name: string; email: string; image: string | null; role: string; skills: StaffSkill[] }

const LEVEL_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Basic', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert' };
const LEVEL_COLORS: Record<number, string> = {
  1: 'rgba(144,144,144,0.15)',
  2: 'rgba(86,156,214,0.15)',
  3: 'rgba(220,220,170,0.15)',
  4: 'rgba(197,134,192,0.15)',
  5: 'rgba(78,201,176,0.15)',
};
const LEVEL_TEXT: Record<number, string> = { 1: '#909090', 2: '#569cd6', 3: '#dcdcaa', 4: '#c586c0', 5: '#4ec9b0' };

const SKILL_CATEGORIES = ['Technical', 'Design', 'Management', 'Communication', 'Sales', 'Operations', 'Finance', 'Other'];

function LevelStars({ level, onChange }: { level: number; onChange?: (l: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => onChange?.(i)} type="button"
          style={{ background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default', padding: 0, lineHeight: 1, transition: 'transform 0.1s' }}
          onMouseEnter={e => onChange && ((e.currentTarget as HTMLElement).style.transform = 'scale(1.2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}>
          <Star style={{ width: 16, height: 16 }} fill={i <= level ? LEVEL_TEXT[level] : 'none'} stroke={i <= level ? LEVEL_TEXT[level] : '#555'} />
        </button>
      ))}
    </div>
  );
}

function MemberAvatar({ name, image, size = 32 }: { name: string; image?: string | null; size?: number }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const colors = ['#569cd6', '#c586c0', '#4ec9b0', '#dcdcaa', '#ce9178'];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return image
    ? <img src={image} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: VS.bg2,
  border: `1px solid ${VS.border}`, borderRadius: 6,
  color: VS.text0, fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: VS.text2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function Skills() {
  const { data: session } = useSession();

  const [tab, setTab] = useState<'my' | 'team' | 'library'>('my');
  const [userRole, setUserRole] = useState('STAFF');
  const [orgId, setOrgId] = useState('');

  // My skills
  const [mySkills, setMySkills] = useState<StaffSkill[]>([]);
  const [library, setLibrary] = useState<Skill[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Add skill form
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [selectedYears, setSelectedYears] = useState('');
  const [skillNotes, setSkillNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');

  // Add to library form
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Technical');
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [libError, setLibError] = useState('');
  const [skillError, setSkillError] = useState('');

  // Team expand
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // AI generate skills
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggested, setAiSuggested] = useState<{ name: string; category: string }[]>([]);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');

  // ── Fetch org ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/organizations?userId=${session.user.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.organizations?.[0]) {
          setOrgId(d.organizations[0].id);
          setUserRole(d.organizations[0].role || 'STAFF');
        }
      }).catch(console.error);
  }, [session]);

  const headers = useCallback(() => ({ 'x-org-id': orgId, 'Content-Type': 'application/json' }), [orgId]);

  const apiFetch = useCallback((url: string, options: RequestInit = {}) =>
    fetch(url, { ...options, headers: { ...headers(), ...(options.headers as object) }, credentials: 'include' }),
  [headers]);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!orgId || !session?.user?.id) return;
    setLoading(true);
    try {
      const [libRes, myRes, teamRes] = await Promise.all([
        apiFetch(`/api/skills/library`),
        apiFetch(`/api/skills/staff/${session.user.id}`),
        apiFetch(`/api/skills/team`),
      ]);
      if (libRes.ok) { const d = await libRes.json(); setLibrary(d.skills || []); }
      if (myRes.ok) { const d = await myRes.json(); setMySkills(d.staffSkills || []); }
      if (teamRes.ok) { const d = await teamRes.json(); setTeam(d.team || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [orgId, session, apiFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Add skill to my profile ───────────────────────────────────────────────
  const handleAddSkill = async () => {
    if (!selectedSkillId) return;
    setSaving(true);
    setSkillError('');
    try {
      const res = await apiFetch('/api/skills/staff', {
        method: 'PUT',
        body: JSON.stringify({ skillId: selectedSkillId, level: selectedLevel, yearsExp: parseFloat(selectedYears) || 0, notes: skillNotes }),
      });
      if (res.ok) {
        await fetchAll();
        setShowAddSkill(false);
        setSelectedSkillId(''); setSelectedLevel(3); setSelectedYears(''); setSkillNotes(''); setSkillSearch('');
      } else {
        const d = await res.json().catch(() => ({}));
        setSkillError(d.error || `Error ${res.status}`);
      }
    } catch (err: any) { setSkillError(err.message || 'Failed to save skill'); } finally { setSaving(false); }
  };

  // ── Remove skill from my profile ──────────────────────────────────────────
  const handleRemoveSkill = async (skillId: string) => {
    try {
      await apiFetch(`/api/skills/staff/${skillId}`, { method: 'DELETE' });
      await fetchAll();
    } catch (err) { console.error(err); }
  };

  // ── AI generate skills ────────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiSuggested([]);
    setAiSelected(new Set());
    try {
      const res = await apiFetch('/api/skills/ai-generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const d = await res.json();
      if (!res.ok) { setAiError(d.error || `Error ${res.status}`); return; }
      const suggested = d.skills || [];
      setAiSuggested(suggested);
      setAiSelected(new Set(suggested.map((_: unknown, i: number) => i)));
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate skills');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiSave = async () => {
    const toSave = aiSuggested.filter((_, i) => aiSelected.has(i));
    if (toSave.length === 0) return;
    setAiSaving(true);
    setAiError('');
    try {
      const res = await apiFetch('/api/skills/library/bulk', {
        method: 'POST',
        body: JSON.stringify({ skills: toSave }),
      });
      if (res.ok) {
        await fetchAll();
        setShowAiGenerate(false);
        setAiPrompt('');
        setAiSuggested([]);
        setAiSelected(new Set());
      } else {
        const d = await res.json().catch(() => ({}));
        setAiError(d.error || `Error ${res.status}`);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Failed to save skills');
    } finally {
      setAiSaving(false);
    }
  };

  const toggleAiSkill = (i: number) => {
    setAiSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // ── Add skill to library ──────────────────────────────────────────────────
  const handleAddToLibrary = async () => {
    if (!newSkillName.trim()) return;
    setSavingLibrary(true);
    setLibError('');
    try {
      const res = await apiFetch('/api/skills/library', {
        method: 'POST',
        body: JSON.stringify({ name: newSkillName.trim(), category: newSkillCategory }),
      });
      if (res.ok) {
        await fetchAll();
        setNewSkillName('');
        setShowAddLibrary(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setLibError(d.error || `Error ${res.status}`);
      }
    } catch (err: any) { setLibError(err.message || 'Failed to add skill'); }
    finally { setSavingLibrary(false); }
  };

  // ── Skills not yet in my profile (for add dropdown) ──────────────────────
  const mySkillIds = new Set(mySkills.map(s => s.skillId));
  const availableSkills = library.filter(s => !mySkillIds.has(s.id) &&
    (skillSearch === '' || s.name.toLowerCase().includes(skillSearch.toLowerCase()) || s.category.toLowerCase().includes(skillSearch.toLowerCase()))
  );

  const isPrivileged = userRole === 'OWNER' || userRole === 'ADMIN';

  // ── Group my skills by category ───────────────────────────────────────────
  const grouped = mySkills.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, StaffSkill[]>);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: VS.text0, margin: 0 }}>Skills</h1>
          <p style={{ color: VS.text2, marginTop: 4, fontSize: 14 }}>Loading...</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: 20 }}>
              <div style={{ height: 14, background: VS.bg3, borderRadius: 4, width: '75%', marginBottom: 10 }} />
              <div style={{ height: 12, background: VS.bg3, borderRadius: 4, width: '50%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: VS.text0, margin: 0 }}>Skills</h1>
          <p style={{ color: VS.text2, marginTop: 4, fontSize: 14 }}>Manage your skillset and team capabilities</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isPrivileged && (
            <>
              <button onClick={() => setShowAiGenerate(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: VS.bg2, border: `1px solid ${VS.border2}`, borderRadius: 6, color: VS.text1, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                <Sparkles style={{ width: 15, height: 15, color: VS.yellow }} />Generate with AI
              </button>
              <button onClick={() => setShowAddLibrary(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: VS.bg2, border: `1px solid ${VS.border2}`, borderRadius: 6, color: VS.text1, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                <Plus style={{ width: 15, height: 15 }} />Add to Library
              </button>
            </>
          )}
          <button onClick={() => setShowAddSkill(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: VS.accent, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            <Plus style={{ width: 15, height: 15 }} />Add Skill
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'my', label: 'My Skills', icon: Star },
          ...(isPrivileged ? [{ key: 'team', label: 'Team Skills', icon: Users }] : []),
          { key: 'library', label: 'Skill Library', icon: Layers },
        ].map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: active ? VS.accent : 'transparent', color: active ? '#fff' : VS.text2, transition: 'all 0.15s' }}>
              <t.icon style={{ width: 14, height: 14 }} />{t.label}
            </button>
          );
        })}
      </div>

      {/* ── MY SKILLS TAB ──────────────────────────────────────────────────── */}
      {tab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {mySkills.length === 0 ? (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '64px 24px', textAlign: 'center' }}>
              <Star style={{ width: 48, height: 48, color: VS.text2, margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 17, fontWeight: 600, color: VS.text0, margin: '0 0 8px' }}>No skills added yet</h3>
              <p style={{ color: VS.text2, fontSize: 14, margin: '0 0 24px' }}>Add your skills so the AI can assign tasks that match your expertise</p>
              <button onClick={() => setShowAddSkill(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: VS.accent, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                <Plus style={{ width: 15, height: 15 }} />Add Your First Skill
              </button>
            </div>
          ) : (
            Object.entries(grouped).map(([category, skills]) => (
              <div key={category}>
                <p style={{ fontSize: 11, fontWeight: 700, color: VS.text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{category}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {skills.map(s => (
                    <div key={s.id} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: 18, transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = VS.accent + '55'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = VS.border}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <p style={{ fontWeight: 600, color: VS.text0, fontSize: 14, margin: 0 }}>{s.name}</p>
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: LEVEL_COLORS[s.level], color: LEVEL_TEXT[s.level] }}>
                            {LEVEL_LABELS[s.level]}
                          </span>
                        </div>
                        <button onClick={() => handleRemoveSkill(s.skillId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 4, lineHeight: 1, borderRadius: 4, transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = VS.red}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = VS.text2}>
                          <Trash2 style={{ width: 15, height: 15 }} />
                        </button>
                      </div>
                      <LevelStars level={s.level} />
                      {s.yearsExp > 0 && <p style={{ fontSize: 12, color: VS.text2, marginTop: 8 }}>{s.yearsExp} yr{s.yearsExp !== 1 ? 's' : ''} experience</p>}
                      {s.notes && <p style={{ fontSize: 12, color: VS.text2, marginTop: 4, fontStyle: 'italic' }}>{s.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TEAM SKILLS TAB ────────────────────────────────────────────────── */}
      {tab === 'team' && isPrivileged && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {team.length === 0 ? (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ color: VS.text2, fontSize: 14 }}>No team members found.</p>
            </div>
          ) : (
            team.map(member => (
              <div key={member.userId} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => setExpandedMember(expandedMember === member.userId ? null : member.userId)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MemberAvatar name={member.name} image={member.image} />
                    <div>
                      <p style={{ fontWeight: 600, color: VS.text0, fontSize: 14, margin: 0 }}>{member.name}</p>
                      <p style={{ fontSize: 12, color: VS.text2, margin: 0 }}>{member.email}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, textTransform: 'capitalize', marginLeft: 8, ...(member.role === 'ADMIN' ? { background: 'rgba(197,134,192,0.15)', color: '#c586c0' } : { background: 'rgba(78,201,176,0.15)', color: '#4ec9b0' }) }}>
                      {member.role.toLowerCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: VS.text2 }}>{member.skills.length} skill{member.skills.length !== 1 ? 's' : ''}</span>
                    {member.skills.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 240 }}>
                        {member.skills.slice(0, 4).map(s => (
                          <span key={s.skillId} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>{s.name}</span>
                        ))}
                        {member.skills.length > 4 && <span style={{ fontSize: 11, color: VS.text2 }}>+{member.skills.length - 4}</span>}
                      </div>
                    )}
                    {expandedMember === member.userId
                      ? <ChevronUp style={{ width: 16, height: 16, color: VS.text2 }} />
                      : <ChevronDown style={{ width: 16, height: 16, color: VS.text2 }} />}
                  </div>
                </button>

                {expandedMember === member.userId && (
                  <div style={{ borderTop: `1px solid ${VS.border}`, padding: '16px 20px 20px' }}>
                    {member.skills.length === 0 ? (
                      <p style={{ fontSize: 13, color: VS.text2, fontStyle: 'italic' }}>No skills added yet</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {member.skills.map(s => (
                          <div key={s.skillId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: VS.bg2, borderRadius: 6, border: `1px solid ${VS.border}` }}>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500, color: VS.text0, margin: 0 }}>{s.name}</p>
                              <p style={{ fontSize: 11, color: VS.text2, margin: '2px 0 0' }}>{s.category}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <LevelStars level={s.level} />
                              <p style={{ fontSize: 11, marginTop: 4, color: LEVEL_TEXT[s.level] }}>{LEVEL_LABELS[s.level]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SKILL LIBRARY TAB ──────────────────────────────────────────────── */}
      {tab === 'library' && (
        <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: VS.text0, margin: '0 0 4px' }}>Skill Library ({library.length} skills)</h2>
            <p style={{ fontSize: 13, color: VS.text2, margin: 0 }}>All skills available in your organisation</p>
          </div>
          {library.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Layers style={{ width: 40, height: 40, color: VS.text2, margin: '0 auto 12px' }} />
              <p style={{ color: VS.text2, fontSize: 14, marginBottom: 16 }}>No skills in library yet</p>
              {isPrivileged && (
                <button onClick={() => setShowAddLibrary(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: VS.accent, border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  <Plus style={{ width: 14, height: 14 }} />Add First Skill
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {SKILL_CATEGORIES.map(cat => {
                const catSkills = library.filter(s => s.category === cat);
                if (catSkills.length === 0) return null;
                return (
                  <div key={cat}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: VS.text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{cat}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {catSkills.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 6, fontSize: 13 }}>
                          <span style={{ color: VS.text1 }}>{s.name}</span>
                          <span style={{ fontSize: 11, color: VS.text2 }}>({s._count?.staffSkills || 0})</span>
                          {isPrivileged && (
                            <button onClick={async () => { await apiFetch(`/api/skills/library/${s.id}`, { method: 'DELETE' }); fetchAll(); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 0, lineHeight: 1, transition: 'color 0.15s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = VS.red}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = VS.text2}>
                              <X style={{ width: 12, height: 12 }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADD SKILL MODAL ────────────────────────────────────────────────── */}
      {showAddSkill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: VS.text0, margin: 0 }}>Add Skill to Profile</h2>
              <button onClick={() => setShowAddSkill(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 4, lineHeight: 1 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Skill search/select */}
              <div>
                <label style={labelStyle}>Select Skill</label>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search style={{ position: 'absolute', left: 10, top: 9, width: 14, height: 14, color: VS.text2 }} />
                  <input value={skillSearch} onChange={e => setSkillSearch(e.target.value)}
                    placeholder="Search skills..."
                    style={{ ...inputStyle, paddingLeft: 32 }} />
                </div>
                <div style={{ maxHeight: 176, overflowY: 'auto', border: `1px solid ${VS.border}`, borderRadius: 6, background: VS.bg2, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {availableSkills.length === 0 ? (
                    <p style={{ fontSize: 13, color: VS.text2, textAlign: 'center', padding: '16px 0' }}>
                      {library.length === 0 ? 'No skills in library yet. Ask an admin to add some.' : 'All library skills already added to your profile.'}
                    </p>
                  ) : (
                    availableSkills.map(s => {
                      const selected = selectedSkillId === s.id;
                      return (
                        <button key={s.id} onClick={() => setSelectedSkillId(s.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 5, border: selected ? `1px solid ${VS.accent}55` : '1px solid transparent', background: selected ? `${VS.accent}22` : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}>
                          <span style={{ fontSize: 13, color: VS.text0 }}>{s.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: VS.text2 }}>{s.category}</span>
                            {selected && <Check style={{ width: 13, height: 13, color: VS.accent }} />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Proficiency level */}
              <div>
                <label style={labelStyle}>Proficiency Level</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <LevelStars level={selectedLevel} onChange={setSelectedLevel} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: LEVEL_TEXT[selectedLevel] }}>{LEVEL_LABELS[selectedLevel]}</span>
                </div>
              </div>

              {/* Years experience */}
              <div>
                <label style={labelStyle}>Years of Experience <span style={{ color: VS.text2, textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                <input type="number" min="0" max="50" step="0.5" value={selectedYears} onChange={e => setSelectedYears(e.target.value)}
                  placeholder="e.g. 2.5" style={inputStyle} />
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes <span style={{ color: VS.text2, textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={skillNotes} onChange={e => setSkillNotes(e.target.value)}
                  placeholder="e.g. Certified, main stack, etc." style={inputStyle} />
              </div>

              {skillError && <p style={{ fontSize: 13, color: VS.red }}>{skillError}</p>}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button onClick={() => { setShowAddSkill(false); setSkillError(''); }}
                  style={{ flex: 1, padding: '9px 0', background: VS.bg2, border: `1px solid ${VS.border2}`, borderRadius: 6, color: VS.text1, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Cancel
                </button>
                <button onClick={handleAddSkill} disabled={!selectedSkillId || saving}
                  style={{ flex: 1, padding: '9px 0', background: selectedSkillId && !saving ? VS.accent : VS.bg3, border: 'none', borderRadius: 6, color: selectedSkillId && !saving ? '#fff' : VS.text2, fontSize: 13, cursor: selectedSkillId && !saving ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  {saving ? 'Saving...' : 'Add Skill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI GENERATE SKILLS MODAL ───────────────────────────────────────── */}
      {showAiGenerate && isPrivileged && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: 28, width: '100%', maxWidth: 640, boxShadow: '0 24px 64px rgba(0,0,0,0.7)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles style={{ width: 18, height: 18, color: VS.yellow }} />
                <h2 style={{ fontSize: 17, fontWeight: 700, color: VS.text0, margin: 0 }}>Generate Skills with AI</h2>
              </div>
              <button onClick={() => { setShowAiGenerate(false); setAiSuggested([]); setAiError(''); setAiPrompt(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 4, lineHeight: 1 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: VS.text2, margin: '0 0 20px' }}>Describe your team, industry, or role and AI will suggest relevant skills for your library.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              {/* Prompt input */}
              <div>
                <label style={labelStyle}>Describe your team or context</label>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3}
                  placeholder="e.g. We're a digital agency specialising in React, Node.js, and mobile apps. We also have project managers and designers."
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10 }} />
              </div>

              <button onClick={handleAiGenerate} disabled={!aiPrompt.trim() || aiGenerating}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', background: !aiPrompt.trim() || aiGenerating ? VS.bg3 : VS.accent, border: 'none', borderRadius: 6, color: !aiPrompt.trim() || aiGenerating ? VS.text2 : '#fff', fontSize: 13, cursor: !aiPrompt.trim() || aiGenerating ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {aiGenerating
                  ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Generating…</>
                  : <><Sparkles style={{ width: 14, height: 14 }} /> Generate Skills</>}
              </button>

              {aiError && <p style={{ fontSize: 13, color: VS.red }}>{aiError}</p>}

              {/* Suggested skills */}
              {aiSuggested.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: VS.text1, margin: 0 }}>{aiSuggested.length} skills suggested — click to deselect</p>
                    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                      <button onClick={() => setAiSelected(new Set(aiSuggested.map((_, i) => i)))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.accent, fontSize: 12 }}>Select all</button>
                      <span style={{ color: VS.text2 }}>·</span>
                      <button onClick={() => setAiSelected(new Set())}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, fontSize: 12 }}>Deselect all</button>
                    </div>
                  </div>

                  {Array.from(new Set(aiSuggested.map(s => s.category))).map(cat => (
                    <div key={cat}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: VS.text2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{cat}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {aiSuggested.map((s, i) => s.category !== cat ? null : (
                          <button key={i} onClick={() => toggleAiSkill(i)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: aiSelected.has(i) ? `1px solid ${VS.accent}55` : `1px solid ${VS.border}`, background: aiSelected.has(i) ? `${VS.accent}22` : VS.bg2, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: aiSelected.has(i) ? VS.text0 : VS.text2, textDecoration: aiSelected.has(i) ? 'none' : 'line-through', opacity: aiSelected.has(i) ? 1 : 0.5, transition: 'all 0.12s' }}>
                            {aiSelected.has(i) && <Check style={{ width: 12, height: 12, color: VS.accent }} />}
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {aiSuggested.length > 0 && (
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => { setShowAiGenerate(false); setAiSuggested([]); setAiError(''); setAiPrompt(''); }}
                    style={{ flex: 1, padding: '9px 0', background: VS.bg2, border: `1px solid ${VS.border2}`, borderRadius: 6, color: VS.text1, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                    Cancel
                  </button>
                  <button onClick={handleAiSave} disabled={aiSelected.size === 0 || aiSaving}
                    style={{ flex: 1, padding: '9px 0', background: aiSelected.size === 0 || aiSaving ? VS.bg3 : VS.accent, border: 'none', borderRadius: 6, color: aiSelected.size === 0 || aiSaving ? VS.text2 : '#fff', fontSize: 13, cursor: aiSelected.size === 0 || aiSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                    {aiSaving ? 'Saving…' : `Add ${aiSelected.size} Skill${aiSelected.size !== 1 ? 's' : ''} to Library`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TO LIBRARY MODAL ───────────────────────────────────────────── */}
      {showAddLibrary && isPrivileged && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border2}`, borderRadius: 8, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: VS.text0, margin: 0 }}>Add Skill to Library</h2>
              <button onClick={() => { setShowAddLibrary(false); setLibError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 4, lineHeight: 1 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Skill Name</label>
                <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddToLibrary()}
                  placeholder="e.g. React, Project Management, Figma..."
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={newSkillCategory} onChange={e => setNewSkillCategory(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {SKILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {libError && <p style={{ fontSize: 13, color: VS.red }}>{libError}</p>}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button onClick={() => { setShowAddLibrary(false); setLibError(''); }}
                  style={{ flex: 1, padding: '9px 0', background: VS.bg2, border: `1px solid ${VS.border2}`, borderRadius: 6, color: VS.text1, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Cancel
                </button>
                <button onClick={handleAddToLibrary} disabled={!newSkillName.trim() || savingLibrary}
                  style={{ flex: 1, padding: '9px 0', background: newSkillName.trim() && !savingLibrary ? VS.accent : VS.bg3, border: 'none', borderRadius: 6, color: newSkillName.trim() && !savingLibrary ? '#fff' : VS.text2, fontSize: 13, cursor: newSkillName.trim() && !savingLibrary ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  {savingLibrary ? 'Adding...' : 'Add Skill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
