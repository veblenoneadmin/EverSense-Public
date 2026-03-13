import { useState, useEffect } from 'react';
import { useApiClient } from '../lib/api-client';
import {
  Video, Users, Clock, Calendar, ChevronDown, ChevronUp,
  Search, Wifi, WifiOff, FileText, Tag, RefreshCw,
} from 'lucide-react';

import { VS } from '../lib/theme';

interface Transcript {
  id: string;
  title: string;
  date: string | null;
  duration: number | null;
  participants: string[];
  overview: string | null;
  notes: string | null;
  action_items: string | null;
  keywords: string | null;
  outline: string | null;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Meetings() {
  const apiClient = useApiClient();

  const [transcripts, setTranscripts]   = useState<Transcript[]>([]);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [connected, setConnected]       = useState(false);

  const loadTranscripts = async () => {
    try {
      const [tData, sData] = await Promise.all([
        apiClient.fetch('/api/fireflies/transcripts'),
        apiClient.fetch('/api/fireflies/status'),
      ]);
      setTranscripts(tData.transcripts ?? []);
      setConnected(sData.connected ?? false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTranscripts(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const data = await apiClient.fetch('/api/fireflies/sync', { method: 'POST' });
      setSyncMsg(data.newCount > 0 ? `✓ ${data.newCount} new meeting(s) synced` : '✓ Already up to date');
      await loadTranscripts();
    } catch (err: any) {
      setSyncMsg(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await apiClient.fetch(`/api/fireflies/transcripts/${id}/refresh`, { method: 'POST' });
      await loadTranscripts();
    } catch { /* ignore */ }
    finally { setRefreshingId(null); }
  };

  const filtered = transcripts.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(s) ||
      t.overview?.toLowerCase().includes(s) ||
      t.action_items?.toLowerCase().includes(s) ||
      t.participants.some(p => p.toLowerCase().includes(s))
    );
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg" style={{ background: VS.bg2 }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl" style={{ background: VS.bg1 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: VS.text0 }}>Meeting Summaries</h1>
          <p className="text-[12px] mt-0.5" style={{ color: VS.text2 }}>
            AI-generated summaries from Fireflies.ai
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sync Now button */}
          {connected && (
            <div className="flex items-center gap-2">
              {syncMsg && (
                <span className="text-[12px]" style={{ color: syncMsg.startsWith('Error') ? VS.red : VS.teal }}>
                  {syncMsg}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity disabled:opacity-50"
                style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            </div>
          )}
          {/* Connection badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium"
            style={connected
              ? { background: 'rgba(78,201,176,0.12)', color: VS.teal, border: `1px solid rgba(78,201,176,0.25)` }
              : { background: 'rgba(144,144,144,0.1)', color: VS.text2, border: `1px solid ${VS.border}` }
            }
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Fireflies Connected' : 'Fireflies Not Connected'}
          </div>
        </div>
      </div>

      {/* Not connected notice */}
      {!connected && (
        <div
          className="rounded-xl p-4 text-[13px]"
          style={{ background: VS.bg1, border: `1px solid ${VS.border}`, color: VS.text2 }}
        >
          <strong style={{ color: VS.yellow }}>Setup required:</strong> Add your{' '}
          <code style={{ color: VS.teal }}>FIREFLIES_API_KEY</code> in Railway environment variables,
          then set the webhook URL in your Fireflies dashboard to{' '}
          <code style={{ color: VS.teal }}>https://your-domain.com/api/fireflies/webhook</code>.
          EverSense will automatically pull the latest summaries every 30 minutes.
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Meetings', value: transcripts.length, icon: Video, color: VS.accent },
          { label: 'Unique Participants', value: new Set(transcripts.flatMap(t => t.participants)).size, icon: Users, color: VS.teal },
          { label: 'Avg Duration', value: (() => {
            const withDur = transcripts.filter(t => t.duration);
            if (!withDur.length) return '—';
            return formatDuration(Math.round(withDur.reduce((a, t) => a + (t.duration ?? 0), 0) / withDur.length)) ?? '—';
          })(), icon: Clock, color: VS.yellow },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums" style={{ color: VS.text0 }}>{value}</div>
              <div className="text-[11px]" style={{ color: VS.text2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: VS.text2 }} />
        <input
          type="text"
          placeholder="Search meetings, summaries, participants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-[13px] outline-none"
          style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text0 }}
        />
      </div>

      {/* Transcript list */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: VS.bg1, border: `1px solid ${VS.border}` }}
        >
          <Video className="h-8 w-8 mx-auto mb-3" style={{ color: VS.text2 }} />
          <p className="text-[13px]" style={{ color: VS.text2 }}>
            {search ? 'No meetings match your search' : 'No meeting summaries yet'}
          </p>
          {!search && (
            <p className="text-[11px] mt-1" style={{ color: VS.text2 }}>
              Summaries will appear here once Fireflies is connected and meetings are recorded
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const isOpen = expanded === t.id;
            return (
              <div
                key={t.id}
                className="rounded-xl overflow-hidden"
                style={{ background: VS.bg1, border: `1px solid ${isOpen ? VS.accent : VS.border}` }}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                >
                  {/* Icon */}
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${VS.accent}18` }}>
                    <Video className="h-4 w-4" style={{ color: VS.accent }} />
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate" style={{ color: VS.text0 }}>
                      {t.title}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: VS.text2 }}>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(t.date)}
                      </span>
                      {t.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(t.duration)}
                        </span>
                      )}
                      {t.participants.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {t.participants.length} participant{t.participants.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span>{timeAgo(t.createdAt)}</span>
                    </div>
                  </div>

                  {/* Keywords preview */}
                  {t.keywords && !isOpen && (
                    <div className="hidden md:flex items-center gap-1.5 shrink-0 max-w-xs overflow-hidden">
                      {t.keywords.split(',').slice(0, 3).map(kw => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded-full text-[10px] truncate"
                          style={{ background: `${VS.accent}18`, color: VS.blue }}
                        >
                          {kw.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expand chevron */}
                  <div style={{ color: VS.text2 }}>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div
                    className="px-5 pb-5 space-y-4"
                    style={{ borderTop: `1px solid ${VS.border}` }}
                  >
                    {/* No summary yet notice */}
                    {!t.overview && !t.notes && !t.action_items && !t.keywords && !t.outline && (
                      <div className="pt-4 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-2 text-[13px]" style={{ color: VS.text2 }}>
                          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                          Summary not available yet.
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleRefresh(t.id); }}
                          disabled={refreshingId === t.id}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium transition-opacity disabled:opacity-50"
                          style={{ background: `${VS.accent}18`, color: VS.blue, border: `1px solid ${VS.accent}30` }}
                        >
                          <RefreshCw className={`h-3 w-3 ${refreshingId === t.id ? 'animate-spin' : ''}`} />
                          {refreshingId === t.id ? 'Refreshing…' : 'Refresh from Fireflies'}
                        </button>
                      </div>
                    )}

                    {/* Participants */}
                    {t.participants.length > 0 && (
                      <div className="pt-4">
                        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
                          <Users className="h-3 w-3" /> Participants
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {t.participants.map(p => (
                            <span
                              key={p}
                              className="px-3 py-1 rounded-full text-[12px]"
                              style={{ background: VS.bg2, border: `1px solid ${VS.border}`, color: VS.text1 }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overview */}
                    {t.overview && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
                          <FileText className="h-3 w-3" /> Summary
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: VS.text1 }}>
                          {t.overview}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {t.notes && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
                          <FileText className="h-3 w-3" /> Notes
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: VS.text1 }}>
                          {t.notes}
                        </p>
                      </div>
                    )}

                    {/* Action items */}
                    {t.action_items && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
                          <ChevronDown className="h-3 w-3" style={{ color: VS.yellow }} /> Action Items
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: VS.text1 }}>
                          {t.action_items}
                        </p>
                      </div>
                    )}

                    {/* Keywords */}
                    {t.keywords && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
                          <Tag className="h-3 w-3" /> Keywords
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {t.keywords.split(',').map(kw => (
                            <span
                              key={kw}
                              className="px-2.5 py-1 rounded-full text-[12px]"
                              style={{ background: `${VS.accent}18`, color: VS.blue, border: `1px solid ${VS.accent}30` }}
                            >
                              {kw.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outline */}
                    {t.outline && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: VS.text2 }}>
                          <FileText className="h-3 w-3" /> Outline
                        </div>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: VS.text1 }}>
                          {t.outline}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
