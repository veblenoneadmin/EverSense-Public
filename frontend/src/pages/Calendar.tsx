import { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg, EventChangeArg, EventSourceFuncArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import { signIn } from '../lib/auth-client';
import {
  Plus, X, Video, Users, Calendar as CalendarIcon,
  Check, ExternalLink, Search, ChevronDown, MapPin,
} from 'lucide-react';
import './Calendar.css';

import { VS } from '../lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrgMember { id: string; name: string | null; email: string; image: string | null; role: string; }

interface CalEventExtended {
  description: string | null;
  location: string | null;
  meetLink: string | null;
  createdById: string;
  syncedToGoogle: boolean;
  googleEventId: string | null;
  attendees: OrgMember[];
  source?: string;
}

interface EventFormData {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  attendeeIds: string[];
  meetLink: string;
  syncToGoogle: boolean;
}

const EVENT_COLORS = [
  { hex: '#007acc', label: 'Blue'   },
  { hex: '#4ec9b0', label: 'Teal'   },
  { hex: '#6a9955', label: 'Green'  },
  { hex: '#dcdcaa', label: 'Yellow' },
  { hex: '#ce9178', label: 'Orange' },
  { hex: '#f44747', label: 'Red'    },
  { hex: '#c586c0', label: 'Purple' },
  { hex: '#569cd6', label: 'Sky'    },
];

function defaultForm(): EventFormData {
  const now = new Date();
  const end = new Date(now.getTime() + 3600000);
  return {
    title: '', description: '', location: '',
    startAt: toLocalInput(now),
    endAt:   toLocalInput(end),
    allDay: false, color: '#007acc',
    attendeeIds: [], meetLink: '', syncToGoogle: false,
  };
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function Calendar() {
  const api = useApiClient();
  const { currentOrg } = useOrganization();
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    api.fetch('/api/calendar/members').then((d: { members: OrgMember[] }) => setMembers(d.members)).catch(() => {});
    api.fetch('/api/calendar/status').then((d: { googleConnected: boolean }) => setGoogleConnected(d.googleConnected ?? false)).catch(() => {});
  }, [currentOrg]);

  // FullCalendar event source — EverSense events
  const fetchEvents = useCallback((info: EventSourceFuncArg, success: (events: EventInput[]) => void, failure: (err: Error) => void) => {
    api.fetch(`/api/calendar/events?start=${encodeURIComponent(info.startStr)}&end=${encodeURIComponent(info.endStr)}`)
      .then((d: { events: EventInput[] }) => success(d.events))
      .catch((e: Error) => failure(e));
  }, [currentOrg]);

  // FullCalendar event source — Google Calendar events (read-only)
  const fetchGoogleEvents = useCallback((info: EventSourceFuncArg, success: (events: EventInput[]) => void) => {
    if (!googleConnected) return success([]);
    api.fetch(`/api/calendar/google-events?start=${encodeURIComponent(info.startStr)}&end=${encodeURIComponent(info.endStr)}`)
      .then((d: { events: { id: string; googleEventId: string; title: string; start: string; end: string; allDay: boolean; description: string | null; location: string | null; meetLink: string | null; source: string }[] }) =>
        success(d.events.map(e => ({
          id: e.id,
          title: `📅 ${e.title}`,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          backgroundColor: '#444',
          borderColor: '#666',
          textColor: '#ccc',
          editable: false,
          extendedProps: {
            description: e.description,
            location: e.location,
            meetLink: e.meetLink,
            source: 'google',
            createdById: '',
            syncedToGoogle: false,
            googleEventId: e.googleEventId,
            attendees: [],
          },
        })))
      )
      .catch(() => success([]));
  }, [currentOrg, googleConnected]);

  const openCreateModal = (startStr?: string, allDay?: boolean) => {
    const start = startStr ? new Date(startStr) : new Date();
    const end = new Date(start.getTime() + (allDay ? 0 : 3600000));
    setForm({
      ...defaultForm(),
      startAt: toLocalInput(start),
      endAt: toLocalInput(allDay ? start : end),
      allDay: allDay || false,
    });
    setEditingEventId(null);
    setError(null);
    setShowModal(true);
  };

  const handleDateClick = (info: DateClickArg) => {
    openCreateModal(info.dateStr, info.allDay);
  };

  const handleEventClick = (info: EventClickArg) => {
    const ext = info.event.extendedProps as CalEventExtended;
    if (ext.source === 'google') return; // Google events are read-only
    setEditingEventId(info.event.id);
    setForm({
      title:        info.event.title,
      description:  ext.description || '',
      location:     ext.location || '',
      startAt:      toLocalInput(info.event.start || new Date()),
      endAt:        toLocalInput(info.event.end || new Date()),
      allDay:       info.event.allDay,
      color:        (info.event.backgroundColor || '#007acc'),
      attendeeIds:  ext.attendees.map(a => a.id),
      meetLink:     ext.meetLink || '',
      syncToGoogle: ext.syncedToGoogle || false,
    });
    setError(null);
    setShowModal(true);
  };

  const handleEventChange = async (info: EventChangeArg) => {
    try {
      await api.fetch(`/api/calendar/events/${info.event.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          startAt: info.event.start?.toISOString(),
          endAt:   info.event.end?.toISOString(),
          allDay:  info.event.allDay,
        }),
      });
      calRef.current?.getApi().refetchEvents();
    } catch {
      info.revert();
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.allDay && new Date(form.endAt) <= new Date(form.startAt)) {
      setError('End time must be after start time');
      return;
    }
    setSaving(true); setError(null);
    try {
      const url = editingEventId ? `/api/calendar/events/${editingEventId}` : '/api/calendar/events';
      const method = editingEventId ? 'PUT' : 'POST';
      await api.fetch(url, { method, body: JSON.stringify(form) });
      setShowModal(false);
      calRef.current?.getApi().refetchEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEventId) return;
    setDeleting(true); setError(null);
    try {
      await api.fetch(`/api/calendar/events/${editingEventId}`, { method: 'DELETE' });
      setShowModal(false);
      calRef.current?.getApi().refetchEvents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ background: VS.bg0, minHeight: '100vh', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarIcon size={20} color={VS.accent} />
          <h1 style={{ color: VS.text0, fontSize: 20, fontWeight: 600, margin: 0 }}>Calendar</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Google Calendar status badge / connect button */}
          {googleConnected ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: 'rgba(78,201,176,0.12)', color: VS.teal,
              border: '1px solid rgba(78,201,176,0.25)',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: VS.teal }} />
              Google Calendar Connected
            </div>
          ) : (
            <button
              onClick={() => signIn.social({ provider: 'google', callbackURL: '/calendar' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: 'rgba(144,144,144,0.08)', color: VS.text1,
                border: `1px solid ${VS.border}`, cursor: 'pointer',
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: VS.text2 }} />
              Connect Google Calendar
            </button>
          )}
          <button
            onClick={() => openCreateModal()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: VS.accent, color: '#fff', border: 'none',
              borderRadius: 6, padding: '7px 14px', fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Event
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div style={{
        background: VS.bg1, borderRadius: 8, padding: 16,
        border: `1px solid ${VS.border}`,
      }}>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          eventSources={[fetchEvents, fetchGoogleEvents]}
          editable={true}
          selectable={true}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          eventDisplay="block"
          height="auto"
          nowIndicator={true}
          dayMaxEvents={3}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <EventModal
          form={form}
          setForm={setForm}
          members={members}
          isEdit={!!editingEventId}
          googleConnected={googleConnected}
          saving={saving}
          deleting={deleting}
          error={error}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ── EventModal ────────────────────────────────────────────────────────────────
interface EventModalProps {
  form: EventFormData;
  setForm: React.Dispatch<React.SetStateAction<EventFormData>>;
  members: OrgMember[];
  isEdit: boolean;
  googleConnected: boolean;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function EventModal({
  form, setForm, members, isEdit, googleConnected,
  saving, deleting, error, onSave, onDelete, onClose,
}: EventModalProps) {
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberList, setShowMemberList] = useState(false);

  const filteredMembers = members.filter(m =>
    (m.name || m.email).toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggleAttendee = (id: string) => {
    setForm(f => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id)
        ? f.attendeeIds.filter(a => a !== id)
        : [...f.attendeeIds, id],
    }));
  };

  const selectedMembers = members.filter(m => form.attendeeIds.includes(m.id));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: VS.bg1, border: `1px solid ${VS.border}`,
        borderRadius: 10, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1px solid ${VS.border}`,
        }}>
          <h2 style={{ color: VS.text0, fontSize: 15, fontWeight: 600, margin: 0 }}>
            {isEdit ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: VS.text2, padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Form body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              placeholder="Event title"
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* All-day toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox" id="allDay"
              checked={form.allDay}
              onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
              style={{ accentColor: VS.accent, cursor: 'pointer' }}
            />
            <label htmlFor="allDay" style={{ color: VS.text1, fontSize: 13, cursor: 'pointer' }}>All day</label>
          </div>

          {/* Start / End times */}
          {!form.allDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Start</label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>End</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {form.allDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Start date</label>
                <input
                  type="date"
                  value={form.startAt.split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, startAt: e.target.value + 'T00:00' }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>End date</label>
                <input
                  type="date"
                  value={form.endAt.split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, endAt: e.target.value + 'T23:59' }))}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Add notes or agenda"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>
              <MapPin size={11} style={{ marginRight: 4, display: 'inline' }} />
              Location
            </label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Add a location"
              style={inputStyle}
            />
          </div>

          {/* Meeting Link */}
          <div>
            <label style={labelStyle}>
              <Video size={11} style={{ marginRight: 4, display: 'inline' }} />
              Meeting Link
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={form.meetLink}
                onChange={e => setForm(f => ({ ...f, meetLink: e.target.value }))}
                placeholder="Paste Google Meet, Zoom, or Teams link"
                style={{ ...inputStyle, paddingRight: form.meetLink ? 70 : 10 }}
              />
              {form.meetLink && (
                <a
                  href={form.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: VS.accent, color: '#fff', textDecoration: 'none',
                    borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 500,
                  }}
                >
                  Join <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          {/* Google Calendar sync toggle */}
          {googleConnected && !isEdit && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: 'rgba(78,201,176,0.06)', border: `1px solid rgba(78,201,176,0.2)`,
              borderRadius: 8, padding: '12px 14px',
            }}>
              <input
                type="checkbox" id="syncToGoogle"
                checked={form.syncToGoogle}
                onChange={e => setForm(f => ({ ...f, syncToGoogle: e.target.checked }))}
                style={{ accentColor: VS.teal, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
              />
              <label htmlFor="syncToGoogle" style={{ cursor: 'pointer' }}>
                <div style={{ color: VS.teal, fontSize: 13, fontWeight: 500 }}>Sync to Google Calendar</div>
                {form.syncToGoogle && (
                  <div style={{ color: VS.text2, fontSize: 12, marginTop: 3 }}>
                    A Google Meet link will be created automatically.
                  </div>
                )}
              </label>
            </div>
          )}
          {isEdit && form.syncToGoogle && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: VS.teal,
            }}>
              <Check size={12} /> Synced to Google Calendar
            </div>
          )}

          {/* Color */}
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EVENT_COLORS.map(c => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setForm(f => ({ ...f, color: c.hex }))}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c.hex, cursor: 'pointer',
                    border: form.color === c.hex ? `2px solid ${VS.text0}` : `2px solid transparent`,
                    outline: form.color === c.hex ? `2px solid ${c.hex}` : 'none',
                    outlineOffset: 2,
                    transition: 'transform 0.1s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label style={labelStyle}>
              <Users size={11} style={{ marginRight: 4, display: 'inline' }} />
              Attendees
            </label>

            {/* Selected chips */}
            {selectedMembers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {selectedMembers.map(m => (
                  <span key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: VS.bg2, border: `1px solid ${VS.border}`,
                    borderRadius: 12, padding: '2px 8px 2px 4px', fontSize: 12, color: VS.text1,
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: VS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: '#fff', fontWeight: 700,
                    }}>
                      {(m.name || m.email)[0].toUpperCase()}
                    </div>
                    {m.name || m.email}
                    <button onClick={() => toggleAttendee(m.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: VS.text2,
                      padding: 0, lineHeight: 1, marginLeft: 2,
                    }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search + dropdown */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: VS.text2 }} />
                <input
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setShowMemberList(true); }}
                  onFocus={() => setShowMemberList(true)}
                  placeholder="Search members…"
                  style={{ ...inputStyle, paddingLeft: 30 }}
                />
                <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: VS.text2 }} />
              </div>
              {showMemberList && filteredMembers.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: VS.bg2, border: `1px solid ${VS.border}`,
                  borderRadius: '0 0 6px 6px', maxHeight: 180, overflowY: 'auto',
                  zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  {filteredMembers.map(m => (
                    <div
                      key={m.id}
                      onClick={() => { toggleAttendee(m.id); setMemberSearch(''); setShowMemberList(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', cursor: 'pointer',
                        background: form.attendeeIds.includes(m.id) ? 'rgba(0,122,204,0.12)' : 'transparent',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = VS.bg3; }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background =
                          form.attendeeIds.includes(m.id) ? 'rgba(0,122,204,0.12)' : 'transparent';
                      }}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: VS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0,
                      }}>
                        {(m.name || m.email)[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: VS.text0, fontWeight: 500 }}>{m.name || m.email}</div>
                        {m.name && <div style={{ fontSize: 11, color: VS.text2 }}>{m.email}</div>}
                      </div>
                      {form.attendeeIds.includes(m.id) && <Check size={13} color={VS.accent} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 13, color: VS.red, background: 'rgba(244,71,71,0.1)', borderRadius: 6, padding: '8px 12px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderTop: `1px solid ${VS.border}`,
        }}>
          {isEdit ? (
            <button
              onClick={onDelete}
              disabled={deleting}
              style={{
                background: 'rgba(244,71,71,0.12)', color: VS.red,
                border: `1px solid rgba(244,71,71,0.3)`, borderRadius: 6,
                padding: '7px 14px', fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: VS.bg2, color: VS.text1, border: `1px solid ${VS.border}`,
                borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: VS.accent, color: '#fff', border: 'none',
                borderRadius: 6, padding: '7px 16px', fontSize: 13,
                fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: VS.text2, marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: VS.bg2, border: `1px solid ${VS.border}`,
  borderRadius: 6, padding: '8px 10px', fontSize: 13, color: VS.text0,
  outline: 'none', boxSizing: 'border-box',
  colorScheme: 'dark',
};
