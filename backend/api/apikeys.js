import express from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// ── Lazy table init ────────────────────────────────────────────────────────────
let tableReady = false;
async function ensureApiKeysTable() {
  if (tableReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS api_keys (' +
      '  id          VARCHAR(191) NOT NULL,' +
      '  `key`       VARCHAR(128) NOT NULL,' +
      '  name        VARCHAR(255) NOT NULL,' +
      '  orgId       VARCHAR(191) NOT NULL,' +
      '  userId      VARCHAR(36)  NOT NULL,' +
      '  lastUsedAt  DATETIME(3)  NULL,' +
      '  revokedAt   DATETIME(3)  NULL,' +
      '  createdAt   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (id),' +
      '  UNIQUE KEY api_keys_key_unique (`key`),' +
      '  KEY api_keys_orgId_idx (orgId),' +
      '  KEY api_keys_userId_idx (userId)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tableReady = true;
  } catch (_) {
    tableReady = true;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateKey() {
  return 'es_' + randomBytes(32).toString('hex');
}

async function isAdminOrOwner(userId, orgId) {
  const membership = await prisma.membership.findFirst({
    where: { userId, orgId },
    select: { role: true },
  });
  return membership && ['OWNER', 'ADMIN', 'HALL_OF_JUSTICE'].includes(membership.role);
}

// ── POST /api/apikeys — Generate a new API key ─────────────────────────────────
router.post('/', requireAuth, withOrgScope, async (req, res) => {
  await ensureApiKeysTable();
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Only OWNER or ADMIN can generate keys
    if (!(await isAdminOrOwner(req.user.id, req.orgId))) {
      return res.status(403).json({ error: 'Only Admins and Owners can generate API keys' });
    }

    const id = randomBytes(12).toString('hex');
    const key = generateKey();

    await prisma.$executeRawUnsafe(
      `INSERT INTO api_keys (id, \`key\`, name, orgId, userId, createdAt)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      id, key, name.trim(), req.orgId, req.user.id
    );

    console.log(`🔑 API key created: "${name}" by ${req.user.email}`);

    // Return the key ONCE — it will never be shown again
    res.status(201).json({
      success: true,
      message: 'API key created. Copy it now — it will not be shown again.',
      apiKey: {
        id,
        name: name.trim(),
        key, // ← shown only on creation
        orgId: req.orgId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[apikeys] create error:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// ── GET /api/apikeys — List API keys for the org ───────────────────────────────
router.get('/', requireAuth, withOrgScope, async (req, res) => {
  await ensureApiKeysTable();
  try {
    if (!(await isAdminOrOwner(req.user.id, req.orgId))) {
      return res.status(403).json({ error: 'Only Admins and Owners can view API keys' });
    }

    const keys = await prisma.$queryRawUnsafe(
      `SELECT ak.id, ak.name, ak.orgId, ak.lastUsedAt, ak.revokedAt, ak.createdAt,
              u.name as createdByName, u.email as createdByEmail,
              CONCAT(LEFT(ak.\`key\`, 10), '...') as keyPreview
       FROM api_keys ak
       JOIN User u ON u.id = ak.userId
       WHERE ak.orgId = ?
       ORDER BY ak.createdAt DESC`,
      req.orgId
    );

    res.json({
      success: true,
      apiKeys: keys.map(k => ({
        id: k.id,
        name: k.name,
        keyPreview: k.keyPreview,
        createdBy: { name: k.createdByName, email: k.createdByEmail },
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
        isActive: !k.revokedAt,
        createdAt: k.createdAt,
      })),
    });
  } catch (err) {
    console.error('[apikeys] list error:', err);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// ── DELETE /api/apikeys/:id — Revoke an API key ────────────────────────────────
router.delete('/:id', requireAuth, withOrgScope, async (req, res) => {
  await ensureApiKeysTable();
  try {
    if (!(await isAdminOrOwner(req.user.id, req.orgId))) {
      return res.status(403).json({ error: 'Only Admins and Owners can revoke API keys' });
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM api_keys WHERE id = ? AND orgId = ? LIMIT 1`,
      req.params.id, req.orgId
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE api_keys SET revokedAt = NOW() WHERE id = ?`,
      req.params.id
    );

    console.log(`🔑 API key revoked: "${existing[0].name}" by ${req.user.email}`);

    res.json({ success: true, message: `API key "${existing[0].name}" has been revoked` });
  } catch (err) {
    console.error('[apikeys] revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;