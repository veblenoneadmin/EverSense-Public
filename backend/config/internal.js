// Internal system configuration - LOCKED DOWN FOR VEBLEN INTERNAL USE ONLY
export const INTERNAL_CONFIG = {
  // Organization settings
  ORGANIZATION: {
    name: 'Veblen',
    slug: 'veblen',
    ownerId: '53ebe8d8-4700-43b0-aae7-f30608cd3b66', // Tony's user ID
    ownerEmail: 'brelvin75@gmail.com'
  },
  
  // System mode - INTERNAL ONLY
  MODE: 'internal', // LOCKED: Only internal single-organization mode
  
  // Features - INVITATION ONLY SYSTEM
  FEATURES: {
    publicRegistration: false,        // NO public registration
    multipleOrganizations: false,     // ONLY Veblen organization
    organizationCreation: false,      // NO new organization creation
    selfServiceInvites: false,        // NO self-service invites
    publicAccess: false,              // NO public access
    inviteOnly: true,                 // INVITATION ONLY
    strictDomainControl: false,       // Allow any email domain for invites
    autoApproveInvites: false         // All invites require approval
  },
  
  // Admin settings - TONY IS OWNER
  ADMIN: {
    defaultRole: 'STAFF',               // Default role for new invites
    allowedRoles: ['OWNER', 'ADMIN', 'STAFF', 'CLIENT'],
    requireAdminApproval: true,         // All new users need approval
    onlyOwnerCanInvite: false,         // ADMINs can also invite
    maxUsers: 50                       // Maximum 50 users for internal use
  },
  
  // UI customization - INTERNAL BRANDING
  UI: {
    hideOrganizationSwitcher: true,     // Hide org switcher (only one org)
    hideCreateOrganization: true,       // Hide create org button
    showAdminNavigation: true,          // Show admin navigation
    brandingName: 'VebTask - Veblen Internal',
    loginMessage: 'Veblen Internal Task Management System',
    requiresInvitation: true,           // Show invitation required message
    showPoweredBy: false               // Hide "powered by" branding
  },
  
  // Security settings
  SECURITY: {
    sessionTimeout: 8 * 60 * 60,       // 8 hour sessions
    requireStrongPasswords: true,      // Enforce strong passwords
    maxLoginAttempts: 5,               // Max 5 login attempts
    lockoutDuration: 30 * 60,          // 30 minute lockout
    requireEmailVerification: true     // Require email verification
  }
};

// Check if user is system administrator
export const isSystemAdmin = (userEmail) => {
  const adminEmails = [
    'brelvin75@gmail.com',
    'admin@veblen.com.au'
  ];
  return adminEmails.includes(userEmail?.toLowerCase());
};

// Check if user has admin access to organization
export const hasAdminAccess = (userRole) => {
  return ['OWNER', 'ADMIN'].includes(userRole);
};

// Get user permissions based on role
export const getUserPermissions = (userRole) => {
  const permissions = {
    OWNER: {
      canManageUsers: true,
      canManageSettings: true,
      canViewReports: true,
      canManageProjects: true,
      canManageTasks: true,
      canManageClients: true,
      canManageInvoices: true,
      canExportData: true,
      canDeleteData: true,
      canInviteUsers: true,
      canApproveUsers: true,
      canManageRoles: true
    },
    ADMIN: {
      canManageUsers: true,
      canManageSettings: true,
      canViewReports: true,
      canManageProjects: true,
      canManageTasks: true,
      canManageClients: true,
      canManageInvoices: true,
      canExportData: true,
      canDeleteData: false,
      canInviteUsers: true,
      canApproveUsers: true,
      canManageRoles: false
    },
    STAFF: {
      canManageUsers: false,
      canManageSettings: false,
      canViewReports: true,
      canManageProjects: true,
      canManageTasks: true,
      canManageClients: true,
      canManageInvoices: true,
      canExportData: false,
      canDeleteData: false,
      canInviteUsers: false,
      canApproveUsers: false,
      canManageRoles: false
    },
    CLIENT: {
      canManageUsers: false,
      canManageSettings: false,
      canViewReports: false,
      canManageProjects: false,
      canManageTasks: true,
      canManageClients: false,
      canManageInvoices: false,
      canExportData: false,
      canDeleteData: false,
      canInviteUsers: false,
      canApproveUsers: false,
      canManageRoles: false
    }
  };
  
  return permissions[userRole] || permissions.CLIENT;
};

// Check if registration is allowed (INTERNAL: NO PUBLIC REGISTRATION)
export const isRegistrationAllowed = () => {
  return false; // Always false for internal use
};

// Check if user can be invited to the system
export const canInviteUser = (inviterRole, inviterEmail) => {
  // Only system admins and users with invite permissions can invite
  if (isSystemAdmin(inviterEmail)) return true;
  
  const permissions = getUserPermissions(inviterRole);
  return permissions.canInviteUsers;
};

// Check if user needs approval after invitation
export const requiresApproval = (inviteeEmail) => {
  // System admins don't need approval
  if (isSystemAdmin(inviteeEmail)) return false;
  
  // All other users require approval in internal mode
  return INTERNAL_CONFIG.ADMIN.requireAdminApproval;
};

// Get allowed domains for invites (INTERNAL: ANY DOMAIN ALLOWED)
export const getAllowedEmailDomains = () => {
  if (INTERNAL_CONFIG.FEATURES.strictDomainControl) {
    return [
      'opusautomations.com',
      'veblen.com.au',
      'veblen.com'
    ];
  }
  return null; // null means any domain is allowed
};

// Validate email domain for invites
export const isEmailDomainAllowed = (email) => {
  const allowedDomains = getAllowedEmailDomains();
  if (!allowedDomains) return true; // Any domain allowed
  
  const domain = email.toLowerCase().split('@')[1];
  return allowedDomains.includes(domain);
};

// Check if system has reached user limit
export const hasReachedUserLimit = async (prisma) => {
  try {
    const userCount = await prisma.user.count();
    return userCount >= INTERNAL_CONFIG.ADMIN.maxUsers;
  } catch (error) {
    console.error('Error checking user limit:', error);
    return false; // Allow on error to prevent lockout
  }
};

// Get system status for internal use
export const getSystemStatus = () => {
  return {
    mode: INTERNAL_CONFIG.MODE,
    organization: INTERNAL_CONFIG.ORGANIZATION.name,
    inviteOnly: INTERNAL_CONFIG.FEATURES.inviteOnly,
    requiresApproval: INTERNAL_CONFIG.ADMIN.requireAdminApproval,
    maxUsers: INTERNAL_CONFIG.ADMIN.maxUsers,
    brandingName: INTERNAL_CONFIG.UI.brandingName
  };
};