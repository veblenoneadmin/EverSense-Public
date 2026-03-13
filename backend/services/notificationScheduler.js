// backend/services/notificationScheduler.js
// Hourly scheduler for time-based notifications:
//   08:00 AWST (00:00 UTC) — task due-soon alerts (due within 24h)
//   09:00 AWST (01:00 UTC) — task overdue alerts
//   17:00 AWST (09:00 UTC) — time-log reminder (no hours logged today)

import { prisma } from '../lib/prisma.js';
import { createNotification } from '../api/notifications.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function utcHour() {
  return new Date().getUTCHours();
}

function todayUTCRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  return { start, end };
}

// ── Job: task due-soon (runs at 00:00 UTC = 08:00 AWST) ──────────────────────
async function runDueSoonJob() {
  try {
    const now    = new Date();
    const in24h  = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Tasks due in the next 24h that are not yet completed
    const tasks = await prisma.$queryRawUnsafe(
      `SELECT id, title, dueDate, userId, orgId FROM macro_tasks
       WHERE dueDate > ? AND dueDate <= ? AND status NOT IN ('completed', 'done')
       AND dueDate IS NOT NULL`,
      now, in24h
    );

    for (const task of tasks) {
      if (!task.userId || !task.orgId) continue;
      const dueStr = new Date(task.dueDate).toLocaleString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      createNotification({
        userId: task.userId,
        orgId:  task.orgId,
        title:  `Due Soon: ${task.title}`,
        body:   `This task is due ${dueStr}. Make sure it's on track.`,
        link:   '/tasks',
        type:   'due_soon',
      });
    }

    if (tasks.length) console.log(`[NotifScheduler] due-soon: notified ${tasks.length} task(s)`);
  } catch (e) {
    console.error('[NotifScheduler] due-soon error:', e.message);
  }
}

// ── Job: task overdue (runs at 01:00 UTC = 09:00 AWST) ───────────────────────
async function runOverdueJob() {
  try {
    const now = new Date();

    const tasks = await prisma.$queryRawUnsafe(
      `SELECT t.id, t.title, t.dueDate, t.userId, t.orgId FROM macro_tasks t
       WHERE t.dueDate < ? AND t.status NOT IN ('completed', 'done')
       AND t.dueDate IS NOT NULL`,
      now
    );

    for (const task of tasks) {
      if (!task.userId || !task.orgId) continue;
      const dueStr = new Date(task.dueDate).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
      });

      // Notify the assignee
      createNotification({
        userId: task.userId,
        orgId:  task.orgId,
        title:  `Overdue: ${task.title}`,
        body:   `This task was due ${dueStr} and has not been completed yet.`,
        link:   '/tasks',
        type:   'overdue',
      });

      // Notify org admins/owners (non-fatal, fire-and-forget)
      prisma.membership.findMany({
        where:  { orgId: task.orgId, role: { in: ['OWNER', 'ADMIN'] } },
        select: { userId: true },
      }).then(admins => {
        for (const { userId: adminId } of admins) {
          if (adminId !== task.userId) {
            createNotification({
              userId: adminId,
              orgId:  task.orgId,
              title:  `Task Overdue: ${task.title}`,
              body:   `Assigned to a team member — was due ${dueStr}.`,
              link:   '/tasks',
              type:   'overdue',
            });
          }
        }
      }).catch(() => {});
    }

    if (tasks.length) console.log(`[NotifScheduler] overdue: notified for ${tasks.length} task(s)`);
  } catch (e) {
    console.error('[NotifScheduler] overdue error:', e.message);
  }
}

// ── Job: time-log reminder (runs at 09:00 UTC = 17:00 AWST) ─────────────────
async function runTimeReminderJob() {
  try {
    const { start, end } = todayUTCRange();

    // Find all STAFF + ADMIN members across all orgs
    const members = await prisma.membership.findMany({
      where:  { role: { in: ['STAFF', 'ADMIN'] } },
      select: { userId: true, orgId: true },
    });

    // Find users who already have a time log today
    const loggedToday = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT userId FROM time_logs WHERE startTime >= ? AND startTime <= ?`,
      start, end
    ).catch(() => []);

    const loggedIds = new Set(loggedToday.map(r => r.userId));

    let reminded = 0;
    for (const { userId, orgId } of members) {
      if (loggedIds.has(userId)) continue;
      createNotification({
        userId,
        orgId,
        title:  `Time Log Reminder`,
        body:   `You haven't logged any hours today. Don't forget to record your work.`,
        link:   '/timesheets',
        type:   'reminder',
      });
      reminded++;
    }

    if (reminded) console.log(`[NotifScheduler] time-reminder: notified ${reminded} member(s)`);
  } catch (e) {
    console.error('[NotifScheduler] time-reminder error:', e.message);
  }
}

// ── Hourly tick ───────────────────────────────────────────────────────────────
async function tick() {
  const h = utcHour();
  if (h === 0)  await runDueSoonJob();
  if (h === 1)  await runOverdueJob();
  if (h === 9)  await runTimeReminderJob();
}

// ── Start ─────────────────────────────────────────────────────────────────────
export function startNotificationScheduler() {
  console.log('[NotifScheduler] Started — hourly checks active');
  // Check immediately on startup (in case server restarted at the right hour)
  tick().catch(() => {});
  // Then check every hour
  setInterval(() => tick().catch(() => {}), 60 * 60 * 1000);
}
