// backend/services/kpiEmailScheduler.js
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Mailer setup ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Fetch KPI data (matches your exact Prisma schema) ────────────────────────
async function getKPIData(orgId, period) {
  const now = new Date();
  let start, end, label;

  if (period === 'daily') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    label = `Daily Report — ${now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  } else if (period === 'weekly') {
    const day = now.getDay();
    start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
    end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    label = `Weekly Report — w/e ${end.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    label = `Monthly Report — ${now.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`;
  }

  // Membership model, orgId field, include user relation
  const memberships = await prisma.membership.findMany({
    where: { orgId },
    include: { user: true },
  });

  // MacroTask model (not 'task'), orgId field
  const tasks = await prisma.macroTask.findMany({
    where: {
      orgId,
      createdAt: { gte: start, lte: end },
    },
  });

  // TimeLog model, uses 'begin' field (not 'startTime')
  const timeLogs = await prisma.timeLog.findMany({
    where: {
      orgId,
      begin: { gte: start, lte: end },
    },
  });

  // Org-level KPIs
  const totalHours     = timeLogs.reduce((sum, e) => sum + (e.duration ? e.duration / 3600 : 0), 0);
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overdueTasks   = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const billableHours  = timeLogs.filter(e => e.isBillable).reduce((sum, e) => sum + (e.duration ? e.duration / 3600 : 0), 0);
  const billableRatio  = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

  // Per-member stats (exclude CLIENT role)
  const memberStats = memberships
    .filter(m => m.role !== 'CLIENT')
    .map(m => {
      const userLogs  = timeLogs.filter(e => e.userId === m.userId);
      const userTasks = tasks.filter(t => t.userId === m.userId);
      const hours     = parseFloat(userLogs.reduce((s, e) => s + (e.duration ? e.duration / 3600 : 0), 0).toFixed(1));
      const done      = userTasks.filter(t => t.status === 'completed').length;
      const overdue   = userTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
      const rate      = userTasks.length > 0 ? Math.round((done / userTasks.length) * 100) : 0;
      return { name: m.user.name || m.user.email, role: m.role, hours, tasks: userTasks.length, completed: done, overdue, rate };
    })
    .filter(m => m.hours > 0 || m.tasks > 0)
    .sort((a, b) => b.hours - a.hours);

  return {
    label, period,
    dateRange: { start, end },
    orgKPIs: {
      totalHours:         parseFloat(totalHours.toFixed(1)),
      totalCompleted:     completedTasks,
      totalTasks:         tasks.length,
      totalOverdue:       overdueTasks,
      taskCompletionRate: completionRate,
      billableHours:      parseFloat(billableHours.toFixed(1)),
      billableRatio,
      activeMembers:      memberStats.length,
      totalMembers:       memberships.filter(m => m.role !== 'CLIENT').length,
    },
    memberStats,
  };
}

