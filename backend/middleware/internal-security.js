// Internal security middleware for Veblen invitation-only system
import { INTERNAL_CONFIG, isRegistrationAllowed } from '../config/internal.js';

/**
 * Middleware to block public registration in internal mode
 */
export function blockPublicRegistration(req, res, next) {
  // Invite-based registration is always allowed regardless of public registration setting
  if (req.path.startsWith('/api/invites/') || req.path.startsWith('/api/invitations/')) {
    return next();
  }

  // Only block public registration endpoints
  const registrationPaths = [
    '/api/auth/sign-up',
    '/api/auth/signup',
    '/api/auth/register',
    '/signup',
    '/register'
  ];

  const isRegistrationPath = registrationPaths.some(path =>
    req.path === path || req.path.startsWith(path + '/')
  );

  if (isRegistrationPath && !isRegistrationAllowed()) {
    return res.status(403).json({
      error: 'Public registration is disabled',
      message: 'This system is invitation-only. Please contact an administrator for access.',
      system: 'Veblen Internal',
      mode: 'invitation-only'
    });
  }

  next();
}

/**
 * Middleware to add internal branding and configuration to responses
 */
export function addInternalBranding(req, res, next) {
  // Add internal configuration to response headers for frontend
  res.setHeader('X-System-Mode', INTERNAL_CONFIG.MODE);
  res.setHeader('X-System-Name', INTERNAL_CONFIG.UI.brandingName);
  res.setHeader('X-Invite-Only', 'true');
  
  next();
}

/**
 * Middleware to validate invitation token on signup
 */
export function validateInvitationOnSignup(req, res, next) {
  // Only apply to signup/registration paths
  const signupPaths = [
    '/api/auth/sign-up',
    '/api/auth/signup',
    '/api/auth/register'
  ];

  const isSignupPath = signupPaths.some(path => req.path === path);
  
  if (isSignupPath) {
    const { invitationToken } = req.body;
    
    if (!invitationToken) {
      return res.status(400).json({
        error: 'Invitation required',
        message: 'This system requires a valid invitation to create an account.',
        code: 'INVITATION_REQUIRED'
      });
    }
    
    // The invitation token will be validated in the signup handler
    req.isInvitationSignup = true;
  }

  next();
}

/**
 * Get system information for frontend
 */
export function getInternalSystemInfo(req, res) {
  res.json({
    system: {
      name: INTERNAL_CONFIG.UI.brandingName,
      mode: INTERNAL_CONFIG.MODE,
      organization: INTERNAL_CONFIG.ORGANIZATION.name,
      inviteOnly: INTERNAL_CONFIG.FEATURES.inviteOnly,
      publicRegistration: INTERNAL_CONFIG.FEATURES.publicRegistration,
      loginMessage: INTERNAL_CONFIG.UI.loginMessage || 'Welcome to Veblen Internal',
      maxUsers: INTERNAL_CONFIG.ADMIN.maxUsers
    },
    features: {
      multipleOrganizations: INTERNAL_CONFIG.FEATURES.multipleOrganizations,
      organizationCreation: INTERNAL_CONFIG.FEATURES.organizationCreation,
      selfServiceInvites: INTERNAL_CONFIG.FEATURES.selfServiceInvites
    },
    ui: {
      hideOrganizationSwitcher: INTERNAL_CONFIG.UI.hideOrganizationSwitcher,
      hideCreateOrganization: INTERNAL_CONFIG.UI.hideCreateOrganization,
      showAdminNavigation: INTERNAL_CONFIG.UI.showAdminNavigation,
      showPoweredBy: INTERNAL_CONFIG.UI.showPoweredBy
    }
  });
}

/**
 * Middleware to enforce user limits
 */
export async function enforceUserLimits(req, res, next) {
  try {
    const signupPaths = [
      '/api/auth/sign-up',
      '/api/auth/signup', 
      '/api/auth/register'
    ];

    const isSignupPath = signupPaths.some(path => req.path === path);
    
    if (isSignupPath) {
      // Import prisma dynamically to avoid circular dependencies
      const { prisma } = await import('../lib/prisma.js');
      const { hasReachedUserLimit } = await import('../config/internal.js');
      
      if (await hasReachedUserLimit(prisma)) {
        return res.status(400).json({
          error: 'User limit reached',
          message: `This system is limited to ${INTERNAL_CONFIG.ADMIN.maxUsers} users.`,
          code: 'USER_LIMIT_REACHED'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error checking user limits:', error);
    next(); // Allow signup on error to prevent complete lockout
  }
}