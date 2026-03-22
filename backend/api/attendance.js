// backend/api/attendance.js — Clock In / Clock Out API
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';
import { randomUUID } from 'crypto';
import { broadcast } from '../lib/sse.js';

const router = express.Router();

const BREAK_LIMIT = 1800;  // 30 minutes in seconds
const WORK_DAY    = 8 * 3600; // 8-hour standard day in seconds

// ── One-time startup: create attendance_logs table and ensure columns ─────────
async function ensureAttendanceTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id            VARCHAR(50)  NOT NULL PRIMARY KEY,
        userId        VARCHAR(36)  NOT NULL,
        orgId         VARCHAR(191) NOT NULL,
        timeIn        DATETIME(3)  NOT NULL,
        timeOut       DATETIME(3)  NULL,
        duration      INT          NOT NULL DEFAULT 0,
        breakDuration INT          NOT NULL DEFAULT 0,
        notes         LONGTEXT     NULL,
        date          VARCHAR(10)  NOT NULL,
        createdAt     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX attendance_logs_userId_idx (userId),
        INDEX attendance_logs_orgId_idx  (orgId)
      )
    `);
  } catch {
    // Table already exists — silently ignore
  }
  // Add breakDuration column to existing tables (MySQL < 8 doesn't support IF NOT EXISTS on ADD COLUMN)
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE attendance_logs ADD COLUMN breakDuration INT NOT NULL DEFAULT 0'
    );
  } catch {
    // Column already exists — silently ignore
  }
}

async function ensureLeavesTable() {
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `leaves` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `type` VARCHAR(50) NOT NULL,' +
      '  `status` VARCHAR(20) NOT NULL DEFAULT \'APPROVED\',' +
      '  `startDate` DATETIME(3) NOT NULL,' +
      '  `endDate` DATETIME(3) NOT NULL,' +
      '  `days` INT NOT NULL,' +
      '  `reason` TEXT NULL,' +
      '  `approvedAt` DATETIME(3) NULL,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `leaves_userId_idx` (`userId`),' +
      '  KEY `leaves_orgId_idx` (`orgId`),' +
      '  KEY `leaves_userId_startDate_idx` (`userId`, `startDate`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
  } catch { /* already exists */ }
}

ensureAttendanceTable();
ensureLeavesTable();

// ── Helper: today's date string YYYY-MM-DD ────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── GET /api/attendance/status ────────────────────────────────────────────────
router.get('/status', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;

    const active = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
      orderBy: { timeIn: 'desc' },
    });

    res.json({ clockedIn: !!active, active: active || null, activeLog: active || null });
  } catch (err) {
    console.error('[Attendance] status error:', err);
    res.status(500).json({ error: 'Failed to get attendance status' });
  }
});

// ── POST /api/attendance/clock-in (alias: /time-in) ──────────────────────────
async function handleClockIn(req, res) {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { notes } = req.body;

    const existing = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
    });
    if (existing) {
      return res.status(400).json({ error: 'Already clocked in', activeLog: existing });
    }

    const id  = randomUUID();
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO attendance_logs (id, userId, orgId, timeIn, duration, breakDuration, notes, date, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, NOW(3), NOW(3))`,
      id, userId, orgId, now, notes || null, todayStr()
    );

    const log = await prisma.attendanceLog.findUnique({ where: { id } });
    console.log(`[Attendance] ✅ Clock in: ${req.user.email} at ${now}`);
    broadcast(orgId, 'attendance', { action: 'clock-in', userId });
    res.status(201).json({ message: 'Clocked in successfully', log });
  } catch (err) {
    console.error('[Attendance] clock-in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
}
router.post('/clock-in', requireAuth, withOrgScope, handleClockIn);
router.post('/time-in',  requireAuth, withOrgScope, handleClockIn);

// ── POST /api/attendance/clock-out (alias: /time-out) ────────────────────────
async function handleClockOut(req, res) {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const { notes, breakDuration: rawBreak } = req.body;

    const active = await prisma.attendanceLog.findFirst({
      where: { userId, orgId, timeOut: null },
      orderBy: { timeIn: 'desc' },
    });

    if (!active) {
      return res.status(400).json({ error: 'Not currently clocked in' });
    }

    const now           = new Date();
    const grossDuration = Math.floor((now.getTime() - new Date(active.timeIn).getTime()) / 1000);
    const breakDuration = Math.max(0, parseInt(rawBreak) || 0);
    const duration      = Math.max(0, grossDuration - breakDuration);

    await prisma.$executeRawUnsafe(
      `UPDATE attendance_logs SET timeOut=?, duration=?, breakDuration=?, notes=?, updatedAt=NOW(3) WHERE id=?`,
      now, duration, breakDuration, notes || active.notes, active.id
    );

    const log = await prisma.attendanceLog.findUnique({ where: { id: active.id } });
    console.log(`[Attendance] ✅ Clock out: ${req.user.email}, net ${Math.round(duration/60)}min, break ${Math.round(breakDuration/60)}min`);
    broadcast(orgId, 'attendance', { action: 'clock-out', userId });
    res.json({ message: 'Clocked out successfully', log });
  } catch (err) {
    console.error('[Attendance] clock-out error:', err);
    res.status(500).json({ error: 'Failed to clock out' });
  }
}
router.post('/clock-out', requireAuth, withOrgScope, handleClockOut);
router.post('/time-out',  requireAuth, withOrgScope, handleClockOut);

