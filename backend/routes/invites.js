import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { auth } from '../auth.js';
import {
  requireAuth,
  withOrgScope,
  requireAdmin,
  canAssignRole
} from '../lib/rbac.js';
import {
  sendInviteEmail,
  sendWelcomeEmail,
  formatDuration
} from '../lib/mailer.js';

const router = express.Router();

/**
 * POST /api/invites/register-and-accept
 * Create an account + accept an invite in one step (public endpoint).
 * Uses Better Auth's server-side API so the password is hashed identically
 * to a normal sign-up, fixing any "Invalid password" mismatch on sign-in.
 */
router.post('/register-and-accept', async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !password || !name?.trim()) {
      return res.status(400).json({ error: 'token, name, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // 1. Validate invite token
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { org: { select: { name: true } } }
    });

    if (!invite) return res.status(404).json({ error: 'Invalid invite token' });
    if (invite.status !== 'PENDING') return res.status(400).json({ error: `Invite is already ${invite.status.toLowerCase()}` });
    if (invite.expiresAt < new Date()) {
      await prisma.invite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // 2. Create account via Better Auth server-side API
    // Using asResponse:true so we can forward the session cookie exactly as
    // Better Auth would set it — no manual cookie construction needed.
    let authResponse;
    try {
      authResponse = await auth.api.signUpEmail({
        body: { email: invite.email, name: name.trim(), password },
        asResponse: true,
      });
    } catch (err) {
      console.error('auth.api.signUpEmail error:', err);
      return res.status(400).json({ error: err.message || 'Failed to create account' });
    }

    if (!authResponse.ok) {
      const errData = await authResponse.json().catch(() => ({}));
      const msg = errData.message || errData.error || 'Failed to create account';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('already')) {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.', code: 'EMAIL_EXISTS' });
      }
      return res.status(authResponse.status).json({ error: msg });
    }

    const authData = await authResponse.json();
    const userId = authData.user?.id;

    if (!userId) {
      return res.status(500).json({ error: 'Account created but could not determine user ID' });
    }

    // 3. Accept invite — create membership
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.membership.findUnique({
          where: { userId_orgId: { userId, orgId: invite.orgId } }
        });
        if (!existing) {
          await tx.membership.create({ data: { userId, orgId: invite.orgId, role: invite.role } });
        }
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED', acceptedById: userId }
        });
      });
    } catch (err) {
      console.error('Failed to create membership:', err);
      return res.status(500).json({ error: 'Account created but failed to join organisation. Please contact support.' });
    }

    // Auto-create Client record for CLIENT role
    if (invite.role === 'CLIENT') {
      try {
        const existing = await prisma.$queryRawUnsafe(
          'SELECT id FROM clients WHERE email = ? AND orgId = ? LIMIT 1',
          invite.email, invite.orgId
        );
        if (!existing.length) {
          const clientId = randomUUID();
          await prisma.$executeRawUnsafe(
            'INSERT INTO clients (id, name, email, orgId, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())',
            clientId, name.trim(), invite.email, invite.orgId
          );
        }
      } catch (e) {
        console.warn('Could not auto-create client record:', e.message);
      }
    }

    // 4. Forward Better Auth's Set-Cookie headers to the browser so the
    //    session is set exactly as it would be on a normal sign-up.
    const cookies = authResponse.headers.getSetCookie?.() ?? [];
    if (cookies.length) {
      res.setHeader('Set-Cookie', cookies);
    }

    console.log(`✅ Invite accepted: ${invite.email} joined ${invite.org.name} as ${invite.role}`);
    res.json({ success: true, message: `Welcome to ${invite.org.name}!` });

  } catch (err) {
    console.error('register-and-accept error:', err);
    res.status(500).json({ error: err.message || 'An unexpected error occurred' });
  }
});

// Validation schemas
const createInviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['ADMIN', 'STAFF', 'CLIENT']),
  message: z.string().max(500).optional()
});

const acceptInviteSchema = z.object({
  token: z.string().min(1)
});

