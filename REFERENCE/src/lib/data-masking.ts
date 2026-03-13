import { secureData } from './security';

// Data masking utilities for sensitive information
export const dataMasking = {
  // Mask cost rates and financial data
  maskCostRate: (rate: number | null, userRole: string): string => {
    if (userRole !== 'admin' || rate === null) {
      return '****';
    }
    return `$${rate.toFixed(2)}`;
  },

  // Mask hourly rates
  maskHourlyRate: (rate: number | null, userRole: string): string => {
    if (userRole !== 'admin' || rate === null) {
      return '****';
    }
    return `$${rate.toFixed(2)}/hr`;
  },

  // Mask email for non-admin users
  maskEmail: (email: string, userRole: string, isOwnProfile: boolean): string => {
    if (userRole === 'admin' || isOwnProfile) {
      return email;
    }
    return secureData.maskEmail(email);
  },

  // Mask phone numbers
  maskPhone: (phone: string | null, userRole: string): string => {
    if (userRole !== 'admin' || !phone) {
      return '****';
    }
    return phone;
  },

  // Mask sensitive profile data
  maskProfileData: (profile: any, currentUserRole: string, isOwnProfile: boolean = false) => {
    return {
      ...profile,
      cost_rate: dataMasking.maskCostRate(profile.cost_rate, currentUserRole),
      hourly_rate: dataMasking.maskHourlyRate(profile.hourly_rate, currentUserRole),
      email: dataMasking.maskEmail(profile.email, currentUserRole, isOwnProfile),
      // Only show department to admins or own profile
      department: (currentUserRole === 'admin' || isOwnProfile) ? profile.department : '****',
    };
  },

  // Mask client contact information
  maskClientData: (client: any, userRole: string, isOwner: boolean = false) => {
    if (userRole === 'admin' || isOwner) {
      return client;
    }
    
    return {
      ...client,
      primary_contact_email: secureData.maskEmail(client.primary_contact_email),
      phone: client.phone ? secureData.maskPhone(client.phone) : null,
      billing_address: '*** (Contact admin for details)',
      tax_id: '****',
    };
  }
};

// Audit logging for sensitive data access
export const auditSensitiveAccess = async (action: string, resourceType: string, resourceId: string, userRole: string) => {
  // Log access to sensitive data for security monitoring
  try {
    const auditData = {
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      user_role: userRole,
      timestamp: new Date().toISOString(),
      ip_address: 'client-side', // In a real app, get from request
    };
    
    // In production, send to your security monitoring system
    console.log('[SECURITY AUDIT]', auditData);
  } catch (error) {
    console.error('Failed to log sensitive data access:', error);
  }
};