import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from './prisma.js';

// Role hierarchy for permission checking
export const RoleOrder = {
  OWNER: 4,
  ADMIN: 3,
  STAFF: 2,
  CLIENT: 1
} as const;

// Extended request type to include user and org context
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    activeOrgId?: string;
  };
  orgId?: string;
  membership?: {
    id: string;
    role: Role;
    orgId: string;
    userId: string;
  };
  headers: any;
  body: any;
  params: any;
  query: any;
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHENTICATED' 
    });
  }
  next();
}

/**
 * Middleware to extract and validate organization context
 */
export function withOrgScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Try to get orgId from multiple sources
  const orgId = 
    (req.headers['x-org-id'] as string) ||
    req.body.orgId ||
    req.params.orgId ||
    req.query.orgId as string ||
    req.user?.activeOrgId;

  if (!orgId) {
    return res.status(400).json({ 
      error: 'Organization context required',
      code: 'MISSING_ORG_CONTEXT',
      message: 'Please provide organization ID via header X-Org-Id, URL parameter, or body'
    });
  }

  req.orgId = orgId;
  next();
}

/**
 * Middleware to require specific role or higher
 */
export function requireRole(minRole: keyof typeof RoleOrder) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'UNAUTHENTICATED' 
        });
      }

      if (!req.orgId) {
        return res.status(400).json({ 
          error: 'Organization context required',
          code: 'MISSING_ORG_CONTEXT' 
        });
      }

      // Check membership and role
      const membership = await prisma.membership.findUnique({
        where: { 
          userId_orgId: { 
            userId: req.user.id, 
            orgId: req.orgId 
          } 
        },
        include: {
          org: { select: { name: true, slug: true } },
          user: { select: { name: true, email: true } }
        }
      });

      if (!membership) {
        return res.status(403).json({ 
          error: 'Access denied',
          code: 'NOT_MEMBER',
          message: 'You are not a member of this organization' 
        });
      }

      const userRoleLevel = RoleOrder[membership.role];
      const requiredRoleLevel = RoleOrder[minRole];

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE',
          message: `Role ${minRole} or higher required, but you have ${membership.role}`,
          required: minRole,
          current: membership.role
        });
      }

      // Add membership to request for use in route handlers
      req.membership = membership;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ 
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_ERROR' 
      });
    }
  };
}

/**
 * Utility function to check if user has specific role or higher in an organization
 */
export async function hasRole(
  userId: string, 
  orgId: string, 
  minRole: keyof typeof RoleOrder
): Promise<boolean> {
  try {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } }
    });

    if (!membership) return false;

    return RoleOrder[membership.role] >= RoleOrder[minRole];
  } catch (error) {
    console.error('hasRole check error:', error);
    return false;
  }
}

/**
 * Utility function to check if user can assign a specific role
 * Rules: 
 * - Only OWNER can assign OWNER role
 * - ADMIN can assign ADMIN, STAFF, CLIENT roles
 * - STAFF and CLIENT cannot assign roles
 */
export function canAssignRole(userRole: Role, targetRole: Role): boolean {
  const userLevel = RoleOrder[userRole];
  const targetLevel = RoleOrder[targetRole];

  // Only OWNER can assign OWNER role
  if (targetRole === 'OWNER' && userRole !== 'OWNER') {
    return false;
  }

  // User must have higher or equal role level to assign
  return userLevel >= targetLevel;
}

/**
 * Utility function to check if user can modify another member
 * Rules:
 * - Cannot modify yourself (for role changes)
 * - OWNER can modify anyone
 * - ADMIN can modify STAFF and CLIENT
 * - STAFF and CLIENT cannot modify anyone
 */
export function canModifyMember(
  actorRole: Role, 
  targetRole: Role, 
  actorId: string, 
  targetId: string
): boolean {
  // Cannot modify yourself for role changes
  if (actorId === targetId) return false;

  const actorLevel = RoleOrder[actorRole];
  const targetLevel = RoleOrder[targetRole];

  // Must have higher role level than target to modify
  return actorLevel > targetLevel;
}

/**
 * Utility function to get user's organizations with roles
 */
export async function getUserOrganizations(userId: string) {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: {
              select: { memberships: true }
            }
          }
        }
      },
      orderBy: [
        { role: 'desc' }, // OWNER first
        { org: { name: 'asc' } }
      ]
    });

    return memberships.map(m => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
      memberCount: m.org._count.memberships,
      createdAt: m.org.createdAt,
      membershipId: m.id
    }));
  } catch (error) {
    console.error('getUserOrganizations error:', error);
    return [];
  }
}

/**
 * Utility function to validate organization slug
 */
export function isValidOrgSlug(slug: string): boolean {
  // Slug must be 3-50 characters, alphanumeric + hyphens, start/end with alphanumeric
  const slugRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,48}[a-zA-Z0-9]$/;
  return slugRegex.test(slug);
}

/**
 * Utility function to generate organization slug from name
 */
export function generateOrgSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

/**
 * Middleware for organization owners only
 */
export const requireOwner = requireRole('OWNER');

/**
 * Middleware for organization admins and above
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware for organization staff and above
 */
export const requireStaff = requireRole('STAFF');

/**
 * Combined middleware for auth + org scope + role check
 */
export function requireOrgRole(minRole: keyof typeof RoleOrder) {
  return [requireAuth, withOrgScope, requireRole(minRole)];
}