/**
 * GET /api/organizations/:orgId/invites
 * List all invites for an organization (requires ADMIN+)
 */
router.get('/:orgId/invites', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Build filters
    const where = { orgId: req.orgId };
    if (status && ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'].includes(status)) {
      where.status = status;
    }

    // Get invites with pagination
    const [invites, totalCount] = await Promise.all([
      prisma.invite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limitNum
      }),
      prisma.invite.count({ where })
    ]);

    // Fetch inviter/acceptor user info separately (no Prisma relations defined)
    const userIds = [...new Set([
      ...invites.map(i => i.invitedById).filter(Boolean),
      ...invites.map(i => i.acceptedById).filter(Boolean)
    ])];
    const userMap = {};
    if (userIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      });
      users.forEach(u => { userMap[u.id] = u; });
    }

    // Add computed fields
    const invitesWithStatus = invites.map(invite => {
      const isExpired = invite.expiresAt < new Date();
      const actualStatus = isExpired && invite.status === 'PENDING' ? 'EXPIRED' : invite.status;

      return {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: actualStatus,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.status === 'ACCEPTED' ? invite.updatedAt : null,
        invitedBy: invite.invitedById ? userMap[invite.invitedById] || null : null,
        acceptedBy: invite.acceptedById ? userMap[invite.acceptedById] || null : null,
        isExpired,
        canRevoke: invite.status === 'PENDING' && !isExpired
      };
    });

    res.json({
      success: true,
      invites: invitesWithStatus,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch invites',
      code: 'FETCH_INVITES_ERROR' 
    });
  }
});

/**
 * POST /api/organizations/:orgId/invites
 * Create a new invite (requires ADMIN+)
 */
router.post('/:orgId/invites', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const validation = createInviteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { email, role, message } = validation.data;

    // Check if user can assign this role
    if (!canAssignRole(req.membership.role, role)) {
      return res.status(403).json({ 
        error: `Cannot assign ${role} role`,
        code: 'INSUFFICIENT_PERMISSIONS' 
      });
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { orgId: req.orgId }
        }
      }
    });

    if (existingUser?.memberships.length > 0) {
      return res.status(409).json({ 
        error: 'User is already a member of this organization',
        code: 'ALREADY_MEMBER' 
      });
    }

    // Check if there's already a pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        orgId: req.orgId,
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvite) {
      return res.status(409).json({ 
        error: 'Active invite already exists for this email',
        code: 'INVITE_EXISTS',
        existingInvite: {
          id: existingInvite.id,
          role: existingInvite.role,
          expiresAt: existingInvite.expiresAt
        }
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get organization details for email
    const org = await prisma.organization.findUnique({
      where: { id: req.orgId },
      select: { name: true, slug: true }
    });

    // Create invite
    const invite = await prisma.invite.create({
      data: {
        orgId: req.orgId,
        email,
        role,
        token,
        expiresAt,
        invitedById: req.user.id
      }
    });

    // Fetch inviter info separately
    const inviterUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true }
    });

    // Send invite email
    try {
      const acceptUrl = `${process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:5173'}/invite?token=${token}`;

      await sendInviteEmail(email, {
        orgName: org.name,
        role,
        invitedBy: inviterUser?.name || inviterUser?.email || 'Someone',
        acceptUrl,
        expiresIn: formatDuration(7 * 24 * 60) // 7 days in minutes
      });

      console.log(`📧 Invite email sent to ${email} for ${org.name}`);
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
      
      // Don't fail the API call if email fails, but log it
      // In production, you might want to queue this for retry
    }

    res.status(201).json({
      success: true,
      message: 'Invite sent successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        invitedBy: inviterUser || null
      }
    });
  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({ 
      error: 'Failed to create invite',
      code: 'CREATE_INVITE_ERROR' 
    });
  }
});

/**
 * POST /api/invites/accept
 * Accept an organization invite (public endpoint, no org scope required)
 */
