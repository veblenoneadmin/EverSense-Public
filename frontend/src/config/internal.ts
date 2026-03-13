// Frontend-only internal configuration
// This should contain only client-side configurations and utilities

export const hasAdminAccess = (userOrRole: any): boolean => {
  // Accepts either a role string ('ADMIN') or a user object ({ role: 'ADMIN' })
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'ADMIN' || role === 'OWNER';
};

export const INTERNAL_CONFIG = {
  // Frontend-specific internal configuration
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
  FEATURE_FLAGS: {
    BRAIN_DUMP: true,
    CALENDAR: true,
    ADVANCED_REPORTING: true,
  }
};
