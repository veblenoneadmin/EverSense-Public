// TypeScript declarations for internal configuration

export interface InternalConfig {
  ORGANIZATION: {
    name: string;
    slug: string;
    ownerId: string;
    ownerEmail: string;
  };
  MODE: 'internal' | 'multi-tenant';
  FEATURES: {
    publicRegistration: boolean;
    multipleOrganizations: boolean;
    organizationCreation: boolean;
    selfServiceInvites: boolean;
    publicAccess: boolean;
  };
  ADMIN: {
    defaultRole: string;
    allowedRoles: string[];
    requireAdminApproval: boolean;
  };
  UI: {
    hideOrganizationSwitcher: boolean;
    hideCreateOrganization: boolean;
    showAdminNavigation: boolean;
    brandingName: string;
  };
}

export interface UserPermissions {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canManageProjects: boolean;
  canManageTasks: boolean;
  canManageClients: boolean;
  canManageInvoices: boolean;
  canExportData: boolean;
  canDeleteData: boolean;
}

export declare const INTERNAL_CONFIG: InternalConfig;
export declare function isSystemAdmin(userEmail: string): boolean;
export declare function hasAdminAccess(userRole: string): boolean;
export declare function getUserPermissions(userRole: string): UserPermissions;