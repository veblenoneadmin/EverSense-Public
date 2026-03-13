import { prisma } from '../lib/prisma.js';

/**
 * Middleware that authenticates requests using an API key.
 * Reads: Authorization: Bearer es_<key>
 * On success: attaches req.user and req.orgId (same shape as session auth)
 * On failure: returns 401
 */
export async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer es_')) {
    return res.status(401).json({
      error: 'Invalid or missing API key',
      code: 'INVALID_API_KEY',
      message: 'Provide a valid API key in the Authorization header: Bearer es_<key>',
    });
  }

  const key = authHeader.replace('Bearer ', '').trim();

  try {
    const apiKey = await prisma.$queryRawUnsafe(
      `SELECT ak.*, u.id as uid, u.name as uname, u.email as uemail
       FROM api_keys ak
       JOIN User u ON u.id = ak.userId
       WHERE ak.key = ? AND ak.revokedAt IS NULL
       LIMIT 1`,
      key
    );

    if (!apiKey || apiKey.length === 0) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    const record = apiKey[0];

    // Attach user + org to request (same shape requireAuth/withOrgScope expect)
    req.user = { id: record.uid, name: record.uname, email: record.uemail };
    req.orgId = record.orgId;
    req.apiKeyId = record.id;
    req.apiKeyName = record.name;

    // Update lastUsedAt async — don't block the request
    prisma.$executeRawUnsafe(
      `UPDATE api_keys SET lastUsedAt = NOW() WHERE id = ?`,
      record.id
    ).catch(() => {});

    next();
  } catch (err) {
    console.error('[apiKeyAuth] Error:', err);
    return res.status(500).json({ error: 'Failed to validate API key' });
  }
}

/**
 * Combined middleware: tries session auth first, falls back to API key auth.
 * Use this on endpoints that should support BOTH session users and external API clients.
 */
export function requireAuthOrApiKey(req, res, next) {
  // If already authenticated via session (better-auth sets req.user)
  if (req.user && req.user.id) {
    return next();
  }

  // Try API key
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer es_')) {
    return apiKeyAuth(req, res, next);
  }

  return res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHENTICATED',
    message: 'Provide a session cookie or an API key (Authorization: Bearer es_<key>)',
  });
}