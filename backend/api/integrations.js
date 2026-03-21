// backend/api/integrations.js — Integrations settings: Fireflies API key + Google Calendar OAuth

import express from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope } from '../lib/rbac.js';

const router = express.Router();

// ── Table setup ───────────────────────────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `org_integrations` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `key` VARCHAR(100) NOT NULL,' +
      '  `value` TEXT NULL,' +
      '  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `oi_org_key` (`orgId`, `key`),' +
      '  KEY `oi_orgId_idx` (`orgId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `user_google_tokens` (' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `accessToken` TEXT NOT NULL,' +
      '  `refreshToken` TEXT NULL,' +
      '  `expiresAt` DATETIME(3) NULL,' +
      '  `scope` VARCHAR(500) NULL,' +
      '  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`userId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `oauth_states` (' +
      '  `state` VARCHAR(64) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  `expiresAt` DATETIME(3) NOT NULL,' +
      '  PRIMARY KEY (`state`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    tablesReady = true;
  } catch (_e) { /* tables likely exist */ }
}

// ── Pending OAuth state store (DB-backed, 10min TTL) ─────────────────────────
async function saveOAuthState(state, userId, orgId) {
  await ensureTables();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.$executeRawUnsafe(
    'INSERT INTO `oauth_states` (state, userId, orgId, expiresAt) VALUES (?, ?, ?, ?) ' +
    'ON DUPLICATE KEY UPDATE userId=VALUES(userId), orgId=VALUES(orgId), expiresAt=VALUES(expiresAt)',
    state, userId, orgId, expiresAt
  );
}

async function getOAuthState(state) {
  await ensureTables();
  const rows = await prisma.$queryRawUnsafe(
    'SELECT userId, orgId FROM `oauth_states` WHERE state = ? AND expiresAt > NOW() LIMIT 1',
    state
  );
  await prisma.$executeRawUnsafe('DELETE FROM `oauth_states` WHERE state = ?', state);
  return rows[0] || null;
}

function cleanOldStates() { /* no-op, DB handles expiry */ }

// ── GET /api/integrations/status ─────────────────────────────────────────────
router.get('/status', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const orgId = req.orgId;
    const userId = req.user.id;

    const [ffRows, googleRows] = await Promise.all([
      prisma.$queryRawUnsafe(
        'SELECT `value` FROM `org_integrations` WHERE orgId = ? AND `key` = ? LIMIT 1',
        orgId, 'fireflies_api_key'
      ),
      prisma.$queryRawUnsafe(
        'SELECT userId FROM `user_google_tokens` WHERE userId = ? LIMIT 1',
        userId
      ),
    ]);

    const ffKey = ffRows[0]?.value || null;
    res.json({
      firefliesConfigured: !!ffKey,
      firefliesKeyMasked: ffKey ? '••••••••' + ffKey.slice(-4) : null,
      googleConnected: googleRows.length > 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/integrations/fireflies ─────────────────────────────────────────
router.put('/fireflies', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    const orgId = req.orgId;
    const trimmed = apiKey.trim();
    const id = randomBytes(8).toString('hex');

    await prisma.$executeRawUnsafe(
      'INSERT INTO `org_integrations` (id, orgId, `key`, `value`) VALUES (?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updatedAt` = NOW(3)',
      id, orgId, 'fireflies_api_key', trimmed
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/integrations/fireflies ───────────────────────────────────────
router.delete('/fireflies', requireAuth, withOrgScope, async (req, res) => {
  try {
    await ensureTables();
    await prisma.$executeRawUnsafe(
      'DELETE FROM `org_integrations` WHERE orgId = ? AND `key` = ?',
      req.orgId, 'fireflies_api_key'
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/integrations/google/connect ────────────────────────────────────
router.get('/google/connect', requireAuth, withOrgScope, async (req, res) => {
  cleanOldStates();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });

  const state = randomBytes(16).toString('hex');
  try {
    await saveOAuthState(state, req.user.id, req.orgId);
    console.log('[Google Connect] State saved for user:', req.user.id);
  } catch (e) {
    console.error('[Google Connect] Failed to save state:', e.message);
    return res.status(500).json({ error: 'Failed to initiate Google OAuth: ' + e.message });
  }

  const backendUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3001';
  const redirectUri = `${backendUrl}/api/integrations/google/callback`;
  console.log('[Google Connect] Redirect URI:', redirectUri);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/integrations/google/callback ────────────────────────────────────
// NOTE: This is a redirect target from Google — no auth session available here.
router.get('/google/callback', async (req, res) => {
  cleanOldStates();

  const frontendUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:5173';
  const { code, state, error } = req.query;

  console.log('[Google Callback] Received state:', state, 'error:', error);

  if (error) {
    console.log('[Google Callback] Google returned error:', error);
    return res.redirect(`${frontendUrl}/settings?tab=integrations&google=denied`);
  }

  const pending = await getOAuthState(state);
  console.log('[Google Callback] Pending state found:', !!pending, pending);
  if (!pending) {
    return res.redirect(`${frontendUrl}/settings?tab=integrations&google=error`);
  }

  try {
    await ensureTables();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const backendUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3001';
    const redirectUri = `${backendUrl}/api/integrations/google/callback`;

    console.log('[Google Callback] Exchanging code, redirectUri:', redirectUri, 'hasCode:', !!code, 'hasClientId:', !!clientId, 'hasClientSecret:', !!clientSecret);

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    console.log('[Google Callback] Token response:', JSON.stringify({ error: tokens.error, hasAccess: !!tokens.access_token }));
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await prisma.$executeRawUnsafe(
      'INSERT INTO `user_google_tokens` (userId, accessToken, refreshToken, expiresAt, scope) ' +
      'VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ' +
      'accessToken = VALUES(accessToken), ' +
      'refreshToken = COALESCE(VALUES(refreshToken), refreshToken), ' +
      'expiresAt = VALUES(expiresAt), scope = VALUES(scope), updatedAt = NOW(3)',
      pending.userId,
      tokens.access_token,
      tokens.refresh_token || null,
      expiresAt,
      tokens.scope || null
    );

    res.redirect(`${frontendUrl}/settings?tab=integrations&google=connected`);
  } catch (e) {
    console.error('[integrations] Google callback error:', e.message);
    res.redirect(`${frontendUrl}/settings?tab=integrations&google=error`);
  }
});

// ── DELETE /api/integrations/google ─────────────────────────────────────────
router.delete('/google', requireAuth, async (req, res) => {
  try {
    await ensureTables();
    await prisma.$executeRawUnsafe(
      'DELETE FROM `user_google_tokens` WHERE userId = ?',
      req.user.id
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Export helper for other modules ─────────────────────────────────────────
export async function getOrgFirefliesKey(orgId) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT `value` FROM `org_integrations` WHERE orgId = ? AND `key` = ? LIMIT 1',
      orgId, 'fireflies_api_key'
    );
    return rows[0]?.value || null;
  } catch {
    return null;
  }
}

export default router;