router.post('/accept', requireAuth, async (req, res) => {
  try {
    const validation = acceptInviteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { token } = validation.data;

    // Find the invite
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        org: { select: { name: true, slug: true } }
      }
    });

    if (!invite) {
      return res.status(404).json({ 
        error: 'Invalid invite token',
        code: 'INVITE_NOT_FOUND' 
      });
    }

    // Check invite status
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ 
        error: `Invite is ${invite.status.toLowerCase()}`,
        code: 'INVITE_NOT_PENDING' 
      });
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' }
      });

      return res.status(400).json({ 
        error: 'Invite has expired',
        code: 'INVITE_EXPIRED' 
      });
    }

    // Check if invite email matches user email
    if (invite.email !== req.user.email) {
      return res.status(403).json({ 
        error: 'Invite is for a different email address',
        code: 'EMAIL_MISMATCH',
        message: `This invite is for ${invite.email}, but you're signed in as ${req.user.email}`
      });
    }

    // Check if already a member
    const existingMembership = await prisma.membership.findUnique({
      where: { 
        userId_orgId: { 
          userId: req.user.id, 
          orgId: invite.orgId 
        } 
      }
    });

    if (existingMembership) {
      // Mark invite as accepted but don't create duplicate membership
      await prisma.invite.update({
        where: { id: invite.id },
        data: { 
          status: 'ACCEPTED',
          acceptedById: req.user.id
        }
      });

      return res.json({
        success: true,
        message: 'You are already a member of this organization',
        organization: {
          id: invite.orgId,
          name: invite.org.name,
          slug: invite.org.slug,
          role: existingMembership.role
        }
      });
    }

    // Accept invite and create membership
    const result = await prisma.$transaction(async (tx) => {
      // Create membership
      const membership = await tx.membership.create({
        data: {
          userId: req.user.id,
          orgId: invite.orgId,
          role: invite.role
        }
      });

      // Update invite status
      await tx.invite.update({
        where: { id: invite.id },
        data: { 
          status: 'ACCEPTED',
          acceptedById: req.user.id
        }
      });

      return membership;
    });

    // Auto-create Client record when invite role is CLIENT
    if (invite.role === 'CLIENT') {
      try {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM clients WHERE email = ? AND orgId = ? LIMIT 1`,
          req.user.email, invite.orgId
        );
        if (!existing.length) {
          const clientId = randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO clients (id, name, email, orgId, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())`,
            clientId, req.user.name || req.user.email, req.user.email, invite.orgId
          );
          try {
            await prisma.$executeRawUnsafe(`UPDATE clients SET user_id = ? WHERE id = ?`, req.user.id, clientId);
          } catch (_) { /* user_id column may not exist yet */ }
          console.log(`👤 Auto-created Client record for invited user ${req.user.email}`);
        }
      } catch (e) {
        console.warn(`⚠️  Could not auto-create client record for invite: ${e.message}`);
      }
    }

    // Send welcome email
    try {
      const dashboardUrl = `${process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:5173'}/dashboard`;

      await sendWelcomeEmail(req.user.email, {
        name: req.user.name,
        orgName: invite.org.name,
        role: invite.role,
        dashboardUrl
      });

      console.log(`📧 Welcome email sent to ${req.user.email} for ${invite.org.name}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    res.json({
      success: true,
      message: `Successfully joined ${invite.org.name}`,
      organization: {
        id: invite.orgId,
        name: invite.org.name,
        slug: invite.org.slug,
        role: invite.role
      }
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ 
      error: 'Failed to accept invite',
      code: 'ACCEPT_INVITE_ERROR' 
    });
  }
});

/**
 * GET /api/invites/:token/details
 * Get invite details for preview (public endpoint)
 */
router.get('/:token/details', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        org: {
          select: {
            name: true,
            slug: true,
            _count: { select: { memberships: true } }
          }
        }
      }
    });

    if (!invite) {
      return res.status(404).json({
        error: 'Invalid invite token',
        code: 'INVITE_NOT_FOUND'
      });
    }

    // Fetch inviter separately
    const inviterUser = invite.invitedById
      ? await prisma.user.findUnique({
          where: { id: invite.invitedById },
          select: { name: true, email: true }
        })
      : null;

    const isExpired = invite.expiresAt < new Date();
    const actualStatus = isExpired && invite.status === 'PENDING' ? 'EXPIRED' : invite.status;

    res.json({
      success: true,
      invite: {
        email: invite.email,
        role: invite.role,
        status: actualStatus,
        expiresAt: invite.expiresAt,
        isExpired,
        organization: {
          name: invite.org.name,
          slug: invite.org.slug,
          memberCount: invite.org._count.memberships
        },
        invitedBy: inviterUser
          ? { name: inviterUser.name || inviterUser.email.split('@')[0] }
          : null
      }
    });
  } catch (error) {
    console.error('Get invite details error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch invite details',
      code: 'FETCH_INVITE_ERROR' 
    });
  }
});

/**
 * DELETE /api/organizations/:orgId/invites/:inviteId
 * Revoke/cancel an invite (requires ADMIN+)
 */
router.delete('/:orgId/invites/:inviteId', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const invite = await prisma.invite.findFirst({
      where: { 
        id: req.params.inviteId,
        orgId: req.orgId
      }
    });

    if (!invite) {
      return res.status(404).json({ 
        error: 'Invite not found',
        code: 'INVITE_NOT_FOUND' 
      });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ 
        error: `Cannot revoke ${invite.status.toLowerCase()} invite`,
        code: 'INVALID_INVITE_STATUS' 
      });
    }

    // Revoke the invite
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'REVOKED' }
    });

    res.json({
      success: true,
      message: 'Invite revoked successfully',
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: 'REVOKED'
      }
    });
  } catch (error) {
    console.error('Revoke invite error:', error);
    res.status(500).json({ 
      error: 'Failed to revoke invite',
      code: 'REVOKE_INVITE_ERROR' 
    });
  }
});

/**
 * POST /api/organizations/:orgId/invites/:inviteId/resend
 * Resend an invite email (requires ADMIN+)
 */
router.post('/:orgId/invites/:inviteId/resend', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const invite = await prisma.invite.findFirst({
      where: {
        id: req.params.inviteId,
        orgId: req.orgId
      },
      include: {
        org: { select: { name: true } }
      }
    });

    if (!invite) {
      return res.status(404).json({ 
        error: 'Invite not found',
        code: 'INVITE_NOT_FOUND' 
      });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ 
        error: `Cannot resend ${invite.status.toLowerCase()} invite`,
        code: 'INVALID_INVITE_STATUS' 
      });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(400).json({ 
        error: 'Cannot resend expired invite',
        code: 'INVITE_EXPIRED',
        message: 'Create a new invite instead'
      });
    }

    // Resend invite email
    try {
      const acceptUrl = `${process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || 'http://localhost:5173'}/invite?token=${invite.token}`;
      const timeUntilExpiry = Math.max(0, invite.expiresAt.getTime() - Date.now());

      // Fetch inviter info separately
      const inviterUser = invite.invitedById
        ? await prisma.user.findUnique({
            where: { id: invite.invitedById },
            select: { name: true, email: true }
          })
        : null;

      await sendInviteEmail(invite.email, {
        orgName: invite.org.name,
        role: invite.role,
        invitedBy: inviterUser?.name || inviterUser?.email || 'Someone',
        acceptUrl,
        expiresIn: formatDuration(Math.floor(timeUntilExpiry / (1000 * 60)))
      });

      res.json({
        success: true,
        message: 'Invite resent successfully',
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt
        }
      });
    } catch (emailError) {
      console.error('Failed to resend invite email:', emailError);
      res.status(500).json({ 
        error: 'Failed to send email',
        code: 'EMAIL_SEND_ERROR' 
      });
    }
  } catch (error) {
    console.error('Resend invite error:', error);
    res.status(500).json({ 
      error: 'Failed to resend invite',
      code: 'RESEND_INVITE_ERROR' 
    });
  }
});

export default router;