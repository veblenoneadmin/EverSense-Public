// backend/api/leaves.js — Receives approved leave records synced from HRSense

import express from 'express';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Ensure leaves table exists (same raw-SQL pattern as other modules)
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
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
    tableReady = true;
    console.log('  ✅ leaves table ready');
  } catch (e) {
    console.warn('  ⚠️  leaves table:', e.message);
  }
}

// Middleware — verify INTERNAL_API_SECRET so only HRSense can call this
function requireInternalSecret(req, res, next) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.warn('[Leaves] INTERNAL_API_SECRET not set — rejecting request');
    return res.status(503).json({ error: 'Internal API not configured' });
  }
  const provided = req.headers['x-internal-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/leaves?userId=xxx&orgId=xxx — query synced leaves (internal use)
router.get('/', requireInternalSecret, async (req, res) => {
  try {
    await ensureTable();
    const { userId, orgId } = req.query;
    if (!userId && !orgId) return res.status(400).json({ error: 'userId or orgId is required' });

    const where = [];
    const params = [];
    if (userId) { where.push('userId = ?'); params.push(userId); }
    if (orgId)  { where.push('orgId = ?');  params.push(orgId); }

    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM leaves WHERE ${where.join(' AND ')} ORDER BY startDate DESC LIMIT 100`,
      ...params
    );
    res.json({ leaves: rows });
  } catch (err) {
    console.error('[Leaves] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leaves — receive approved leave from HRSense
router.post('/', requireInternalSecret, async (req, res) => {
  try {
    await ensureTable();

    const { userId, type, status = 'APPROVED', startDate, endDate, days, reason, approvedAt } = req.body;

    if (!userId || !type || !startDate || !endDate || !days) {
      return res.status(400).json({ error: 'userId, type, startDate, endDate and days are required' });
    }

    // Look up the user's orgId from their membership
    const membership = await prisma.membership.findFirst({
      where: { userId },
      select: { orgId: true },
    });

    if (!membership) {
      console.warn(`[Leaves] No membership found for userId=${userId} — leave not stored`);
      return res.status(404).json({ error: `No org membership found for user ${userId}` });
    }

    const orgId = membership.orgId;
    const id = randomUUID();

    await prisma.$executeRawUnsafe(
      'INSERT INTO leaves (id, userId, orgId, type, status, startDate, endDate, days, reason, approvedAt, createdAt) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      id,
      userId,
      orgId,
      type,
      status,
      new Date(startDate),
      new Date(endDate),
      Number(days),
      reason || null,
      approvedAt ? new Date(approvedAt) : new Date(),
    );

    console.log(`[Leaves] ✅ Synced leave: userId=${userId} orgId=${orgId} type=${type} days=${days} (${startDate} → ${endDate})`);
    res.status(201).json({ success: true, id, orgId });

  } catch (err) {
    console.error('[Leaves] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
