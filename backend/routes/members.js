import express from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  requireAuth,
  withOrgScope,
  requireRole,
  requireAdmin,
  canAssignRole,
  canModifyMember,
  RoleOrder,
} from '../lib/rbac.js';

const router = express.Router();

// Validation schemas
const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'CLIENT'])
});

/**
 * GET /api/organizations/:orgId/members
 * List all members in an organization (requires ADMIN+)
 */
router.get('/:orgId/members', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', search, role } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Build filters
    const where = { orgId: req.orgId };
    
    if (role && ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'].includes(role)) {
      where.role = role;
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    // Get members with pagination
    const [members, totalCount] = await Promise.all([
      prisma.membership.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              createdAt: true
            }
          }
        },
        orderBy: [
          { role: 'desc' }, // OWNER first
          { user: { name: 'asc' } },
          { createdAt: 'asc' }
        ],
        skip: offset,
        take: limitNum
      }),
      prisma.membership.count({ where })
    ]);

    // Add activity stats for each member
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const stats = await prisma.timeLog.aggregate({
          where: {
            userId: member.userId,
            orgId: req.orgId,
            startTime: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          _sum: { duration: true },
          _count: { id: true }
        });

        return {
          id: member.id,
          role: member.role,
          joinedAt: member.createdAt,
          user: member.user,
          stats: {
            totalHours: Math.round((stats._sum.duration || 0) / 3600 * 100) / 100,
            totalSessions: stats._count.id
          },
          canModify: canModifyMember(
            req.membership.role,
            member.role,
            req.user.id,
            member.userId
          )
        };
      })
    );

    res.json({
      success: true,
      members: membersWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: membersWithStats.length,
        pages: Math.ceil(membersWithStats.length / limitNum)
      }
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch members',
      code: 'FETCH_MEMBERS_ERROR' 
    });
  }
});

/**
 * GET /api/organizations/:orgId/members/:memberId
 * Get specific member details (requires ADMIN+)
 */
router.get('/:orgId/members/:memberId', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const member = await prisma.membership.findFirst({
      where: { 
        id: req.params.memberId,
        orgId: req.orgId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true
          }
        }
      }
    });

    if (!member) {
      return res.status(404).json({ 
        error: 'Member not found',
        code: 'MEMBER_NOT_FOUND' 
      });
    }

    // Get member's activity stats
    const [timeStats, taskStats, recentActivity] = await Promise.all([
      // Time tracking stats
      prisma.timeLog.aggregate({
        where: {
          userId: member.userId,
          orgId: req.orgId
        },
        _sum: { duration: true, earnings: true },
        _count: { id: true }
      }),
      
      // Task stats
      prisma.macroTask.aggregate({
        where: {
          createdBy: member.userId,
          orgId: req.orgId
        },
        _count: { 
          id: true,
          _all: true
        }
      }),
      
      // Recent activity
      prisma.timeLog.findMany({
        where: {
          userId: member.userId,
          orgId: req.orgId
        },
        include: {
          task: { select: { title: true } }
        },
        orderBy: { startTime: 'desc' },
        take: 10
      })
    ]);

    const memberDetails = {
      id: member.id,
      role: member.role,
      joinedAt: member.createdAt,
      user: member.user,
      stats: {
        totalHours: Math.round((timeStats._sum.duration || 0) / 3600 * 100) / 100,
        totalEarnings: timeStats._sum.earnings || 0,
        totalSessions: timeStats._count.id,
        tasksCreated: taskStats._count.id
      },
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        type: 'time_log',
        description: activity.task?.title || activity.description || 'Work session',
        duration: activity.duration,
        startTime: activity.startTime,
        endTime: activity.endTime,
        isBillable: activity.isBillable
      })),
      canModify: canModifyMember(
        req.membership.role,
        member.role,
        req.user.id,
        member.userId
      )
    };

    res.json({
      success: true,
      member: memberDetails
    });
  } catch (error) {
    console.error('Get member details error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch member details',
      code: 'FETCH_MEMBER_ERROR' 
    });
  }
});

/**
 * PATCH /api/organizations/:orgId/members/:memberId
 * Update member role (requires ADMIN+ and appropriate permissions)
 */