// ── GET /api/attendance/logs — fetch logs (role-aware) ───────────────────────
router.get('/logs', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId  = req.orgId;
    const limit  = Math.min(parseInt(req.query.limit || '1000'), 2000);

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    const role         = membership?.role || 'STAFF';
    const isPrivileged = role === 'OWNER' || role === 'ADMIN' || role === 'HALL_OF_JUSTICE';
    const isClient     = role === 'CLIENT';

    // CLIENT — build list of staff userIds assigned to their projects
    let clientStaffIds = null; // null means use default (own only)
    if (isClient) {
      let clientRecord = null;
      // 1) Try user_id column lookup
      try {
        const rows = await prisma.$queryRawUnsafe(
          'SELECT id FROM clients WHERE user_id = ? AND orgId = ? LIMIT 1',
          userId, orgId
        );
        if (rows.length) clientRecord = rows[0];
      } catch { /* user_id column not yet added — fall through */ }

      // 2) Email fallback if user_id lookup found nothing
      if (!clientRecord) {
        try {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
          if (user?.email) {
            const rows = await prisma.$queryRawUnsafe(
              'SELECT id FROM clients WHERE LOWER(email) = LOWER(?) AND orgId = ? LIMIT 1',
              user.email, orgId
            );
            if (rows.length) clientRecord = rows[0];
          }
        } catch (e) { console.warn('[Attendance] client email lookup failed:', e.message); }
      }

      if (clientRecord) {
        try {
          const projects = await prisma.project.findMany({
            where: { clientId: clientRecord.id, orgId },
            select: { id: true },
          });
          if (projects.length) {
            const tasks = await prisma.macroTask.findMany({
              where: { projectId: { in: projects.map(p => p.id) }, orgId },
              select: { userId: true },
            });
            const staffIds = [...new Set(tasks.map(t => t.userId).filter(Boolean))];
            clientStaffIds = [...new Set([userId, ...staffIds])];
          }
        } catch (e) { console.warn('[Attendance] project/task lookup failed:', e.message); }
      }
      if (!clientStaffIds) clientStaffIds = [userId];
    }

    // Fetch logs (no JOIN — avoids collation issues with user table)
    const logs = await prisma.attendanceLog.findMany({
      where: isPrivileged
        ? { orgId }
        : clientStaffIds
          ? { userId: { in: clientStaffIds }, orgId }
          : { userId, orgId },
      orderBy: { timeIn: 'desc' },
      take:    limit,
    });

    // Collect user IDs from logs — leave user IDs added after leaves are fetched
    const logUserIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
    const usersMap = {};
    if (logUserIds.length) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: logUserIds } },
          select: { id: true, name: true, email: true, image: true },
        });
        users.forEach(u => { usersMap[u.id] = u; });
      } catch { /* non-fatal */ }
    }

    // Role map for privileged view or client multi-user view
    const roleMap = {};
    if (isPrivileged || (isClient && clientStaffIds && clientStaffIds.length > 1)) {
      try {
        const memberships = await prisma.membership.findMany({
          where: isPrivileged ? { orgId } : { userId: { in: clientStaffIds }, orgId },
          select: { userId: true, role: true },
        });
        memberships.forEach(m => { roleMap[m.userId] = m.role; });
      } catch { /* non-fatal */ }
    }

    // CLIENT sees a "team" view when they have project staff
    const showTeamView = isPrivileged || (isClient && clientStaffIds && clientStaffIds.length > 1);

    // For privileged users, also return all org members so frontend can show "not clocked in" rows
    let allMembers = [];
    if (isPrivileged) {
      try {
        const memberships = await prisma.membership.findMany({
          where: { orgId },
          select: { userId: true, role: true },
        });
        const memberUserIds = memberships.map(m => m.userId);
        const memberUsers = await prisma.user.findMany({
          where: { id: { in: memberUserIds } },
          select: { id: true, name: true, email: true, image: true },
        });
        const memberUserMap = {};
        memberUsers.forEach(u => { memberUserMap[u.id] = u; });
        allMembers = memberships.map(m => ({
          id: m.userId,
          name: memberUserMap[m.userId]?.name || memberUserMap[m.userId]?.email || 'Unknown',
          email: memberUserMap[m.userId]?.email || '',
          image: memberUserMap[m.userId]?.image || null,
          role: m.role,
        }));
      } catch { /* non-fatal */ }
    }

    // Fetch approved leaves for the same scope
    let leaves = [];
    try {
      const leaveUserIds = isPrivileged ? null : clientStaffIds || [userId];
      let leaveSql, leaveParams;
      if (isPrivileged) {
        leaveSql = 'SELECT id, userId, orgId, type, status, startDate, endDate, days, reason FROM leaves WHERE orgId = ? AND status = ? ORDER BY startDate DESC LIMIT 500';
        leaveParams = [orgId, 'APPROVED'];
      } else {
        const ph = leaveUserIds.map(() => '?').join(',');
        leaveSql = `SELECT id, userId, orgId, type, status, startDate, endDate, days, reason FROM leaves WHERE orgId = ? AND userId IN (${ph}) AND status = ? ORDER BY startDate DESC LIMIT 500`;
        leaveParams = [orgId, ...leaveUserIds, 'APPROVED'];
      }
      const rawLeaves = await prisma.$queryRawUnsafe(leaveSql, ...leaveParams);

      // Build a rich user lookup: allMembers already has everyone for privileged; also merge usersMap
      const richUserMap = {};
      allMembers.forEach(m => { richUserMap[m.id] = { name: m.name, email: m.email, image: m.image }; });
      Object.entries(usersMap).forEach(([id, u]) => { if (!richUserMap[id]) richUserMap[id] = u; });

      // If any leave user is still missing, fetch them now
      const missingIds = rawLeaves.map(l => l.userId).filter(id => !richUserMap[id]);
      if (missingIds.length) {
        try {
          const extra = await prisma.user.findMany({
            where: { id: { in: [...new Set(missingIds)] } },
            select: { id: true, name: true, email: true, image: true },
          });
          extra.forEach(u => { richUserMap[u.id] = u; });
        } catch { /* non-fatal */ }
      }

      leaves = rawLeaves.map(l => {
        const u = richUserMap[l.userId];
        return {
          id:          l.id,
          userId:      l.userId,
          type:        l.type,
          status:      l.status,
          startDate:   l.startDate instanceof Date ? l.startDate.toISOString() : l.startDate,
          endDate:     l.endDate   instanceof Date ? l.endDate.toISOString()   : l.endDate,
          days:        Number(l.days),
          reason:      l.reason || null,
          memberName:  u?.name || u?.email || 'Unknown',
          memberEmail: u?.email || '',
          memberImage: u?.image || null,
          memberRole:  roleMap[l.userId] || role,
        };
      });
      console.log(`[Attendance] leaves fetched: ${rawLeaves.length} record(s) for orgId=${orgId}`);
    } catch (e) { console.error('[Attendance] leaves fetch failed:', e.message); }

    return res.json({
      role,
      isPrivileged: showTeamView,
      allMembers,
      leaves,
      logs: logs.map(l => formatLog(l, usersMap[l.userId], roleMap[l.userId] || role)),
    });
  } catch (err) {
    console.error('[Attendance] logs error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance logs' });
  }
});

