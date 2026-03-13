import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { 
  requireAuth, 
  withOrgScope, 
  requireRole,
  requireOwner,
  requireAdmin,
  generateOrgSlug,
  isValidOrgSlug,
  getUserOrganizations,
  canModifyMember,
  ensureUserHasOrganization
} from '../lib/rbac.js';

const router = express.Router();

// Validation schemas
const createOrgSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().optional()
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: z.string().min(3).max(50).optional()
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1)
});

/**
 * GET /api/organizations
 * List all organizations for the current user
 */
router.get('/', requireAuth, ensureUserHasOrganization, async (req, res) => {
  try {
    const organizations = await getUserOrganizations(req.user.id);
    
    res.json({
      success: true,
      organizations,
      count: organizations.length
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch organizations',
      code: 'FETCH_ORGS_ERROR' 
    });
  }
});

/**
 * POST /api/organizations
 * Create a new organization (user becomes OWNER)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const validation = createOrgSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { name, slug: providedSlug } = validation.data;
    
    // Generate or validate slug
    let slug = providedSlug || generateOrgSlug(name);
    if (!isValidOrgSlug(slug)) {
      slug = generateOrgSlug(name);
    }

    // Check if slug is available
    const existingOrg = await prisma.organization.findUnique({
      where: { slug }
    });

    if (existingOrg) {
      // Generate a unique slug by appending a number
      let counter = 1;
      let uniqueSlug = slug;
      
      while (await prisma.organization.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      
      slug = uniqueSlug;
    }

    // Create organization and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Log the session user data for debugging
      console.log('📧 Session user data:', {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      });

      // Ensure user exists in our database (upsert from Better Auth session)
      const user = await tx.user.upsert({
        where: { id: req.user.id },
        update: {
          name: req.user.name,
          email: req.user.email,
          image: req.user.image
        },
        create: {
          id: req.user.id,
          name: req.user.name || '',
          email: req.user.email,
          emailVerified: true, // Assume verified from Better Auth
          image: req.user.image
        }
      });

      console.log('👤 User upserted:', { id: user.id, email: user.email });

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          createdById: user.id
        }
      });

      console.log('🏢 Organization created:', { id: organization.id, name: organization.name, createdById: organization.createdById });

      // Create OWNER membership for creator
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          orgId: organization.id,
          role: 'OWNER'
        }
      });

      return { organization, membership };
    });

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        role: result.membership.role,
        memberCount: 1,
        createdAt: result.organization.createdAt
      }
    });
  } catch (error) {
    console.error('Create organization error:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Organization slug already exists',
        code: 'SLUG_CONFLICT' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create organization',
      code: 'CREATE_ORG_ERROR' 
    });
  }
});

/**
 * GET /api/organizations/:orgId
 * Get organization details (requires membership)
 */
router.get('/:orgId', requireAuth, withOrgScope, requireRole('CLIENT'), async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { 
            memberships: true,
            macroTasks: true,
            calendarEvents: true,
            timeLogs: true
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ 
        error: 'Organization not found',
        code: 'ORG_NOT_FOUND' 
      });
    }

    res.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdBy: organization.createdBy,
        createdAt: organization.createdAt,
        stats: {
          members: organization._count.memberships,
          tasks: organization._count.macroTasks,
          events: organization._count.calendarEvents,
          timeLogs: organization._count.timeLogs
        },
        userRole: req.membership?.role
      }
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch organization',
      code: 'FETCH_ORG_ERROR' 
    });
  }
});

/**
 * PATCH /api/organizations/:orgId
 * Update organization details (requires ADMIN+)
 */
router.patch('/:orgId', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const validation = updateOrgSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const updates = validation.data;

    // If slug is being updated, validate it
    if (updates.slug) {
      if (!isValidOrgSlug(updates.slug)) {
        return res.status(400).json({ 
          error: 'Invalid slug format',
          code: 'INVALID_SLUG' 
        });
      }

      // Check if new slug is available
      const existingOrg = await prisma.organization.findFirst({
        where: { 
          slug: updates.slug,
          id: { not: req.orgId }
        }
      });

      if (existingOrg) {
        return res.status(409).json({ 
          error: 'Slug already in use',
          code: 'SLUG_CONFLICT' 
        });
      }
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id: req.orgId },
      data: updates,
      include: {
        _count: {
          select: { memberships: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Organization updated successfully',
      organization: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        slug: updatedOrganization.slug,
        memberCount: updatedOrganization._count.memberships,
        updatedAt: updatedOrganization.updatedAt
      }
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ 
      error: 'Failed to update organization',
      code: 'UPDATE_ORG_ERROR' 
    });
  }
});

