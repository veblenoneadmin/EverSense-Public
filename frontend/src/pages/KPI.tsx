import { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  BarChart3,
  Clock,
  FileText,
  Users,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Folder,
} from 'lucide-react';

import { VS } from '../lib/theme';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface KPISummary {
  totalHours: number;
  totalReports: number;
  totalTasks: number;
  activeEmployees: number;
  totalMembers: number;
  completionRate: number;
  topProject: { name: string; hours: number } | null;
}

interface KPIEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
  hours: number;
  reports: number;
  tasksCompleted: number;
  projects: string[];
  daysActive: number;
  avgHoursPerDay: number;
  hasActivity: boolean;
}

interface KPIProject {
  id: string;
  name: string;
  hours: number;
  tasksCount: number;
}

interface KPIData {
  period: Period;
  dateRange: { start: string; end: string };
  prevDateRange: { start: string; end: string };
  summary: KPISummary;
  prevSummary: KPISummary;
  changes: { hours: number | null; reports: number | null; tasks: number | null; activeEmployees: number | null };
  employees: KPIEmployee[];
  projects: KPIProject[];
  missingReports: string[];
}

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const PERIOD_DATE_TYPE: Record<Period, string> = {
  daily: 'date',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

// Convert <input type="week"> value (e.g. "2026-W08") to a date string for query
function weekToDate(val: string) {
  if (!val) return '';
  const [year, week] = val.split('-W');
  const jan4 = new Date(Number(year), 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const weekStart = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000 + (Number(week) - 1) * 7 * 86400000);
  return weekStart.toISOString().split('T')[0];
}

function toQueryDate(period: Period, inputVal: string): string {
  if (!inputVal) return new Date().toISOString().split('T')[0];
  if (period === 'weekly') return weekToDate(inputVal);
  if (period === 'monthly') return `${inputVal}-15`; // mid-month → backend picks range
  if (period === 'yearly') return `${inputVal}-07-01`;
  return inputVal;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtHours(h: number) {
  return h.toFixed(1) + 'h';
}

function defaultInputVal(period: Period) {
  const now = new Date();
  if (period === 'daily') return now.toISOString().split('T')[0];
  if (period === 'weekly') {
    const y = now.getFullYear();
    // ISO week number
    const start = new Date(y, 0, 1);
    const diff = now.getTime() - start.getTime();
    const week = Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  }
  if (period === 'monthly') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return String(now.getFullYear());
}

function ChangePill({ value }: { value: number | null }) {
  if (value === null) return <span style={{ fontSize: 11, color: VS.text2 }}>N/A</span>;
  const color = value > 0 ? VS.teal : value < 0 ? VS.red : VS.text2;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color, background: `${color}18`, padding: '2px 6px', borderRadius: 4 }}>
      <Icon size={10} />
      {value > 0 ? '+' : ''}{value}%
    </span>
  );
}

