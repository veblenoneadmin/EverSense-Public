import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import {
  Building2, Mail, Phone, MapPin, DollarSign, Clock, Plus, Edit, Trash2,
  Search, FileText, TrendingUp, Users, X, Check, ChevronDown, ChevronRight,
  Folder, ListTodo,
} from 'lucide-react';

import { VS } from '../lib/theme';

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive' | 'potential';
  totalProjects: number;
  totalHours: number;
  totalEarnings: number;
  hourlyRate: number;
  budget: number | null;
  lastActivity: string;
  contactPerson: string;
  industry: string;
  notes: string;
  priority: 'high' | 'medium' | 'low';
  userId?: string | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  tasks: Array<{
    id: string; title: string; status: string; priority: string;
    estimatedHours: number; actualHours: number; dueDate?: string;
  }>;
}

const inputStyle: React.CSSProperties = {
  background: VS.bg3, border: `1px solid ${VS.border2}`, borderRadius: 8,
  color: VS.text0, padding: '8px 12px', outline: 'none', width: '100%', fontSize: 13,
};

const statusColors: Record<string, { bg: string; color: string }> = {
  active:    { bg: `${VS.teal}18`,  color: VS.teal   },
  inactive:  { bg: `${VS.text2}18`, color: VS.text2  },
  potential: { bg: `${VS.yellow}18`, color: VS.yellow },
};
const priorityColors: Record<string, { bg: string; color: string }> = {
  high:   { bg: `${VS.red}18`,    color: VS.red    },
  medium: { bg: `${VS.yellow}18`, color: VS.yellow },
  low:    { bg: `${VS.blue}18`,   color: VS.blue   },
};
const taskStatusColor: Record<string, string> = {
  completed: VS.teal, in_progress: VS.blue, not_started: VS.text2, cancelled: VS.red,
};

const EMPTY_FORM = {
  name: '', company: '', email: '', phone: '', address: '',
  contactPerson: '', industry: '', hourlyRate: 95, budget: '' as string | number,
  priority: 'medium' as 'low' | 'medium' | 'high', notes: '', status: 'active' as 'active' | 'inactive' | 'potential',
};