/**
 * DELETE /api/organizations/:orgId
 * Delete organization (requires OWNER, and must be empty or force=true)
 */
router.delete('/:orgId', requireAuth, withOrgScope, requireOwner, async (req, res) => {
  try {
    const { force } = req.query;

    // Check if organization has data
    const orgWithCounts = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            macroTasks: true,
            calendarEvents: true,
            timeLogs: true,
            brainDumps: true
          }
        }
      }
    });

    if (!orgWithCounts) {
      return res.status(404).json({ 
        error: 'Organization not found',
        code: 'ORG_NOT_FOUND' 
      });
    }

    const hasData = 
      orgWithCounts._count.macroTasks > 0 ||
      orgWithCounts._count.calendarEvents > 0 ||
      orgWithCounts._count.timeLogs > 0 ||
      orgWithCounts._count.brainDumps > 0;

    const hasMultipleMembers = orgWithCounts._count.memberships > 1;

    if ((hasData || hasMultipleMembers) && force !== 'true') {
      return res.status(400).json({ 
        error: 'Organization contains data or has multiple members',
        code: 'ORG_NOT_EMPTY',
        message: 'Use force=true to delete organization with data',
        counts: orgWithCounts._count
      });
    }

    // Delete organization (cascading deletes will handle related data)
    await prisma.organization.delete({
      where: { id: req.orgId }
    });

    res.json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ 
      error: 'Failed to delete organization',
      code: 'DELETE_ORG_ERROR' 
    });
  }
});

/**
 * POST /api/organizations/:orgId/transfer-ownership
 * Transfer organization ownership (requires current OWNER)
 */
router.post('/:orgId/transfer-ownership', requireAuth, withOrgScope, requireOwner, async (req, res) => {
  try {
    const validation = transferOwnershipSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { newOwnerId } = validation.data;

    // Cannot transfer to yourself
    if (newOwnerId === req.user.id) {
      return res.status(400).json({ 
        error: 'Cannot transfer ownership to yourself',
        code: 'INVALID_TRANSFER' 
      });
    }

    // Check if new owner is a member of the organization
    const newOwnerMembership = await prisma.membership.findUnique({
      where: { 
        userId_orgId: { 
          userId: newOwnerId, 
          orgId: req.orgId 
        } 
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!newOwnerMembership) {
      return res.status(400).json({ 
        error: 'New owner must be a member of the organization',
        code: 'USER_NOT_MEMBER' 
      });
    }

    // Transfer ownership in a transaction
    await prisma.$transaction(async (tx) => {
      // Update new owner to OWNER role
      await tx.membership.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'OWNER' }
      });

      // Update current owner to ADMIN role
      await tx.membership.update({
        where: { 
          userId_orgId: { 
            userId: req.user.id, 
            orgId: req.orgId 
          } 
        },
        data: { role: 'ADMIN' }
      });

      // Update organization creator if needed
      await tx.organization.update({
        where: { id: req.orgId },
        data: { createdById: newOwnerId }
      });
    });

    res.json({
      success: true,
      message: 'Ownership transferred successfully',
      newOwner: {
        id: newOwnerId,
        name: newOwnerMembership.user.name,
        email: newOwnerMembership.user.email
      }
    });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({ 
      error: 'Failed to transfer ownership',
      code: 'TRANSFER_ERROR' 
    });
  }
});

/**
 * POST /api/organizations/:orgId/switch
 * Switch active organization for current user
 */
router.post('/:orgId/switch', requireAuth, async (req, res) => {
  try {
    // Verify user is a member of this organization
    const membership = await prisma.membership.findUnique({
      where: { 
        userId_orgId: { 
          userId: req.user.id, 
          orgId: req.params.orgId 
        } 
      },
      include: {
        org: { select: { name: true, slug: true } }
      }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'You are not a member of this organization',
        code: 'NOT_MEMBER' 
      });
    }

    // Here you would typically update the user's session or JWT token
    // For now, we'll just return success - the frontend will handle the context switch
    
    res.json({
      success: true,
      message: 'Active organization switched',
      organization: {
        id: req.params.orgId,
        name: membership.org.name,
        slug: membership.org.slug,
        role: membership.role
      }
    });
  } catch (error) {
    console.error('Switch organization error:', error);
    res.status(500).json({ 
      error: 'Failed to switch organization',
      code: 'SWITCH_ORG_ERROR' 
    });
  }
});

export default router;