// ── HTML email template ───────────────────────────────────────────────────────
function buildEmailHTML(orgName, kpiData) {
  const { label, orgKPIs: o, memberStats } = kpiData;

  const statBox = (value, title, color) => `
    <td style="width:25%;padding:8px;">
      <div style="background:#1e1e1e;border:1px solid #3c3c3c;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:${color};font-family:monospace;">${value}</div>
        <div style="font-size:11px;color:#909090;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">${title}</div>
      </div>
    </td>`;

  const memberRow = (m, i) => `
    <tr style="border-bottom:1px solid #2d2d2d;">
      <td style="padding:10px 12px;font-size:13px;color:#c0c0c0;">${i + 1}. ${m.name}</td>
      <td style="padding:10px 12px;font-size:12px;color:#909090;text-transform:capitalize;">${m.role.toLowerCase()}</td>
      <td style="padding:10px 12px;font-size:13px;color:#569cd6;font-weight:600;text-align:right;">${m.hours}h</td>
      <td style="padding:10px 12px;font-size:13px;color:#4ec9b0;font-weight:600;text-align:right;">${m.rate}%</td>
      <td style="padding:10px 12px;font-size:13px;color:${m.overdue > 0 ? '#f44747' : '#4ec9b0'};font-weight:600;text-align:right;">${m.overdue}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#141414;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#1e1e1e;border:1px solid #3c3c3c;border-radius:12px;padding:28px;margin-bottom:16px;">
      <div style="margin-bottom:6px;"><span style="font-size:11px;color:#909090;text-transform:uppercase;letter-spacing:2px;">KPI Intelligence Report</span></div>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#f0f0f0;">${orgName}</h1>
      <p style="margin:0;font-size:13px;color:#909090;">${label} · Auto-generated at 5:00 PM AWST</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr>
      ${statBox(`${o.totalHours}h`, 'Total Hours', '#569cd6')}
      ${statBox(`${o.taskCompletionRate}%`, 'Completion Rate', '#dcdcaa')}
      ${statBox(`${o.totalOverdue}`, 'Overdue Tasks', o.totalOverdue > 0 ? '#f44747' : '#4ec9b0')}
      ${statBox(`${o.billableRatio}%`, 'Billable Ratio', '#ce9178')}
    </tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr>
      ${statBox(`${o.totalCompleted}/${o.totalTasks}`, 'Tasks Done', '#4ec9b0')}
      ${statBox(`${o.billableHours}h`, 'Billable Hours', '#ce9178')}
      ${statBox(`${o.activeMembers}/${o.totalMembers}`, 'Active Members', '#c586c0')}
      ${statBox('AWST', '5PM Daily', '#007acc')}
    </tr></table>
    ${memberStats.length > 0 ? `
    <div style="background:#1e1e1e;border:1px solid #3c3c3c;border-radius:12px;overflow:hidden;margin-bottom:16px;">
      <div style="padding:16px;border-bottom:1px solid #2d2d2d;"><span style="font-size:13px;font-weight:700;color:#f0f0f0;">Team Performance</span></div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <thead><tr style="background:#252526;">
          <th style="padding:8px 12px;font-size:10px;color:#909090;text-align:left;text-transform:uppercase;letter-spacing:1px;">Member</th>
          <th style="padding:8px 12px;font-size:10px;color:#909090;text-align:left;text-transform:uppercase;letter-spacing:1px;">Role</th>
          <th style="padding:8px 12px;font-size:10px;color:#909090;text-align:right;text-transform:uppercase;letter-spacing:1px;">Hours</th>
          <th style="padding:8px 12px;font-size:10px;color:#909090;text-align:right;text-transform:uppercase;letter-spacing:1px;">Done%</th>
          <th style="padding:8px 12px;font-size:10px;color:#909090;text-align:right;text-transform:uppercase;letter-spacing:1px;">Overdue</th>
        </tr></thead>
        <tbody>${memberStats.map((m, i) => memberRow(m, i)).join('')}</tbody>
      </table>
    </div>` : `<div style="background:#1e1e1e;border:1px solid #3c3c3c;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px;"><span style="color:#909090;font-size:13px;">No activity recorded this period.</span></div>`}
    ${o.totalOverdue > 0 ? `
    <div style="background:#1e1e1e;border:1px solid rgba(244,71,71,0.3);border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#f44747;margin-bottom:10px;">⚠ Overdue Tasks Require Attention</div>
      ${memberStats.filter(m => m.overdue > 0).map(m => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2d2d2d;">
          <span style="font-size:12px;color:#c0c0c0;">${m.name}</span>
          <span style="font-size:12px;color:#f44747;font-weight:600;">${m.overdue} overdue</span>
        </div>`).join('')}
    </div>` : ''}
    <div style="text-align:center;padding:16px;">
      <p style="margin:0;font-size:11px;color:#555;">Sent automatically by VebTask · 5:00 PM AWST<br>
      <span style="color:#333;">You're receiving this as the owner of ${orgName}</span></p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send KPI email for one org ────────────────────────────────────────────────
async function sendKPIEmail(org, period) {
  try {
    const kpiData = await getKPIData(org.id, period);

    // Role enum is 'OWNER' (uppercase) per schema.prisma
    const owners = await prisma.membership.findMany({
      where: { orgId: org.id, role: 'OWNER' },
      include: { user: true },
    });

    if (owners.length === 0) {
      console.log(`[KPI Scheduler] No owners found for org: ${org.name}, skipping.`);
      return;
    }

    const toEmails    = owners.map(o => o.user.email).filter(Boolean);
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

    await transporter.sendMail({
      from:    `"VebTask Reports" <${process.env.SMTP_USER}>`,
      to:      toEmails.join(', '),
      subject: `📊 ${periodLabel} KPI Report — ${org.name}`,
      html:    buildEmailHTML(org.name, kpiData),
    });

    console.log(`[KPI Scheduler] ✅ ${periodLabel} email sent to ${toEmails.join(', ')} for org: ${org.name}`);
  } catch (err) {
    console.error(`[KPI Scheduler] ❌ Failed for org ${org.id}:`, err.message);
  }
}

// ── Send to all orgs ──────────────────────────────────────────────────────────
async function sendAllOrgs(period) {
  const orgs = await prisma.organization.findMany();
  console.log(`[KPI Scheduler] Sending ${period} reports to ${orgs.length} org(s)...`);
  await Promise.allSettled(orgs.map(org => sendKPIEmail(org, period)));
}

// ── Cron jobs — 5PM AWST (Perth) = 09:00 UTC ─────────────────────────────────
export function startKPIScheduler() {
  cron.schedule('0 9 * * *', () => sendAllOrgs('daily'),   { timezone: 'UTC' }); // daily
  cron.schedule('0 9 * * 1', () => sendAllOrgs('weekly'),  { timezone: 'UTC' }); // every Monday
  cron.schedule('0 9 1 * *', () => sendAllOrgs('monthly'), { timezone: 'UTC' }); // 1st of month
  console.log('[KPI Scheduler] ✅ Scheduled — Daily, Weekly & Monthly at 5PM AWST (09:00 UTC)');
}