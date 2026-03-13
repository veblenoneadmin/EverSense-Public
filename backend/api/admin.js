import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { auth } from '../auth.js'; // Better Auth instance - handles hashing correctly
import { requireAuth, withOrgScope, requireAdmin, requireRole } from '../lib/rbac.js';
import { checkDatabaseConnection, handleDatabaseError } from '../lib/api-error-handler.js';
import crypto from 'crypto';
import { sendInviteEmail, formatDuration } from '../lib/mailer.js';

// Create a Client record via raw SQL — safe even when extended columns don't exist yet
async function createClientRecord(name, email, userId, orgId) {
  const clientId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO clients (id, name, email, orgId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    clientId, name, email, orgId
  );
  // Link user_id if the column exists (silently skip if not)
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE clients SET user_id = ? WHERE id = ?`, userId, clientId
    );
  } catch (_) { /* user_id column not yet added */ }
  return clientId;
}

// Check if a client record exists for this email+org (raw SQL, no Prisma column dependency)
async function clientExistsForEmail(email, orgId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM clients WHERE email = ? AND orgId = ? LIMIT 1`, email, orgId
  );
  return rows.length > 0;
}

const router = express.Router();

// Validation schemas
const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'CLIENT'])
});

const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'CLIENT'])
});

const createUserSchema = z.object({
  name:     z.string().min(1).max(255),
  email:    z.string().email(),
  password: z.string().min(6).max(128),
  role:     z.enum(['OWNER', 'ADMIN', 'STAFF', 'CLIENT']),
});

/**
 * POST /api/admin/users/create
 * Manually create a new user and add them to the organization
 */
router.post('/users/create', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', details: validation.error.errors });
    }

    const { name, email, password, role } = validation.data;

    // Check if email is already registered
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const existingMembership = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: existing.id, orgId: req.orgId } },
      });
      if (existingMembership) {
        return res.status(409).json({ error: 'User already exists in this organization' });
      }
      await prisma.membership.create({
        data: { userId: existing.id, orgId: req.orgId, role },
      });
      // Auto-create Client record for existing user added as CLIENT
      if (role === 'CLIENT') {
        try {
          const exists = await clientExistsForEmail(existing.email, req.orgId);
          if (!exists) {
            await createClientRecord(existing.name || existing.email, existing.email, existing.id, req.orgId);
            console.log(`👤 Auto-created Client record for ${existing.email}`);
          }
        } catch (e) {
          console.warn(`⚠️  Could not auto-create client record: ${e.message}`);
        }
      }
      return res.status(201).json({ success: true, message: 'Existing user added to organization', userId: existing.id });
    }

    // Use Better Auth's own signUpEmail API so the password is hashed
    // exactly the same way as normal signup — no custom hashing needed.
    const signUpResult = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    if (!signUpResult?.user?.id) {
      console.error('❌ Better Auth signUpEmail failed:', signUpResult);
      return res.status(500).json({ error: 'Failed to create user via Better Auth' });
    }

    const userId = signUpResult.user.id;

    // Add to organization with the specified role
    await prisma.membership.create({
      data: { userId, orgId: req.orgId, role },
    });

    // Auto-create Client record when role is CLIENT
    if (role === 'CLIENT') {
      try {
        const exists = await clientExistsForEmail(email, req.orgId);
        if (!exists) {
          await createClientRecord(name, email, userId, req.orgId);
          console.log(`👤 Auto-created Client record for ${email}`);
        }
      } catch (e) {
        console.warn(`⚠️  Could not auto-create client record: ${e.message}`);
      }
    }

    console.log(`✅ User created via Better Auth: ${email} as ${role}`);

    res.status(201).json({
      success: true,
      message: 'User created and added to organization',
      user: { id: userId, name, email, role },
    });
  } catch (error) {
    console.error('❌ Create user error:', error.message);
    return handleDatabaseError(error, res, 'create user');
  }
});

/**
 * GET /api/admin/users
 */
