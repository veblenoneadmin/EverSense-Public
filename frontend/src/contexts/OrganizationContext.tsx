import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';
import { applyTheme, type Theme } from '../lib/theme';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';
  theme: Theme;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  allOrganizations: Organization[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

// Apply dark theme immediately on load to avoid flash
applyTheme('dark');

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizations = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/organizations?userId=${session.user.id}`, {
        credentials: 'include'
      });

      if (response.ok) {
        let orgs = (await response.json()).organizations || [];

        // If no orgs returned (super admin has no memberships), check super admin status
        if (orgs.length === 0) {
          const checkRes = await fetch('/api/super-admin/check', { credentials: 'include' });
          if (checkRes.ok) {
            const { isSuperAdmin } = await checkRes.json();
            if (isSuperAdmin) {
              const allOrgsRes = await fetch('/api/super-admin/orgs', { credentials: 'include' });
              if (allOrgsRes.ok) {
                orgs = (await allOrgsRes.json()).organizations || [];
              }
            }
          }
        }

        setAllOrganizations(orgs);

        // Set current org to first one if none selected
        if (orgs.length > 0 && !currentOrg) {
          const firstOrg = orgs[0];
          const theme: Theme = firstOrg.theme === 'light' ? 'light' : 'dark';
          applyTheme(theme);
          setCurrentOrg({
            id: firstOrg.id,
            name: firstOrg.name,
            slug: firstOrg.slug,
            role: firstOrg.role || 'OWNER',
            theme,
          });
        }
      } else {
        console.error('Failed to fetch organizations:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrganizations = async () => {
    setIsLoading(true);
    await fetchOrganizations();
  };

  const switchOrganization = (orgId: string) => {
    const org = allOrganizations.find(o => o.id === orgId);
    if (org) {
      const theme: Theme = org.theme === 'light' ? 'light' : 'dark';
      applyTheme(theme);
      setCurrentOrg({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: org.role || 'ADMIN',
        theme,
      });
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [session]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        allOrganizations,
        isLoading,
        switchOrganization,
        refreshOrganizations
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}