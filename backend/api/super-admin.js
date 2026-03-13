// backend/api/super-admin.js
// Completely DB-free super admin — credentials live in env vars only.
// Uses an HMAC-signed cookie (sa_token) for session. No user record in the DB.
import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/rbac.js';
import { sendInviteEmail, formatDuration } from '../lib/mailer.js';

const router = express.Router();

// ── Token helpers ─────────────────────────────────────────────────────────────
export function generateSaToken(secret) {
  const ts = Date.now().toString();
  const sig = createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

export function verifySaToken(token, secret) {
  if (!token || !secret) return false;
  try {
    const dot = token.indexOf('.');
    if (dot === -1) return false;
    const ts  = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(ts).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

function getSaSecret() { return process.env.MAINTENANCE_TOKEN || ''; }

const COOKIE_NAME = 'sa_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  path:     '/',
};

const SUPER_ADMIN_EMAIL = 'admin@eversense.ai';

// ── In-memory error log (last 200 entries) ────────────────────────────────────
const ERROR_LOG = [];
const MAX_ERRORS = 200;

export function logError(level, source, message, detail = null) {
  ERROR_LOG.unshift({ level, source, message, detail: detail ? String(detail).slice(0, 500) : null, ts: new Date().toISOString() });
  if (ERROR_LOG.length > MAX_ERRORS) ERROR_LOG.length = MAX_ERRORS;
}

// Middleware: require logged-in user with the super-admin email
function requireSuperAdminUser(req, res, next) {
  if (!req.user || req.user.email !== SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ── GET /api/super-admin/check ────────────────────────────────────────────────
// Used by OrganizationContext — works via cookie, no auth middleware needed.
router.get('/check', (req, res) => {
  const token  = parseSaCookie(req);
  const secret = getSaSecret();
  res.json({ isSuperAdmin: !!(token && verifySaToken(token, secret)) });
});

// ── GET /api/super-admin/me ───────────────────────────────────────────────────
// Returns a virtual user object when the sa_token cookie is valid.
router.get('/me', (req, res) => {
  const token  = parseSaCookie(req);
  const secret = getSaSecret();
  if (!token || !verifySaToken(token, secret)) {
    return res.status(401).json({ isSuperAdmin: false });
  }
  res.json({
    isSuperAdmin: true,
    user: { id: '__superadmin__', email: 'system@internal', name: 'Super Admin' },
  });
});

// ── POST /api/super-admin/login ───────────────────────────────────────────────
// No user record created. Validates password against MAINTENANCE_TOKEN env var.
router.post('/login', (req, res) => {
  const { password } = req.body;
  const secret = getSaSecret();

  if (!secret) {
    return res.status(503).json({ error: 'Super admin not configured' });
  }
  if (!password || password !== secret) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateSaToken(secret);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ success: true });
});

// ── POST /api/super-admin/logout ──────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// ── GET /api/super-admin/orgs ─────────────────────────────────────────────────
// Lists ALL orgs for the super admin org-switcher. Cookie-authenticated.
router.get('/orgs', (req, res, next) => {
  const token  = parseSaCookie(req);
  const secret = getSaSecret();
  if (!token || !verifySaToken(token, secret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    res.json({ organizations: orgs.map(o => ({ ...o, role: 'OWNER' })) });
  } catch (err) {
    console.error('[SuperAdmin] orgs error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// ── GET /api/super-admin/stats ────────────────────────────────────────────────
router.get('/stats', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrgs,
      totalTasks,
      totalProjects,
      totalClients,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.macroTask.count(),
      prisma.project.count(),
      prisma.client.count(),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
    ]);

    res.json({ totalUsers, totalOrgs, totalTasks, totalProjects, totalClients, recentUsers });
  } catch (err) {
    console.error('[SuperAdmin] stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/super-admin/users ────────────────────────────────────────────────
router.get('/users', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            org: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { macroTasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  } catch (err) {
    console.error('[SuperAdmin] users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/super-admin/orgs-detailed ───────────────────────────────────────
router.get('/orgs-detailed', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            macroTasks: true,
          },
        },
        memberships: {
          where: { role: 'OWNER' },
          select: {
            user: { select: { id: true, email: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = orgs.map(o => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      createdAt: o.createdAt,
      memberCount: o._count.memberships,
      taskCount: o._count.macroTasks,
      owner: o.memberships[0]?.user ?? null,
    }));

    res.json({ orgs: result });
  } catch (err) {
    console.error('[SuperAdmin] orgs-detailed error:', err);
    res.status(500).json({ error: 'Failed to fetch orgs' });
  }
});

// ── GET /api/super-admin/pending-owner-invites ───────────────────────────────
router.get('/pending-owner-invites', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const invites = await prisma.invite.findMany({
      where: { role: 'OWNER', status: 'PENDING' },
      include: { org: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invites: invites.map(i => ({
      id: i.id,
      email: i.email,
      orgId: i.orgId,
      orgName: i.org?.name ?? '—',
      orgSlug: i.org?.slug ?? '—',
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      token: i.token,
    })) });
  } catch (err) {
    console.error('[SuperAdmin] pending-owner-invites error:', err);
    res.status(500).json({ error: 'Failed to fetch pending invites' });
  }
});

// ── POST /api/super-admin/invite ──────────────────────────────────────────────
router.post('/invite', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const { email, role = 'STAFF', name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Find Veblen org
    const org = await prisma.organization.findUnique({ where: { slug: 'veblen' } });
    if (!org) return res.status(404).json({ error: 'Veblen organization not found' });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: existingUser.id, orgId: org.id } },
      });
      if (existingMembership) {
        return res.status(400).json({ error: 'User is already a member' });
      }
      await prisma.membership.create({
        data: { userId: existingUser.id, orgId: org.id, role },
      });
      return res.json({ success: true, message: 'Existing user added to organization' });
    }

    // Create invitation record
    const invitation = await prisma.invite.create({
      data: {
        email,
        orgId: org.id,
        invitedById: req.user.id,
        role,
        token: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`[SuperAdmin] Invitation created for ${email} token=${invitation.token}`);
    res.json({ success: true, message: 'Invitation created', invitationId: invitation.id, token: invitation.token });
  } catch (err) {
    console.error('[SuperAdmin] invite error:', err);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// ── POST /api/super-admin/create-lead-account ────────────────────────────────
// Creates a new org + owner invitation (or membership if user already exists)
router.post('/create-lead-account', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const { email, name, companyName } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!companyName) return res.status(400).json({ error: 'Company name required' });

    // Generate unique slug from company name
    let baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!baseSlug) baseSlug = 'org';
    let slug = baseSlug;
    let attempt = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++attempt}`;
    }

    // Create the organization
    const org = await prisma.organization.create({
      data: {
        name: companyName,
        slug,
        createdById: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // If user already exists, add OWNER membership; otherwise create invitation
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.membership.create({
        data: { userId: existingUser.id, orgId: org.id, role: 'OWNER' },
      });
      return res.json({ success: true, message: 'Existing user added as owner of new organization', orgId: org.id, slug });
    }

    const invitation = await prisma.invite.create({
      data: {
        email,
        orgId: org.id,
        invitedById: req.user.id,
        role: 'OWNER',
        token: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Send invite email
    try {
      const baseUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
      console.log('[SuperAdmin] invite baseUrl:', baseUrl, '| APP_URL:', process.env.APP_URL);
      const acceptUrl = `${baseUrl}/invite?token=${invitation.token}`;
      await sendInviteEmail(email, {
        orgName: companyName,
        role: 'Owner',
        invitedBy: 'EverSense Admin',
        acceptUrl,
        expiresIn: formatDuration(7 * 24 * 60),
      });
      console.log(`[SuperAdmin] Lead invite email sent to ${email}`);
    } catch (emailErr) {
      console.error('[SuperAdmin] Failed to send lead invite email:', emailErr.message);
    }

    console.log(`[SuperAdmin] Lead account created: org=${slug} email=${email} token=${invitation.token}`);
    res.json({ success: true, message: 'Organization created and invitation sent', orgId: org.id, slug, token: invitation.token });
  } catch (err) {
    console.error('[SuperAdmin] create-lead-account error:', err);
    res.status(500).json({ error: 'Failed to create lead account' });
  }
});

// ── DELETE /api/super-admin/invites/:inviteId ─────────────────────────────────
router.delete('/invites/:inviteId', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const { inviteId } = req.params;
    await prisma.invite.delete({ where: { id: inviteId } });
    res.json({ success: true });
  } catch (err) {
    console.error('[SuperAdmin] delete-invite error:', err);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

// ── DELETE /api/super-admin/users/:userId ─────────────────────────────────────
router.delete('/users/:userId', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete in dependency order
    await prisma.membership.deleteMany({ where: { userId } });
    await prisma.invite.deleteMany({ where: { invitedById: userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('[SuperAdmin] delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── GET /api/super-admin/errors ───────────────────────────────────────────────
router.get('/errors', requireAuth, requireSuperAdminUser, (req, res) => {
  const { level, limit = 100 } = req.query;
  let logs = ERROR_LOG;
  if (level) logs = logs.filter(e => e.level === level);
  res.json({ errors: logs.slice(0, Number(limit)) });
});

// ── POST /api/super-admin/errors/clear ────────────────────────────────────────
router.post('/errors/clear', requireAuth, requireSuperAdminUser, (req, res) => {
  ERROR_LOG.length = 0;
  res.json({ success: true });
});

// ── DELETE /api/super-admin/orgs/:orgId ──────────────────────────────────────
router.delete('/orgs/:orgId', requireAuth, requireSuperAdminUser, async (req, res) => {
  try {
    const { orgId } = req.params;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (org.slug === 'veblen') {
      return res.status(400).json({ error: 'Cannot delete the primary Veblen organization' });
    }

    await prisma.membership.deleteMany({ where: { orgId } });
    await prisma.organization.delete({ where: { id: orgId } });

    res.json({ success: true, message: 'Organization deleted' });
  } catch (err) {
    console.error('[SuperAdmin] delete org error:', err);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// ── Helper: parse sa_token from Cookie header ─────────────────────────────────
export function parseSaCookie(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}

export default router;