router.get('/users', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    console.log(`📋 Fetching admin users for org ${req.orgId}, user ${req.user.id}`);

    const users = await prisma.user.findMany({
      where: {
        memberships: { some: { orgId: req.orgId } }
      },
      include: {
        memberships: {
          where: { orgId: req.orgId },
          include: { org: { select: { name: true, slug: true } } }
        },
        _count: {
          select: {
            macroTasks: { where: { orgId: req.orgId } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Fetched ${users.length} users for org ${req.orgId}`);
    res.json({ success: true, users, count: users.length });
  } catch (error) {
    console.error(`❌ Failed to fetch admin users for org ${req.orgId}:`, error.message);
    return handleDatabaseError(error, res, 'fetch admin users');
  }
});

/**
 * GET /api/admin/invites
 */
router.get('/invites', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const invites = await prisma.invite.findMany({
      where: { orgId: req.orgId },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch inviter info separately (no Prisma relation defined on Invite model)
    const inviterIds = [...new Set(invites.map(i => i.invitedById).filter(Boolean))];
    const inviterMap = {};
    if (inviterIds.length) {
      const inviters = await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, name: true, email: true }
      });
      inviters.forEach(u => { inviterMap[u.id] = u; });
    }
    const invitesWithUser = invites.map(i => ({
      ...i,
      invitedBy: i.invitedById ? inviterMap[i.invitedById] || null : null
    }));

    res.json({ success: true, invites: invitesWithUser, count: invites.length });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch admin invites');
  }
});

/**
 * POST /api/admin/invite
 */
router.post('/invite', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const validation = inviteUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: validation.error.errors });
    }

    const { email, role } = validation.data;

    const existingUser = await prisma.user.findFirst({
      where: { email, memberships: { some: { orgId: req.orgId } } }
    });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists in this organization', code: 'USER_EXISTS' });
    }

    const existingInvite = await prisma.invite.findFirst({
      where: { email, orgId: req.orgId, status: 'PENDING' }
    });
    if (existingInvite) {
      return res.status(409).json({ error: 'Invitation already sent to this email', code: 'INVITE_EXISTS' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.invite.create({
      data: { orgId: req.orgId, email, role, token, expiresAt, invitedById: req.user.id }
    });

    // Fetch inviter separately (no Prisma relation on Invite model)
    const inviterUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true }
    });

    // Send invite email
    const acceptUrl = `${process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:5173'}/invite?token=${token}`;
    console.log(`🔗 Invite link: ${acceptUrl}`);

    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.orgId },
        select: { name: true }
      });
      await sendInviteEmail(email, {
        orgName: org?.name || 'the organization',
        role,
        invitedBy: inviterUser?.name || inviterUser?.email || 'An admin',
        acceptUrl,
        expiresIn: formatDuration(7 * 24 * 60),
      });
      console.log(`📧 Invite email sent to ${email}`);
    } catch (emailErr) {
      console.error('❌ Failed to send invite email:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expiresAt,
        invitedBy: inviterUser || null
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'send invitation');
  }
});

/**
 * PATCH /api/admin/users/:userId/role
 */
router.patch('/users/:userId/role', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const validation = updateRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: validation.error.errors });
    }

    const { userId } = req.params;
    const { role } = validation.data;

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: req.orgId } },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!membership) {
      return res.status(404).json({ error: 'User not found in this organization', code: 'USER_NOT_FOUND' });
    }
    if (membership.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot change owner role', code: 'CANNOT_CHANGE_OWNER' });
    }
    if (membership.user?.email === 'admin@eversense.ai') {
      return res.status(403).json({ error: 'Cannot change this protected account\'s role', code: 'PROTECTED_ACCOUNT' });
    }

    const updatedMembership = await prisma.membership.update({
      where: { userId_orgId: { userId, orgId: req.orgId } },
      data: { role },
      include: { user: { select: { name: true, email: true } } }
    });

    // Auto-create Client record when role is changed to CLIENT
    if (role === 'CLIENT' && updatedMembership.user) {
      try {
        const exists = await clientExistsForEmail(updatedMembership.user.email, req.orgId);
        if (!exists) {
          await createClientRecord(
            updatedMembership.user.name || updatedMembership.user.email,
            updatedMembership.user.email,
            userId,
            req.orgId
          );
          console.log(`👤 Auto-created Client record for role-changed user ${updatedMembership.user.email}`);
        }
      } catch (e) {
        console.warn(`⚠️  Could not auto-create client record on role change: ${e.message}`);
      }
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      membership: { userId: updatedMembership.userId, role: updatedMembership.role, user: updatedMembership.user }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'update user role');
  }
});