export function Clients() {
  const { data: session } = useSession();
  const apiClient = useApiClient();

  const [clients, setClients]         = useState<Client[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [searchTerm, setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Create modal
  const [showCreate, setShowCreate]   = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_FORM);
  const [creating, setCreating]       = useState(false);

  // Edit modal
  const [editClient, setEditClient]   = useState<Client | null>(null);
  const [editForm, setEditForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  // Delete
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // Projects/tasks expansion
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [projectsMap, setProjectsMap] = useState<Record<string, Project[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<Record<string, boolean>>({});

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchClients = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const data = await apiClient.fetch('/api/clients');
      if (data.success) setClients(data.clients || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load clients', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [session?.user?.id]);

  const toggleProjects = async (clientId: string) => {
    const nowOpen = !expandedClients[clientId];
    setExpandedClients(e => ({ ...e, [clientId]: nowOpen }));
    if (nowOpen && !projectsMap[clientId]) {
      setLoadingProjects(l => ({ ...l, [clientId]: true }));
      try {
        const data = await apiClient.fetch(`/api/clients/${clientId}/projects`);
        if (data.success) setProjectsMap(m => ({ ...m, [clientId]: data.projects }));
      } catch { /* silent */ } finally {
        setLoadingProjects(l => ({ ...l, [clientId]: false }));
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiClient.fetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ ...createForm }),
      });
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      fetchClients();
      showToast('Client created successfully');
    } catch (err: any) { showToast(err.message || 'Failed to create client', false); }
    finally { setCreating(false); }
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setEditForm({
      name: c.name, company: c.company || '', email: c.email || '',
      phone: c.phone || '', address: c.address || '',
      contactPerson: c.contactPerson || '', industry: c.industry || '',
      hourlyRate: c.hourlyRate || 0, budget: c.budget || '',
      priority: c.priority || 'medium',
      notes: c.notes || '', status: c.status || 'active',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient) return;
    setSaving(true);
    try {
      await apiClient.fetch(`/api/clients/${editClient.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editForm }),
      });
      setEditClient(null);
      fetchClients();
      showToast('Client updated successfully');
    } catch (err: any) { showToast(err.message || 'Failed to update client', false); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiClient.fetch(`/api/clients/${id}`, { method: 'DELETE' });
      fetchClients();
      showToast('Client deleted');
    } catch (err: any) { showToast(err.message || 'Failed to delete client', false); }
    finally { setDeletingId(null); }
  };

  const filtered = clients.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.contactPerson || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = [
    { icon: Users,      color: VS.blue,   label: 'Total Clients',   value: clients.length },
    { icon: TrendingUp, color: VS.teal,   label: 'Active Clients',  value: clients.filter(c => c.status === 'active').length },
    { icon: DollarSign, color: VS.accent, label: 'Total Revenue',   value: `$${clients.reduce((s, c) => s + c.totalEarnings, 0).toLocaleString()}` },
    { icon: Clock,      color: VS.yellow, label: 'Avg. Rate/Hour',  value: clients.length > 0 ? `$${Math.round(clients.reduce((s, c) => s + c.hourlyRate, 0) / clients.length)}/hr` : '$0/hr' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[300] flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium shadow-2xl"
          style={{ background: toast.ok ? 'rgba(78,201,176,0.15)' : 'rgba(244,71,71,0.15)',
            border: `1px solid ${toast.ok ? VS.teal : VS.red}55`, color: toast.ok ? VS.teal : VS.red }}>
          {toast.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: VS.text0 }}>Clients</h1>
          <p className="text-[13px] mt-1" style={{ color: VS.text2 }}>Manage client relationships and their projects</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold hover:opacity-90 transition-all"
          style={{ background: VS.accent, color: '#fff' }}>
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, color, label, value }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color: VS.text0 }}>{value}</div>
              <div className="text-[11px]" style={{ color: VS.text2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap p-4 rounded-xl"
        style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: VS.text2 }} />
          <input type="text" placeholder="Search clients…" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] focus:outline-none"
            style={{ background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] focus:outline-none cursor-pointer"
          style={{ background: VS.bg3, border: `1px solid ${VS.border2}`, color: VS.text0 }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="potential">Potential</option>
        </select>
      </div>

      {/* Client list */}
      {loading ? (
        <div className="text-center py-12" style={{ color: VS.text2 }}>Loading clients…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
          <Building2 className="h-12 w-12 mx-auto mb-4" style={{ color: VS.text2, opacity: 0.5 }} />
          <p className="text-[15px] font-semibold" style={{ color: VS.text1 }}>No clients found</p>
          <p className="text-[13px] mt-2" style={{ color: VS.text2 }}>
            {searchTerm || filterStatus !== 'all' ? 'Try adjusting filters' : 'Add your first client to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => {
            const sc = statusColors[client.status]   || statusColors.active;
            const pc = priorityColors[client.priority] || priorityColors.medium;
            const isOpen = expandedClients[client.id];
            const projects = projectsMap[client.id] || [];
            const loadingP = loadingProjects[client.id];
            const initials = (client.name || '?').charAt(0).toUpperCase();

            return (
              <div key={client.id} className="rounded-xl overflow-hidden"
                style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                {/* Client row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold"
                    style={{ background: `${VS.accent}22`, color: VS.accent }}>{initials}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold" style={{ color: VS.text0 }}>{client.name}</span>
                      {client.company && (
                        <span className="text-[12px]" style={{ color: VS.text2 }}>· {client.company}</span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: sc.bg, color: sc.color }}>{client.status}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: pc.bg, color: pc.color }}>{client.priority}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      {client.email && (
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                          <Mail className="h-3 w-3" />{client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                          <Phone className="h-3 w-3" />{client.phone}
                        </span>
                      )}
                      {client.address && (
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: VS.text2 }}>
                          <MapPin className="h-3 w-3" />{client.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats mini */}
                  <div className="hidden sm:flex items-center gap-6 text-center shrink-0">
                    <div>
                      <div className="text-[14px] font-bold" style={{ color: VS.text0 }}>{client.totalProjects}</div>
                      <div className="text-[11px]" style={{ color: VS.text2 }}>Projects</div>
                    </div>
                    <div>
                      <div className="text-[14px] font-bold" style={{ color: VS.teal }}>${client.totalEarnings.toLocaleString()}</div>
                      <div className="text-[11px]" style={{ color: VS.text2 }}>Revenue</div>
                    </div>
                    {client.hourlyRate > 0 && (
                      <div>
                        <div className="text-[14px] font-bold" style={{ color: VS.text0 }}>${client.hourlyRate}/hr</div>
                        <div className="text-[11px]" style={{ color: VS.text2 }}>Rate</div>
                      </div>
                    )}
                    {client.budget != null && client.budget > 0 && (
                      <div>
                        <div className="text-[14px] font-bold" style={{ color: VS.orange }}>${Number(client.budget).toLocaleString()}</div>
                        <div className="text-[11px]" style={{ color: VS.text2 }}>Budget</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleProjects(client.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/5"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.blue }}>
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Tasks
                    </button>
                    <button onClick={() => openEdit(client)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} disabled={deletingId === client.id}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-40"
                      style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.red }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expandable projects + tasks */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${VS.border}`, background: VS.bg0 }}>
                    {loadingP ? (
                      <div className="px-5 py-4 text-[13px]" style={{ color: VS.text2 }}>Loading projects…</div>
                    ) : projects.length === 0 ? (
                      <div className="px-5 py-4 flex items-center gap-2 text-[13px]" style={{ color: VS.text2 }}>
                        <Folder className="h-4 w-4" /> No projects linked to this client yet.
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {projects.map(project => {
                          const done = project.tasks.filter(t => t.status === 'completed').length;
                          return (
                            <div key={project.id} className="rounded-lg overflow-hidden"
                              style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
                              {/* Project header */}
                              <div className="flex items-center gap-3 px-4 py-3"
                                style={{ borderBottom: project.tasks.length > 0 ? `1px solid ${VS.border}` : 'none' }}>
                                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ background: project.color || VS.accent }} />
                                <span className="text-[13px] font-semibold flex-1" style={{ color: VS.text0 }}>
                                  <Folder className="h-3.5 w-3.5 inline mr-1.5" style={{ color: VS.text2 }} />
                                  {project.name}
                                </span>
                                <span className="text-[11px]" style={{ color: VS.text2 }}>
                                  {done}/{project.tasks.length} tasks
                                </span>
                                {/* Mini progress */}
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: VS.bg3 }}>
                                  <div className="h-full rounded-full" style={{
                                    width: `${project.tasks.length > 0 ? (done / project.tasks.length) * 100 : 0}%`,
                                    background: VS.teal }} />
                                </div>
                              </div>

                              {/* Task rows */}
                              {project.tasks.map((task, i) => (
                                <div key={task.id}
                                  className="flex items-center gap-3 px-4 py-2.5"
                                  style={{ borderTop: i > 0 ? `1px solid ${VS.border}` : undefined }}>
                                  <ListTodo className="h-3.5 w-3.5 shrink-0" style={{ color: VS.text2 }} />
                                  <span className="flex-1 text-[13px] truncate" style={{
                                    color: VS.text1,
                                    textDecoration: task.status === 'cancelled' ? 'line-through' : undefined }}>
                                    {task.title}
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: `${taskStatusColor[task.status] || VS.text2}18`,
                                      color: taskStatusColor[task.status] || VS.text2 }}>
                                    {task.status.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[11px]" style={{ color: VS.text2 }}>
                                    {Number(task.actualHours) || 0}h / {Number(task.estimatedHours) || 0}h
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: VS.accent }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Add New Client</h3>
              </div>
              <button onClick={() => setShowCreate(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5"
                style={{ color: VS.text1 }}><X className="h-4 w-4" /></button>
            </div>
            <ClientForm form={createForm} setForm={setCreateForm as any}
              onSubmit={handleCreate} loading={creating} onCancel={() => setShowCreate(false)} label="Create Client" />
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditClient(null); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: VS.bg0, border: `1px solid ${VS.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: VS.bg1, borderBottom: `1px solid ${VS.border}` }}>
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4" style={{ color: VS.blue }} />
                <h3 className="text-[14px] font-bold" style={{ color: VS.text0 }}>Edit Client</h3>
              </div>
              <button onClick={() => setEditClient(null)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/5"
                style={{ color: VS.text1 }}><X className="h-4 w-4" /></button>
            </div>
            <ClientForm form={editForm} setForm={setEditForm as any}
              onSubmit={handleSaveEdit} loading={saving} onCancel={() => setEditClient(null)} label="Save Changes" showStatus />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared form component ──────────────────────────────────────────────────────
function ClientForm({ form, setForm, onSubmit, loading, onCancel, label, showStatus = false }: {
  form: any; setForm: (f: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean; onCancel: () => void; label: string; showStatus?: boolean;
}) {
  const f = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));
  return (
    <form onSubmit={onSubmit} className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Name *</label>
          <input required value={form.name} onChange={e => f('name', e.target.value)} placeholder="Client name" style={inputStyle} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Company</label>
          <input value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company name" style={inputStyle} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Email *</label>
          <input required type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="client@email.com" style={inputStyle} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Phone</label>
          <input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+1 555 000 0000" style={inputStyle} />
        </div>
      </div>
      <div>
        <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Address</label>
        <input value={form.address} onChange={e => f('address', e.target.value)} placeholder="Address" style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Contact Person</label>
          <input value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)} placeholder="John Smith" style={inputStyle} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Industry</label>
          <input value={form.industry} onChange={e => f('industry', e.target.value)} placeholder="Technology" style={inputStyle} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Budget ($)</label>
          <input type="number" min="0" step="100" placeholder="0" value={form.budget}
            onChange={e => f('budget', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Priority</label>
          <select value={form.priority} onChange={e => f('priority', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      {showStatus && (
        <div>
          <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Status</label>
          <select value={form.status} onChange={e => f('status', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="potential">Potential</option>
          </select>
        </div>
      )}
      <div>
        <label className="block text-[12px] font-semibold mb-1.5" style={{ color: VS.text2 }}>Notes</label>
        <textarea rows={3} value={form.notes} onChange={e => f('notes', e.target.value)}
          placeholder="Additional notes…" style={{ ...inputStyle, resize: 'vertical' } as any} />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-white/5"
          style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}>Cancel</button>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:opacity-90"
          style={{ background: VS.accent, color: '#fff' }}>
          <FileText className="h-4 w-4" />
          {loading ? 'Saving…' : label}
        </button>
      </div>
    </form>
  );
}
