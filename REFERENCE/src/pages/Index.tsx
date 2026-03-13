import React from 'react';
import StaffWorkspace from '@/components/Workspace/StaffWorkspace';
import UnifiedDashboard from '@/components/Dashboard/UnifiedDashboard';
import ClientPortal from '@/components/Client/ClientPortal';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useDatabase';

const Index = () => {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold gradient-text">Veblen CRM</h1>
          <p className="text-muted-foreground">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Route based on user role
  switch (profile?.role) {
    case 'admin':
      return <UnifiedDashboard />;
    case 'manager':
    case 'employee':
      return <UnifiedDashboard />;
    case 'client':
      return <ClientPortal />;
    default:
      return <UnifiedDashboard />; // Default to unified dashboard
  }
};

export default Index;