// ── Format a log record for the API response ──────────────────────────────────
function formatLog(log, user, memberRole) {
  const breakDuration = log.breakDuration || 0;
  const overBreak     = Math.max(0, breakDuration - BREAK_LIMIT);
  const overtime      = log.timeOut ? Math.max(0, (log.duration || 0) - WORK_DAY) : 0;
  const durationMins  = log.duration ? Math.round(log.duration / 60) : null;

  return {
    id:            log.id,
    date:          log.date,
    timeIn:        log.timeIn,
    timeOut:       log.timeOut,
    duration:      log.duration,
    durationMins,
    breakDuration,
    overBreak,
    overtime,
    notes:         log.notes,
    isActive:      !log.timeOut,
    memberId:      log.userId,
    memberName:    user?.name || user?.email || 'Unknown',
    memberEmail:   user?.email || '',
    memberImage:   user?.image || null,
    memberRole,
  };
}

// ── GET /api/attendance/today ─────────────────────────────────────────────────
router.get('/today', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const orgId  = req.orgId;
    const today  = new Date().toISOString().split('T')[0];

    const logs = await prisma.attendanceLog.findMany({
      where: { userId, orgId, date: today },
      orderBy: { timeIn: 'asc' },
    });

    const totalSeconds = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
    res.json({ logs, totalSeconds });
  } catch (err) {
    console.error('[Attendance] today error:', err);
    res.status(500).json({ error: 'Failed to fetch today logs' });
  }
});