router.patch('/:orgId/members/:memberId', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    const validation = updateMemberRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors 
      });
    }

    const { role: newRole } = validation.data;

    // Get the target member
    const targetMember = await prisma.membership.findFirst({
      where: { 
        id: req.params.memberId,
        orgId: req.orgId
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!targetMember) {
      return res.status(404).json({ 
        error: 'Member not found',
        code: 'MEMBER_NOT_FOUND' 
      });
    }

    // Cannot modify yourself
    if (targetMember.userId === req.user.id) {
      return res.status(400).json({ 
        error: 'Cannot modify your own role',
        code: 'CANNOT_MODIFY_SELF' 
      });
    }

    // Check if user can assign this role
    if (!canAssignRole(req.membership.role, newRole)) {
      return res.status(403).json({ 
        error: `Only ${newRole === 'OWNER' ? 'OWNER' : 'ADMIN+'} can assign ${newRole} role`,
        code: 'INSUFFICIENT_PERMISSIONS' 
      });
    }

    // Check if user can modify this member
    if (!canModifyMember(req.membership.role, targetMember.role, req.user.id, targetMember.userId)) {
      return res.status(403).json({ 
        error: 'Cannot modify member with equal or higher role',
        code: 'CANNOT_MODIFY_HIGHER_ROLE' 
      });
    }

    // Special handling for OWNER role transfer
    if (newRole === 'OWNER') {
      if (req.membership.role !== 'OWNER') {
        return res.status(403).json({ 
          error: 'Only current OWNER can assign OWNER role',
          code: 'OWNER_ONLY_TRANSFER' 
        });
      }

      // Transfer ownership (demote current owner to ADMIN)
      await prisma.$transaction(async (tx) => {
        // Update target member to OWNER
        await tx.membership.update({
          where: { id: targetMember.id },
          data: { role: 'OWNER' }
        });

        // Update current owner to ADMIN
        await tx.membership.update({
          where: { 
            userId_orgId: { 
              userId: req.user.id, 
              orgId: req.orgId 
            } 
          },
          data: { role: 'ADMIN' }
        });

        // Update organization creator
        await tx.organization.update({
          where: { id: req.orgId },
          data: { createdById: targetMember.userId }
        });
      });
    } else {
      // Regular role update
      await prisma.membership.update({
        where: { id: targetMember.id },
        data: { role: newRole }
      });
    }

    res.json({
      success: true,
      message: `Member role updated to ${newRole}`,
      member: {
        id: targetMember.id,
        userId: targetMember.userId,
        name: targetMember.user.name,
        email: targetMember.user.email,
        role: newRole,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ 
      error: 'Failed to update member role',
      code: 'UPDATE_MEMBER_ERROR' 
    });
  }
});

/**
 * DELETE /api/organizations/:orgId/members/:memberId
 * Remove member from organization (requires ADMIN+ and appropriate permissions)
 */