/**
 * POST /api/admin/invites/:inviteId/revoke
 */
router.post('/invites/:inviteId/revoke', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const { inviteId } = req.params;

    const invite = await prisma.invite.findFirst({ where: { id: inviteId, orgId: req.orgId } });
    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found', code: 'INVITE_NOT_FOUND' });
    }
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending invitations can be revoked', code: 'INVALID_INVITE_STATUS' });
    }

    await prisma.invite.update({ where: { id: inviteId }, data: { status: 'REVOKED' } });
    res.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (error) {
    return handleDatabaseError(error, res, 'revoke invitation');
  }
});

/**
 * DELETE /api/admin/users/:userId
 */
router.delete('/users/:userId', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const { userId } = req.params;

    // Resolve caller's email and role
    const callerUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
    const callerEmail = callerUser?.email;
    const callerMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: req.user.id, orgId: req.orgId } },
      select: { role: true },
    });
    const callerRole = callerMembership?.role;
    const isSuperAdmin = callerEmail === 'admin@eversense.ai';

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: req.orgId } },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!membership) {
      return res.status(404).json({ error: 'User not found in this organization', code: 'USER_NOT_FOUND' });
    }

    // Only admin@eversense.ai can remove OWNERs
    if (membership.role === 'OWNER' && !isSuperAdmin) {
      return res.status(403).json({ error: 'Cannot remove organization owner', code: 'CANNOT_REMOVE_OWNER' });
    }

    // Nobody (not even OWNER) can delete admin@eversense.ai
    if (membership.user?.email === 'admin@eversense.ai') {
      return res.status(403).json({ error: 'Cannot remove this protected account', code: 'PROTECTED_ACCOUNT' });
    }

    // Regular admins (not super admin, not owner) can only delete STAFF
    if (!isSuperAdmin && callerRole !== 'OWNER' && membership.role !== 'STAFF') {
      return res.status(403).json({ error: 'You can only remove Staff members', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    await prisma.membership.delete({ where: { userId_orgId: { userId, orgId: req.orgId } } });
    res.json({ success: true, message: 'User removed from organization successfully' });
  } catch (error) {
    return handleDatabaseError(error, res, 'remove user');
  }
});

/**
 * GET /api/admin/stats
 */
router.get('/stats', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const stats = await prisma.$transaction(async (tx) => {
      const [userCount, pendingInvites, totalTasks, totalTimeLogs, activeUsers, totalRevenue] = await Promise.all([
        tx.membership.count({ where: { orgId: req.orgId } }),
        tx.invite.count({ where: { orgId: req.orgId, status: 'PENDING' } }),
        tx.macroTask.count({ where: { orgId: req.orgId } }),
        tx.timeLog.count({ where: { orgId: req.orgId } }),
        tx.timeLog.groupBy({
          by: ['userId'],
          where: { orgId: req.orgId, begin: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        }).then(groups => groups.length),
        tx.timeLog.aggregate({
          where: { orgId: req.orgId, isBillable: true, earnings: { not: null } },
          _sum: { earnings: true }
        }).then(result => result._sum.earnings || 0)
      ]);
      return { userCount, pendingInvites, totalTasks, totalTimeLogs, activeUsers, totalRevenue };
    });

    res.json({ success: true, stats });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch admin statistics');
  }
});

/**
 * GET /api/admin/system/status
 */
