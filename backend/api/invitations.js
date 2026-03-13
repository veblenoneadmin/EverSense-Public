// User invitation system for Veblen internal use
import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, withOrgScope, requireRole } from '../lib/rbac.js';
import { 
  INTERNAL_CONFIG, 
  canInviteUser, 
  requiresApproval,
  isEmailDomainAllowed,
  hasReachedUserLimit,
  isSystemAdmin 
} from '../config/internal.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Validation schemas
const inviteUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['ADMIN', 'STAFF', 'CLIENT']).default('STAFF'),
  name: z.string().optional(),
  message: z.string().max(500).optional()
});

const approveInviteSchema = z.object({
  inviteId: z.string(),
  approved: z.boolean(),
  role: z.enum(['ADMIN', 'STAFF', 'CLIENT']).optional()
});

/**
 * POST /api/invitations/invite
 * Invite a new user to Veblen (ADMIN+ only)
 */
router.post('/invite', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    const validation = inviteUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid invitation data',
        details: validation.error.errors
      });
    }

    const { email, role, name, message } = validation.data;

    // Check if user can invite
    if (!canInviteUser(req.membership.role, req.user.email)) {
      return res.status(403).json({
        error: 'You do not have permission to invite users'
      });
    }

    // Check if we've reached user limit
    if (await hasReachedUserLimit(prisma)) {
      return res.status(400).json({
        error: `User limit reached (${INTERNAL_CONFIG.ADMIN.maxUsers} users maximum)`
      });
    }

    // Validate email domain
    if (!isEmailDomainAllowed(email)) {
      return res.status(400).json({
        error: 'Email domain not allowed for invitations'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { orgId: req.orgId }
        }
      }
    });

    if (existingUser) {
      if (existingUser.memberships.length > 0) {
        return res.status(400).json({
          error: 'User is already a member of this organization'
        });
      }
      
      // User exists but not in this org - create membership directly
      const membership = await prisma.membership.create({
        data: {
          userId: existingUser.id,
          orgId: req.orgId,
          role: requiresApproval(email) ? 'CLIENT' : role, // Pending approval gets CLIENT role
          status: requiresApproval(email) ? 'pending' : 'active'
        }
      });

      return res.json({
        success: true,
        message: requiresApproval(email) 
          ? 'User added to organization, pending approval'
          : 'User added to organization successfully',
        requiresApproval: requiresApproval(email)
      });
    }

    // Create invitation record
    const invitation = await prisma.invitation.create({
      data: {
        email,
        orgId: req.orgId,
        invitedById: req.user.id,
        role: requiresApproval(email) ? 'CLIENT' : role,
        name,
        message,
        status: requiresApproval(email) ? 'pending_approval' : 'sent',
        token: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    // TODO: Send invitation email here
    console.log(`📧 Invitation created for ${email} (ID: ${invitation.id})`);

    res.json({
      success: true,
      message: requiresApproval(email)
        ? 'Invitation created, pending admin approval'
        : 'Invitation sent successfully',
      invitationId: invitation.id,
      requiresApproval: requiresApproval(email),
      expiresAt: invitation.expiresAt
    });

  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({
      error: 'Failed to create invitation'
    });
  }
});

/**
 * GET /api/invitations
 * List all pending invitations (ADMIN+ only)
 */
router.get('/', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    const where = { orgId: req.orgId };
    if (status !== 'all') {
      where.status = status;
    }

    const invitations = await prisma.invitation.findMany({
      where,
      include: {
        invitedBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      name: inv.name,
      role: inv.role,
      status: inv.status,
      message: inv.message,
      invitedBy: inv.invitedBy,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt
    }));

    res.json({
      success: true,
      invitations: formattedInvitations
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({
      error: 'Failed to fetch invitations'
    });
  }
});

/**
 * POST /api/invitations/approve
 * Approve or reject a pending invitation (ADMIN+ only)
 */
router.post('/approve', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    const validation = approveInviteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid approval data',
        details: validation.error.errors
      });
    }

    const { inviteId, approved, role } = validation.data;

    const invitation = await prisma.invitation.findFirst({
      where: {
        id: inviteId,
        orgId: req.orgId,
        status: { in: ['pending_approval', 'sent'] }
      }
    });

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found or already processed'
      });
    }

    if (approved) {
      // Approve the invitation
      await prisma.invitation.update({
        where: { id: inviteId },
        data: {
          status: 'approved',
          role: role || invitation.role,
          approvedById: req.user.id,
          approvedAt: new Date()
        }
      });

      // TODO: Send approval email here
      console.log(`✅ Invitation approved for ${invitation.email}`);

      res.json({
        success: true,
        message: 'Invitation approved successfully'
      });
    } else {
      // Reject the invitation
      await prisma.invitation.update({
        where: { id: inviteId },
        data: {
          status: 'rejected',
          approvedById: req.user.id,
          approvedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Invitation rejected'
      });
    }

  } catch (error) {
    console.error('Error processing invitation approval:', error);
    res.status(500).json({
      error: 'Failed to process invitation approval'
    });
  }
});

/**
 * GET /api/invitations/accept/:token
 * Accept an invitation (public endpoint)
 */
router.get('/accept/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findFirst({
      where: {
        token,
        status: { in: ['sent', 'approved'] },
        expiresAt: { gt: new Date() }
      },
      include: {
        org: { select: { name: true, slug: true } }
      }
    });

    if (!invitation) {
      return res.status(400).json({
        error: 'Invalid or expired invitation'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (existingUser) {
      // Create membership for existing user
      const membership = await prisma.membership.create({
        data: {
          userId: existingUser.id,
          orgId: invitation.orgId,
          role: invitation.role
        }
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() }
      });

      // Notify inviter + all org admins/owners
      try {
        const joinerName = existingUser.name || existingUser.email;
        const notifySet = new Set();
        if (invitation.invitedById) notifySet.add(invitation.invitedById);
        const admins = await prisma.membership.findMany({
          where: { orgId: invitation.orgId, role: { in: ['OWNER', 'ADMIN'] } },
          select: { userId: true },
        });
        admins.forEach(a => notifySet.add(a.userId));
        for (const uid of notifySet) {
          if (uid !== existingUser.id) {
            createNotification({
              userId: uid,
              orgId: invitation.orgId,
              title: `New Member Joined`,
              body: `${joinerName} accepted the invitation and joined as ${invitation.role}.`,
              link: '/admin',
              type: 'member',
            });
          }
        }
      } catch (_) {}

      res.json({
        success: true,
        message: 'Welcome to Veblen! You can now log in.',
        organization: invitation.org.name,
        role: invitation.role
      });
    } else {
      // Return signup information for new user
      res.json({
        success: true,
        message: 'Please complete your account setup',
        invitation: {
          email: invitation.email,
          name: invitation.name,
          organization: invitation.org.name,
          role: invitation.role,
          token: invitation.token
        },
        requiresSignup: true
      });
    }

  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      error: 'Failed to accept invitation'
    });
  }
});

/**
 * DELETE /api/invitations/:inviteId
 * Cancel/delete an invitation (ADMIN+ only)
 */
router.delete('/:inviteId', requireAuth, withOrgScope, requireRole('ADMIN'), async (req, res) => {
  try {
    const { inviteId } = req.params;

    const result = await prisma.invitation.deleteMany({
      where: {
        id: inviteId,
        orgId: req.orgId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({
        error: 'Invitation not found'
      });
    }

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({
      error: 'Failed to cancel invitation'
    });
  }
});

export default router;