router.delete('/:orgId/members/:memberId', requireAuth, withOrgScope, requireAdmin, async (req, res) => {
  try {
    // Get the target member
    const targetMember = await prisma.membership.findFirst({
      where: { 
        id: req.params.memberId,
        orgId: req.orgId
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!targetMember) {
      return res.status(404).json({ 
        error: 'Member not found',
        code: 'MEMBER_NOT_FOUND' 
      });
    }

    // Cannot remove yourself
    if (targetMember.userId === req.user.id) {
      return res.status(400).json({ 
        error: 'Cannot remove yourself from organization',
        code: 'CANNOT_REMOVE_SELF',
        message: 'Use leave organization or transfer ownership first'
      });
    }

    // Cannot remove OWNER (must transfer ownership first)
    if (targetMember.role === 'OWNER') {
      return res.status(400).json({ 
        error: 'Cannot remove organization owner',
        code: 'CANNOT_REMOVE_OWNER',
        message: 'Transfer ownership first'
      });
    }

    // Check if user can modify this member
    if (!canModifyMember(req.membership.role, targetMember.role, req.user.id, targetMember.userId)) {
      return res.status(403).json({ 
        error: 'Cannot remove member with equal or higher role',
        code: 'CANNOT_REMOVE_HIGHER_ROLE' 
      });
    }

    // Check if member has data that needs to be handled
    const memberData = await prisma.$transaction(async (tx) => {
      const [taskCount, timeLogCount] = await Promise.all([
        tx.macroTask.count({
          where: { createdBy: targetMember.userId, orgId: req.orgId }
        }),
        tx.timeLog.count({
          where: { userId: targetMember.userId, orgId: req.orgId }
        })
      ]);

      return { taskCount, timeLogCount };
    });

    const { force } = req.query;
    if ((memberData.taskCount > 0 || memberData.timeLogCount > 0) && force !== 'true') {
      return res.status(400).json({ 
        error: 'Member has associated data',
        code: 'MEMBER_HAS_DATA',
        message: 'Use force=true to remove member and reassign their data',
        data: memberData
      });
    }

    // Remove member (and optionally reassign their data)
    await prisma.$transaction(async (tx) => {
      if (force === 'true') {
        // Reassign tasks to the current user (admin removing the member)
        await tx.macroTask.updateMany({
          where: { createdBy: targetMember.userId, orgId: req.orgId },
          data: { createdBy: req.user.id }
        });

        // Time logs remain as historical data but member association is removed via cascade
      }

      // Remove membership
      await tx.membership.delete({
        where: { id: targetMember.id }
      });
    });

    res.json({
      success: true,
      message: 'Member removed from organization',
      member: {
        id: targetMember.id,
        name: targetMember.user.name,
        email: targetMember.user.email,
        role: targetMember.role
      },
      dataReassigned: force === 'true' && (memberData.taskCount > 0 || memberData.timeLogCount > 0)
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ 
      error: 'Failed to remove member',
      code: 'REMOVE_MEMBER_ERROR' 
    });
  }
});

/**
 * POST /api/organizations/:orgId/leave
 * Leave organization (current user removes themselves)
 */
router.post('/:orgId/leave', requireAuth, withOrgScope, requireRole('CLIENT'), async (req, res) => {
  try {
    // Cannot leave if you're the only OWNER
    if (req.membership.role === 'OWNER') {
      const ownerCount = await prisma.membership.count({
        where: { orgId: req.orgId, role: 'OWNER' }
      });

      if (ownerCount === 1) {
        return res.status(400).json({ 
          error: 'Cannot leave as sole owner',
          code: 'SOLE_OWNER',
          message: 'Transfer ownership to another member first'
        });
      }
    }

    // Check for data that needs handling
    const userData = await prisma.$transaction(async (tx) => {
      const [taskCount, timeLogCount] = await Promise.all([
        tx.macroTask.count({
          where: { createdBy: req.user.id, orgId: req.orgId }
        }),
        tx.timeLog.count({
          where: { userId: req.user.id, orgId: req.orgId }
        })
      ]);

      return { taskCount, timeLogCount };
    });

    const { reassignTo } = req.body;
    
    if ((userData.taskCount > 0) && !reassignTo) {
      return res.status(400).json({ 
        error: 'You have tasks that need reassignment',
        code: 'HAS_TASKS',
        message: 'Provide reassignTo user ID to reassign your tasks',
        data: userData
      });
    }

    // Validate reassignTo user if provided
    if (reassignTo) {
      const targetUser = await prisma.membership.findUnique({
        where: { 
          userId_orgId: { userId: reassignTo, orgId: req.orgId } 
        }
      });

      if (!targetUser) {
        return res.status(400).json({ 
          error: 'Reassign target must be a member of this organization',
          code: 'INVALID_REASSIGN_TARGET' 
        });
      }
    }

    // Leave organization
    await prisma.$transaction(async (tx) => {
      if (reassignTo && userData.taskCount > 0) {
        // Reassign tasks
        await tx.macroTask.updateMany({
          where: { createdBy: req.user.id, orgId: req.orgId },
          data: { createdBy: reassignTo }
        });
      }

      // Remove membership
      await tx.membership.delete({
        where: { 
          userId_orgId: { userId: req.user.id, orgId: req.orgId } 
        }
      });
    });

    res.json({
      success: true,
      message: 'Successfully left organization',
      tasksReassigned: reassignTo && userData.taskCount > 0
    });
  } catch (error) {
    console.error('Leave organization error:', error);
    res.status(500).json({ 
      error: 'Failed to leave organization',
      code: 'LEAVE_ORG_ERROR' 
    });
  }
});

export default router;