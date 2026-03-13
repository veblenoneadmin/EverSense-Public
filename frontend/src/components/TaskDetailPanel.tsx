import { useState, useEffect, useRef } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import {
  X, MessageSquare, Paperclip, Send, Trash2, Download,
  Calendar, Clock, Tag, Folder, User, AlertTriangle,
  FileText, Image, File, ChevronRight, Upload, CheckSquare, Check,
} from 'lucide-react';

import { VS } from '../lib/theme';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  dueDate?: string;
  assignee?: string;
  project?: string;
  projectId?: string;
  isBillable: boolean;
  tags: string[];
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface Props {
  task: Task;
  orgId: string;
  onClose: () => void;
  onTaskUpdated?: () => void;
  onCountsLoaded?: (taskId: string, comments: number, attachments: number) => void;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'To Do',       color: VS.blue,   bg: 'rgba(86,156,214,0.12)'  },
  in_progress: { label: 'In Progress', color: VS.yellow, bg: 'rgba(220,220,170,0.12)' },
  on_hold:     { label: 'On Hold',     color: VS.red,    bg: 'rgba(244,71,71,0.12)'   },
  completed:   { label: 'Done',        color: VS.teal,   bg: 'rgba(78,201,176,0.12)'  },
  cancelled:   { label: 'Cancelled',   color: VS.orange, bg: 'rgba(206,145,120,0.12)' },
};

