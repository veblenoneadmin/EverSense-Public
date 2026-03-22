// backend/lib/attendance-cron.js
// Checks every 1 minute — auto-clocks out sessions open longer than 9h 30m
// and sends notifications to the user + all ADMIN/OWNER/HALL_OF_JUSTICE members

import { prisma } from './prisma.js';
import { createNotification } from '../api/notifications.js';
import { broadcast } from './sse.js';

const DEFAULT_CLOCKOUT_MINUTES = 90;
const INTERVAL_MS = 60 * 1000; // every 1 minute

async function getClockoutSeconds(orgId) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT `value` FROM `org_integrations` WHERE orgId = ? AND `key` = ? LIMIT 1',
      orgId, 'auto_clockout_minutes'
    );
    const minutes = rows[0]?.value ? parseInt(rows[0].value) : DEFAULT_CLOCKOUT_MINUTES;
    return minutes * 60;
  } catch {
    return DEFAULT_CLOCKOUT_MINUTES * 60;
  }
}

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function runAutoClockout() {
  if (!process.env.DATABASE_URL) return;
  try {
    // Find all open attendance logs older than AUTO_CLOCKOUT_SECONDS
    // Use date arithmetic instead of TIMESTAMPDIFF+parameter to avoid Prisma BigInt binding issues
    // Use the maximum possible limit to get all open sessions, filter per-org below
    const overdueRows = await prisma.$queryRawUnsafe(
      `SELECT id, userId, orgId, timeIn
       FROM attendance_logs
       WHERE timeOut IS NULL
         AND timeIn <= DATE_SUB(NOW(), INTERVAL 15 MINUTE)`
    );

    if (!overdueRows.length) return;

    console.log(`[AttendanceCron] Auto-clocking out ${overdueRows.length} overdue session(s)`);

    for (const row of overdueRows) {
      try {
        const now = new Date();
        const timeIn = new Date(row.timeIn);
        const limitSeconds = await getClockoutSeconds(row.orgId);
        const elapsedSeconds = Math.floor((now.getTime() - timeIn.getTime()) / 1000);
        if (elapsedSeconds < limitSeconds) continue; // not overdue for this org
        const grossSeconds = Math.floor((now.getTime() - timeIn.getTime()) / 1000);

        // Clock out
        await prisma.$executeRawUnsafe(
          `UPDATE attendance_logs
           SET timeOut = ?, duration = ?, updatedAt = NOW(3)
           WHERE id = ? AND timeOut IS NULL`,
          now, grossSeconds, row.id
        );

        // Broadcast SSE so all connected clients (admin view) refresh immediately
        try { broadcast(row.orgId, 'attendance', { action: 'clock-out', userId: row.userId }); } catch { /* non-fatal */ }

        // Fetch user info
        let userName = 'Unknown';
        let userEmail = '';
        try {
          const userRows = await prisma.$queryRawUnsafe(
            'SELECT name, email FROM `User` WHERE id = ? LIMIT 1',
            row.userId
          );
          if (userRows.length) {
            userName = userRows[0].name || userRows[0].email;
            userEmail = userRows[0].email;
          }
        } catch { /* non-fatal */ }

        const durationStr = fmtDuration(grossSeconds);
        const clockInTime = timeIn.toLocaleTimeString('en-AU', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });

        // Notify the user themselves
        try {
          await createNotification({
            userId: row.userId,
            orgId:  row.orgId,
            title:  'Auto Clock-Out',
            body:   `You were automatically clocked out after ${durationStr} (clocked in at ${clockInTime}). Please review your attendance record.`,
            link:   '/attendance',
            type:   'warning',
          });
        } catch (e) {
          console.warn('[AttendanceCron] User notification error:', e.message);
        }

        // Notify all ADMIN / OWNER / HALL_OF_JUSTICE in the org
        try {
          const managers = await prisma.$queryRawUnsafe(
            `SELECT userId FROM memberships
             WHERE orgId = ? AND role IN ('OWNER','ADMIN','HALL_OF_JUSTICE') AND userId != ?`,
            row.orgId, row.userId
          );

          for (const mgr of managers) {
            await createNotification({
              userId: mgr.userId,
              orgId:  row.orgId,
              title:  `Auto Clock-Out: ${userName}`,
              body:   `${userName} (${userEmail}) was automatically clocked out after ${durationStr}. They clocked in at ${clockInTime} and did not manually clock out.`,
              link:   '/attendance',
              type:   'warning',
            });
          }
        } catch (e) {
          console.warn('[AttendanceCron] Manager notification error:', e.message);
        }

        console.log(`[AttendanceCron] ✅ Auto-clocked out ${userName} (${row.userId}) after ${durationStr}`);
      } catch (rowErr) {
        console.error(`[AttendanceCron] Failed to process session ${row.id}:`, rowErr.message);
      }
    }
  } catch (err) {
    console.error('[AttendanceCron] Error:', err.message);
  }
}

export function startAttendanceCron() {
  // Run once immediately on startup to catch any already-overdue sessions
  runAutoClockout();
  // Then run every 5 minutes via native setInterval (no external deps)
  setInterval(runAutoClockout, INTERVAL_MS);
  console.log('  ✅ Attendance auto-clockout started (every 1 min, limit: 9h30m)');
}