export function KPI() {
  const { currentOrg } = useOrganization();
  const [period, setPeriod] = useState<Period>('weekly');
  const [inputVal, setInputVal] = useState(() => defaultInputVal('weekly'));
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setInputVal(defaultInputVal(p));
    setData(null);
    setError('');
  };

  const handleGenerate = async () => {
    const orgId = currentOrg?.id || 'org_1757046595553';
    const dateParam = toQueryDate(period, inputVal);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/kpi/generate?orgId=${orgId}&period=${period}&date=${dateParam}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to generate KPI');
    } finally {
      setLoading(false);
    }
  };

  const statCards = data ? [
    {
      label: 'Total Hours',
      value: fmtHours(data.summary.totalHours),
      prev: fmtHours(data.prevSummary.totalHours),
      change: data.changes.hours,
      icon: <Clock size={16} />, accent: VS.teal,
    },
    {
      label: 'Reports Submitted',
      value: String(data.summary.totalReports),
      prev: String(data.prevSummary.totalReports),
      change: data.changes.reports,
      icon: <FileText size={16} />, accent: VS.blue,
    },
    {
      label: 'Tasks Completed',
      value: String(data.summary.totalTasks),
      prev: String(data.prevSummary.totalTasks),
      change: data.changes.tasks,
      icon: <CheckSquare size={16} />, accent: VS.purple,
    },
    {
      label: 'Active Employees',
      value: `${data.summary.activeEmployees} / ${data.summary.totalMembers}`,
      prev: String(data.prevSummary.activeEmployees),
      change: data.changes.activeEmployees,
      icon: <Users size={16} />, accent: VS.orange,
    },
    {
      label: 'Report Completion',
      value: `${data.summary.completionRate}%`,
      prev: `${data.prevSummary.completionRate}%`,
      change: null,
      icon: <BarChart3 size={16} />, accent: VS.yellow,
      isRate: true,
      rate: data.summary.completionRate,
    },
    {
      label: 'Top Project',
      value: data.summary.topProject?.name || '—',
      sub: data.summary.topProject ? fmtHours(data.summary.topProject.hours) : null,
      change: null,
      icon: <Folder size={16} />, accent: VS.accent,
    },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 56px)', color: VS.text0 }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 24px', borderBottom: `1px solid ${VS.border}` }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: VS.text0, margin: 0 }}>
            KPI Report
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, background: VS.bg3, color: VS.text2, border: `1px solid ${VS.border}`, borderRadius: 4, padding: '2px 8px' }}>
              Performance
            </span>
          </h1>
          {data && (
            <p style={{ fontSize: 12, color: VS.text2, margin: '3px 0 0' }}>
              {fmtDate(data.dateRange.start)} — {fmtDate(data.dateRange.end)}
            </p>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Period tabs */}
          <div style={{ display: 'flex', background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 6, overflow: 'hidden' }}>
            {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  fontWeight: period === p ? 700 : 400,
                  background: period === p ? VS.accent : 'transparent',
                  color: period === p ? '#fff' : VS.text2,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <input
            type={PERIOD_DATE_TYPE[period]}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            style={{
              background: VS.bg3, border: `1px solid ${VS.border}`, borderRadius: 4,
              color: VS.text1, fontSize: 12, padding: '5px 10px', outline: 'none',
              colorScheme: 'dark',
            }}
          />

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              background: loading ? VS.bg3 : VS.accent,
              border: 'none', borderRadius: 4,
              color: loading ? VS.text2 : '#fff',
              fontSize: 12, fontWeight: 700,
              padding: '6px 16px', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? 'Generating...' : 'Generate KPI'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ margin: '16px 24px', padding: '10px 14px', background: `${VS.red}15`, border: `1px solid ${VS.red}40`, borderRadius: 4, color: VS.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!data && !loading && !error && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: VS.text2 }}>
          <BarChart3 size={48} style={{ opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Select a period and click <strong style={{ color: VS.text1 }}>Generate KPI</strong> to view the report</p>
        </div>
      )}

      {/* ── KPI Content ── */}
      {data && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {statCards.map((card, i) => (
              <div key={i} style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                {/* accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: card.accent }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: VS.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                  <span style={{ color: card.accent, opacity: 0.8 }}>{card.icon}</span>
                </div>

                <div style={{ fontSize: 22, fontWeight: 700, color: card.accent, lineHeight: 1 }}>{card.value}</div>

                {/* progress bar for rates */}
                {'isRate' in card && card.isRate && (
                  <div style={{ marginTop: 8, height: 3, background: VS.bg3, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${card.rate}%`, background: card.accent, borderRadius: 2, transition: 'width 0.5s' }} />
                  </div>
                )}

                {/* sub (for top project hours) */}
                {'sub' in card && card.sub && (
                  <div style={{ fontSize: 12, color: VS.text2, marginTop: 4 }}>{card.sub} logged</div>
                )}

                {/* prev + change */}
                {card.change !== undefined && card.change !== null && 'prev' in card && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: VS.text2 }}>prev: {'prev' in card ? card.prev : ''}</span>
                    <ChangePill value={card.change} />
                  </div>
                )}
                {'prev' in card && card.change === null && card.prev && (
                  <div style={{ fontSize: 11, color: VS.text2, marginTop: 6 }}>prev: {card.prev}</div>
                )}
              </div>
            ))}
          </div>

          {/* ── Missing reports alert ── */}
          {data.missingReports.length > 0 && (
            <div style={{ background: `${VS.red}10`, border: `1px solid ${VS.red}40`, borderRadius: 6, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertCircle size={14} color={VS.red} />
                <span style={{ fontSize: 13, fontWeight: 700, color: VS.red }}>
                  No reports from {data.missingReports.length} member{data.missingReports.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.missingReports.map(name => (
                  <span key={name} style={{ fontSize: 11, background: `${VS.red}18`, color: VS.red, border: `1px solid ${VS.red}30`, borderRadius: 4, padding: '2px 8px' }}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Employee table ── */}
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${VS.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} color={VS.text2} />
              <span style={{ fontSize: 14, fontWeight: 700, color: VS.text0 }}>Employee Performance</span>
              <span style={{ fontSize: 11, color: VS.text2, marginLeft: 'auto' }}>{data.employees.length} members</span>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 80px 90px 70px 50px', padding: '8px 18px', background: VS.bg2, fontSize: 11, fontWeight: 600, color: VS.text2, textTransform: 'uppercase', letterSpacing: '0.04em', gap: 8 }}>
              <span>Employee</span>
              <span style={{ textAlign: 'right' }}>Hours</span>
              <span style={{ textAlign: 'right' }}>Reports</span>
              <span style={{ textAlign: 'right' }}>Tasks</span>
              <span style={{ textAlign: 'right' }}>Avg h/day</span>
              <span style={{ textAlign: 'right' }}>Days</span>
              <span style={{ textAlign: 'center' }}>Status</span>
            </div>

            {/* Table rows */}
            {data.employees.map((emp, i) => {
              const isExpanded = expandedEmployee === emp.id;
              const statusColor = emp.hours > 6 ? VS.teal : emp.hours > 0 ? VS.yellow : VS.red;
              const statusLabel = emp.hours > 6 ? 'Active' : emp.hours > 0 ? 'Partial' : 'Inactive';

              return (
                <div key={emp.id}>
                  <div
                    onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 90px 80px 80px 90px 70px 50px',
                      padding: '10px 18px',
                      borderBottom: `1px solid ${i === data.employees.length - 1 && !isExpanded ? 'transparent' : VS.border}`,
                      background: isExpanded ? `${VS.accent}08` : 'transparent',
                      cursor: 'pointer',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Name + role */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${statusColor}22`, border: `1px solid ${statusColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{emp.name[0]?.toUpperCase()}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: VS.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: VS.text2 }}>{emp.role}</div>
                      </div>
                      {isExpanded ? <ChevronUp size={12} color={VS.text2} style={{ marginLeft: 4 }} /> : <ChevronDown size={12} color={VS.text2} style={{ marginLeft: 4 }} />}
                    </div>

                    <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: emp.hours > 0 ? VS.teal : VS.text2 }}>{fmtHours(emp.hours)}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: emp.reports > 0 ? VS.blue : VS.text2 }}>{emp.reports}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: emp.tasksCompleted > 0 ? VS.purple : VS.text2 }}>{emp.tasksCompleted}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: VS.text1 }}>{fmtHours(emp.avgHoursPerDay)}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: VS.text1 }}>{emp.daysActive}</div>

                    {/* Status pill */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}30`, borderRadius: 4, padding: '2px 6px' }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '12px 18px 16px 56px', borderBottom: `1px solid ${VS.border}`, background: `${VS.accent}06`, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 11, color: VS.text2, marginBottom: 4 }}>Email</div>
                        <div style={{ fontSize: 12, color: VS.text1 }}>{emp.email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: VS.text2, marginBottom: 4 }}>Projects Worked On</div>
                        {emp.projects.length === 0
                          ? <div style={{ fontSize: 12, color: VS.text2 }}>None recorded</div>
                          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {emp.projects.map(p => (
                                <span key={p} style={{ fontSize: 11, background: `${VS.accent}15`, color: VS.accent, border: `1px solid ${VS.accent}30`, borderRadius: 4, padding: '2px 8px' }}>{p}</span>
                              ))}
                            </div>
                        }
                      </div>
                      {!emp.hasActivity && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: VS.red }}>
                          <AlertCircle size={13} />
                          No activity logged this period — follow up required
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Project breakdown ── */}
          {data.projects.length > 0 && (
            <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${VS.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Folder size={15} color={VS.text2} />
                <span style={{ fontSize: 14, fontWeight: 700, color: VS.text0 }}>Project Breakdown</span>
                <span style={{ fontSize: 11, color: VS.text2, marginLeft: 'auto' }}>{data.projects.length} project{data.projects.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Project rows */}
              <div style={{ padding: '8px 0' }}>
                {data.projects.map((proj, i) => {
                  const maxHours = data.projects[0]?.hours || 1;
                  const widthPct = Math.round((proj.hours / maxHours) * 100);
                  return (
                    <div key={proj.id} style={{ padding: '10px 18px', borderBottom: i < data.projects.length - 1 ? `1px solid ${VS.border}` : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Rank */}
                      <span style={{ fontSize: 12, color: VS.text2, fontWeight: 700, width: 20, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>

                      {/* Name + bar */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: VS.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                          <div style={{ display: 'flex', gap: 16, flexShrink: 0, marginLeft: 12 }}>
                            <span style={{ fontSize: 12, color: VS.teal, fontWeight: 600 }}>{fmtHours(proj.hours)}</span>
                            <span style={{ fontSize: 12, color: VS.text2 }}>{proj.tasksCount} task{proj.tasksCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: 3, background: VS.bg3, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${widthPct}%`, background: `linear-gradient(90deg, ${VS.teal}, ${VS.accent})`, borderRadius: 2, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Period comparison ── */}
          <div style={{ background: VS.bg1, border: `1px solid ${VS.border}`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <BarChart3 size={15} color={VS.text2} />
              <span style={{ fontSize: 14, fontWeight: 700, color: VS.text0 }}>Period Comparison</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {[
                { label: 'Hours Worked', curr: fmtHours(data.summary.totalHours), prev: fmtHours(data.prevSummary.totalHours), change: data.changes.hours, accent: VS.teal },
                { label: 'Reports',      curr: String(data.summary.totalReports),  prev: String(data.prevSummary.totalReports),  change: data.changes.reports, accent: VS.blue },
                { label: 'Tasks Done',   curr: String(data.summary.totalTasks),    prev: String(data.prevSummary.totalTasks),    change: data.changes.tasks, accent: VS.purple },
                { label: 'Active Staff', curr: String(data.summary.activeEmployees), prev: String(data.prevSummary.activeEmployees), change: data.changes.activeEmployees, accent: VS.orange },
              ].map(row => (
                <div key={row.label} style={{ background: VS.bg2, borderRadius: 6, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: VS.text2, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: row.accent }}>{row.curr}</div>
                      <div style={{ fontSize: 11, color: VS.text2, marginTop: 2 }}>prev: {row.prev}</div>
                    </div>
                    <ChangePill value={row.change} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
