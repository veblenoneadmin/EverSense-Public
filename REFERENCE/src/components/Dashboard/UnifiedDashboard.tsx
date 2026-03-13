import React, { useState } from 'react';
import { useProfile } from '@/hooks/useDatabase';
import DashboardOverview from './DashboardOverview';
import AdminCommandCenter from '@/components/Admin/AdminCommandCenter';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutDashboard, Settings2 } from 'lucide-react';

const UnifiedDashboard: React.FC = () => {
  const { data: profile } = useProfile();
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Command Center</h1>
            <p className="text-muted-foreground">Administrative dashboard and overview</p>
          </div>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
            <ToggleGroupItem value="dashboard" aria-label="Dashboard View">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </ToggleGroupItem>
            <ToggleGroupItem value="admin" aria-label="Admin View">
              <Settings2 className="h-4 w-4 mr-2" />
              Admin Panel
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {isAdmin && view === 'admin' ? (
        <AdminCommandCenter />
      ) : (
        <DashboardOverview />
      )}
    </div>
  );
};

export default UnifiedDashboard;