import { useState, useEffect } from 'react';
import { X, Plus, Users, Check } from 'lucide-react';
import { VS } from '../lib/theme';

interface Project { id: string; name: string; }
interface OrgMember { id: string; name: string; email: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (taskTitle: string) => void;
  orgId: string;
  userId: string;
  userRole: string;
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#007acc]/50 transition-all';
const inputStyle: React.CSSProperties = { background: '#3c3c3c', border: '1px solid #454545', color: '#d4d4d4' };

const PRIORITY_CONFIG: Record<string, { text: string }> = {
  Low: { text: VS.teal }, Medium: { text: VS.yellow }, High: { text: VS.red }, Urgent: { text: VS.purple },
};

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function avatarGradient(name?: string) {
  const colors = ['#007acc','#4ec9b0','#dcdcaa','#c586c0','#ce9178','#f44747'];
  const i = (name?.charCodeAt(0) ?? 0) % colors.length;
  return `linear-gradient(135deg, ${colors[i]}, ${colors[(i + 2) % colors.length]})`;
}

export function CreateTaskModal({ isOpen, onClose, onTaskCreated, orgId, userId, userRole }: Props) {
  const isAdminOrOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium',
    projectId: '', estimatedHours: 0, dueDate: '', tags: '',
    assigneeIds: [] as string[], isTeamTask: false,
    subTasks: [] as { assigneeId: string; title: string }[],
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !orgId) return;
    fetch(`/api/projects?orgId=${orgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.projects) setProjects(d.projects); })
      .catch(() => {});
    fetch(`/api/members?orgId=${orgId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.members) setMembers(d.members); })
      .catch(() => {});
  }, [isOpen, orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          userId: form.assigneeIds[0] || userId,
          assigneeIds: form.assigneeIds.length > 0 ? form.assigneeIds : [userId],
          orgId,
          priority: form.priority,
          status: 'not_started',
          projectId: form.projectId || undefined,
          estimatedHours: form.estimatedHours,
          dueDate: form.dueDate ? new Date(form.dueDate + 'T00:00:00.000Z').toISOString() : undefined,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
          isTeamTask: form.isTeamTask || undefined,
          subTasks: form.isTeamTask ? form.subTasks.filter(s => s.title && s.assigneeId) : undefined,
        }),
      });
      if (res.ok) {
        onTaskCreated(form.title.trim());
        setForm({ title: '', description: '', priority: 'Medium', projectId: '', estimatedHours: 0, dueDate: '', tags: '', assigneeIds: [], isTeamTask: false, subTasks: [] });
        onClose();
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold" style={{ color: VS.text0 }}>New Task</h3>
            {!isAdminOrOwner && (
              <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                <Users className="h-3 w-3" style={{ color: form.isTeamTask ? VS.teal : VS.text2 }} />
                <span className="text-[11px] font-medium" style={{ color: form.isTeamTask ? VS.teal : VS.text2 }}>Switch to Team Task</span>
                <div
                  onClick={() => setForm(p => ({ ...p, isTeamTask: !p.isTeamTask, subTasks: p.isTeamTask ? [] : [{ assigneeId: '', title: '' }], assigneeIds: [] }))}
                  className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 cursor-pointer"
                  style={{ background: form.isTeamTask ? VS.teal : VS.bg3, border: `1px solid ${form.isTeamTask ? VS.teal : VS.border}` }}
                >
                  <span className="inline-block h-3 w-3 rounded-full transition-transform duration-200"
                    style={{ background: form.isTeamTask ? '#fff' : VS.text2, transform: form.isTeamTask ? 'translateX(14px)' : 'translateX(1px)' }} />
                </div>
              </label>
            )}
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Title</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Task title..." className={inputCls} style={inputStyle} autoFocus />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="What needs to be done?" rows={3} className={inputCls + ' resize-none'} style={inputStyle} />
          </div>

          {/* Assignees */}
          {isAdminOrOwner && !form.isTeamTask && (
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>
                Assignees {form.assigneeIds.length > 0 && <span className="ml-1.5 normal-case font-normal" style={{ color: VS.accent }}>{form.assigneeIds.length} selected</span>}
              </label>
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${VS.border}`, maxHeight: 152, overflowY: 'auto' }}>
                {members.length === 0
                  ? <div className="px-3 py-3 text-xs" style={{ color: VS.text2 }}>No members found</div>
                  : members.map((m, i) => {
                    const selected = form.assigneeIds.includes(m.id);
                    return (
                      <button key={m.id} type="button"
                        onClick={() => setForm(p => ({ ...p, assigneeIds: selected ? p.assigneeIds.filter(id => id !== m.id) : [...p.assigneeIds, m.id] }))}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
                        style={{ background: selected ? `${VS.accent}22` : i % 2 === 0 ? VS.bg3 : 'transparent', borderBottom: i < members.length - 1 ? `1px solid ${VS.border}` : 'none', color: selected ? VS.text0 : VS.text1 }}
                      >
                        <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: avatarGradient(m.name || m.email) }}>
                          {getInitials(m.name || m.email)}
                        </div>
                        <span className="flex-1 text-xs truncate">{m.name || m.email}</span>
                        {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: VS.accent }} />}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Team Task sub-tasks */}
          {form.isTeamTask && (
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${VS.accent}44`, background: `${VS.accent}08` }}>
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${VS.accent}33` }}>
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: VS.accent }}>Sub-tasks</span>
                <span className="text-[10px]" style={{ color: VS.text2 }}>Each member gets this on their board</span>
              </div>
              <div className="p-3 space-y-2">
                {form.subTasks.map((sub, idx) => {
                  const m = members.find(x => x.id === sub.assigneeId);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ background: m ? `${VS.blue}22` : VS.bg3, color: VS.blue }}>
                        {m ? getInitials(m.name || m.email) : '?'}
                      </div>
                      <input type="text" placeholder="Sub-task title..." value={sub.title}
                        onChange={e => setForm(p => { const u = [...p.subTasks]; u[idx] = { ...u[idx], title: e.target.value }; return { ...p, subTasks: u }; })}
                        className={inputCls} style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '5px 8px' } as React.CSSProperties} />
                      <select value={sub.assigneeId}
                        onChange={e => setForm(p => { const u = [...p.subTasks]; u[idx] = { ...u[idx], assigneeId: e.target.value }; return { ...p, subTasks: u }; })}
                        className={inputCls} style={{ ...inputStyle, width: 120, fontSize: 11, padding: '5px 6px' } as React.CSSProperties}>
                        <option value="">Assign...</option>
                        {members.map(m2 => <option key={m2.id} value={m2.id}>{m2.name || m2.email}</option>)}
                      </select>
                      <button type="button" onClick={() => setForm(p => ({ ...p, subTasks: p.subTasks.filter((_, i) => i !== idx) }))}
                        style={{ color: VS.text2, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => setForm(p => ({ ...p, subTasks: [...p.subTasks, { assigneeId: '', title: '' }] }))}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-lg w-full justify-center"
                  style={{ color: VS.accent, border: `1px dashed ${VS.accent}55`, background: 'transparent' }}>
                  <Plus className="h-3 w-3" /> Add sub-task
                </button>
              </div>
            </div>
          )}

          {/* Priority + Est. Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className={inputCls} style={{ ...inputStyle, color: PRIORITY_CONFIG[form.priority]?.text || VS.text1 }}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Est. Time</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type="number" value={Math.floor(form.estimatedHours)}
                    onChange={e => { const h = Math.max(0, parseInt(e.target.value) || 0); const m = Math.round((form.estimatedHours % 1) * 60); setForm(p => ({ ...p, estimatedHours: h + m / 60 })); }}
                    className={inputCls} style={{ ...inputStyle, paddingRight: 28 } as React.CSSProperties} min="0" placeholder="0" />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>h</span>
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type="number" value={Math.round((form.estimatedHours % 1) * 60)}
                    onChange={e => { const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0)); const h = Math.floor(form.estimatedHours); setForm(p => ({ ...p, estimatedHours: h + m / 60 })); }}
                    className={inputCls} style={{ ...inputStyle, paddingRight: 28 } as React.CSSProperties} min="0" max="59" placeholder="0" />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: VS.text2, pointerEvents: 'none' }}>m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Project + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Project</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))}
                className={inputCls} style={{ ...inputStyle, color: VS.text1 }}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                className={inputCls} style={{ ...inputStyle, color: VS.text1 }} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: VS.text2 }}>
              Tags <span className="normal-case font-normal" style={{ color: VS.text2 }}>(comma separated)</span>
            </label>
            <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="frontend, urgent, client" className={inputCls} style={inputStyle} />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text1 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !form.title.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: VS.accent, opacity: loading || !form.title.trim() ? 0.6 : 1 }}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
