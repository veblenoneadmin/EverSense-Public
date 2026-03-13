// backend/api/notifications.js — Notifications CRUD
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// ── Lazy table init ───────────────────────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `notifications` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `title` VARCHAR(500) NOT NULL,' +
      '  `body` TEXT NULL,' +
      '  `link` VARCHAR(500) NULL,' +
      '  `type` VARCHAR(50) NOT NULL DEFAULT \'info\',' +
      '  `isRead` TINYINT(1) NOT NULL DEFAULT 0,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  KEY `notif_userId_idx` (`userId`),' +
      '  KEY `notif_orgId_userId_idx` (`orgId`, `userId`),' +
      '  KEY `notif_createdAt_idx` (`createdAt`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tablesReady = true;
    console.log('[Notifications] Table ready');
  } catch (e) {
    console.error('[Notifications] Table init error:', e.message);
  }
}

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const limit = Math.min(parseInt(req.query.limit || '30'), 50);

    const notifications = await prisma.$queryRawUnsafe(
      'SELECT * FROM notifications WHERE userId = ? AND orgId = ? ORDER BY createdAt DESC LIMIT ?',
      req.user.id, req.orgId, limit
    );

    const unreadCount = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) as cnt FROM notifications WHERE userId = ? AND orgId = ? AND isRead = 0',
      req.user.id, req.orgId
    );

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        type: n.type,
        isRead: !!n.isRead,
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      })),
      unreadCount: Number(unreadCount[0]?.cnt ?? 0),
    });
  } catch (err) {
    console.error('[Notifications] list error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── PUT /api/notifications/read-all ──────────────────────────────────────────
router.put('/read-all', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    await prisma.$executeRawUnsafe(
      'UPDATE notifications SET isRead = 1 WHERE userId = ? AND orgId = ?',
      req.user.id, req.orgId
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[Notifications] read-all error:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// ── PUT /api/notifications/:id/read ──────────────────────────────────────────
router.put('/:id/read', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    await prisma.$executeRawUnsafe(
      'UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ? AND orgId = ?',
      req.params.id, req.user.id, req.orgId
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('[Notifications] read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ── POST /api/notifications (internal — called by other routes) ───────────────
router.post('/', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { userId, title, body, link, type = 'info' } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      'INSERT INTO notifications (id, userId, orgId, title, body, link, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(3))',
      id, userId, req.orgId, title, body || null, link || null, type
    );
    res.status(201).json({ id });
  } catch (err) {
    console.error('[Notifications] create error:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    await prisma.$executeRawUnsafe(
      'DELETE FROM notifications WHERE id = ? AND userId = ? AND orgId = ?',
      req.params.id, req.user.id, req.orgId
    );
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('[Notifications] delete error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;

// ── Helper exported for other routes to create notifications ─────────────────
export async function createNotification({ userId, orgId, title, body = null, link = null, type = 'info' }) {
  try {
    await ensureTables();
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      'INSERT INTO notifications (id, userId, orgId, title, body, link, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(3))',
      id, userId, orgId, title, body, link, type
    );
  } catch (e) {
    // Non-critical — don't throw
    console.error('[Notifications] createNotification error:', e.message);
  }
}