router.get('/system/status', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const { INTERNAL_CONFIG } = await import('../config/internal.js');
    const userCount = await prisma.user.count();
    const pendingInvitations = await prisma.invitation.count({
      where: { orgId: req.orgId, status: { in: ['pending_approval', 'sent'] } }
    });

    res.json({
      success: true,
      system: {
        mode: INTERNAL_CONFIG.MODE,
        organization: INTERNAL_CONFIG.ORGANIZATION.name,
        brandingName: INTERNAL_CONFIG.UI.brandingName,
        inviteOnly: INTERNAL_CONFIG.FEATURES.inviteOnly,
        maxUsers: INTERNAL_CONFIG.ADMIN.maxUsers,
        currentUsers: userCount,
        availableSlots: Math.max(0, INTERNAL_CONFIG.ADMIN.maxUsers - userCount),
        pendingInvitations
      }
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'fetch system status');
  }
});

/**
 * POST /api/admin/users/bulk-delete
 * Remove all non-owner members from the organization (caller is also preserved)
 */
router.post('/users/bulk-delete', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const callerUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
    const callerMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: req.user.id, orgId: req.orgId } },
      select: { role: true },
    });
    if (callerUser?.email !== 'admin@eversense.ai' && callerMembership?.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only the super admin or owner can perform bulk delete', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    // Find admin@eversense.ai's userId to preserve their membership
    const protectedUser = await prisma.user.findUnique({ where: { email: 'admin@eversense.ai' }, select: { id: true } });

    const result = await prisma.membership.deleteMany({
      where: {
        orgId: req.orgId,
        role: { not: 'OWNER' },
        userId: {
          notIn: [req.user.id, ...(protectedUser ? [protectedUser.id] : [])],
        },
      },
    });

    console.log(`🗑️  Bulk deleted ${result.count} members from org ${req.orgId}`);
    res.json({ success: true, message: `Removed ${result.count} member(s) from the organization`, count: result.count });
  } catch (error) {
    return handleDatabaseError(error, res, 'bulk delete users');
  }
});

/**
 * POST /api/admin/timelogs/reset
 * Delete ALL time logs for the organization and zero out actualHours on tasks
 */
router.post('/timelogs/reset', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    const callerUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
    const callerMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: req.user.id, orgId: req.orgId } },
      select: { role: true },
    });
    if (callerUser?.email !== 'admin@eversense.ai' && callerMembership?.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only the super admin or owner can reset time logs', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const result = await prisma.timeLog.deleteMany({ where: { orgId: req.orgId } });

    await prisma.macroTask.updateMany({
      where: { orgId: req.orgId },
      data: { actualHours: 0 },
    });

    console.log(`🗑️  Reset ${result.count} time logs for org ${req.orgId}`);
    res.json({ success: true, message: `Reset ${result.count} time log(s)`, count: result.count });
  } catch (error) {
    return handleDatabaseError(error, res, 'reset time logs');
  }
});

/**
 * POST /api/admin/sync-admins
 */
router.post('/sync-admins', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    if (!(await checkDatabaseConnection(res))) return;

    console.log(`🔄 Syncing admin users for org ${req.orgId}...`);

    const adminMemberships = await prisma.membership.findMany({
      where: { role: { in: ['ADMIN', 'OWNER'] } },
      include: { user: { select: { id: true, email: true, name: true } } },
      distinct: ['userId']
    });

    let added = 0, skipped = 0;
    const results = [];

    for (const membership of adminMemberships) {
      const userId = membership.user.id;
      const existing = await prisma.mesmbership.findUnique({
        where: { userId_orgId: { userId, orgId: req.orgId } }
      });

      if (existing) {
        skipped++;
        results.push({ email: membership.user.email, status: 'skipped', reason: 'Already in organization' });
      } else {
        await prisma.membership.create({ data: { userId, orgId: req.orgId, role: membership.role } });
        added++;
        results.push({ email: membership.user.email, status: 'added', role: membership.role });
        console.log(`✅ Added ${membership.user.email} as ${membership.role}`);
      }
    }

    console.log(`📊 Sync complete: ${added} added, ${skipped} already members`);
    res.json({
      success: true,
      message: `Admin sync complete: ${added} users added, ${skipped} already members`,
      stats: { added, skipped, total: adminMemberships.length },
      results
    });
  } catch (error) {
    console.error('❌ Error syncing admin users:', error);
    return handleDatabaseError(error, res, 'sync admin users');
  }
});

export default router;