import { prisma } from './prisma.js';

// Role hierarchy for permission checking
export const RoleOrder = {
  OWNER: 4,
  ADMIN: 3,
  STAFF: 2,
  CLIENT: 1
};

/**
 * Middleware to require authentication
 */
export function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    console.log(`🚫 Authentication required for ${req.method} ${req.path}`, {
      hasUser: !!req.user,
      userId: req.user?.id,
      userAgent: req.headers['user-agent']?.substring(0, 50),
      origin: req.headers.origin
    });

    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
      details: 'Please log in to access this resource'
    });
  }
  next();
}

/**
 * Middleware to extract and validate organization context.
 * If no orgId is supplied in the request, auto-resolves from the user's
 * first membership — so single-org installs (e.g. Veblen) work transparently.
 */
export async function withOrgScope(req, res, next) {
  // Try to get orgId from multiple sources
  let orgId =
    req.headers['x-org-id'] ||
    req.body?.orgId ||
    req.params?.orgId ||
    req.query?.orgId ||
    req.user?.activeOrgId;

  // Handle cases where orgId might be an array (duplicate URL parameters)
  if (Array.isArray(orgId)) orgId = orgId[0];

  // Auto-resolve: if no orgId provided, look up the user's membership
  if (!orgId && req.user?.id) {
    try {
      const membership = await prisma.membership.findFirst({
        where:   { userId: req.user.id },
        orderBy: { createdAt: 'asc' },
        select:  { orgId: true },
      });
      if (membership) orgId = membership.orgId;
    } catch (_) { /* fall through to 400 below */ }
  }

  if (!orgId) {
    return res.status(400).json({
      error:   'Organization context required',
      code:    'MISSING_ORG_CONTEXT',
      message: 'User has no organization membership. Please complete onboarding.',
    });
  }

  req.orgId = orgId;
  next();
}

/**
 * Optional organization scope middleware that doesn't require orgId
 * Used for endpoints that can work without organization context
 */
export function withOptionalOrgScope(req, res, next) {
  // Try to get orgId from multiple sources
  let orgId = 
    req.headers['x-org-id'] ||
    req.body.orgId ||
    req.params.orgId ||
    req.query.orgId ||
    req.user?.activeOrgId;

  // Handle cases where orgId might be an array (duplicate URL parameters)
  if (Array.isArray(orgId)) {
    orgId = orgId[0];
  }

  req.orgId = orgId || null;
  next();
}

/**
 * Auto-create organization for specific users if they don't have one
 */
export async function ensureUserHasOrganization(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Check if user has any organizations
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      include: { org: true }
    });

    if (memberships.length === 0) {
      // Check if this is an internal admin user
      const internalEmails = [
        'brelvin75@gmail.com',
        // Add other internal emails as needed
      ];

      if (internalEmails.includes(req.user.email)) {
        // Create organization for internal user (suppress frequent logs)
        const organization = await prisma.organization.upsert({
          where: { slug: 'veblen' },
          update: {
            name: 'Veblen',
            createdById: req.user.id
          },
          create: {
            name: 'Veblen',
            slug: 'veblen',
            createdById: req.user.id
          }
        });

        // Create owner membership
        await prisma.membership.upsert({
          where: {
            userId_orgId: {
              userId: req.user.id,
              orgId: organization.id
            }
          },
          update: {
            role: 'OWNER'
          },
          create: {
            userId: req.user.id,
            orgId: organization.id,
            role: 'OWNER'
          }
        });
        req.autoCreatedOrg = organization.id;
      }
    }

    next();
  } catch (error) {
    console.error('Error in ensureUserHasOrganization:', error);
    next(); // Continue even if auto-creation fails
  }
}

/**
 * Middleware to require specific role or higher
 */
export function requireRole(minRole) {
  return async (req, res, next) => {
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
export async function hasRole(userId, orgId, minRole) {
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
export function canAssignRole(userRole, targetRole) {
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
export function canModifyMember(actorRole, targetRole, actorId, targetId) {
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
export async function getUserOrganizations(userId) {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            theme: true,
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
      theme: m.org.theme ?? 'dark',
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
export function isValidOrgSlug(slug) {
  // Slug must be 3-50 characters, alphanumeric + hyphens, start/end with alphanumeric
  const slugRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,48}[a-zA-Z0-9]$/;
  return slugRegex.test(slug);
}

/**
 * Utility function to generate organization slug from name
 */
export function generateOrgSlug(name) {
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
export function requireOrgRole(minRole) {
  return [requireAuth, withOrgScope, requireRole(minRole)];
}

/**
 * Middleware to validate resource ownership for tasks
 */
export function requireTaskOwnership(req, res, next) {
  const checkOwnership = async () => {
    const { taskId } = req.params;
    const orgId = req.orgId;

    console.log('🔍 Checking task ownership:', { taskId, orgId, userId: req.user?.id });

    if (!taskId) {
      console.error('❌ Task ID missing');
      return res.status(400).json({ error: 'Task ID is required' });
    }

    try {
      const task = await prisma.macroTask.findUnique({
        where: { id: taskId },
        select: { orgId: true, userId: true }
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.orgId !== orgId) {
        return res.status(403).json({ 
          error: 'Access denied: Task belongs to different organization' 
        });
      }

      req.resourceOwnership = { taskOrgId: task.orgId, taskUserId: task.userId };
      next();
    } catch (error) {
      console.error('Error checking task ownership:', error);
      return res.status(500).json({ error: 'Failed to validate resource access' });
    }
  };

  checkOwnership();
}

/**
 * Middleware to validate resource ownership for timers (TimeLog model)
 */
export function requireTimerOwnership(req, res, next) {
  const checkOwnership = async () => {
    const { timerId } = req.params;
    const orgId = req.orgId;
    
    if (!timerId) {
      return res.status(400).json({ error: 'Timer ID is required' });
    }

    try {
      const timer = await prisma.timeLog.findUnique({
        where: { id: timerId },
        select: { orgId: true, userId: true }
      });

      if (!timer) {
        return res.status(404).json({ error: 'Timer not found' });
      }

      if (timer.orgId !== orgId) {
        return res.status(403).json({ 
          error: 'Access denied: Timer belongs to different organization' 
        });
      }

      req.resourceOwnership = { timerOrgId: timer.orgId, timerUserId: timer.userId };
      next();
    } catch (error) {
      console.error('Error checking timer ownership:', error);
      return res.status(500).json({ error: 'Failed to validate resource access' });
    }
  };

  checkOwnership();
}

/**
 * Generic middleware factory to validate resource ownership
 */
export function requireResourceOwnership(model, idParam = 'id') {
  return async (req, res, next) => {
    const resourceId = req.params[idParam];
    const orgId = req.orgId;
    
    if (!resourceId) {
      return res.status(400).json({ error: `${model} ID is required` });
    }

    try {
      const resource = await prisma[model].findUnique({
        where: { id: resourceId },
        select: { orgId: true, userId: true }
      });

      if (!resource) {
        return res.status(404).json({ error: `${model} not found` });
      }

      if (resource.orgId !== orgId) {
        return res.status(403).json({ 
          error: `Access denied: ${model} belongs to different organization` 
        });
      }

      req.resourceOwnership = { 
        [`${model}OrgId`]: resource.orgId, 
        [`${model}UserId`]: resource.userId 
      };
      next();
    } catch (error) {
      console.error(`Error checking ${model} ownership:`, error);
      return res.status(500).json({ error: 'Failed to validate resource access' });
    }
  };
}