const PRIORITY_CFG: Record<string, { color: string; bg: string }> = {
  low:    { color: VS.teal,   bg: 'rgba(78,201,176,0.12)'  },
  medium: { color: VS.yellow, bg: 'rgba(220,220,170,0.12)' },
  high:   { color: VS.red,    bg: 'rgba(244,71,71,0.12)'   },
  urgent: { color: VS.purple, bg: 'rgba(197,134,192,0.12)' },
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function getInitials(name?: string, email?: string) {
  const src = name || email || '?';
  return src.split(/[\s@.]+/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0, 2).join('');
}
function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return Image;
  if (mime === 'application/pdf' || mime.includes('text')) return FileText;
  return File;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function TaskDetailPanel({ task, orgId: _orgId, onClose, onTaskUpdated: _onTaskUpdated, onCountsLoaded }: Props) {
  const { data: session } = useSession();
  const api = useApiClient();
  const [tab, setTab] = useState<'overview' | 'comments' | 'attachments'>('overview');
  const [postError, setPostError] = useState('');

  // Comments
  const [comments, setComments]     = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPosting] = useState(false);
  const [commentsLoading, setCL]    = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAL]        = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]     = useState(false);

  // Report modal
  const [showReport, setShowReport]       = useState(false);
  const [reportTitle, setReportTitle]     = useState('');
  const [reportDesc, setReportDesc]       = useState('');
  const [reportFiles, setReportFiles]     = useState<File[]>([]);
  const [submittingReport, setSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const reportFileRef = useRef<HTMLInputElement>(null);

  // ── Fetch comments ────────────────────────────────────────────────────────
  const fetchComments = async (): Promise<number> => {
    setCL(true);
    try {
      const data = await api.fetch(`/api/tasks/${task.id}/comments`);
      const list = data.comments ?? [];
      setComments(list);
      return list.length;
    } catch { return 0; }
    finally { setCL(false); }
  };

  // ── Fetch attachments ─────────────────────────────────────────────────────
  const fetchAttachments = async (): Promise<number> => {
    setAL(true);
    try {
      const data = await api.fetch(`/api/tasks/${task.id}/attachments`);
      const list = data.attachments ?? [];
      setAttachments(list);
      return list.length;
    } catch { return 0; }
    finally { setAL(false); }
  };

  useEffect(() => {
    Promise.all([fetchComments(), fetchAttachments()]).then(([cc, ac]) => {
      onCountsLoaded?.(task.id, cc, ac);
    });
  }, [task.id]);

  useEffect(() => {
    if (tab === 'comments') commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, tab]);

  // ── Post comment ──────────────────────────────────────────────────────────
  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    setPostError('');
    try {
      await api.fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setCommentText('');
      await fetchComments();
    } catch (e: any) {
      setPostError(e?.message || 'Failed to post comment');
    } finally { setPosting(false); }
  };

  // ── Delete comment ────────────────────────────────────────────────────────
  const handleDeleteComment = async (id: string) => {
    try {
      await api.fetch(`/api/tasks/${task.id}/comments/${id}`, { method: 'DELETE' });
      setComments(c => c.filter(x => x.id !== id));
    } catch { /* ignore */ }
  };

  // ── Upload file ───────────────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const data = await toBase64(file);
        await api.fetch(`/api/tasks/${task.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size, data, category: 'attachment' }),
        });
      }
      await fetchAttachments();
    } catch { /* ignore */ }
    finally { setUploading(false); }
  };

  // ── Download attachment ───────────────────────────────────────────────────
  const handleDownload = async (att: Attachment) => {
    try {
      const { attachment } = await api.fetch(`/api/tasks/${task.id}/attachments/${att.id}/download`);
      const link = document.createElement('a');
      link.href = `data:${attachment.mimeType};base64,${attachment.data}`;
      link.download = attachment.name;
      link.click();
    } catch { /* ignore */ }
  };

  // ── Delete attachment ─────────────────────────────────────────────────────
  const handleDeleteAttachment = async (id: string) => {
    try {
      await api.fetch(`/api/tasks/${task.id}/attachments/${id}`, { method: 'DELETE' });
      setAttachments(a => a.filter(x => x.id !== id));
    } catch { /* ignore */ }
  };

  // ── Submit report ─────────────────────────────────────────────────────────
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim()) return;
    setSubmitting(true);
    try {
      const descData = btoa(unescape(encodeURIComponent(reportDesc)));
      await api.fetch(`/api/tasks/${task.id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          name: `Report${reportTitle ? ` - ${reportTitle}` : ''} (${new Date().toLocaleDateString('en-AU')}).txt`,
          mimeType: 'text/plain', size: reportDesc.length, data: descData, category: 'report',
        }),
      });
      for (const file of reportFiles) {
        const data = await toBase64(file);
        await api.fetch(`/api/tasks/${task.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size, data, category: 'report' }),
        });
      }

      // Also create a user-report entry so it appears on the Reports page
      try {
        const firstImg = reportFiles.find(f => f.type.startsWith('image/'));
        let imageData: string | undefined;
        if (firstImg) {
          const b64 = await toBase64(firstImg);
          imageData = `data:${firstImg.type};base64,${b64}`;
        }
        const userName = session?.user?.name || (session?.user as any)?.email || 'Unknown';
        await api.fetch('/api/user-reports', {
          method: 'POST',
          body: JSON.stringify({
            title: reportTitle || undefined,
            description: reportDesc,
            userName,
            projectId: task.projectId || undefined,
            image: imageData,
          }),
        });
      } catch (err) {
        console.error('❌ Failed to create user-report entry:', err);
      }

      await fetchAttachments();
      setReportSuccess(true);
      setTimeout(() => { setShowReport(false); setReportSuccess(false); setReportTitle(''); setReportDesc(''); setReportFiles([]); }, 1500);
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const sCfg = STATUS_CFG[task.status] ?? STATUS_CFG.not_started;
  const pKey = (task.priority ?? 'medium').toLowerCase();
  const pCfg = PRIORITY_CFG[pKey] ?? PRIORITY_CFG.medium;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
    && task.status !== 'completed' && task.status !== 'cancelled';
  const regularAttachments = attachments.filter(a => a.category === 'attachment');
  const reportAttachments  = attachments.filter(a => a.category === 'report');

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Panel (right slide-over) ── */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col"
        style={{ background: VS.bg0, borderLeft: `1px solid ${VS.border}`, boxShadow: '-20px 0 60px rgba(0,0,0,0.6)' }}
      >
        {/* ── Panel header ── */}
        <div
          className="flex items-start gap-3 px-5 py-4 shrink-0"
          style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: sCfg.bg, color: sCfg.color }}
              >{sCfg.label}</span>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: pCfg.bg, color: pCfg.color }}
              >{(task.priority ?? 'Medium').toUpperCase()}</span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${VS.red}18`, color: VS.red }}>
                  <AlertTriangle className="h-3 w-3" /> Overdue
                </span>
              )}
            </div>
            <h2 className="text-[16px] font-bold leading-snug" style={{ color: VS.text0 }}>{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 hover:bg-white/5 transition-colors"
            style={{ color: VS.text2 }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div
          className="flex gap-1 px-5 py-2 shrink-0"
          style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}
        >
          {([
            ['overview', 'Overview', CheckSquare],
            ['comments', `Comments (${comments.length})`, MessageSquare],
            ['attachments', `Files (${attachments.length})`, Paperclip],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={tab === key
                ? { background: `${VS.accent}22`, color: VS.accent, border: `1px solid ${VS.accent}44` }
                : { color: VS.text2 }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ───── OVERVIEW TAB ───── */}
          {tab === 'overview' && (
            <div className="p-5 space-y-5">

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Calendar, label: 'Due Date',        value: fmtDate(task.dueDate),    color: isOverdue ? VS.red : VS.text1 },
                  { icon: Folder,   label: 'Project',         value: task.project || '—',       color: VS.text1 },
                  { icon: Clock,    label: 'Est. Hours',      value: `${task.estimatedHours}h`, color: VS.text1 },
                  { icon: Clock,    label: 'Actual Hours',    value: `${task.actualHours}h`,    color: VS.text1 },
                  { icon: User,     label: 'Assignee',        value: task.assignee || '—',       color: VS.text1 },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: VS.text2 }} />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: VS.text2 }}>{label}</div>
                      <div className="text-[13px] font-medium mt-0.5" style={{ color }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              {task.description && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: VS.text2 }}>Description</h3>
                  <div
                    className="p-4 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ background: VS.bg1, border: `1px solid ${VS.border}`, color: VS.text1 }}
                  >
                    {task.description}
                  </div>
                </div>
              )}

              {/* Tags */}
              {task.tags?.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: VS.text2 }}>
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map(t => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: `${VS.accent}18`, color: VS.accent, border: `1px solid ${VS.accent}33` }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent comments preview */}
              {comments.length > 0 && (
                <div>
                  <button
                    onClick={() => setTab('comments')}
                    className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-2 hover:opacity-70 transition-opacity"
                    style={{ color: VS.text2 }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Latest Comments
                    <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                  </button>
                  <div className="space-y-2">
                    {comments.slice(-2).map(c => (
                      <div key={c.id} className="flex gap-2.5 p-3 rounded-lg" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                        <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                          style={{ background: `${VS.blue}22`, color: VS.blue }}>
                          {getInitials(c.user.name, c.user.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold" style={{ color: VS.text0 }}>{c.user.name || c.user.email}</span>
                            <span className="text-[10px]" style={{ color: VS.text2 }}>{fmtTime(c.createdAt)}</span>
                          </div>
                          <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: VS.text1 }}>{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───── COMMENTS TAB ───── */}
          {tab === 'comments' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {commentsLoading ? (
                  <div className="text-center py-8 text-[13px]" style={{ color: VS.text2 }}>Loading…</div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3" style={{ color: VS.text2 }} />
                    <p className="text-[13px]" style={{ color: VS.text2 }}>No comments yet. Be the first to comment.</p>
                  </div>
                ) : comments.map(c => {
                  const isOwn = c.user.id === session?.user?.id;
                  return (
                    <div key={c.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                        style={{ background: isOwn ? `${VS.teal}22` : `${VS.blue}22`, color: isOwn ? VS.teal : VS.blue }}
                      >
                        {getInitials(c.user.name, c.user.email)}
                      </div>
                      <div className={`flex-1 min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[11px] font-semibold" style={{ color: VS.text0 }}>
                            {isOwn ? 'You' : (c.user.name || c.user.email)}
                          </span>
                          <span className="text-[10px]" style={{ color: VS.text2 }}>{fmtTime(c.createdAt)}</span>
                        </div>
                        <div className="relative group flex items-start gap-2">
                          <div
                            className="px-3 py-2 rounded-xl text-[13px] leading-relaxed max-w-md"
                            style={{
                              background: isOwn ? `${VS.accent}22` : VS.bg2,
                              border: `1px solid ${isOwn ? VS.accent + '44' : VS.border}`,
                              color: VS.text1,
                            }}
                          >
                            {c.content}
                          </div>
                          {isOwn && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                              style={{ color: VS.red }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={commentsEndRef} />
              </div>

              {/* Comment input */}
              <div className="p-4 shrink-0" style={{ borderTop: `1px solid ${VS.border}`, background: VS.bg1 }}>
                {postError && (
                  <p className="text-[11px] mb-2" style={{ color: VS.red }}>{postError}</p>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); }}}
                    placeholder="Write a comment… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1"
                    style={{ background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 }}
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={!commentText.trim() || postingComment}
                    className="h-10 w-10 rounded-lg flex items-center justify-center disabled:opacity-40 transition-all hover:opacity-90"
                    style={{ background: VS.accent, color: '#fff' }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ───── ATTACHMENTS TAB ───── */}
          {tab === 'attachments' && (
            <div className="p-5 space-y-6">

              {/* Upload button */}
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold" style={{ color: VS.text0 }}>
                  Attachments
                  <span className="ml-2 text-[11px] font-normal" style={{ color: VS.text2 }}>{regularAttachments.length} files</span>
                </h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: VS.accent, color: '#fff' }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : 'Upload File'}
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={e => handleFileUpload(e.target.files)} />
              </div>

              {/* Regular attachments */}
              {attachLoading ? (
                <div className="text-center py-8 text-[13px]" style={{ color: VS.text2 }}>Loading…</div>
              ) : regularAttachments.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed rounded-xl"
                  style={{ borderColor: VS.border, color: VS.text2 }}>
                  <Paperclip className="h-8 w-8 mx-auto mb-2" style={{ color: VS.text2 }} />
                  <p className="text-[13px]">No attachments yet</p>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-[12px] hover:underline" style={{ color: VS.accent }}>
                    Upload a file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {regularAttachments.map(att => {
                    const Icon = fileIcon(att.mimeType);
                    const isOwn = att.user.id === session?.user?.id;
                    return (
                      <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg group transition-colors hover:bg-white/[0.03]"
                        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${VS.blue}18`, border: `1px solid ${VS.blue}33` }}>
                          <Icon className="h-4 w-4" style={{ color: VS.blue }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate" style={{ color: VS.text0 }}>{att.name}</div>
                          <div className="text-[11px]" style={{ color: VS.text2 }}>
                            {fmtSize(att.size)} · {att.user.name || att.user.email} · {fmtDate(att.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDownload(att)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5"
                            style={{ color: VS.blue }}>
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {isOwn && (
                            <button onClick={() => handleDeleteAttachment(att.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5"
                              style={{ color: VS.red }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Report submissions */}
              {reportAttachments.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
                    style={{ color: VS.text2 }}>
                    <FileText className="h-3.5 w-3.5" /> Report Submissions ({reportAttachments.length})
                  </h3>
                  <div className="space-y-2">
                    {reportAttachments.map(att => {
                      const isOwn = att.user.id === session?.user?.id;
                      return (
                        <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg group transition-colors"
                          style={{ background: `${VS.purple}08`, border: `1px solid ${VS.purple}30` }}>
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${VS.purple}18` }}>
                            <FileText className="h-4 w-4" style={{ color: VS.purple }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate" style={{ color: VS.text0 }}>{att.name}</div>
                            <div className="text-[11px]" style={{ color: VS.text2 }}>
                              Report · {att.user.name || att.user.email} · {fmtDate(att.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDownload(att)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5"
                              style={{ color: VS.purple }}>
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            {isOwn && (
                              <button onClick={() => handleDeleteAttachment(att.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5"
                                style={{ color: VS.red }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Panel footer: Submit Report ── */}
        <div
          className="px-5 py-3 shrink-0 flex items-center justify-between"
          style={{ background: VS.bg1, borderTop: `1px solid ${VS.border}` }}
        >
          <p className="text-[11px]" style={{ color: VS.text2 }}>
            Created {fmtDate(task.createdAt)}
          </p>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ background: `${VS.purple}22`, border: `1px solid ${VS.purple}55`, color: VS.purple }}
          >
            <FileText className="h-4 w-4" />
            Submit Report
          </button>
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReport(false); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: VS.purple }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Submit Accomplishment Report</h3>
              </div>
              <button onClick={() => setShowReport(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: VS.text1 }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: `${VS.teal}22` }}>
                  <Check className="h-7 w-7" style={{ color: VS.teal }} />
                </div>
                <p className="text-[15px] font-semibold" style={{ color: VS.teal }}>Report submitted!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="p-5 space-y-4">
                <p className="text-[12px]" style={{ color: VS.text2 }}>
                  Summarise what you accomplished on this task. Attach screenshots, documents, or any supporting files.
                </p>

                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Report Title (optional)</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={e => setReportTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-1"
                    style={{ background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 }}
                    placeholder="e.g. Week 3 Progress"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Accomplishments *</label>
                  <textarea
                    value={reportDesc}
                    onChange={e => setReportDesc(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1"
                    style={{ background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 }}
                    placeholder="Describe what you completed, challenges faced, and next steps…"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Attachments (optional)</label>
                  <div
                    className="rounded-lg p-4 text-center cursor-pointer transition-colors hover:bg-white/[0.03]"
                    style={{ border: `2px dashed ${VS.border2}` }}
                    onClick={() => reportFileRef.current?.click()}
                  >
                    <Upload className="h-6 w-6 mx-auto mb-1.5" style={{ color: VS.text2 }} />
                    <p className="text-[12px]" style={{ color: VS.text2 }}>
                      Click to add files, or drag and drop
                    </p>
                    {reportFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {reportFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1 rounded text-[11px]"
                            style={{ background: VS.bg2, color: VS.text1 }}>
                            <span>{f.name}</span>
                            <span style={{ color: VS.text2 }}>{fmtSize(f.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    ref={reportFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => setReportFiles(Array.from(e.target.files ?? []))}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setShowReport(false)}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/5"
                    style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingReport || !reportDesc.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:opacity-90"
                    style={{ background: VS.purple, color: '#fff' }}>
                    <FileText className="h-4 w-4" />
                    {submittingReport ? 'Submitting…' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get just the base64
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
