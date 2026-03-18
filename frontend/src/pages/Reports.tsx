import { useState, useEffect, useRef } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { createPortal } from 'react-dom';
import {
  FileText, Plus, Users, X, Save, Trash2,
  Calendar, Search, Clock, TrendingUp, FolderOpen, AlertCircle,
  Paperclip, File, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { VS } from '../lib/theme';

interface Report {
  id: string;
  title: string | null;
  description: string;
  userName: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string; image: string | null } | null;
  project: { id: string; name: string; color: string; status: string } | null;
}
interface ProjectItem { id: string; name: string; color: string; }
interface MemberItem  { id: string; name: string; role: string; }

type Attachment = { name: string; type: string; dataUrl: string };
function parseAttachments(image: string | null): Attachment[] {
  if (!image) return [];
  if (image.startsWith('[')) {
    try { return JSON.parse(image); } catch { return []; }
  }
  // Legacy: single base64 image string
  return [{ name: 'image', type: 'image/png', dataUrl: image }];
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtRelative(d: string | Date) {
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return fmtDate(d);
}
function projectColor(color?: string | null) {
  if (!color) return '#6b7280';
  if (color.startsWith('#')) return color;
  const m: Record<string, string> = {
    'bg-blue': '#3b82f6', 'bg-teal': '#14b8a6', 'bg-purple': '#8b5cf6',
    'bg-green': '#22c55e', 'bg-red': '#ef4444', 'bg-orange': '#f97316',
    'bg-yellow': '#eab308', 'bg-primary': '#3b82f6',
  };
  return m[color] || '#6b7280';
}
function initials(name?: string | null, email?: string | null) {
  const src = name || email || '?';
  return src.split(/[\s@.]+/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, image, size = 26 }: { name: string; image?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const pal   = [VS.blue, VS.purple, VS.teal, VS.yellow, VS.orange];
  const color = pal[(name?.charCodeAt(0) ?? 0) % pal.length];
  return image && !imgError
    ? <img src={image} alt={name} onError={() => setImgError(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}28`, border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color, flexShrink: 0 }}>
        {initials(name)}
      </div>;
}

// ── Create Report Modal ───────────────────────────────────────────────────────
function CreateModal({ projects, onClose, onCreated }: {
  projects: ProjectItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: session }   = useSession();
  const api                 = useApiClient();
  const [name, setName]       = useState(session?.user?.name || (session?.user as any)?.email?.split('@')[0] || '');
  const [project, setProject] = useState('');
  const [desc, setDesc]       = useState('');
  const [attachments, setAttachments] = useState<{ name: string; type: string; dataUrl: string }[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null); // index into attachments
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: File[]) => {
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => {
        setAttachments(prev => [...prev, { name: f.name, type: f.type, dataUrl: ev.target?.result as string }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (i: number) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !desc.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const projName = projects.find(p => p.id === project)?.name;
      const res = await api.fetch('/api/user-reports', {
        method: 'POST',
        body: JSON.stringify({
          title:       projName ? `${projName} — Report` : undefined,
          description: desc.trim(),
          userName:    name.trim(),
          image:       attachments.length > 0 ? JSON.stringify(attachments) : undefined,
          projectId:   project || undefined,
        }),
      });
      if (!res.success) throw new Error(res.error || 'Failed to save');
      onCreated();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = { width: '100%', background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '8px 12px', color: VS.text0, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: VS.text2, marginBottom: 6 };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 12, width: '95%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ background: VS.bg2, borderBottom: `1px solid ${VS.border}`, padding: '16px 22px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={16} style={{ color: VS.blue }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: VS.text0 }}>Create Report</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && (
            <div style={{ background: `${VS.red}18`, border: `1px solid ${VS.red}44`, borderRadius: 8, padding: '10px 14px', color: VS.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} />{err}
            </div>
          )}

          <div>
            <label style={lbl}>Your Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" style={inp} />
          </div>

          <div>
            <label style={lbl}>Project (optional)</label>
            <select value={project} onChange={e => setProject(e.target.value)} style={inp}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Description *</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} required rows={5}
              placeholder="Describe progress, blockers, or any relevant updates…"
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          <div>
            <label style={lbl}>Attachments (optional)</label>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={handleFiles}
              style={{ display: 'none' }}
            />
            {/* Drop zone wrapping button + thumbnails */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
              style={{ border: `1px dashed ${dragOver ? VS.accent : VS.border}`, borderRadius: 8, padding: 10, background: dragOver ? 'rgba(0,122,204,0.06)' : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}
            >
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, color: VS.text1, cursor: 'pointer' }}>
              <Paperclip size={13} /> Attach Files
            </button>

            {/* Thumbnail grid */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                {attachments.map((a, i) => {
                  const isImg = a.type.startsWith('image/');
                  return (
                    <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                      {/* Thumbnail */}
                      <div
                        onClick={() => isImg && setLightbox(i)}
                        style={{
                          width: 80, height: 80, borderRadius: 8,
                          border: `1px solid ${VS.border}`,
                          background: VS.bg2,
                          overflow: 'hidden',
                          cursor: isImg ? 'zoom-in' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {isImg
                          ? <img src={a.dataUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 8 }}>
                              <File size={24} style={{ color: VS.accent }} />
                              <span style={{ fontSize: 9, color: VS.text2, textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.2 }}>
                                {a.name.length > 12 ? a.name.slice(0, 10) + '…' : a.name}
                              </span>
                            </div>
                          )
                        }
                      </div>
                      {/* X remove button */}
                      <button type="button" onClick={() => removeAttachment(i)}
                        style={{ position: 'absolute', top: -6, right: -6, background: VS.red, border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', padding: 0 }}>
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            </div>{/* end drop zone */}

            {/* Lightbox */}
            {lightbox !== null && (
              <div
                onClick={() => setLightbox(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img
                  src={attachments[lightbox].dataUrl}
                  alt={attachments[lightbox].name}
                  style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
                  onClick={e => e.stopPropagation()}
                />
                {/* Prev / Next */}
                {attachments.filter(a => a.type.startsWith('image/')).length > 1 && (() => {
                  const imgIndexes = attachments.map((a, i) => a.type.startsWith('image/') ? i : -1).filter(i => i >= 0);
                  const pos = imgIndexes.indexOf(lightbox);
                  return (
                    <>
                      {pos > 0 && (
                        <button onClick={e => { e.stopPropagation(); setLightbox(imgIndexes[pos - 1]); }}
                          style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                          <ChevronLeft size={20} />
                        </button>
                      )}
                      {pos < imgIndexes.length - 1 && (
                        <button onClick={e => { e.stopPropagation(); setLightbox(imgIndexes[pos + 1]); }}
                          style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                          <ChevronRight size={20} />
                        </button>
                      )}
                    </>
                  );
                })()}
                {/* Close */}
                <button onClick={() => setLightbox(null)}
                  style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ background: VS.bg3, color: VS.text1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim() || !desc.trim()}
              style={{ background: VS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving || !name.trim() || !desc.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} />{saving ? 'Saving…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Report Attachments (thumbnails + lightbox) ────────────────────────────────
function ReportAttachments({ attachments }: { attachments: Attachment[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const imgIndexes = attachments.map((a, i) => a.type.startsWith('image/') ? i : -1).filter(i => i >= 0);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: VS.text2, marginBottom: 8 }}>
        Attachments ({attachments.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {attachments.map((a, i) => {
          const isImg = a.type.startsWith('image/');
          return (
            <div key={i} onClick={() => isImg && setLightbox(i)}
              style={{ width: 80, height: 80, borderRadius: 8, border: `1px solid ${VS.border}`, background: VS.bg2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isImg ? 'zoom-in' : 'default', flexShrink: 0 }}>
              {isImg
                ? <img src={a.dataUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 8 }}>
                    <File size={24} style={{ color: VS.accent }} />
                    <span style={{ fontSize: 9, color: VS.text2, textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.2 }}>
                      {a.name.length > 12 ? a.name.slice(0, 10) + '…' : a.name}
                    </span>
                  </div>
                )
              }
            </div>
          );
        })}
      </div>

      {lightbox !== null && createPortal(
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={attachments[lightbox].dataUrl} alt={attachments[lightbox].name}
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={e => e.stopPropagation()} />
          {imgIndexes.length > 1 && (() => {
            const pos = imgIndexes.indexOf(lightbox);
            return (
              <>
                {pos > 0 && (
                  <button onClick={e => { e.stopPropagation(); setLightbox(imgIndexes[pos - 1]); }}
                    style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                    <ChevronLeft size={20} />
                  </button>
                )}
                {pos < imgIndexes.length - 1 && (
                  <button onClick={e => { e.stopPropagation(); setLightbox(imgIndexes[pos + 1]); }}
                    style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                    <ChevronRight size={20} />
                  </button>
                )}
              </>
            );
          })()}
          <button onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Report Detail Modal ───────────────────────────────────────────────────────
function DetailModal({ report, isPrivileged, onClose, onDelete, session }: {
  report: Report;
  isPrivileged: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  session: any;
}) {
  const pColor   = projectColor(report.project?.color);
  const dispName = report.user?.name || report.userName;
  const isOwn    = report.user?.id === session?.user?.id;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 12, width: '95%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {/* Left accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: pColor, borderRadius: '12px 0 0 12px' }} />

        {/* Header */}
        <div style={{ padding: '16px 20px 14px 24px', borderBottom: `1px solid ${VS.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {report.project && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: pColor }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: pColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {report.project.name}
                </span>
              </div>
            )}
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: VS.text0 }}>
              {report.title || 'Report'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {(isPrivileged || isOwn) && (
              <button
                onClick={() => { onDelete(report.id); onClose(); }}
                style={{ background: 'transparent', border: `1px solid ${VS.border}`, color: VS.text2, cursor: 'pointer', padding: '5px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = VS.red; (e.currentTarget as HTMLButtonElement).style.borderColor = VS.red; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = VS.text2; (e.currentTarget as HTMLButtonElement).style.borderColor = VS.border; }}
              >
                <Trash2 size={13} />Delete
              </button>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', padding: 4, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Author + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={dispName} image={report.user?.image} size={28} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: VS.text0 }}>
                {dispName}
                {isPrivileged && !isOwn && (
                  <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 3, background: `${VS.blue}18`, color: VS.blue, border: `1px solid ${VS.blue}25` }}>team</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: VS.text2, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Calendar size={10} />
                {fmtDate(report.createdAt)}
                <span style={{ opacity: 0.5 }}>·</span>
                {fmtRelative(report.createdAt)}
              </div>
            </div>
          </div>

          {/* Full description */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: VS.text2, marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 14, color: VS.text1, lineHeight: 1.65, background: VS.bg2, borderRadius: 8, padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {report.description}
            </div>
          </div>

          {/* Attachments */}
          {(() => {
            const atts = parseAttachments(report.image);
            if (!atts.length) return null;
            return <ReportAttachments attachments={atts} />;
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Reports() {
  const { data: session } = useSession();
  const { currentOrg }    = useOrganization();
  const api               = useApiClient();

  const [reports, setReports]     = useState<Report[]>([]);
  const [projects, setProjects]   = useState<ProjectItem[]>([]);
  const [members, setMembers]     = useState<MemberItem[]>([]);
  const [isPrivileged, setPriv]   = useState(false);
  const [analytics, setAnalytics] = useState({ total: 0, thisWeek: 0, uniqueProjects: 0, uniqueMembers: 0 });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showModal, setShowModal]           = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [filterProject, setFProject]  = useState('');
  const [filterMember, setFMember]    = useState('');
  const [filterFrom, setFFrom]        = useState('');
  const [filterTo, setFTo]            = useState('');

  const orgIdRef = useRef(currentOrg?.id);
  orgIdRef.current = currentOrg?.id;

  const fetchReports = async () => {
    const orgId  = orgIdRef.current;
    const userId = session?.user?.id;
    if (!orgId || !userId) return;

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ orgId });
      if (filterProject) params.set('projectId', filterProject);
      if (filterMember)  params.set('memberId',  filterMember);
      if (filterFrom)    params.set('dateFrom',   filterFrom);
      if (filterTo)      params.set('dateTo',     filterTo);
      if (search)        params.set('search',     search);

      const data = await api.fetch(`/api/user-reports?${params}`);
      if (data.success) {
        setReports(data.reports   || []);
        setProjects(data.projects || []);
        setMembers(data.members   || []);
        setPriv(data.isPrivileged ?? false);
        setAnalytics(data.analytics || { total: 0, thisWeek: 0, uniqueProjects: 0, uniqueMembers: 0 });
      } else {
        setError(data.error || 'Failed to load reports');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when org/session changes
  useEffect(() => {
    if (session?.user?.id && currentOrg?.id) fetchReports();
  }, [session?.user?.id, currentOrg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters change
  useEffect(() => {
    if (session?.user?.id && currentOrg?.id) fetchReports();
  }, [search, filterProject, filterMember, filterFrom, filterTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    try {
      await api.fetch(`/api/user-reports/${id}`, { method: 'DELETE' });
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const clearFilters = () => { setSearch(''); setFProject(''); setFMember(''); setFFrom(''); setFTo(''); };
  const hasFilters   = !!(search || filterProject || filterMember || filterFrom || filterTo);

  const inp2: React.CSSProperties = { background: VS.bg2, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '6px 10px', color: VS.text0, fontSize: 13, outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: VS.text0, margin: 0 }}>Reports</h1>
          <p style={{ fontSize: 13, color: VS.text2, marginTop: 4 }}>
            {isPrivileged ? 'All team reports' : 'Your submitted reports'}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: VS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={15} />New Report
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Reports',     value: analytics.total,          icon: FileText,   color: VS.blue   },
          { label: 'This Week',         value: analytics.thisWeek,        icon: Clock,      color: VS.teal   },
          { label: 'Projects Covered',  value: analytics.uniqueProjects,  icon: FolderOpen, color: VS.orange },
          { label: isPrivileged ? 'Contributors' : 'Your Total',
            value: isPrivileged ? analytics.uniqueMembers : analytics.total,
            icon: isPrivileged ? Users : TrendingUp, color: VS.purple },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: VS.text2 }}>{label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={13} style={{ color }} />
              </div>
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: VS.text0 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: VS.text2 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
            style={{ ...inp2, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} />
        </div>

        <select value={filterProject} onChange={e => setFProject(e.target.value)} style={inp2}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {isPrivileged && (
          <select value={filterMember} onChange={e => setFMember(e.target.value)} style={inp2}>
            <option value="">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}

        <input type="date" value={filterFrom} onChange={e => setFFrom(e.target.value)} style={{ ...inp2, colorScheme: 'dark' }} />
        <span style={{ color: VS.text2, fontSize: 12 }}>–</span>
        <input type="date" value={filterTo} onChange={e => setFTo(e.target.value)} style={{ ...inp2, colorScheme: 'dark' }} />

        {hasFilters && (
          <button onClick={clearFilters} style={{ background: VS.bg3, border: `1px solid ${VS.border}`, color: VS.text2, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={12} />Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: `${VS.red}18`, border: `1px solid ${VS.red}44`, borderRadius: 8, padding: '12px 16px', color: VS.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} />{error}
          <button onClick={fetchReports} style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${VS.red}55`, color: VS.red, borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0', background: VS.bg1, borderRadius: 10, border: `1px solid ${VS.border}` }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${VS.accent}44`, borderTopColor: VS.accent, animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: VS.text2 }}>Loading reports…</span>
        </div>
      ) : reports.length === 0 && !error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 0', background: VS.bg1, borderRadius: 10, border: `1px solid ${VS.border}` }}>
          <FileText size={40} style={{ color: VS.text2, opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: VS.text1, margin: 0 }}>{hasFilters ? 'No matching reports' : 'No reports yet'}</p>
          <p style={{ fontSize: 13, color: VS.text2, margin: 0 }}>{hasFilters ? 'Try adjusting filters' : 'Create the first report'}</p>
          {!hasFilters && (
            <button onClick={() => setShowModal(true)} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, background: `${VS.accent}18`, color: VS.accent, border: `1px solid ${VS.accent}33`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} />Create Report
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {reports.map(report => {
            const pColor   = projectColor(report.project?.color);
            const dispName = report.user?.name || report.userName;
            const isOwn    = report.user?.id === session?.user?.id;

            return (
              <div key={report.id} onClick={() => setSelectedReport(report)} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                {/* Left accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: pColor }} />

                {/* Top row */}
                <div style={{ padding: '12px 14px 10px 18px', borderBottom: `1px solid ${VS.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {report.project && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: pColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: pColor, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.project.name}
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 600, color: VS.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.title || 'Report'}
                    </div>
                  </div>
                  {(isPrivileged || isOwn) && (
                    <button onClick={e => { e.stopPropagation(); handleDelete(report.id); }}
                      style={{ background: 'transparent', border: 'none', color: VS.text2, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = VS.red)}
                      onMouseLeave={e => (e.currentTarget.style.color = VS.text2)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '10px 14px 12px 18px' }}>
                  {/* Submitter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Avatar name={dispName} image={report.user?.image} size={22} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: VS.text1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dispName}
                      {isPrivileged && !isOwn && <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 5px', borderRadius: 3, background: `${VS.blue}18`, color: VS.blue, border: `1px solid ${VS.blue}25` }}>team</span>}
                    </span>
                    <span style={{ fontSize: 11, color: VS.text2, flexShrink: 0 }}>{fmtRelative(report.createdAt)}</span>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: 13, color: VS.text1, lineHeight: 1.55, background: VS.bg2, borderRadius: 6, padding: '8px 10px' }}>
                    {report.description.length > 160 ? `${report.description.slice(0, 160)}…` : report.description}
                  </div>

                  {/* Attachments preview */}
                  {(() => {
                    const atts = parseAttachments(report.image);
                    if (!atts.length) return null;
                    return (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {atts.slice(0, 4).map((a, i) => (
                          <div key={i} onClick={e => e.stopPropagation()}
                            style={{ width: 48, height: 48, borderRadius: 6, border: `1px solid ${VS.border}`, background: VS.bg2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {a.type.startsWith('image/')
                              ? <img src={a.dataUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <File size={18} style={{ color: VS.accent }} />
                            }
                          </div>
                        ))}
                        {atts.length > 4 && <div style={{ width: 48, height: 48, borderRadius: 6, border: `1px solid ${VS.border}`, background: VS.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: VS.text2 }}>+{atts.length - 4}</div>}
                      </div>
                    );
                  })()}

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${VS.border}` }}>
                    <Calendar size={11} style={{ color: VS.text2, marginRight: 4 }} />
                    <span style={{ fontSize: 11, color: VS.text2 }}>{fmtDate(report.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreateModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onCreated={fetchReports}
        />
      )}

      {selectedReport && (
        <DetailModal
          report={selectedReport}
          isPrivileged={isPrivileged}
          session={session}
          onClose={() => setSelectedReport(null)}
          onDelete={id => { handleDelete(id); setSelectedReport(null); }}
        />
      )}
    </div>
  );
}