// ── GET /api/attendance/history ───────────────────────────────────────────────
router.get('/history', requireAuth, withOrgScope, async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const orgId  = req.orgId;
    const limit  = Math.min(parseInt(req.query.limit || '10'), 100);

    const logs = await prisma.attendanceLog.findMany({
      where: { userId, orgId },
      orderBy: { timeIn: 'desc' },
      take: limit,
    });

    res.json({ logs });
  } catch (err) {
    console.error('[Attendance] history error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ── PATCH /api/attendance/logs/:id/break — admin sets break duration ──────────
router.patch('/logs/:id/break', requireAuth, withOrgScope, async (req, res) => {
  try {
    const orgId = req.orgId;

    // Only ADMIN / OWNER / HALL_OF_JUSTICE may edit breaks
    const membership = await prisma.$queryRawUnsafe(
      'SELECT role FROM memberships WHERE userId = ? AND orgId = ? LIMIT 1',
      req.user.id, orgId
    );
    const role = membership[0]?.role || 'STAFF';
    if (!['OWNER', 'ADMIN', 'HALL_OF_JUSTICE'].includes(role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const { breakHours = 0, breakMinutes = 0 } = req.body;
    const breakSecs = Math.max(0, Math.floor(Number(breakHours) * 3600 + Number(breakMinutes) * 60));

    // Fetch the log to recalculate net duration
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, orgId, timeIn, timeOut FROM attendance_logs WHERE id = ? AND orgId = ? LIMIT 1',
      req.params.id, orgId
    );
    if (!rows.length) return res.status(404).json({ error: 'Log not found' });

    const log = rows[0];
    let duration = 0;
    if (log.timeOut) {
      const gross = Math.floor((new Date(log.timeOut).getTime() - new Date(log.timeIn).getTime()) / 1000);
      duration = Math.max(0, gross - breakSecs);
    }

    await prisma.$executeRawUnsafe(
      'UPDATE attendance_logs SET breakDuration = ?, duration = ?, updatedAt = NOW(3) WHERE id = ? AND orgId = ?',
      breakSecs, duration, log.id, orgId
    );

    res.json({ success: true, breakDuration: breakSecs, duration });
  } catch (err) {
    console.error('[Attendance] patch break error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/policy — get org break policy ────────────────────────
router.get('/policy', requireAuth, withOrgScope, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT `key`, `value` FROM `org_integrations` WHERE orgId = ? AND `key` IN (?, ?)',
      req.orgId, 'break_limit_secs', 'break_count_per_day'
    );
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      breakLimitSecs:    parseInt(map.break_limit_secs   ?? '1800'),
      breakCountPerDay:  parseInt(map.break_count_per_day ?? '1'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/attendance/policy — admin saves org break policy ─────────────────
router.put('/policy', requireAuth, withOrgScope, async (req, res) => {
  try {
    const membership = await prisma.$queryRawUnsafe(
      'SELECT role FROM memberships WHERE userId = ? AND orgId = ? LIMIT 1',
      req.user.id, req.orgId
    );
    const role = membership[0]?.role || 'STAFF';
    if (!['OWNER', 'ADMIN', 'HALL_OF_JUSTICE'].includes(role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const { breakLimitSecs, breakCountPerDay } = req.body;
    const limitSecs = Math.max(0, parseInt(breakLimitSecs) || 1800);
    const countDay  = Math.max(1, parseInt(breakCountPerDay) || 1);

    const upsert = async (key, value) => {
      const { randomBytes } = await import('crypto');
      const id = randomBytes(8).toString('hex');
      await prisma.$executeRawUnsafe(
        'INSERT INTO `org_integrations` (id, orgId, `key`, `value`) VALUES (?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updatedAt = NOW(3)',
        id, req.orgId, key, String(value)
      );
    };

    await upsert('break_limit_secs',    limitSecs);
    await upsert('break_count_per_day', countDay);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/attendance/settings ─────────────────────────────────────────────
router.get('/settings', requireAuth, withOrgScope, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT `value` FROM `org_integrations` WHERE orgId = ? AND `key` = ? LIMIT 1',
      req.orgId, 'auto_clockout_minutes'
    );
    const minutes = rows[0]?.value ? parseInt(rows[0].value) : 90;
    res.json({ autoClockoutMinutes: minutes });
  } catch (e) {
    res.json({ autoClockoutMinutes: 90 });
  }
});

// ── PUT /api/attendance/settings ─────────────────────────────────────────────
router.put('/settings', requireAuth, withOrgScope, async (req, res) => {
  try {
    const { autoClockoutMinutes } = req.body;
    const minutes = Math.max(15, Math.min(1440, parseInt(autoClockoutMinutes) || 90));
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      'INSERT INTO `org_integrations` (id, orgId, `key`, `value`) VALUES (?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updatedAt` = NOW(3)',
      id, req.orgId, 'auto_clockout_minutes', String(minutes)
    );
    res.json({ autoClockoutMinutes: minutes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
